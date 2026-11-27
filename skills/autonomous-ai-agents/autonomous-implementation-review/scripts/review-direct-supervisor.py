"""Native supervisor for one disposable review packet."""
import base64
import ctypes
import errno
import json
import os
import signal
import subprocess
import sys
import threading
import time

SETTLEMENT_SECONDS = 2


def capture_pipes(worker, spec):
    exceeded = threading.Event()
    captured = {}
    threads = []

    def drain(name):
        output = bytearray()
        limit = spec[name + "Limit"]
        with getattr(worker, name) as pipe:
            while True:
                chunk = pipe.read1(65536)
                if not chunk:
                    break
                remaining = limit - len(output)
                output.extend(chunk[:remaining])
                if len(chunk) > remaining:
                    exceeded.set()
        captured[name] = base64.b64encode(output).decode("ascii")

    def deliver():
        try:
            with worker.stdin:
                worker.stdin.write(base64.b64decode(spec["input"]))
        except OSError:
            pass

    for target, args in [(deliver, ()), (drain, ("stdout",)), (drain, ("stderr",))]:
        thread = threading.Thread(target=target, args=args, daemon=True)
        thread.start()
        threads.append(thread)
    return captured, threads, exceeded


def settle(worker, active, threads):
    # Windows may report an empty Job before its leader handle is signaled.
    # Pipe EOF is a separate observation and may arrive after the leader exits.
    try:
        worker.wait(timeout=SETTLEMENT_SECONDS)
    except subprocess.TimeoutExpired:
        pass
    tree_deadline = time.monotonic() + SETTLEMENT_SECONDS
    while active(worker) and time.monotonic() < tree_deadline:
        time.sleep(0.01)
    drain_deadline = time.monotonic() + SETTLEMENT_SECONDS
    for thread in threads:
        thread.join(max(0, drain_deadline - time.monotonic()))
    code = worker.poll()
    return code, code is not None and not active(worker) and not any(thread.is_alive() for thread in threads)


def supervise(spec, canceled, spawn, active, kill, *, descendant_grace=0):
    deadline = time.monotonic() + spec["timeoutMs"] / 1000
    if canceled.is_set() or time.monotonic() >= deadline:
        return dict(outcome="canceled", quiescent=True, code=None, signal=None, stdout="", stderr="")
    worker = spawn(spec)
    captured, threads, exceeded = capture_pipes(worker, spec)
    outcome = None
    grace_deadline = deadline
    try:
        while True:
            code = worker.poll()
            if code is not None:
                grace_deadline = min(grace_deadline, time.monotonic() + descendant_grace)
            living = active(worker)
            now = time.monotonic()
            if canceled.is_set():
                outcome = "canceled"
            elif exceeded.is_set():
                outcome = "capture-quota"
            elif now >= deadline:
                outcome = "timeout"
            elif code is not None:
                if not living:
                    break
                if now >= grace_deadline:
                    outcome = "surviving-descendants"
            if outcome:
                break
            canceled.wait(max(0, min(0.01, grace_deadline - now)))
    finally:
        if outcome or worker.poll() is None:
            kill(worker)
        code, quiescent = settle(worker, active, threads)
    quiescent = quiescent and {"stdout", "stderr"} <= captured.keys()
    return dict(outcome=outcome or ("capture-quota" if exceeded.is_set() else "exit"), quiescent=quiescent,
                code=code if code is not None and code >= 0 else None,
                signal=signal.Signals(-code).name if code is not None and code < 0 else None,
                stdout=captured.get("stdout", ""), stderr=captured.get("stderr", ""))


def start_worker(spec, **kwargs):
    return subprocess.Popen(spec["argv"], cwd=spec["cwd"], env=spec["env"],
                            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, **kwargs)


