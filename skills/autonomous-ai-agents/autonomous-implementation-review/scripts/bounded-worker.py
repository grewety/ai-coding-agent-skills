"""Linux subreaper for a single worker. The control channel belongs to this process."""
import base64
import ctypes
import json
import os
import selectors
import signal
import subprocess
import sys
import time


def reap(worker):
    descendant_signaled = False
    while True:
        try:
            pid, status = os.waitpid(-1, os.WNOHANG)
        except ChildProcessError:
            return True, descendant_signaled
        if pid == 0:
            return False, descendant_signaled
        if pid == worker.pid:
            worker.returncode = os.waitstatus_to_exitcode(status)
        elif os.WIFSIGNALED(status):
            descendant_signaled = True


def kill_children():
    # Adopted descendants are our own waitable children. A pidfd pins the
    # process, and waitid verifies that it is still our child before signaling.
    with open(f"/proc/self/task/{os.getpid()}/children", encoding="ascii") as children:
        pids = children.read().split()
    for pid in pids:
        try:
            fd = os.pidfd_open(int(pid))
        except ProcessLookupError:
            continue
        try:
            try:
                os.waitid(os.P_PIDFD, fd, os.WEXITED | os.WNOHANG | os.WNOWAIT)
                signal.pidfd_send_signal(fd, signal.SIGKILL)
            except (ChildProcessError, ProcessLookupError):
                continue
        finally:
            os.close(fd)


def run(spec, on_started=None, on_delivered=None, observe=None):
    if ctypes.CDLL(None, use_errno=True).prctl(36, 1, 0, 0, 0) != 0:
        raise OSError("subreaper unavailable")
    # Validate the kernel's pidfd and procfs interfaces before starting a worker.
    fd = os.pidfd_open(os.getpid())
    try:
        signal.pidfd_send_signal(fd, 0)
        try:
            os.waitid(os.P_PIDFD, fd, os.WEXITED | os.WNOHANG | os.WNOWAIT)
        except ChildProcessError:
            pass
    finally:
        os.close(fd)
    kill_children()
    now = time.monotonic()
    deadline = min(now + spec["timeoutMs"] / 1000, spec.get("monotonicDeadline", float("inf")))
    if deadline <= now:
        raise ValueError("worker deadline expired before launch")
    grace = spec.get("postLeaderGraceMs", 0) / 1000
    captures = {"stdout": bytearray(), "stderr": bytearray()}
    with selectors.DefaultSelector() as ready:
        worker = subprocess.Popen(spec["argv"], cwd=spec["cwd"], env=spec["env"],
                                  stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        with worker.stdin, worker.stdout, worker.stderr:
            control_failed = False
            if on_started:
                try:
                    on_started(worker.pid)
                except Exception:
                    control_failed = True
            for name in captures:
                pipe = getattr(worker, name)
                os.set_blocking(pipe.fileno(), False)
                ready.register(pipe, selectors.EVENT_READ, name)
            payload = base64.b64decode(spec["input"])
            if payload and not control_failed:
                os.set_blocking(worker.stdin.fileno(), False)
                ready.register(worker.stdin, selectors.EVENT_WRITE, "stdin")
            else:
                worker.stdin.close()
            outcome = None
            delivery_recorded = False
            cleanup_deadline = None
            teardown_deadline = None
            while True:
                quiescent, descendant_signaled = reap(worker)
                now = time.monotonic()
                if outcome is None:
                    if control_failed:
                        stop = "control-failed"
                    else:
                        try:
                            stop = observe() if observe else None
                        except Exception:
                            stop = "control-failed"
                    if stop:
                        outcome = stop
                    elif now >= deadline:
                        outcome = "timeout"
                    elif grace and descendant_signaled:
                        outcome = "surviving-descendants"
                    elif teardown_deadline is not None:
                        if now >= teardown_deadline:
                            outcome = "surviving-descendants"
                    elif worker.returncode is not None and not quiescent:
                        if grace and worker.returncode == 0:
                            teardown_deadline = min(deadline, now + grace)
                        else:
                            outcome = "surviving-descendants"
                    if outcome:
                        cleanup_deadline = now + 2
                if outcome and not quiescent:
                    if now >= cleanup_deadline:
                        break
                    kill_children()
                poll = 0.01
                if outcome is None and teardown_deadline is not None:
                    poll = min(poll, teardown_deadline - now)
                events = ready.select(0 if quiescent else poll)
                for key, _ in events:
                    name = key.data
                    if name == "stdin":
                        try:
                            payload = payload[os.write(key.fd, payload[:65536]):]
                            if not payload and on_delivered and not delivery_recorded:
                                try:
                                    on_delivered()
                                    delivery_recorded = True
                                except Exception:
                                    control_failed = True
                        except BrokenPipeError:
                            payload = b""
                        except BlockingIOError:
                            continue
                        if not payload:
                            ready.unregister(key.fileobj)
                            worker.stdin.close()
                        continue
                    remaining = spec[name + "Limit"] - len(captures[name])
                    try:
                        data = os.read(key.fd, min(65536, remaining + 1))
                    except BlockingIOError:
                        continue
                    if not data:
                        ready.unregister(key.fileobj)
                        continue
                    chunk = data[:remaining]
                    captures[name].extend(chunk)
                    if name == "stdout" and observe and outcome is None:
                        try:
                            stop = observe(chunk)
                        except Exception:
                            stop = "control-failed"
                        if stop:
                            outcome = stop
                            cleanup_deadline = time.monotonic() + 2
                    if len(data) > remaining:
                        if outcome is None:
                            outcome = name + "-quota"
                            cleanup_deadline = time.monotonic() + 2
                        ready.unregister(key.fileobj)
                if quiescent and not events:
                    break
    code = worker.returncode
    return dict(outcome=outcome or "exit", quiescent=quiescent,
                code=code if code is not None and code >= 0 else None,
                signal=signal.Signals(-code).name if code is not None and code < 0 else None,
                **{name: base64.b64encode(data).decode("ascii") for name, data in captures.items()})


if __name__ == "__main__":
    try:
        print(json.dumps(run(json.load(sys.stdin))))
    except (OSError, ValueError, AttributeError) as error:
        print(json.dumps(dict(error=type(error).__name__)))
