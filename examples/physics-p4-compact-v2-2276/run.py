#!/usr/bin/env python3
"""Parent-guarded compact V2 prototype. No old reference or World is imported."""
import hashlib
import json
from pathlib import Path
import re
import signal
import sys
import time

import backend
import loaders
import verify

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
MAX_OUTPUT = 8 * 1024 * 1024
MAX_RETAINED = 64 * 1024 * 1024
sys.dont_write_bytecode = True


def main():
    if len(sys.argv) != 2 or re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,63}', sys.argv[1]) is None:
        raise ValueError('one fresh run ID is required')
    out = HERE / 'evidence' / sys.argv[1]
    out.mkdir(parents=True, exist_ok=False)
    wall, cpu = time.monotonic_ns(), time.process_time_ns()
    signal.signal(signal.SIGALRM, lambda *_: (_ for _ in ()).throw(TimeoutError('INTERNAL_170S_GUARD')))
    signal.alarm(170)
    counts = dict(framesAttempted=0, framesCompleted=0, recordAttempts=0, recordsReturned=0,
                  recordsVerified=0, scalarCalls=0, scalarReturns=0, numericWordsVerified=0,
                  retainedPayloadLeavesVerified=0, WorldCalls=0, QPCalls=0, oldDecimalSatCalls=0,
                  oldObserverCalls=0, fixtureCalls=0, trigSeedCalls=0)
    summary = dict(protocol=backend.PROTOCOL, status='NOT_RUN', counts=counts, firstFailure=None,
                   fullPositionReference='NOT_RUN', line32PointReference='NOT_RUN',
                   ledgerQuality='NOT_RUN', totalCostGO='NOT_RUN', fullP4='NO_GO')
    meter = None
    cursor = None
    charged = 0
    owned = 0
    try:
        dependencies = json.loads((HERE / 'dependencies.json').read_text())
        loaders.authenticate(ROOT, dependencies)
        # These authenticated modules define only file/decoding helpers and
        # integer kernel functions at import; their guarded main never runs.
        h = loaders.load_module(ROOT / 'examples/physics-p4-sat-2276/run.py', 'p4_v2_saved_helpers')
        corpus = json.loads((ROOT / 'examples/physics-p4-sat-2276/corpus.json').read_text())
        paths = []
        for scene, step, session, input_sha, output_sha in corpus['frames']:
            folder = ROOT / 'examples/physics-world-p4-2276/evidence' / session
            stem = f'{scene}-{step}-position-world'
            ip, op = folder / (stem + '.stdin.jsonl'), folder / (stem + '.stdout.raw')
            h.authenticated(ip, input_sha)
            h.authenticated(op, output_sha)
            paths.append((scene, step, ip, op, input_sha, output_sha))
        k = loaders.load_module(ROOT / 'examples/physics-p4-sat-2276/integer_sat.py', 'p4_v2_integer_kernel')
        scalar, audit = loaders.scalar_closure(ROOT, dependencies)
        summary['scalarSourceAudit'] = audit
        summary['qualifiedIntegerKernelSha256'] = dependencies['pins']['examples/physics-p4-sat-2276/integer_sat.py']['sha256']
        summary['oldHelperDefinitionsImported'] = 1
        meter = k.Meter()

        def counted_scalar(a, b):
            counts['scalarCalls'] += 1
            result = scalar(a, b)
            counts['scalarReturns'] += 1
            return result

        with (out / 'records.jsonl').open('xb') as stream:
            for scene, step, ip, op, input_sha, output_sha in paths:
                counts['framesAttempted'] += 1
                if (ip.stat().st_size + op.stat().st_size) * 128 + 32 * 1024 * 1024 > MAX_RETAINED:
                    raise ValueError('DECODE_PREALLOCATION_LIMIT')
                request = json.loads(h.authenticated(ip, input_sha))
                expected = json.loads(h.authenticated(op, output_sha))
                if request['scene'] != scene or request['stepIndex'] != step or expected['resolved'] is not True:
                    raise ValueError('FRAME_AUTHORITY_LAYOUT')
                owned = max(owned, h.allocation((request, expected)))
                for stage, bodies_key, raw_key, saved_key in (
                    ('PRE', 'preBodies', 'preRawHex', 'prePairs'),
                    ('HYP', 'hypBodies', 'hypRawHex', 'hypPairs')):
                    originals = h.restore(request[bodies_key], request[raw_key])
                    if len({b['id'] for b in originals}) != 9 or sum(b['kind'] == 'static' for b in originals) != 1:
                        raise ValueError('ORIGINAL_NINE_BODY_LAYOUT')
                    prepared = [k.prepare(b, meter) for b in originals]
                    owned = max(owned, h.allocation((request, expected, originals, prepared)))
                    pairs = sorted((a.id + '\0' + b.id, i, j) if a.id < b.id else (b.id + '\0' + a.id, j, i)
                                   for i, a in enumerate(prepared) for j, b in enumerate(prepared[i+1:], i+1)
                                   if a.kind != 'static' or b.kind != 'static')
                    authority = expected['reference'][saved_key]
                    if len(pairs) != 36 or len(authority) != 36:
                        raise ValueError('ALL_36_PAIRS_REQUIRED')
                    for (key, ai, bi), saved in zip(pairs, authority):
                        counts['recordAttempts'] += 1
                        cursor = dict(scene=scene, step=step, stage=stage, pairKey=key)
                        if key != saved['pairKey']:
                            raise ValueError('PAIR_ORDER_AUTHORITY')
                        record = backend.compact(prepared[ai], prepared[bi], originals[ai], originals[bi],
                                                 stage, counted_scalar, k, meter)
                        counts['recordsReturned'] += 1
                        if charged + 262144 > MAX_OUTPUT:
                            raise ValueError('EVIDENCE_PREALLOCATION_LIMIT')
                        payload = dict(cursor=cursor, record=record)
                        data = json.dumps(payload, separators=(',', ':'), allow_nan=False).encode() + b'\n'
                        if len(data) > 262144:
                            raise ValueError('RECORD_EVIDENCE_BOUND')
                        stream.write(data)
                        stream.flush()
                        charged += len(data)
                        checked = verify.verify(record, saved, stage)
                        counts['recordsVerified'] += 1
                        counts['numericWordsVerified'] += checked['numericWords']
                        counts['retainedPayloadLeavesVerified'] += checked['retainedPayloadLeaves']
                    del originals, prepared, pairs, authority
                counts['framesCompleted'] += 1
                del request, expected
        if (counts['recordsVerified'], counts['scalarCalls'], counts['scalarReturns'], meter.models, meter.axes) != (432,432,432,864,12960):
            raise ValueError('COMPLETE_POPULATION_REQUIRED')
        summary['status'] = 'PASS_OFFLINE_COMPACT_V2_PROTOCOL_SUBSET'
    except Exception as exc:
        summary['status'] = 'NO_GO_OFFLINE_COMPACT_V2'
        summary['firstFailure'] = dict(type=type(exc).__name__, message=str(exc), cursor=cursor, counts=dict(counts))
    finally:
        signal.alarm(0)
        summary.update(kernelCounters=None if meter is None else meter.stats(),
                       elapsedWallNs=time.monotonic_ns()-wall, elapsedCpuNs=time.process_time_ns()-cpu,
                       peakExplicitDataBytes=owned, writtenRecordEvidenceBytes=charged,
                       dataBoundMeaning='CONSERVATIVE_RETAINED_DATA_PLUS32MIB_SCRATCH_NOT_TOTAL_RSS',
                       metadataChange=dict(removed='precisionMaxDifferenceM', added='satCertificateV2',
                                           oldSchemaEdited=False, oldPrecisionDeltaFabricated=False),
                       nextDependencies=['full cold-QP position observer protocol', 'unchanged32-point line/paired witness',
                                         'unchanged phase ledger/quality', 'total output/cost budget', '1200-step P4'])
        data = json.dumps(summary, indent=2, allow_nan=False).encode() + b'\n'
        if charged + len(data) > MAX_OUTPUT:
            raise RuntimeError('SUMMARY_EVIDENCE_LIMIT')
        (out / 'summary.json').write_bytes(data)
    return 0 if summary['status'] == 'PASS_OFFLINE_COMPACT_V2_PROTOCOL_SUBSET' else 1


if __name__ == '__main__':
    raise SystemExit(main())
