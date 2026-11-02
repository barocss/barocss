#!/usr/bin/env python3
"""Parent-guarded, files-only micro. A fresh run never imports an old oracle."""
import copy
from dataclasses import is_dataclass
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import re
import signal
import struct
import sys
import time

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
MAX_FILE = 2 * 1024 * 1024
MAX_OUTPUT = 8 * 1024 * 1024
MAX_RETAINED = 64 * 1024 * 1024
MAX_NODES = 200000
FIELDS = (('positionM', 3), ('velocityMps', 3), ('orientation', 4), ('angularVelocityRadps', 3))
sys.dont_write_bytecode = True


def load(name):
    spec = importlib.util.spec_from_file_location('p4_sat_' + name, HERE / (name + '.py'))
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def authenticated(path, expected):
    if path.stat().st_size > MAX_FILE:
        raise ValueError('INPUT_BYTE_LIMIT')
    data = path.read_bytes()
    if hashlib.sha256(data).hexdigest() != expected:
        raise ValueError('INPUT_SHA256:' + str(path))
    return data


def allocation(value):
    # Conservative recursive sum: shared immutable objects may count twice.
    nodes = 0
    def visit(item, depth=0):
        nonlocal nodes
        nodes += 1
        if nodes > MAX_NODES or depth > 32:
            raise ValueError('INPUT_NODE_LIMIT')
        total = sys.getsizeof(item)
        children = list(item.items()) if type(item) is dict else item if type(item) in (list, tuple) else (vars(item),) if is_dataclass(item) else ()
        for child in children:
            total += visit(child, depth + 1)
            if total > MAX_RETAINED:
                raise ValueError('OWNED_DATA_LIMIT')
        return total
    return visit(value)


def restore(json_bodies, raw_hex):
    if type(json_bodies) is not list or len(json_bodies) != 9 or type(raw_hex) is not str or len(raw_hex) != 1872:
        raise ValueError('RAW_FRAME_LAYOUT')
    data = bytes.fromhex(raw_hex)
    values = struct.unpack('<117d', data)
    if not all(math.isfinite(v) for v in values):
        raise ValueError('RAW_NONFINITE')
    bodies = copy.deepcopy(json_bodies)
    offset = 0
    for body in bodies:
        for field, length in FIELDS:
            decoded = list(values[offset:offset+length])
            if body[field] != decoded:
                raise ValueError('RAW_JSON_VALUE_MISMATCH')
            body[field] = decoded
            offset += length
    return bodies


