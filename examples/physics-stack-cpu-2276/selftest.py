"""Root only. One fresh inherited process tree at a time; owns ONE180s group."""
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import resource
import signal
import sys
import time


def require(value, reason):
    if not value:
        raise AssertionError(reason)


def file_pin(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(65536), b''):
            h.update(block)
    return dict(bytes=Path(path).stat().st_size, sha256=h.hexdigest())


def main():
    require(len(sys.argv) == 3, 'USAGE:selftest.py FRESH_OUT ROOT_REVIEWED_PINS_SHA')
    here = Path(__file__).resolve().parent; repo = here.parents[1]
    require(sys.platform == 'darwin', 'DARWIN_ONLY')
    require(signal.getsignal(signal.SIGCHLD) == signal.SIG_DFL, 'NORMAL_SIGCHLD_REQUIRED')
    # Direct invocation. This existing Python becomes the sole outer group owner.
    # No child supervisor, detached spawn or second group is created.
    if os.getpgrp() != os.getpid():
        os.setpgid(0, 0)
    require(os.getpgrp() == os.getpid() and os.getpid() > 1, 'OUTER_GROUP_NOT_OWNED')
    out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=False)
    start = time.monotonic(); inner_deadline = start + 170
    self_before = resource.getrusage(resource.RUSAGE_SELF)

    def kill_own_group(reason):
        # An incomplete actual tree never leaves hidden live descendants behind.
        # This path is not a successful reap or CPU receipt and is not a test workload.
        try:
            packet = dict(status='CPUUNKNOWN', reason=reason, completeChildCpuUs=None,
                          ownerPid=os.getpid(), ownedPgid=os.getpgrp(), API=False)
            (out / 'outer-stop.json').write_text(json.dumps(packet) + '\n')
        finally:
            os.killpg(os.getpgrp(), signal.SIGKILL)

    signal.signal(signal.SIGALRM, lambda *_: kill_own_group('ONE_OUTER180S_DEADLINE'))
    signal.setitimer(signal.ITIMER_REAL, 180)
    report = dict(status='NOT_RUN', firstFailure=None, groups=[], actualPhysicsCalls=0,
                  oldBenchmarkRuns=0, whole64MiBBound=False, resourceQualification=False,
                  full1200='BLOCKED', API=False,
                  guardMode='DIRECT_ONE_COLLECTOR_OWNED_GROUP180S_NO_NESTED_SUPERVISOR',
                  ownerPid=os.getpid(), ownedPgid=os.getpgrp(), controllerWholeLifetimeCpu='NOT_CLAIMED')
    actual_samples = []
    need_group_cleanup = False
    try:
        pins_path = here / 'PINS.json'
        require(pins_path.stat().st_size <= 65536, 'PINS64K')
        raw = pins_path.read_bytes()
        require(hashlib.sha256(raw).hexdigest() == sys.argv[2], 'EXACT_ROOT_REVIEWED_PINS')
        pins = json.loads(raw)

        def authenticate():
            require(Path(sys.executable).resolve() == Path(pins['python']).resolve(), 'PINNED_PYTHON_EXECUTABLE')
            require(sys.version == pins['pythonVersion'], 'PINNED_PYTHON_VERSION')
            require(hashlib.sha256(pins_path.read_bytes()).hexdigest() == sys.argv[2], 'PINS_UNCHANGED')
            for name, expected in pins['files'].items():
                path = Path(name) if name.startswith('/') else repo / name
                require(file_pin(path) == expected, 'PIN_DRIFT:' + name)

        authenticate()  # Before importing the new collector or executing any synthetic child.
        spec = importlib.util.spec_from_file_location('stack_cpu_collector', here / 'collect.py')
        collector = importlib.util.module_from_spec(spec); spec.loader.exec_module(collector)

        def run(case):
            nonlocal need_group_cleanup
            require(time.monotonic() < inner_deadline, 'INTERNAL170S_DEADLINE')
            need_group_cleanup = True  # Any actual collection exception leaves closure unproved.
            sample = collector.collect(case)
            actual_samples.append(sample)
            if sample['qualification']['status'] != 'CPU_COMPLETE':
                need_group_cleanup = True
            require(sample['qualification']['status'] == 'CPU_COMPLETE', 'ACTUAL_CASE_CPU_UNKNOWN:' + case)
            require(sample['reaped'] and sample['pipeEof'], 'ACTUAL_CASE_UNREAPED:' + case)
            require(sample['pid'] != os.getpid() and sample['pgid'] == os.getpgrp(), 'OWNED_PID_GROUP')
            need_group_cleanup = False
            cpu = sample['qualification']['completeChildCpuUs']
            require(cpu['userUs'] + cpu['systemUs'] > 0, 'NONZERO_OS_CPU:' + case)
            return sample

        clean = run('clean')
        require(clean['exitCode'] == 0 and clean['qualification']['execution'] == 'CLEAN', 'G1_CLEAN_EXIT')
        report['groups'].append(dict(id='G1-clean-leaf', sample=clean))

        parent = run('parent')
        grand = parent['records'][0]['childWait4CpuUs']
        grand_total = grand['userUs'] + grand['systemUs']
        require(grand_total >= 79000, 'G2_ACTUAL_GRANDCHILD_CPU_TARGET')
        total = parent['qualification']['completeChildCpuUs']
        require(total['userUs'] + total['systemUs'] + 2 >= grand_total, 'G2_DESCENDANT_ROLLUP')
        report['groups'].append(dict(id='G2-waited-grandchild-rollup', sample=parent,
                                     grandchildOsWait4IsCrosscheckNotAdded=True))

        tree = run('node-tree')
        final = tree['records'][-1]
        require(len(final['children']) == 3 and final['worker']['pid'] == tree['pid'], 'G3_EXACT_TREE')
        report['groups'].append(dict(id='G3-one-node-worker-three-python-tree', sample=tree,
                                     osProcessCountIncludingOwner=5, workerThreadCount=1,
                                     nodeProcessCpuChargedOnce=True))

        failed = run('error')
        require(failed['exitCode'] == 7 and failed['qualification']['execution'] == 'FAILED', 'G4_EXPECTED_FAILURE')
        report['groups'].append(dict(id='G4-execution-failure-cpu-complete', sample=failed))

        timed = run('wait')
        require(timed['qualification']['execution'] == 'TIMEOUT' and timed['waitIdentityAdmitted'], 'G5_KNOWN_LEAF_TIMEOUT')
        report['groups'].append(dict(id='G5-timeout-leaf-exact-reap', sample=timed))

        # G6 is classification only, using ONE already measured clean tree's bounded copy.
        # No killed intermediate/live orphan or repeated CPU workload is created.
        variants = []
        for kind in ('missing-closure', 'unreaped-descendant', 'unjoined-worker', 'killed-parent-missing-closure', 'unavailable-wait'):
            sample = copy.deepcopy(tree)
            if kind == 'missing-closure':
                sample['records'] = sample['records'][:1]
            elif kind == 'unreaped-descendant':
                sample['records'][-1]['allReaped'] = False
            elif kind == 'unjoined-worker':
                sample['records'][-1]['worker']['joined'] = False
            elif kind == 'killed-parent-missing-closure':
                sample['exitCode'] = -signal.SIGKILL; sample['records'] = []
            else:
                sample['reaped'] = False; sample['wait4Usage'] = None
            classified = collector.classify(sample, 'node-tree')
            require(classified['status'] == 'CPUUNKNOWN' and classified['completeChildCpuUs'] is None,
                    'G6_NOT_FAIL_CLOSED:' + kind)
            variants.append(dict(kind=kind, qualification=classified))
        report['groups'].append(dict(id='G6-unavailable-closure-classification-only', variants=variants,
                                     additionalProcessCalls=0, actualOrphansCreated=0))

        try:
            collector.validate_start(True)
        except collector.CollectionError as error:
            require(str(error) == 'OVERLAPPING_COLLECTION', 'G7_OVERLAP_REASON')
        else:
            raise AssertionError('G7_OVERLAP_ADMITTED')
        collector.validate_start(False)
        require(all(sample['qualification']['wait4IsCrosscheckOnly'] for sample in actual_samples), 'G7_NO_WAIT4_DOUBLE_SUM')
        require(all(sample['rssBoundary'] == 'DARWIN_BYTES_CHILD_MAX_NOT_SIMULTANEOUS_TREE_RSS_NO_CAP'
                    for sample in actual_samples), 'G7_RSS_BOUNDARY')
        report['groups'].append(dict(id='G7-owner-mode-overlap-and-boundaries', overlappingSpawnCalls=0,
                                     normalSigchld=True, rssUnits='BYTES', rssCap='NONE',
                                     aggregateChildRssIs='MAXIMUM_NOT_SIMULTANEOUS_TREE'))
        authenticate()
        require(time.monotonic() < inner_deadline, 'INTERNAL170S_DEADLINE')
        report['status'] = 'PASS_SYNTHETIC_DARWIN_CPU_COLLECTION_COMPONENT'
        report['finalAuthentication'] = 'ALL_FROZEN_SOURCES_TOOLS_AND_OS_FILES_EQUAL'
    except Exception as error:
        report['status'] = 'FIRST_FAILURE'
        report['firstFailure'] = dict(type=type(error).__name__, message=str(error)[:1024])
    finally:
        self_after = resource.getrusage(resource.RUSAGE_SELF)
        report['controllerSelfObservedSpanUs'] = dict(userUs=round((self_after.ru_utime - self_before.ru_utime) * 1000000),
                                                      systemUs=round((self_after.ru_stime - self_before.ru_stime) * 1000000))
        report['controllerSelfBoundary'] = 'AFTER_GROUP_AND_OUTPUT_SETUP_BEFORE_PIN_AUTH_TO_BEFORE_FINAL_RECEIPT_ENCODING_WRITES; NOT_WHOLE_LIFETIME'
        report['controllerSelfMaxrssBytes'] = self_after.ru_maxrss
        report['osIdentityObserved'] = dict(zip(('sysname', 'nodename', 'release', 'version', 'machine'), os.uname()))
        report['wallBeforeFinalReceiptNs'] = round((time.monotonic() - start) * 1000000000)
        encoded = (json.dumps(report, indent=2) + '\n').encode()
        require(len(encoded) <= 2 * 1024 * 1024, 'REPORT2M')
        (out / 'summary.json').write_bytes(encoded)
        if need_group_cleanup:
            kill_own_group('ACTUAL_CLOSURE_UNKNOWN_AFTER_BOUNDED_REAP')
        signal.setitimer(signal.ITIMER_REAL, 0)
    return 0 if report['status'] == 'PASS_SYNTHETIC_DARWIN_CPU_COLLECTION_COMPONENT' else 1


if __name__ == '__main__':
    raise SystemExit(main())