def windows_run(spec, canceled):
    import _winapi
    from ctypes import wintypes

    class BasicLimits(ctypes.Structure):
        _fields_ = [("time", ctypes.c_longlong * 2), ("flags", wintypes.DWORD),
                    ("working_set", ctypes.c_size_t * 2), ("active_limit", wintypes.DWORD),
                    ("affinity", ctypes.c_size_t), ("priority", wintypes.DWORD),
                    ("scheduling", wintypes.DWORD)]

    class ExtendedLimits(ctypes.Structure):
        _fields_ = [("basic", BasicLimits), ("io", ctypes.c_ulonglong * 6), ("memory", ctypes.c_size_t * 4)]

    class ProcessIdList(ctypes.Structure):
        _fields_ = [("assigned", wintypes.DWORD), ("returned", wintypes.DWORD),
                    ("pids", ctypes.c_size_t * 4096)]

    kernel = ctypes.WinDLL("kernel32", use_last_error=True)

    def bind(name, result, *arguments):
        fn = getattr(kernel, name)
        fn.restype = result
        fn.argtypes = arguments
        return fn

    handle = wintypes.HANDLE
    dword = wintypes.DWORD
    ptr = ctypes.c_void_p
    create = bind("CreateJobObjectW", handle, ptr, wintypes.LPCWSTR)
    close = bind("CloseHandle", wintypes.BOOL, handle)
    assign = bind("AssignProcessToJobObject", wintypes.BOOL, handle, handle)
    resume = bind("ResumeThread", dword, handle)
    terminate = bind("TerminateJobObject", wintypes.BOOL, handle, wintypes.UINT)
    set_info = bind("SetInformationJobObject", wintypes.BOOL, handle, ctypes.c_int, ptr, dword)
    query = bind("QueryInformationJobObject", wintypes.BOOL, handle, ctypes.c_int, ptr, dword, ptr)
    open_process = bind("OpenProcess", handle, dword, wintypes.BOOL, dword)
    in_job = bind("IsProcessInJob", wintypes.BOOL, handle, handle, ctypes.POINTER(wintypes.BOOL))
    wait = bind("WaitForSingleObject", dword, handle, dword)
    process_access = 0x00100000 | 0x1000  # SYNCHRONIZE | PROCESS_QUERY_LIMITED_INFORMATION

    def check(ok):
        if not ok:
            raise ctypes.WinError(ctypes.get_last_error())

    job = create(None, None)
    check(job)
    try:
        limits = ExtendedLimits()
        limits.basic.flags = 0x2000  # KILL_ON_JOB_CLOSE. No breakaway flag.
        check(set_info(job, 9, ctypes.byref(limits), ctypes.sizeof(limits)))
        create_process = _winapi.CreateProcess

        def joined_process(*args):
            process, thread, pid, tid = create_process(*args)
            try:
                check(assign(job, process))
                check(resume(thread) != 0xffffffff)
                return process, thread, pid, tid
            except BaseException:
                _winapi.TerminateProcess(process, 1)
                _winapi.WaitForSingleObject(process, 2000)
                _winapi.CloseHandle(thread)
                _winapi.CloseHandle(process)
                raise

        def spawn(payload):
            _winapi.CreateProcess = joined_process
            try:
                return start_worker(payload, creationflags=0x00000004 | 0x08000000)
            finally:
                _winapi.CreateProcess = create_process

        def job_pids():
            members = ProcessIdList()
            # JobObjectBasicProcessIdList. A capped or partial list cannot show settlement.
            check(query(job, 3, ctypes.byref(members), ctypes.sizeof(members), None))
            if members.returned != members.assigned or members.returned > len(members.pids):
                raise OSError("Incomplete Windows Job process ID list")
            pids = set(members.pids[:members.returned])
            if len(pids) != members.returned or any(not 0 < pid <= 0xffffffff for pid in pids):
                raise OSError("Invalid Windows Job process ID list")
            return pids

        def active(worker):
            if worker.poll() is None:
                return True
            pids = job_pids() - {worker.pid}
            if not pids:
                return False
            handles = []
            exited = {worker.pid}
            try:
                for pid in pids:
                    process = open_process(process_access, False, pid)
                    if not process:
                        error = ctypes.get_last_error()
                        if error == 87:  # ERROR_INVALID_PARAMETER for a vanished nonzero PID.
                            continue
                        raise ctypes.WinError(error)
                    handles.append(process)
                    member = wintypes.BOOL()
                    check(in_job(process, job, ctypes.byref(member)))
                    if not member.value:
                        continue
                    status = wait(process, 0)
                    if status == 0x102:  # WAIT_TIMEOUT
                        return True
                    check(status != 0xffffffff)  # WAIT_FAILED
                    if status != 0:  # WAIT_OBJECT_0
                        raise OSError("Unexpected Windows process wait status")
                    exited.add(pid)
                # A child can spawn between the first enumeration and its exit.
                # Confirm that only exited members remain, holding their handles
                # to pin their identities until the second enumeration.
                return not job_pids().issubset(exited)
            finally:
                for process in handles:
                    close(process)

        def kill(_worker):
            check(terminate(job, 1))

        return supervise(spec, canceled, spawn, active, kill, descendant_grace=0.250)
    finally:
        close(job)


