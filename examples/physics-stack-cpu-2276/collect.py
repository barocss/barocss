"""Closed synthetic process census. OS CPU after exact wait, not worker timing."""
import json
import os
from pathlib import Path
import resource
import selectors
import signal
import subprocess
import sys
import time

HOME = Path(__file__).resolve().parent
PROTOCOL = 'stack-cpu-synthetic-v1'
NODE = '/Users/user/.volta/tools/image/node/22.19.0/bin/node'
CASES = ('clean', 'grandchild', 'parent', 'node-tree', 'error', 'wait')
_active = False


class CollectionError(ValueError):
    pass


def need(value, reason):
    if not value:
        raise CollectionError(reason)


def usage(who):
    value = resource.getrusage(who)
    return dict(userUs=round(value.ru_utime * 1000000), systemUs=round(value.ru_stime * 1000000),
                maxrssBytes=value.ru_maxrss)


def validate_start(active):
    need(active is False, 'OVERLAPPING_COLLECTION')
    need(sys.platform == 'darwin', 'DARWIN_ONLY')
    need(os.getpgrp() > 1, 'INVALID_OWNED_GROUP')
    need(signal.getsignal(signal.SIGCHLD) == signal.SIG_DFL, 'NORMAL_SIGCHLD_REQUIRED')


def os_match(sample):
    before, after, waited = sample['childrenBefore'], sample['childrenAfter'], sample['wait4Usage']
    need(sample['reaped'] is True and waited is not None and sample['pipeEof'] is True,
         'REAP_OR_EOF_UNAVAILABLE')
    delta = {key: after[key] - before[key] for key in ('userUs', 'systemUs')}
    need(all(value >= 0 for value in delta.values()), 'NONMONOTONIC_OS_CPU')
    # Independent OS cross-check. Never add this wait4 observation to the delta.
    need(all(abs(delta[key] - waited[key]) <= 2 for key in delta), 'OS_WAIT4_AGGREGATE_DISAGREEMENT')
    return delta


def classify(sample, case):
    """Fail-closed receipt interpretation; fault controls call this without spawning."""
    try:
        need(case in CASES, 'UNKNOWN_CASE')
        cpu = os_match(sample)
        need(sample['ioFailure'] is None and sample['stderrBytes'] == 0, 'IO_CLOSURE_INVALID')
        records = sample['records']
        need(type(records) is list and 1 <= len(records) <= 2, 'CLOSURE_RECEIPT_UNAVAILABLE')
        final = records[-1]
        need(final['protocol'] == PROTOCOL and final['pid'] == sample['pid']
             and final['ppid'] == sample['ownerPid'] and final['pgid'] == sample['pgid'],
             'IDENTITY_OR_GROUP_MISMATCH')
        need(final['allReaped'] is True, 'DESCENDANT_CREDIT_UNAVAILABLE')
        if case == 'node-tree':
            need(final['kind'] == 'node-tree' and len(records) == 2, 'NODE_CLOSURE_UNAVAILABLE')
            started = records[0]
            need(started['kind'] == 'started-tree' and started['pid'] == sample['pid'], 'NODE_REGISTRATION_UNAVAILABLE')
            children = final['children']
            need(len(children) == 3 and len({c['pid'] for c in children}) == 3, 'THREE_CHILDREN_REQUIRED')
            need([c['role'] for c in children] == ['geometry', 'position0', 'position1'], 'CHILD_ROLE_MISMATCH')
            need(started['childPids'] == [c['pid'] for c in children], 'CHILD_REGISTRATION_MISMATCH')
            for child in children:
                need(child['protocol'] == PROTOCOL and child['kind'] == 'leaf'
                     and child['pid'] > 1 and child['ppid'] == sample['pid']
                     and child['pgid'] == sample['pgid'] and child['children'] == []
                     and child['allReaped'] is True and child['closeCode'] == 0
                     and child['closeSignal'] is None and child['stdoutEof'] is True,
                     'NODE_DESCENDANT_CLOSURE_UNAVAILABLE')
            worker = final['worker']
            need(worker['pid'] == sample['pid'] and worker['threadId'] > 0
                 and worker['exit'] == 0 and worker['joined'] is True, 'WORKER_JOIN_UNAVAILABLE')
            need(sample['exitCode'] == 0 and not sample['timedOut'], 'NODE_EXECUTION_INCOMPLETE')
        elif case == 'parent':
            need(final['kind'] == 'parent' and len(final['children']) == 1, 'GRANDCHILD_CLOSURE_UNAVAILABLE')
            child = final['children'][0]
            need(child['pid'] != sample['pid'] and child['ppid'] == sample['pid']
                 and child['pgid'] == sample['pgid'] and child['kind'] == 'leaf'
                 and child['children'] == [] and child['allReaped'] is True,
                 'GRANDCHILD_IDENTITY_INVALID')
            need(final['childWaitComplete'] is True and final['childExitCode'] == 0
                 and final['childCpuStatus'] == 'CPU_COMPLETE', 'GRANDCHILD_WAIT_UNAVAILABLE')
            grand_cpu = final['childWait4CpuUs']
            need(cpu['userUs'] + cpu['systemUs'] + 2 >= grand_cpu['userUs'] + grand_cpu['systemUs'],
                 'DESCENDANT_CPU_NOT_CREDITED')
            need(sample['exitCode'] == 0 and not sample['timedOut'], 'PARENT_EXECUTION_INCOMPLETE')
        else:
            need(final['kind'] == 'leaf' and final['children'] == [], 'KNOWN_LEAF_REQUIRED')
            need(final['role'] == case, 'LEAF_ROLE_MISMATCH')
            if case == 'wait':
                need(sample['waitIdentityAdmitted'] is True and sample['timedOut'] is True
                     and sample['exitCode'] in (-signal.SIGTERM, -signal.SIGKILL),
                     'EXPECTED_LEAF_TIMEOUT_UNAVAILABLE')
            else:
                need(not sample['timedOut'] and sample['exitCode'] == (7 if case == 'error' else 0),
                     'LEAF_EXECUTION_MISMATCH')
        return dict(status='CPU_COMPLETE', completeChildCpuUs=cpu,
                    execution='TIMEOUT' if sample['timedOut'] else 'FAILED' if sample['exitCode'] else 'CLEAN',
                    authority='ONE_RUSAGE_CHILDREN_DELTA_AFTER_EXACT_WAIT_AND_CLOSED_DESCENDANTS',
                    wait4IsCrosscheckOnly=True, workerCpuAddedSeparately=False)
    except (CollectionError, KeyError, TypeError, ValueError, IndexError) as error:
        return dict(status='CPUUNKNOWN', completeChildCpuUs=None, reason=str(error)[:512],
                    authority='INCOMPLETE_REAP_OR_CLOSURE_NOT_ZERO_CPU')


