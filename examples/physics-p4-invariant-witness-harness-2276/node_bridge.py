"""One owned Node22 worker. Raw data RPC only; no proof arithmetic in Python."""
import hashlib
import json
import math
import os
from pathlib import Path
import resource
import selectors
import signal
import subprocess
import sys
import time

PROTOCOL = 'p4-native-witness-rpc-v1'
LINE_LIMIT = 2 * 1024 * 1024
TRANSPORT_LIMIT = 4 * 1024 * 1024
STDERR_LIMIT = 65536


def need(ok, reason):
    if not ok:
        raise ValueError(reason)


def owned(value):
    total, seen, pending = 0, set(), [value]
    while pending:
        item = pending.pop()
        if id(item) in seen:
            continue
        seen.add(id(item)); total += sys.getsizeof(item)
        need(total <= TRANSPORT_LIMIT, 'RPC_EXPLICIT_TRANSPORT_LIMIT')
        if isinstance(item, dict):
            pending.extend(item.keys()); pending.extend(item.values())
        elif isinstance(item, (tuple, list)):
            pending.extend(item)
    return total


def cpu_snapshot():
    usage = resource.getrusage(resource.RUSAGE_CHILDREN)
    return dict(userSeconds=usage.ru_utime, systemSeconds=usage.ru_stime)