def macos_run(spec, canceled):
    # Live callers also constrain process creation before exec. Groups alone
    # are only sufficient for fixtures whose child behavior is controlled.
    if spec.get("noFork"):
        spec = {**spec, "argv": [sys.executable, "-I", "-B", __file__, "--macos-leader", *spec["argv"]]}
    def active(worker):
        try:
            os.killpg(worker.pid, 0)
            return True
        except ProcessLookupError:
            return False

    def kill(worker):
        try:
            os.killpg(worker.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass

    return supervise(spec, canceled, lambda payload: start_worker(payload, start_new_session=True), active, kill)


def macos_no_fork():
    import resource

    if sys.platform != "darwin" or os.getuid() == 0 or os.geteuid() == 0:
        raise OSError("macOS process-creation limit requires an unprivileged native process")
    resource.setrlimit(resource.RLIMIT_NPROC, (0, 0))
    if resource.getrlimit(resource.RLIMIT_NPROC) != (0, 0):
        raise OSError("macOS process-creation limit was not applied")


def macos_probe():
    macos_no_fork()
    for start in [os.fork, lambda: os.posix_spawn("/usr/bin/true", ["/usr/bin/true"], {})]:
        try:
            pid = start()
        except OSError as error:
            if error.errno == errno.EAGAIN:
                continue
            raise
        if pid == 0:
            os._exit(1)
        os.waitpid(pid, 0)
        raise OSError("macOS allowed child creation under RLIMIT_NPROC=0")
    print("macos-nproc-zero", flush=True)


def main():
    if sys.argv[1:] == ["--macos-probe"]:
        macos_probe()
        return
    if sys.argv[1:2] == ["--macos-leader"]:
        macos_no_fork()
        os.execve(sys.argv[2], sys.argv[2:], os.environ)
    spec = json.loads(sys.stdin.buffer.readline())
    canceled = threading.Event()

    def control():
        sys.stdin.buffer.read(1)
        canceled.set()

    threading.Thread(target=control, daemon=True).start()
    if sys.platform == "linux":
        # The existing kernel subreaper also observes descendants that leave the
        # leader's process group, without changing the implementer supervisor.
        sys.path.insert(0, os.path.dirname(__file__))
        from importlib import import_module
        run = import_module("bounded-worker").run
        result = run(spec, observe=lambda *_: "canceled" if canceled.is_set() else None)
    elif sys.platform == "win32":
        result = windows_run(spec, canceled)
    elif sys.platform == "darwin":
        result = macos_run(spec, canceled)
    else:
        raise OSError("unsupported supervisor platform")
    print(json.dumps(result), flush=True)
    # The daemon control thread may be blocked on stdin at interpreter exit.
    os._exit(0)


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, AttributeError, RuntimeError) as error:
        print(json.dumps(dict(error=type(error).__name__)), flush=True)
        os._exit(1)
