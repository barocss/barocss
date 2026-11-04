#!/usr/bin/env python3
"""Six saved cold position requests; no World or old Decimal SAT evaluation."""
import difflib
import importlib.util
import json
from pathlib import Path
import re
import signal
import sys
import time

import observer
import verify

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
MAX_OUTPUT = 16 * 1024 * 1024
MAX_RETAINED = 64 * 1024 * 1024
sys.dont_write_bytecode = True


def module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = value
    spec.loader.exec_module(value)
    return value


def main():
    if len(sys.argv) != 2 or re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,63}', sys.argv[1]) is None:
        raise ValueError('one fresh run ID required')
    out = HERE / 'evidence' / sys.argv[1]
    out.mkdir(parents=True, exist_ok=False)
    wall, cpu = time.monotonic_ns(), time.process_time_ns()
    signal.signal(signal.SIGALRM, lambda *_: (_ for _ in ()).throw(TimeoutError('INTERNAL_170S_GUARD')))
    signal.alarm(170)
    counts = dict(framesAttempted=0, framesReturned=0, framesVerified=0, compactAttempts=0,
        compactReturns=0, scalarCalls=0, scalarReturns=0, coldKernelAttempts=0, coldKernelReturns=0,
        coldQpAttempts=0, coldQpReturns=0, forbiddenOldCompactAttempts=0, oldDecimalSatCalls=0,
        oldObserverBaselineCalls=0, WorldCalls=0, fixtureCalls=0, trigSeedCalls=0,
        compactRecordsVerified=0, numericWordsVerified=0, retainedPayloadLeavesVerified=0)
    summary = dict(protocol=observer.PROTOCOL, status='NOT_RUN', counts=counts, frames=[],
                   firstFailure=None, costGO='NOT_RUN', line32PointLedgerQuality='NOT_RUN', fullP4='NO_GO')
    charged = peak_owned = 0
    meter = None
    context = None
    cursor = None

    def put(name, data):
        nonlocal charged
        if charged + len(data) > MAX_OUTPUT:
            raise ValueError('TOTAL_EVIDENCE_LIMIT')
        (out / name).write_bytes(data)
        charged += len(data)

    try:
        dependencies = json.loads((HERE / 'dependencies.json').read_text())
        # No numerical imports before every source and every corpus file is authenticated.
        for relative, pin in dependencies['pins'].items():
            path = ROOT / relative
            import hashlib
            if path.stat().st_size != pin['bytes'] or hashlib.sha256(path.read_bytes()).hexdigest() != pin['sha256']:
                raise ValueError('DEPENDENCY_DRIFT:' + relative)
        loader = module(ROOT / 'examples/physics-p4-compact-v2-2276/loaders.py', 'p4_position_v2_loaders')
        h = module(ROOT / 'examples/physics-p4-sat-2276/run.py', 'p4_position_v2_saved_helpers')
        corpus = json.loads((ROOT / 'examples/physics-p4-sat-2276/corpus.json').read_text())
        paths = []
        for scene, step, session, input_sha, output_sha in corpus['frames']:
            folder = ROOT / 'examples/physics-world-p4-2276/evidence' / session
            stem = f'{scene}-{step}-position-world'
            ip, op = folder / (stem + '.stdin.jsonl'), folder / (stem + '.stdout.raw')
            h.authenticated(ip, input_sha)
            h.authenticated(op, output_sha)
            paths.append((scene, step, ip, op, input_sha, output_sha))
        compact_dependencies = json.loads((ROOT / 'examples/physics-p4-compact-v2-2276/dependencies.json').read_text())
        scalar, scalar_audit = loader.scalar_closure(ROOT, compact_dependencies)
        k = module(ROOT / 'examples/physics-p4-sat-2276/integer_sat.py', 'p4_position_v2_integer')
        cb = module(ROOT / 'examples/physics-p4-compact-v2-2276/backend.py', 'p4_position_v2_compact')
        cv = module(ROOT / 'examples/physics-p4-compact-v2-2276/verify.py', 'p4_position_v2_compact_observer')
        old_path = ROOT / dependencies['fullPositionPath']
        original = module(old_path, 'p4_position_v2_authenticated_cold_definitions')
        meter = k.Meter()
        context = observer.PositionObserver(original, old_path.read_text(), dependencies['spans'], h, k, cb, scalar, meter, counts)
        transfer = context.transfer_audit
        put('function-transfer.json', json.dumps(transfer, indent=2).encode() + b'\n')
        difference = ''.join(difflib.unified_diff(transfer['originalWorldSource'].splitlines(True),
            transfer['transformedWorldSource'].splitlines(True), fromfile='authenticated-original-world', tofile='new-world-v2'))
        put('function-transfer.diff', difference.encode())
        summary['scalarSourceAudit'] = scalar_audit
        summary['setupCpuNs'] = time.process_time_ns() - cpu
        for scene, step, ip, op, input_sha, output_sha in paths:
            counts['framesAttempted'] += 1
            cursor = dict(scene=scene, step=step)
            frame_wall, frame_cpu = time.monotonic_ns(), time.process_time_ns()
            if (ip.stat().st_size + op.stat().st_size) * 128 + 32 * 1024 * 1024 > MAX_RETAINED:
                raise ValueError('DECODE_PREALLOCATION_LIMIT')
            decode_start = time.process_time_ns()
            request = json.loads(h.authenticated(ip, input_sha))
            saved = json.loads(h.authenticated(op, output_sha))
            if request['scene'] != scene or request['stepIndex'] != step or saved['resolved'] is not True:
                raise ValueError('FRAME_AUTHORITY_LAYOUT')
            decode_cpu = time.process_time_ns() - decode_start
            peak_owned = max(peak_owned, h.allocation((request, saved)))
            observed_start = time.process_time_ns()
            reply = context.evaluate(request)
            observed_cpu = time.process_time_ns() - observed_start
            counts['framesReturned'] += 1
            serialize_start = time.process_time_ns()
            # Reserve before dense serialization; each72-record certificate frame is bounded.
            if charged + 2 * 1024 * 1024 > MAX_OUTPUT:
                raise ValueError('FRAME_OUTPUT_PREALLOCATION_LIMIT')
            data = json.dumps(reply, separators=(',', ':'), allow_nan=False).encode() + b'\n'
            if len(data) > 2 * 1024 * 1024:
                raise ValueError('FRAME_OUTPUT_LIMIT')
            put(f'{scene}-{step}-reply.json', data)
            serialize_cpu = time.process_time_ns() - serialize_start
            peak_owned = max(peak_owned, h.allocation((request, saved, reply, context.states)))
            if reply.get('resolved') is not True or reply.get('ok') is not True:
                raise ValueError('POSITION_OBSERVER_REFUSAL:' + str(reply.get('referenceStatus')) + ':' + str(reply.get('violations')))
            if context.request_calls != 72:
                raise ValueError('COMPLETE_72_COMPACT_CALLS_REQUIRED')
            audit_start = time.process_time_ns()
            checked = verify.verify(reply, saved, cv)
            audit_cpu = time.process_time_ns() - audit_start
            counts['framesVerified'] += 1
            for name in ('compactRecordsVerified', 'numericWordsVerified', 'retainedPayloadLeavesVerified'):
                counts[name] += checked[name]
            summary['frames'].append(dict(scene=scene, step=step, elapsedWallNs=time.monotonic_ns()-frame_wall,
                totalCpuNs=time.process_time_ns()-frame_cpu, decodeCpuNs=decode_cpu,
                observerIncludingCompactQpCpuNs=observed_cpu, nestedAttribution=dict(context.times),
                serializeWriteCpuNs=serialize_cpu, independentSavedAuditCpuNs=audit_cpu,
                referenceCounters=reply['reference']['counters'], verified=checked))
            context.states = {}
            del request, saved, reply, data
        if (counts['framesVerified'], counts['coldQpAttempts'], counts['coldQpReturns'], counts['scalarCalls'],
            counts['compactRecordsVerified'], meter.models, meter.axes) != (6,6,6,432,432,864,12960):
            raise ValueError('COMPLETE_POPULATION_REQUIRED')
        summary['status'] = 'PASS_OFFLINE_FULL_COLD_POSITION_V2'
    except Exception as exc:
        summary['status'] = 'NO_GO_OFFLINE_POSITION_V2'
        summary['firstFailure'] = dict(type=type(exc).__name__, message=str(exc), cursor=cursor, counts=dict(counts))
    finally:
        signal.alarm(0)
        summary.update(satCounters=None if meter is None else meter.stats(),
            elapsedWallNs=time.monotonic_ns()-wall, totalCpuNs=time.process_time_ns()-cpu,
            peakExplicitDataBytes=peak_owned, writtenEvidenceBytesBeforeSummary=charged,
            timingBoundary='All setup, frames, payload output and audits; terminal summary write excluded. Nested roots overlap.',
            historicalSixPositionCpuNs=885643000, historicalTimingIsNotSameBoundary=True,
            originalQpBudgetsUnchanged=True, originalPhysicalGatesUnchanged=True,
            unsupported=['32-point line/paired witness', 'phase ledger/quality', 'total trajectory cost forecast', '1200-step P4'])
        put('summary.json', json.dumps(summary, indent=2, allow_nan=False).encode() + b'\n')
    return 0 if summary['status'] == 'PASS_OFFLINE_FULL_COLD_POSITION_V2' else 1


if __name__ == '__main__':
    raise SystemExit(main())