def main():
    if len(sys.argv) != 2 or re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,63}', sys.argv[1]) is None:
        raise ValueError('one fresh run ID is required')
    out = HERE / 'evidence' / sys.argv[1]
    out.mkdir(parents=True, exist_ok=False)
    started, cpu = time.monotonic_ns(), time.process_time_ns()
    signal.signal(signal.SIGALRM, lambda *_: (_ for _ in ()).throw(TimeoutError('INTERNAL_170S_GUARD')))
    signal.alarm(170)
    counts = dict(framesAttempted=0, framesCompleted=0, pairStagesAttempted=0,
                  pairStagesReturned=0, pairStagesVerified=0, numericWordsVerified=0,
                  WorldCalls=0, QPCalls=0, oldReferenceCalls=0, fixtureCalls=0, trigCalls=0)
    summary = dict(status='NOT_RUN', counts=counts, firstFailure=None,
                   fullCompactPairCompatible=False, costGO='NOT_RUN', fullP4='NO_GO',
                   separate192BoundaryRows='AUTHENTICATE_ONLY_NOT_SAT_ORACLE')
    meter = None
    charged = 0
    peak_owned = 0
    cursor = None
    try:
        manifest = json.loads((HERE / 'corpus.json').read_text())
        paths = []
        # Authenticate the COMPLETE authority before candidate import/evaluation.
        for scene, step, session, input_sha, output_sha in manifest['frames']:
            folder = ROOT / 'examples/physics-world-p4-2276/evidence' / session
            stem = f'{scene}-{step}-position-world'
            ip, op = folder / (stem + '.stdin.jsonl'), folder / (stem + '.stdout.raw')
            authenticated(ip, input_sha)
            authenticated(op, output_sha)
            paths.append((scene, step, ip, op, input_sha, output_sha))
        boundary_path, boundary_sha = manifest['separateBoundaryReport']
        boundary = json.loads(authenticated(ROOT / boundary_path, boundary_sha))
        if boundary['counts']['rowsChecked'] != 192 or boundary['counts']['casesCompleted'] != 6:
            raise ValueError('SEPARATE_BOUNDARY_AUTHORITY_LAYOUT')
        del boundary
        kernel, observer = load('integer_sat'), load('verify')
        meter = kernel.Meter()
        with (out / 'pairs.jsonl').open('xb') as stream:
            for scene, step, ip, op, input_sha, output_sha in paths:
                counts['framesAttempted'] += 1
                # Hash-pinned encoded inputs get a conservative decoded-data
                # allowance plus32MiB for bounded active kernel/output scratch.
                if (ip.stat().st_size + op.stat().st_size) * 128 + 32 * 1024 * 1024 > MAX_RETAINED:
                    raise ValueError('DECODE_PREALLOCATION_LIMIT')
                request = json.loads(authenticated(ip, input_sha))
                expected = json.loads(authenticated(op, output_sha))
                if request['scene'] != scene or request['stepIndex'] != step or expected['resolved'] is not True:
                    raise ValueError('FRAME_AUTHORITY_LAYOUT')
                peak_owned = max(peak_owned, allocation((request, expected)))
                for stage, bodies_key, raw_key, expected_key in (
                    ('PRE', 'preBodies', 'preRawHex', 'prePairs'),
                    ('HYP', 'hypBodies', 'hypRawHex', 'hypPairs')):
                    bodies = restore(request[bodies_key], request[raw_key])
                    if len({b['id'] for b in bodies}) != 9 or sum(b['kind'] == 'static' for b in bodies) != 1:
                        raise ValueError('ORIGINAL_NINE_BODY_LAYOUT')
                    prepared = [kernel.prepare(b, meter) for b in bodies]
                    peak_owned = max(peak_owned, allocation((request, expected, bodies, tuple(vars(b) for b in prepared))))
                    pairs = sorted((a.id + '\0' + b.id, a, b) if a.id < b.id else (b.id + '\0' + a.id, b, a)
                                   for i, a in enumerate(prepared) for b in prepared[i+1:]
                                   if a.kind != 'static' or b.kind != 'static')
                    authority = expected['reference'][expected_key]
                    if len(pairs) != 36 or len(authority) != 36:
                        raise ValueError('ALL_36_PAIRS_REQUIRED')
                    for (key, a, b), saved in zip(pairs, authority):
                        counts['pairStagesAttempted'] += 1
                        cursor = dict(scene=scene, step=step, stage=stage, pairKey=key)
                        if key != saved['pairKey']:
                            raise ValueError('PAIR_ORDER_AUTHORITY')
                        candidate = kernel.evaluate_pair(a, b, meter)
                        counts['pairStagesReturned'] += 1
                        candidate.update(scene=scene, step=step, stage=stage)
                        # Reserve before JSON conversion;15 fixed axis records and bounded interval integers.
                        if charged + 131072 > MAX_OUTPUT:
                            raise ValueError('EVIDENCE_PREALLOCATION_LIMIT')
                        data = json.dumps(candidate, separators=(',', ':'), allow_nan=False).encode() + b'\n'
                        if len(data) > 131072:
                            raise ValueError('PAIR_EVIDENCE_BOUND')
                        stream.write(data)
                        stream.flush()
                        charged += len(data)
                        checked = observer.verify(candidate, saved)
                        counts['pairStagesVerified'] += 1
                        counts['numericWordsVerified'] += checked['verifiedNumericWords']
                    del prepared, bodies, pairs, authority
                counts['framesCompleted'] += 1
                del request, expected
        if counts['pairStagesVerified'] != 432 or meter.axes != 12960 or meter.models != 864:
            raise ValueError('COMPLETE_POPULATION_REQUIRED')
        summary['status'] = 'PASS_SAVED_SAT_NUMERIC_SUBSET'
    except Exception as exc:
        summary['status'] = 'NO_GO_OFFLINE_SAT_MICRO'
        summary['firstFailure'] = dict(type=type(exc).__name__, message=str(exc), cursor=cursor, counts=dict(counts))
    finally:
        signal.alarm(0)
        summary.update(kernelCounters=None if meter is None else meter.stats(),
                       elapsedWallNs=time.monotonic_ns()-started, elapsedCpuNs=time.process_time_ns()-cpu,
                       peakExplicitDataBytes=peak_owned, writtenPairEvidenceBytes=charged,
                       interpreterAndTemporaryHeap='NOT_A_TOTAL_RSS_BOUND',
                       unsupportedOutputs=['Float64 selection/point/normal/ties', 'legacy precisionMaxDifferenceM',
                                           'independent exact feature winner', 'full compact_pair raw compatibility',
                                           'full reference cost', '1200-step P4 trajectory'])
        data = json.dumps(summary, indent=2, allow_nan=False).encode() + b'\n'
        if charged + len(data) > MAX_OUTPUT:
            raise RuntimeError('SUMMARY_EVIDENCE_LIMIT')
        (out / 'summary.json').write_bytes(data)
    return 0 if summary['status'] == 'PASS_SAVED_SAT_NUMERIC_SUBSET' else 1


if __name__ == '__main__':
    raise SystemExit(main())
