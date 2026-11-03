"""Root only: one fixed data-only Brotli replay; exact wait4 and one after-wait CPU delta."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import resource
import selectors
import signal
import subprocess
import sys
import time


def need(value, reason):
    if not value:
        raise ValueError(reason)


def pin(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(65536), b''):
            digest.update(block)
    return dict(bytes=Path(path).stat().st_size, sha256=digest.hexdigest())


def main():
    need(len(sys.argv) == 3, 'USAGE:screen.py FRESH_OUT REVIEWED_PINS_SHA')
    home = Path(__file__).resolve().parent
    root = home.parents[1]
    need(sys.platform == 'darwin', 'DARWIN_ONLY')
    need(signal.getsignal(signal.SIGCHLD) == signal.SIG_DFL, 'NORMAL_SIGCHLD_REQUIRED')
    if os.getpgrp() != os.getpid():
        os.setpgid(0, 0)
    need(os.getpgrp() == os.getpid() and os.getpid() > 1, 'ONE_OWNED_GROUP_REQUIRED')
    out = Path(sys.argv[1]).resolve()
    out.mkdir(parents=True, exist_ok=False)
    (out / 'host').mkdir()
    started = time.monotonic()
    deadline = started + 170
    self_before = resource.getrusage(resource.RUSAGE_SELF)

    def stop_group(reason):
        try:
            (out / 'outer-stop.json').write_text(json.dumps(dict(status='CPUUNKNOWN', reason=reason,
                completeNodeSubtreeCpuUs=None, ownedPgid=os.getpgrp(), API=False)) + '\n')
        finally:
            os.killpg(os.getpgrp(), signal.SIGKILL)

    signal.signal(signal.SIGALRM, lambda *_: stop_group('ONE_OUTER180S_DEADLINE'))
    signal.setitimer(signal.ITIMER_REAL, 180)
    report = dict(status='CPUUNKNOWN', completeNodeSubtreeCpuUs=None, firstFailure=None,
        ownerPid=os.getpid(), ownedPgid=os.getpgrp(), independentlyFullAccepted=0,
        full1200=False, fullP4Qualification=False, API=False, resourceQualification=False,
        complete64MiBData='NOT_QUALIFIED', RSS='NOT_QUALIFIED', controllerWholeLifetimeCpu='NOT_CLAIMED')
    process = None
    sample = dict(pid=None, ownerPid=os.getpid(), pgid=os.getpgrp(), childrenBefore=None,
        childrenAfter=None, wait4Usage=None, reaped=False, pipeEof=False, exitCode=None,
        timedOut=False, waitOwnershipLost=False, ioFailure=None, signals=[])
    stdout, stderr = bytearray(), bytearray()
    selector = selectors.DefaultSelector()
    closure_ok = False
    tree_closed = False
    try:
        pins_path = home / 'PINS.json'
        need(pins_path.stat().st_size <= 65536, 'PINS64K')
        need(pin(pins_path)['sha256'] == sys.argv[2], 'REVIEWED_PINS_REQUIRED')
        pins = json.loads(pins_path.read_bytes())

        def authenticate():
            need(pin(pins_path)['sha256'] == sys.argv[2], 'PINS_CHANGED')
            need(Path(sys.executable).resolve() == Path(pins['python']).resolve(), 'PYTHON_PATH')
            need(sys.version == pins['pythonVersion'], 'PYTHON_VERSION')
            for name, expected in pins['files'].items():
                need(pin(root / name) == expected, 'PIN_DRIFT:' + name)

        authenticate()
        helper = root / 'examples/physics-stack-cpu-2276/collect.py'
        spec = importlib.util.spec_from_file_location('qualified_afterwait_cpu', helper)
        collector = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(collector)
        collector.validate_start(False)
        prior = json.loads((root / 'examples/physics-stack-cpu-2276/evidence/selftest-01/summary.json').read_bytes())
        need(prior['status'] == 'PASS_SYNTHETIC_DARWIN_CPU_COLLECTION_COMPONENT', 'QUALIFIED_CPU_COMPONENT')
        remaining = min(45000, int((deadline - time.monotonic()) * 1000))
        need(remaining > 0, 'INTERNAL170S_BEFORE_SPAWN')
        command = [pins['node'], str(home / 'replay.mjs'), str(out / 'host'), sys.argv[2],
                   str(remaining), str(os.getpgrp())]
        (out / 'stage.json').write_text(json.dumps(dict(stage='SPAWNING_SEALED_REAL_PREFIX', command=command)) + '\n')
        node_started = time.monotonic()
        replay_deadline = min(deadline, node_started + 45)
        sample['childrenBefore'] = collector.usage(resource.RUSAGE_CHILDREN)
        process = subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
            stderr=subprocess.PIPE, bufsize=0, start_new_session=False)
        sample['pid'] = process.pid
        sample['observedDirectChildPgid'] = os.getpgid(process.pid)
        need(sample['observedDirectChildPgid'] == os.getpgrp(), 'CHILD_ESCAPED_GROUP')
        for stream, name in ((process.stdout, 'stdout'), (process.stderr, 'stderr')):
            os.set_blocking(stream.fileno(), False)
            selector.register(stream, selectors.EVENT_READ, name)
        term_at = kill_at = None
        while True:
            if not sample['reaped']:
                try:
                    pid, status, used = os.wait4(process.pid, os.WNOHANG)
                except ChildProcessError:
                    sample['waitOwnershipLost'] = True
                    raise ValueError('EXACT_WAIT_OWNERSHIP_LOST')
                if pid:
                    need(pid == process.pid, 'WRONG_WAIT_PID')
                    sample['reaped'] = True
                    sample['exitCode'] = os.waitstatus_to_exitcode(status)
                    process.returncode = sample['exitCode']
                    sample['wait4Usage'] = dict(userUs=round(used.ru_utime * 1000000),
                        systemUs=round(used.ru_stime * 1000000), maxrssBytes=used.ru_maxrss)
            if sample['reaped'] and not selector.get_map():
                sample['pipeEof'] = True
                break
            now = time.monotonic()
            if (now >= replay_deadline or sample['ioFailure']) and term_at is None and not sample['reaped']:
                sample['timedOut'] = now >= replay_deadline
                try:
                    os.kill(process.pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass
                sample['signals'].append('SIGTERM')
                term_at = now
            if term_at is not None and now >= term_at + .25 and kill_at is None and not sample['reaped']:
                try:
                    os.kill(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                sample['signals'].append('SIGKILL')
                kill_at = now
            if now >= replay_deadline + 2:
                sample['ioFailure'] = sample['ioFailure'] or 'BOUNDED_REAP_OR_EOF_UNAVAILABLE'
                break
            for key, _ in selector.select(.01):
                chunk = os.read(key.fd, 4096)
                if not chunk:
                    selector.unregister(key.fileobj)
                    continue
                target, cap = (stdout, 16384) if key.data == 'stdout' else (stderr, 4096)
                if len(target) + len(chunk) > cap:
                    sample['ioFailure'] = sample['ioFailure'] or key.data.upper() + '_BOUND'
                target.extend(chunk[:max(0, cap - len(target))])
        # Exactly one after snapshot, after exact direct wait AND attempted pipe drain.
        sample['childrenAfter'] = collector.usage(resource.RUSAGE_CHILDREN)
        sample['nodeWallSecondsThroughReapAndEof'] = time.monotonic() - node_started
        (out / 'host.stdout').write_bytes(stdout)
        (out / 'host.stderr').write_bytes(stderr)
        report['sample'] = sample
        need(sample['reaped'] and sample['pipeEof'] and not sample['timedOut'], 'REAP_EOF_DEADLINE')
        need(sample['exitCode'] == 0 and sample['ioFailure'] is None and not stderr, 'CLEAN_NODE_REQUIRED')
        need(stdout.endswith(b'\n') and stdout.count(b'\n') == 1, 'ONE_CLOSURE_LINE_REQUIRED')
        final = json.loads(stdout)
        need(final['protocol'] == 'stack-evidence-ref-replay-v1', 'CLOSURE_PROTOCOL')
        need(final['pid'] == process.pid and final['ppid'] == os.getpid()
             and final['expectedPgid'] == sample['observedDirectChildPgid'], 'OS_BACKED_HOST_IDENTITY')
        need(final['status'] == 'DATA_REPLAY_RECOVERY_CONFIRMED' and final['error'] is None
             and final['allOwnedStreamsClosed'] is True and final['children'] == [], 'KNOWN_NODE_LEAF_AND_STREAM_CLOSURE')
        need(final['source']['entries'] == final['recovered']['entries'] == 10034, 'FIXED10034_ENTRIES')
        need(final['encoded']['compressedBytes'] <= 80 * 2**20, 'FIXED80MIB_SCREEN')
        need(pin(out / 'host/result.json')['sha256'] == pin(out / 'host.stdout')['sha256'], 'EXACT_HOST_RECEIPT_BYTES')
        authenticate()
        cpu = collector.os_match(sample)  # The sole authoritative delta; wait4 is NOT added.
        tree_closed = True
        report['observedAfterWaitNodeCpuUs'] = cpu
        report['cpuClosure'] = 'COMPLETE_KNOWN_NODE_LEAF'
        need(cpu['userUs'] + cpu['systemUs'] <= 30000000, 'FIXED30S_OWNED_NODE_CPU_SCREEN')
        need(sample['nodeWallSecondsThroughReapAndEof'] <= 45, 'FIXED45S_REPLAY_RECOVERY_WALL_SCREEN')
        need(time.monotonic() < deadline, 'INTERNAL170_INCLUDES_REAUTH_CPU')
        report.update(status='EVIDENCE_REF_DATA_SCREEN_CONFIRMED', completeNodeSubtreeCpuUs=cpu,
            closure=final, authority='ONE_RUSAGE_CHILDREN_DELTA_AFTER_EXACT_WAIT_AND_PINNED_CLOSED_TREE',
            wait4IsCrosscheckOnly=True, workerCpuAddedSeparately=False,
            identityAuthority='TRUSTED_PINNED_HOST_OS_PID_PPID_PLUS_PARENT_GETPGID')
        closure_ok = True
    except Exception as error:
        report.update(status='SCREEN_NO_GO', completeNodeSubtreeCpuUs=None)
        report['firstFailure'] = dict(type=type(error).__name__, message=str(error)[:1024])
    finally:
        selector.close()
        if process:
            process.stdout.close()
            process.stderr.close()
        (out / 'host.stdout').write_bytes(stdout)
        (out / 'host.stderr').write_bytes(stderr)
        report['sample'] = sample
        self_after = resource.getrusage(resource.RUSAGE_SELF)
        report['controllerSelfObservedSpanUs'] = dict(userUs=round((self_after.ru_utime-self_before.ru_utime)*1000000),
            systemUs=round((self_after.ru_stime-self_before.ru_stime)*1000000))
        report['controllerSelfSpanScope'] = 'BEFORE_PIN_AUTH_TO_BEFORE_FINAL_RECEIPT;NOT_WHOLE_LIFETIME;NOT_ADDED_TO_NODE'
        report['rssSemantics'] = 'DARWIN_BYTES;OS_MAXRSS_OBSERVATION_NOT_SIMULTANEOUS_TREE_RSS_OR_64MIB_DATA'
        report['observedWallSecondsBeforeFinalReceipt'] = time.monotonic() - started
        raw = (json.dumps(report, sort_keys=True, indent=2) + '\n').encode()
        need(len(raw) <= 128 * 1024, 'PARENT_METADATA_RESERVED_BOUND')
        (out / 'summary.json').write_bytes(raw)
        if process is not None and not tree_closed:
            stop_group('INCOMPLETE_KNOWN_LEAF_CLOSURE_CPUUNKNOWN_RECEIPT_PRESERVED')
        signal.setitimer(signal.ITIMER_REAL, 0)
    return 0 if closure_ok else 1


if __name__ == '__main__':
    sys.exit(main())