class NativeWorker:
    def __init__(self, node, script, cwd, deadline):
        self.node, self.script, self.cwd, self.deadline = node, script, cwd, deadline
        self.process = self.selection = None
        self.calls, self.starts, self.closed = 0, 0, False
        self.output, self.stderr = bytearray(), bytearray()
        self.sent_bytes = self.received_bytes = self.peak_transport = 0
        self.before = self.after = None
        self.child_cpu_ns = None
        self.cleanup_error = None
        self.last_line = b''

    def remaining(self):
        value = math.floor((self.deadline - time.monotonic()) * 1000)
        need(value > 0, 'RPC_SHARED_DEADLINE')
        return value

    def _start(self):
        need(self.process is None and self.starts == 0, 'ONE_NATIVE_WORKER_ONLY')
        self.remaining()
        self.before = cpu_snapshot()
        self.process = subprocess.Popen([self.node, self.script], cwd=self.cwd, stdin=subprocess.PIPE,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, bufsize=0, start_new_session=False)
        self.starts += 1
        self.selection = selectors.DefaultSelector()
        for stream, label in ((self.process.stdout, 'stdout'), (self.process.stderr, 'stderr')):
            os.set_blocking(stream.fileno(), False)
            self.selection.register(stream, selectors.EVENT_READ, label)
        os.set_blocking(self.process.stdin.fileno(), False)
        ready = self._decode(self._line())
        need(ready == {'protocol': PROTOCOL, 'type': 'ready'}, 'EXACT_NATIVE_READY_LINE')

    def _line(self, data=None):
        offset = 0
        target_bytes = 0 if data is None else len(data)
        if data is not None:
            need(len(data) <= LINE_LIMIT, 'RPC_REQUEST_LINE_LIMIT')
            self.selection.register(self.process.stdin, selectors.EVENT_WRITE, 'stdin')
        while True:
            if b'\n' in self.output:
                index = self.output.index(10)
                line = bytes(self.output[:index])
                del self.output[:index + 1]
                need(not self.output and (data is None or offset == target_bytes), 'UNSOLICITED_OR_EARLY_NATIVE_LINE')
                self.last_line = line
                return line
            for key, _ in self.selection.select(min(self.remaining(), 100) / 1000):
                if key.data == 'stdin':
                    count = os.write(key.fd, memoryview(data)[offset:offset + 65536])
                    need(count > 0, 'RPC_WRITE_CLOSED')
                    offset += count; self.sent_bytes += count
                    if offset == target_bytes:
                        self.selection.unregister(key.fileobj)
                        data.clear()  # Release outgoing backing before any response decoding.
                else:
                    chunk = os.read(key.fd, 65536)
                    if not chunk:
                        self.selection.unregister(key.fileobj)
                        need(key.data != 'stdout', 'RPC_EOF_BEFORE_REPLY')
                        continue
                    if key.data == 'stderr':
                        need(len(self.stderr) + len(chunk) <= STDERR_LIMIT, 'RPC_STDERR_LIMIT')
                        self.stderr.extend(chunk)
                    else:
                        self.received_bytes += len(chunk)
                        need(len(self.output) + len(chunk) <= LINE_LIMIT, 'RPC_REPLY_LINE_LIMIT')
                        self.output.extend(chunk)

    def _decode(self, raw, retained_bytes=0):
        # Reserve decoding before allocating dense object trees, within parent transport4MiB (child has its separate4MiB)..
        tokens, in_string, escape, atom, depth = 0, False, False, False, 0
        for byte in raw:
            if in_string:
                if escape: escape = False
                elif byte == 92: escape = True
                elif byte == 34: in_string = False
            elif byte == 34:
                tokens += 1; in_string, atom = True, False
            elif byte in (123, 91):
                tokens += 1; depth += 1; atom = False
                need(depth <= 32, 'RPC_JSON_DEPTH')
            elif byte in (125, 93): depth -= 1; atom = False
            elif byte in (9, 10, 13, 32, 44, 58): atom = False
            elif not atom: tokens += 1; atom = True
        reserve = tokens * 192 + len(raw) * 4 + len(self.output) + len(self.stderr) + 1024 * 1024 + retained_bytes
        need(reserve <= TRANSPORT_LIMIT, 'RPC_PARSE_PREALLOCATION')
        self.peak_transport = max(self.peak_transport, reserve)
        value = json.loads(raw)
        self.peak_transport = max(self.peak_transport, owned((raw, value, self.output, self.stderr)))
        return value

    def request(self, problem, result):
        need(not self.closed and self.calls < 6, 'RPC_SIX_CALL_CAP')
        if self.process is None:
            self._start()  # Startup and ready parsing are inside the first context timer.
        self.last_line = b''
        self.calls += 1
        message = dict(protocol=PROTOCOL, id=self.calls, problem=problem, result=result)
        data = bytearray()
        for part in json.JSONEncoder(separators=(',', ':'), allow_nan=False).iterencode(message):
            chunk = part.encode()
            need(len(data) + len(chunk) + 1 <= LINE_LIMIT, 'RPC_REQUEST_LINE_LIMIT')
            data.extend(chunk)
        data.append(10)
        raw = self._line(data)
        need(len(data) == 0, 'OUTGOING_BACKING_RELEASED')
        response = self._decode(raw)
        need(set(response) == {'protocol', 'id', 'reply', 'modelExact'} and
             response['protocol'] == PROTOCOL and type(response['id']) is int and response['id'] == self.calls,
             'EXACT_NATIVE_RPC_RESPONSE')
        self.peak_transport = max(self.peak_transport, owned((raw, data, response, self.output, self.stderr)))
        if self.calls == 6:
            self.close()  # EOF, wait and authoritative CPU read stay inside the sixth context timer.
        return response

    def close(self, force=False):
        if self.closed or self.process is None:
            return
        failure = None
        try:
            if force:
                if self.process.poll() is None:
                    self.process.kill()
                self.process.wait(timeout=2)
            else:
                need(self.calls == 6, 'NORMAL_CLOSE_REQUIRES_SIX_CALLS')
                self.process.stdin.close()
                while self.selection.get_map():
                    for key, _ in self.selection.select(min(self.remaining(), 100) / 1000):
                        chunk = os.read(key.fd, 65536)
                        if not chunk:
                            self.selection.unregister(key.fileobj)
                        elif key.data == 'stderr':
                            need(len(self.stderr) + len(chunk) <= STDERR_LIMIT, 'RPC_STDERR_LIMIT')
                            self.stderr.extend(chunk)
                        else:
                            raise ValueError('UNEXPECTED_NATIVE_OUTPUT_AFTER_SIX_REPLIES')
                self.process.wait(timeout=self.remaining() / 1000)
                need(self.process.returncode == 0, 'NATIVE_WORKER_NONZERO_EXIT')
        except Exception as error:
            failure = error
            self.cleanup_error = dict(type=type(error).__name__, message=str(error))
        finally:
            if self.process.poll() is None:
                self.process.kill()
                try:
                    self.process.wait(timeout=2)
                except Exception as error:
                    self.cleanup_error = dict(type=type(error).__name__, message=str(error))
            if self.process.poll() is not None:
                # Preserve bounded buffered error output after reaping the exact child.
                if force or failure is not None:
                    for stream, target, cap in ((self.process.stdout, self.output, LINE_LIMIT), (self.process.stderr, self.stderr, STDERR_LIMIT)):
                        while True:
                            try:
                                chunk = os.read(stream.fileno(), 65536)
                            except BlockingIOError:
                                break
                            if not chunk:
                                break
                            room = max(0, cap - len(target))
                            target.extend(chunk[:room])
                            if len(chunk) > room and self.cleanup_error is None:
                                self.cleanup_error = dict(type='OutputLimit', message='CLEANUP_OUTPUT_PREFIX_TRUNCATED')
                self.after = cpu_snapshot()  # Only after actual owned-child reap.
                user = self.after['userSeconds'] - self.before['userSeconds']
                system = self.after['systemSeconds'] - self.before['systemSeconds']
                need(user >= 0 and system >= 0, 'CHILD_RESOURCE_CPU_MONOTONIC')
                self.child_cpu_ns = math.ceil((user + system) * 1000000000)
                self.closed = True
            if self.selection is not None:
                self.selection.close()
            for stream in (self.process.stdin, self.process.stdout, self.process.stderr):
                if not stream.closed: stream.close()
        if failure is not None:
            raise failure

    def stats(self):
        return dict(protocol=PROTOCOL, workerStarts=self.starts, requestCalls=self.calls,
                    workerClosed=self.closed, exit=None if self.process is None else self.process.returncode,
                    pid=None if self.process is None else self.process.pid,
                    childCpuAuthority='RESOURCE_RUSAGE_CHILDREN_DELTA_AFTER_CLOSE_AND_WAIT',
                    childLifetimeCpuNs=self.child_cpu_ns, resourceBefore=self.before, resourceAfter=self.after,
                    selfReportedChildCpuUsed=False, sentBytes=self.sent_bytes, receivedBytes=self.received_bytes,
                    parentTransportLimitBytes=TRANSPORT_LIMIT, childTransportReservedBytes=4 * 1024 * 1024,
                    maxExplicitTransportReservedBytes=self.peak_transport, stderrBytes=len(self.stderr),
                    stderrSHA256=hashlib.sha256(self.stderr).hexdigest(), cleanupError=self.cleanup_error,
                    scope='ONE_OWNED_NODE_WORKER_ONLY_NO_PROCESS_RSS_CLAIM')
