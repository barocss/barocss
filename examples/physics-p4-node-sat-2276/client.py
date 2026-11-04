"""One owned nonblocking stdio child, with exact owned-PID wait4 accounting."""
import json
import os
from pathlib import Path
import selectors
import signal
import subprocess
import time

MAX_LINE = 256 * 1024
MAX_STDERR = 64 * 1024


class WorkerFailure(Exception):
    pass


class NodeWorker:
    def __init__(self, executable, worker_path, deadline, log):
        if not hasattr(os, 'wait4'):
            raise WorkerFailure('OWNED_WAIT4_UNAVAILABLE_PERFORMANCE_NOT_RUN')
        self.deadline, self.log = deadline, log
        self.selector = selectors.DefaultSelector()
        self.buffer, self.stderr = bytearray(), bytearray()
        self.stdout_eof = self.stderr_eof = self.reaped = self.failed = False
        self.request_id = self.requests = self.replies = 0
        self.stats = dict(integerOperations=0, peakIntegerBits=0, axisVisits=0, conventionProblems=0)
        self.request_cpu_us = 0
        self.lifecycle = dict(starts=1, ready=0, requests=0, replies=0, parentPgid=os.getpgrp(), signals=[])
        self.process = subprocess.Popen([str(executable), str(worker_path)], stdin=subprocess.PIPE,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, close_fds=True, start_new_session=False)
        self.lifecycle['pid'] = self.process.pid
        self.lifecycle['childPgid'] = os.getpgid(self.process.pid)
        for stream in (self.process.stdin, self.process.stdout, self.process.stderr):
            os.set_blocking(stream.fileno(), False)
        self.selector.register(self.process.stdout, selectors.EVENT_READ, 'stdout')
        self.selector.register(self.process.stderr, selectors.EVENT_READ, 'stderr')
        self.log('start', dict(pid=self.process.pid, executable=str(executable), worker=str(worker_path)))
        try:
            ready = self._read_reply(0, deadline)
            if ready.get('ready') is not True or ready.get('node') != 'v22.19.0':
                raise WorkerFailure('PINNED_NODE_READY_MISMATCH')
            self.lifecycle['ready'] = 1
            self.lifecycle['readyCumulativeCpu'] = ready['cumulativeCpu']
        except BaseException:
            self.failed = True
            self.close()
            raise

    def _events(self, timeout):
        for key, _ in self.selector.select(max(0, timeout)):
            if key.data == 'stdin':
                continue
            try:
                data = os.read(key.fd, 65536)
            except BlockingIOError:
                continue
            if not data:
                self.selector.unregister(key.fileobj)
                if key.data == 'stdout':
                    self.stdout_eof = True
                else:
                    self.stderr_eof = True
            elif key.data == 'stdout':
                if len(self.buffer) + len(data) > MAX_LINE:
                    raise WorkerFailure('CHILD_STDOUT_LINE_LIMIT')
                self.buffer.extend(data)
            else:
                if len(self.stderr) + len(data) > MAX_STDERR:
                    raise WorkerFailure('CHILD_STDERR_LIMIT')
                self.stderr.extend(data)

    def _read_reply(self, expected, deadline):
        while b'\n' not in self.buffer:
            if self.stdout_eof:
                raise WorkerFailure('CHILD_EOF_BEFORE_REPLY:' + self.stderr.decode(errors='replace'))
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise WorkerFailure('CHILD_REPLY_DEADLINE')
            self._events(min(1, remaining))
        line, _, rest = self.buffer.partition(b'\n')
        self.buffer = bytearray(rest)
        reply = json.loads(line)
        self.log('reply', dict(raw=line.decode(), expectedId=expected))
        if reply.get('id') != expected or reply.get('pid') != self.process.pid:
            raise WorkerFailure('CHILD_REPLY_ID_OR_PID')
        self.stats = reply.get('stats', self.stats)
        if expected:
            self.replies += 1
            used = reply.get('requestCpu', {})
            self.request_cpu_us += used.get('userUs', 0) + used.get('systemUs', 0)
        if reply.get('ok') is not True:
            self.failed = True
            raise WorkerFailure('CHILD_TYPED_REFUSAL:' + json.dumps(reply, separators=(',', ':')))
        return reply

    def request(self, operation, **payload):
        self.request_id += 1
        message = dict(id=self.request_id, op=operation, **payload)
        data = json.dumps(message, separators=(',', ':'), allow_nan=False).encode() + b'\n'
        if len(data) > MAX_LINE:
            raise WorkerFailure('PARENT_REQUEST_LINE_LIMIT')
        self.log('request', dict(raw=data.decode().rstrip('\n')))
        self.requests += 1
        offset = 0
        self.selector.register(self.process.stdin, selectors.EVENT_WRITE, 'stdin')
        try:
            while offset < len(data):
                if time.monotonic() >= self.deadline:
                    raise WorkerFailure('CHILD_WRITE_DEADLINE')
                try:
                    count = os.write(self.process.stdin.fileno(), data[offset:offset+65536])
                    if count <= 0:
                        raise WorkerFailure('CHILD_STDIN_CLOSED')
                    offset += count
                except BlockingIOError:
                    self._events(min(0.05, self.deadline-time.monotonic()))
        except BaseException:
            self.failed = True
            raise
        finally:
            try:
                self.selector.unregister(self.process.stdin)
            except KeyError:
                pass
        try:
            return self._read_reply(self.request_id, self.deadline)['result']
        except BaseException:
            self.failed = True
            raise

    def close(self):
        if self.reaped:
            return self.lifecycle
        cleanup_start = time.monotonic()
        cleanup_end = cleanup_start + 5
        if not self.failed and time.monotonic() < self.deadline:
            previous_deadline = self.deadline
            self.deadline = min(self.deadline, cleanup_start + 1)
            try:
                self.request('quit')
            except BaseException as error:
                self.failed = True
                self.lifecycle['quitFailure'] = dict(type=type(error).__name__, message=str(error))
            self.deadline = previous_deadline
        try:
            self.process.stdin.close()
        except OSError:
            pass
        term = kill = False
        usage = None
        while time.monotonic() < cleanup_end and not (self.reaped and self.stdout_eof and self.stderr_eof):
            elapsed = time.monotonic() - cleanup_start
            if not self.reaped and (self.failed or elapsed >= 2) and not term:
                try:
                    os.kill(self.process.pid, signal.SIGTERM)
                    self.lifecycle['signals'].append('SIGTERM_OWN_PID')
                except ProcessLookupError:
                    pass
                term = True
            if not self.reaped and elapsed >= 3.5 and not kill:
                try:
                    os.kill(self.process.pid, signal.SIGKILL)
                    self.lifecycle['signals'].append('SIGKILL_OWN_PID')
                except ProcessLookupError:
                    pass
                kill = True
            try:
                self._events(0.01)
            except Exception as error:
                self.lifecycle.setdefault('drainFailures', []).append(str(error))
                self.failed = True
            if not self.reaped:
                pid, status, result = os.wait4(self.process.pid, os.WNOHANG)
                if pid == self.process.pid:
                    self.reaped, usage = True, result
                    self.process.returncode = os.waitstatus_to_exitcode(status)
                    self.lifecycle['exitCode'] = self.process.returncode
        self.lifecycle.update(requests=self.requests, replies=self.replies, stdoutEOF=self.stdout_eof,
            stderrEOF=self.stderr_eof, reaped=self.reaped, trailingStdoutBytes=len(self.buffer),
            stderr=self.stderr.decode(errors='replace'), cleanupWallNs=round((time.monotonic()-cleanup_start)*1e9),
            requestCpuUsNestedOnly=self.request_cpu_us, lastKernelStats=self.stats)
        if usage is not None:
            self.lifecycle['ownedWait4'] = dict(userSeconds=usage.ru_utime, systemSeconds=usage.ru_stime,
                totalCpuNs=round((usage.ru_utime+usage.ru_stime)*1e9), maxRss=usage.ru_maxrss)
        self.lifecycle['completeCleanLifecycle'] = bool(self.reaped and self.stdout_eof and self.stderr_eof
            and not self.buffer and not self.stderr and self.process.returncode == 0 and usage is not None)
        self.log('cleanup', self.lifecycle)
        for stream in (self.process.stdout, self.process.stderr):
            stream.close()
        self.selector.close()
        return self.lifecycle
