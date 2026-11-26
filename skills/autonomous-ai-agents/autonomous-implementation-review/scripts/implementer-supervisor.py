"""Persist the original bounded supervisor's identities and settlement outside the worker."""
import hashlib
import importlib.util
import json
import os
import stat
import sys
import time
import uuid

helper = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bounded-worker.py")
module_spec = importlib.util.spec_from_file_location("bounded_worker", helper)
bounded = importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(bounded)


def identity(pid):
    if type(pid) is not int or pid <= 0:
        raise ValueError("invalid process ID")
    proc_root = "/proc"
    stat_path = os.path.join(proc_root, str(pid), "stat")
    canonical = os.path.realpath(stat_path)
    if os.path.commonpath((proc_root, canonical)) != proc_root or canonical != stat_path:
        raise ValueError("noncanonical process stat path")
    with open("/proc/sys/kernel/random/boot_id", encoding="ascii") as fd:
        boot = fd.read().strip()
    with os.fdopen(os.open(canonical, os.O_RDONLY | os.O_NOFOLLOW), encoding="ascii") as fd:
        # The process name may contain spaces and other delimiter-looking characters.
        tail = fd.read().rsplit(")", 1)[1].split()
    return {"pid": pid, "start": tail[19], "session": tail[3], "boot": boot,
            "namespace": str(os.stat("/proc/self/ns/pid").st_ino)}


class Attempt:
    def __init__(self, directory, digest):
        if (not isinstance(directory, str) or not os.path.isabs(directory)
                or os.path.normpath(directory) != directory
                or any(ord(character) < 32 or ord(character) == 127 for character in directory)
                or os.path.realpath(directory, strict=True) != directory):
            raise ValueError("noncanonical supervisor state directory")
        self.directory = os.open(directory, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        state = os.fstat(self.directory)
        if state.st_uid != os.getuid() or stat.S_IMODE(state.st_mode) != 0o700:
            raise OSError("unsafe supervisor state directory")
        with os.fdopen(os.open("spawn.json", os.O_RDONLY | os.O_NOFOLLOW, dir_fd=self.directory), "rb") as source:
            raw = source.read(1024 * 1024)
        if hashlib.sha256(raw).hexdigest() != digest:
            raise ValueError("spawn intent changed")
        self.spec = json.loads(raw)
        self.binding = self.spec.pop("binding")
        self.limit = self.spec.pop("maxTurns")
        deadline_ms = self.spec.pop("deadlineMs", None)
        if deadline_ms is not None:
            remaining = (deadline_ms - time.time_ns() // 1_000_000) / 1000
            self.spec["monotonicDeadline"] = time.monotonic() + remaining
        self.identity = identity(os.getpid())
        self.session = None
        self.turns = 0
        self.waiting = None
        self.unparsed = b""
        self.started = time.monotonic()
        self.save("supervisor.json", {"process": self.identity})

    def save(self, name, record):
        record = {"binding": self.binding, **record}
        tmp = ".new-" + str(uuid.uuid4())
        with os.fdopen(os.open(tmp, os.O_CREAT | os.O_EXCL | os.O_WRONLY | os.O_NOFOLLOW,
                               0o600, dir_fd=self.directory), "wb") as handle:
            handle.write((json.dumps(record, sort_keys=True, ensure_ascii=False, separators=(",", ":")) + "\n").encode())
            os.fchmod(handle.fileno(), 0o400)
            handle.flush()
            os.fsync(handle.fileno())
        os.link(tmp, name, src_dir_fd=self.directory, dst_dir_fd=self.directory, follow_symlinks=False)
        os.unlink(tmp, dir_fd=self.directory)
        os.fsync(self.directory)

    def start(self, pid):
        self.save("worker.json", {"process": identity(pid), "supervisor": self.identity})

    def delivered(self):
        self.save("delivered.json", {"supervisor": self.identity})

    def observe(self, chunk=None):
        if chunk is None:
            try:
                descriptor = os.open("cancel.json", os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=self.directory)
            except FileNotFoundError:
                return None
            with os.fdopen(descriptor, "rb") as source:
                state = os.fstat(source.fileno())
                if not stat.S_ISREG(state.st_mode) or stat.S_IMODE(state.st_mode) != 0o400 or state.st_size > 4096:
                    return "control-failed"
                cancel = json.load(source)
            return "cancelled" if cancel == {"binding": self.binding, "process": self.identity} else "control-failed"
        complete = (self.unparsed + chunk).split(b"\n")
        self.unparsed = complete.pop()
        for line in complete:
            try:
                event = json.loads(line)
            except (ValueError, UnicodeError, RecursionError):
                continue
            if not isinstance(event, dict):
                continue
            if event.get("type") == "thread.started" and not self.session:
                session = event.get("thread_id")
                if isinstance(session, str):
                    try:
                        if str(uuid.UUID(session)) == session:
                            self.session = session
                            self.save("session.json", {"session": session, "supervisor": self.identity})
                    except ValueError:
                        pass
            if event.get("type") == "turn.started":
                self.turns += 1
                if self.turns > self.limit:
                    return "supervisor-turn-limit"
            if self.session and event.get("thread_id") == self.session:
                request = event.get("request_id")
                if (event.get("type") == "approval.requested" and event.get("kind") in ("approval", "credential")
                        and isinstance(request, str) and 0 < len(request) <= 256 and self.waiting is None):
                    self.waiting = request
                    self.save("wait.json", {"session": self.session, "kind": event["kind"], "request": request,
                                            "supervisor": self.identity})
                elif (event.get("type") == "approval.resolved" and self.waiting is not None and self.waiting == request
                        and event.get("decision") == "approved" and event.get("by") == "operator"):
                    self.save("resumed.json", {"session": self.session, "request": request, "supervisor": self.identity})
        return None

    def run(self):
        result = bounded.run(self.spec, self.start, self.delivered, self.observe)
        self.save("settlement.json", {"process": self.identity, "result": result,
                                      "elapsedMs": round((time.monotonic() - self.started) * 1000)})


if __name__ == "__main__":
    try:
        Attempt(sys.argv[1], sys.argv[2]).run()
    except (OSError, ValueError, RuntimeError, RecursionError):
        sys.exit(1)