def collect(case):
    global _active
    validate_start(_active)
    need(type(case) is str and case in CASES, 'UNKNOWN_CASE')
    _active = True
    process = None
    selector = selectors.DefaultSelector()
    before = usage(resource.RUSAGE_CHILDREN)
    owner_self_before = usage(resource.RUSAGE_SELF)
    sample = dict(case=case, ownerPid=os.getpid(), pgid=os.getpgrp(), pid=None,
                  childrenBefore=before, childrenAfter=None, wait4Usage=None, reaped=False,
                  pipeEof=False, timedOut=False, exitCode=None, records=[], ioFailure=None,
                  stdoutBytes=0, stderrBytes=0, signals=[], waitIdentityAdmitted=False)
    sample['waitOwnershipLost'] = False
    stdout, stderr = bytearray(), bytearray()
    try:
        if case == 'node-tree':
            command = [NODE, str(HOME / 'tree.mjs'), sys.executable, str(HOME / 'leaf.py'), str(os.getpgrp())]
        else:
            command = [sys.executable, '-B', str(HOME / 'leaf.py'), case]
        # Never detach. This owner and every descendant inherit the ONE outer group.
        process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE, bufsize=0, start_new_session=False)
        sample['pid'] = process.pid
        need(os.getpgid(process.pid) == sample['pgid'], 'CHILD_ESCAPED_GROUP')
        for stream, label in ((process.stdout, 'stdout'), (process.stderr, 'stderr')):
            os.set_blocking(stream.fileno(), False)
            selector.register(stream, selectors.EVENT_READ, label)
        hard_deadline = deadline = time.monotonic() + 5.0
        term_at = None
        kill_at = None
        while True:
            if not sample['reaped']:
                pid, status, consumed = os.wait4(process.pid, os.WNOHANG)
                if pid:
                    need(pid == process.pid, 'WRONG_WAIT_PID')
                    sample['reaped'] = True
                    sample['exitCode'] = os.waitstatus_to_exitcode(status)
                    process.returncode = sample['exitCode']  # Prevent Popen destructor from stealing/retrying wait.
                    sample['wait4Usage'] = dict(userUs=round(consumed.ru_utime * 1000000),
                                                systemUs=round(consumed.ru_stime * 1000000),
                                                maxrssBytes=consumed.ru_maxrss)
            if sample['reaped'] and not selector.get_map():
                sample['pipeEof'] = True
                break
            now = time.monotonic()
            if now >= deadline and term_at is None and not sample['reaped']:
                sample['timedOut'] = True
                try:
                    os.kill(process.pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass  # Exact wait below still owns this child's unreaped status.
                sample['signals'].append('SIGTERM'); term_at = now
            if term_at is not None and now >= term_at + 0.2 and kill_at is None and not sample['reaped']:
                try:
                    os.kill(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                sample['signals'].append('SIGKILL'); kill_at = now
            if now >= deadline + 2.0:
                sample['ioFailure'] = 'BOUNDED_REAP_OR_DRAIN_UNAVAILABLE'
                break
            for key, _ in selector.select(0.01):
                chunk = os.read(key.fd, 4096)
                if not chunk:
                    selector.unregister(key.fileobj)
                    continue
                target, cap = (stdout, 16384) if key.data == 'stdout' else (stderr, 4096)
                if len(target) + len(chunk) > cap:
                    sample['ioFailure'] = key.data.upper() + '_BOUND'
                    # Retain only bounded prefix; incomplete output cannot qualify CPU closure.
                    target.extend(chunk[:max(0, cap - len(target))])
                else:
                    target.extend(chunk)
                if case == 'wait' and not sample['waitIdentityAdmitted'] and key.data == 'stdout' and stdout.endswith(b'\n'):
                    ready = json.loads(stdout)
                    need(ready['protocol'] == PROTOCOL and ready['kind'] == 'leaf'
                         and ready['role'] == 'wait' and ready['pid'] == process.pid
                         and ready['ppid'] == os.getpid() and ready['pgid'] == sample['pgid']
                         and ready['children'] == [] and ready['allReaped'] is True,
                         'TIMEOUT_LEAF_IDENTITY_NOT_ADMITTED')
                    sample['waitIdentityAdmitted'] = True
                    deadline = min(hard_deadline, time.monotonic() + 0.150)
        if stdout:
            try:
                need(stdout.endswith(b'\n'), 'PARTIAL_STDOUT')
                lines = stdout.splitlines()
                need(len(lines) <= 2, 'EXCESS_CLOSURE_RECORDS')
                sample['records'] = [json.loads(line) for line in lines]
            except (CollectionError, ValueError, UnicodeError) as error:
                sample['ioFailure'] = str(error)[:512]
    except ChildProcessError as error:
        # Never signal a PID whose wait ownership has been lost; it may be reused.
        sample['waitOwnershipLost'] = True
        sample['ioFailure'] = str(error)[:512]
    except (OSError, CollectionError, ValueError, KeyError, TypeError) as error:
        sample['ioFailure'] = str(error)[:512]
    finally:
        if process is not None and not sample['reaped'] and not sample['waitOwnershipLost']:
            # Exact owned PID only. A missing descendant closure remains UNKNOWN.
            try:
                try:
                    os.kill(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                limit = time.monotonic() + 0.5
                while time.monotonic() < limit:
                    pid, status, consumed = os.wait4(process.pid, os.WNOHANG)
                    if pid:
                        process.returncode = os.waitstatus_to_exitcode(status)
                        sample['reaped'] = True; sample['exitCode'] = process.returncode
                        sample['wait4Usage'] = dict(userUs=round(consumed.ru_utime * 1000000),
                                                    systemUs=round(consumed.ru_stime * 1000000),
                                                    maxrssBytes=consumed.ru_maxrss)
                        break
                    time.sleep(0.005)
            except OSError as error:
                sample['ioFailure'] = str(error)[:512]
        selector.close()
        if process is not None:
            for stream in (process.stdin, process.stdout, process.stderr):
                stream.close()
        sample['stdoutBytes'] = len(stdout); sample['stderrBytes'] = len(stderr)
        sample['stdoutText'] = stdout.decode('utf8', errors='replace')
        sample['stderrText'] = stderr.decode('utf8', errors='replace')
        # ONE aggregate after all reached wait/close actions. Never per-descendant summed deltas.
        sample['childrenAfter'] = usage(resource.RUSAGE_CHILDREN)
        sample['ownerSelfBefore'] = owner_self_before
        sample['ownerSelfAfterBeforeReceipt'] = usage(resource.RUSAGE_SELF)
        sample['rssBoundary'] = 'DARWIN_BYTES_CHILD_MAX_NOT_SIMULTANEOUS_TREE_RSS_NO_CAP'
        sample['qualification'] = classify(sample, case)
        _active = False
    return sample
