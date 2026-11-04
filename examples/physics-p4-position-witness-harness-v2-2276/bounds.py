"""Bounded subprocess and evidence IO. No candidate, arithmetic or World imports."""
import hashlib
import json
import math
import os
from pathlib import Path
import selectors
import signal
import subprocess
import sys
import tempfile
import time

REQUEST_BYTES = REPLY_BYTES = 2 * 1024 * 1024
EVIDENCE_BYTES = 16 * 1024 * 1024
TERMINAL_RESERVE = 65536
RETAINED_BYTES = 64 * 1024 * 1024


def require(ok, reason):
    if not ok:
        raise ValueError(reason)


def pin(path):
    path = Path(path)
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(65536), b''):
            digest.update(block)
    return dict(bytes=path.stat().st_size, sha256=digest.hexdigest())


def authenticate(root, manifest):
    for name, expected in manifest.items():
        path = Path(name) if Path(name).is_absolute() else root / name
        require(pin(path) == expected, 'INPUT_DRIFT:' + name)


def retained_size(*values):
    """Explicit retained Python objects, with shared references charged once; not RSS."""
    seen, total, pending = set(), 0, list(values)
    while pending:
        value = pending.pop()
        if id(value) in seen:
            continue
        seen.add(id(value))
        total += sys.getsizeof(value)
        require(total <= RETAINED_BYTES, 'EXPLICIT_RETAINED_DATA_LIMIT')
        if isinstance(value, dict):
            pending.extend(value.keys())
            pending.extend(value.values())
        elif isinstance(value, (list, tuple)):
            pending.extend(value)
    return total


class Evidence:
    def __init__(self, directory):
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=False)
        self.bytes = 0

    def adopt(self, path, per_file_cap=REPLY_BYTES):
        path = Path(path)
        require(path.is_file() and not path.is_symlink() and path.resolve().is_relative_to(self.directory.resolve()), 'OWNED_EVIDENCE_FILE')
        size = path.stat().st_size
        require(size <= per_file_cap and self.bytes + size <= EVIDENCE_BYTES - TERMINAL_RESERVE, 'ADOPTED_EVIDENCE_LIMIT')
        self.bytes += size
        return pin(path)

    def put(self, name, value, terminal=False):
        require(Path(name).name == name, 'EVIDENCE_NAME')
        raw = value if isinstance(value, bytes) else (json.dumps(value, separators=(',', ':'), allow_nan=False) + '\n').encode()
        cap = EVIDENCE_BYTES if terminal else EVIDENCE_BYTES - TERMINAL_RESERVE
        require(self.bytes + len(raw) <= cap, 'TOTAL_EVIDENCE_LIMIT')
        with (self.directory / name).open('xb') as stream:
            stream.write(raw)
        self.bytes += len(raw)
        return dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())


def command(argv, request, cwd, deadline):
    """Root-only command. Local wall deadline includes bounded output collection."""
    require(isinstance(request, bytes) and len(request) <= REQUEST_BYTES, 'REQUEST_LIMIT')
    timeout_ms = math.floor((deadline - time.monotonic()) * 1000)
    require(timeout_ms > 0, 'NO_REMAINING_TIME')
    started = time.monotonic()
    child_deadline = min(deadline, started + timeout_ms / 1000)
    buffers = {'stdout': bytearray(), 'stderr': bytearray()}
    observed = {'stdout': 0, 'stderr': 0}
    child, failure = None, None
    with tempfile.TemporaryFile() as stdin:
        stdin.write(request)
        stdin.seek(0)
        try:
            child = subprocess.Popen(argv, cwd=cwd, stdin=stdin, stdout=subprocess.PIPE,
                                     stderr=subprocess.PIPE, start_new_session=True)
            with selectors.DefaultSelector() as selection:
                for key in buffers:
                    stream = getattr(child, key)
                    os.set_blocking(stream.fileno(), False)
                    selection.register(stream, selectors.EVENT_READ, key)
                while selection.get_map():
                    remaining_ms = math.floor((child_deadline - time.monotonic()) * 1000)
                    require(remaining_ms > 0, 'COMMAND_DEADLINE')
                    for event, _ in selection.select(min(remaining_ms, 100) / 1000):
                        data = os.read(event.fd, 65536)
                        if not data:
                            selection.unregister(event.fileobj)
                            continue
                        observed[event.data] += len(data)
                        cap = REPLY_BYTES if event.data == 'stdout' else TERMINAL_RESERVE
                        require(len(buffers[event.data]) + len(data) <= cap, 'COMMAND_OUTPUT_LIMIT:' + event.data)
                        buffers[event.data].extend(data)
                remaining_ms = math.floor((child_deadline - time.monotonic()) * 1000)
                require(remaining_ms > 0, 'COMMAND_EXIT_DEADLINE')
                child.wait(timeout=remaining_ms / 1000)
                require(child.returncode == 0, 'COMMAND_EXIT:' + str(child.returncode))
        except Exception as error:
            failure = dict(type=type(error).__name__, message=str(error))
        finally:
            if child is not None and child.poll() is None:
                os.killpg(child.pid, signal.SIGKILL)
                child.wait(timeout=2)
            if child is not None:
                for key in buffers:
                    getattr(child, key).close()
    return dict(status='PASS_COMMAND_ONLY' if failure is None else 'NO_GO_COMMAND',
                argv=argv, timeoutMs=timeout_ms, exit=None if child is None else child.returncode,
                firstFailure=failure, elapsedWallNs=round((time.monotonic()-started)*1e9),
                stdout=bytes(buffers['stdout']), stderr=bytes(buffers['stderr']),
                outputBytes={key: {'observed': observed[key], 'captured': len(buffers[key]),
                                  'omitted': observed[key] - len(buffers[key])} for key in buffers},
                boundary='Subprocess wall time is not candidate core CPU time')
