#!/usr/bin/env python3
"""Audit immutable saved trajectory with unchanged original quality authority."""
import copy
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import struct
import sys
import time

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
SOURCE = ROOT / 'examples/physics-rigid-contact-reference/geometry-reference.py'
RUNTIME = ROOT / 'examples/physics-stack-library-2276/evidence/runtime-opt04-01'
CENSUS = ROOT / 'examples/physics-stack-wholepath-2276/evidence/census-01'
PROVIDER = '4a765881cfe2aeb6bb04611baf29174035e6f58436d423c7090efdafbddc66a3'
SCENES = ('ALIGNED', 'OFFSET', 'YAW')
FIELDS = (('positionM', 3), ('velocityMps', 3), ('orientation', 4), ('angularVelocityRadps', 3))
CAP = 16 * 1024 * 1024
WIRE = 2 * 1024 * 1024


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        while b := f.read(65536):
            h.update(b)
    return h.hexdigest()


def wire(value):
    return (json.dumps(value, allow_nan=False, separators=(',', ':')) + '\n').encode()


def main():
    assert len(sys.argv) == 2 and sys.argv[1].startswith('audit-')
    label = sys.argv[1]
    assert len(label) <= 64 and all(c.islower() or c.isdigit() or c == '-' for c in label)
    out = HERE / 'evidence' / label
    out.mkdir(parents=True, exist_ok=False)
    start, cpu = time.perf_counter_ns(), time.process_time_ns()
    deadline = time.monotonic() + 170
    paths = [Path(__file__), HERE / 'CONTRACT.md', SOURCE, Path(sys.executable), RUNTIME / 'result.json']
    for scene in SCENES:
        paths += [RUNTIME / (scene + '.f64le'), RUNTIME / (scene + '-initial-body-metadata.json')]
    for n in range(3):
        paths += [CENSUS / ('geometry-' + str(33*n + (1 if step == 0 else 2*step+1)) + '-reply.json') for step in range(17)]
    before = {str(p.relative_to(ROOT)) if p.is_relative_to(ROOT) else str(p): digest(p) for p in paths}
    written = 0

    def save(name, value):
        nonlocal written
        data = wire(value)
        assert written + len(data) < CAP - 1024*1024
        (out / name).write_bytes(data)
        written += len(data)

    save('inputs-before.json', before)
    result = {'status': 'RUNNING', 'reports': [], 'firstFailure': None,
              'independentlyFullAccepted': 0, 'API': False, 'resourceQualification': False,
              'fullP4Qualification': False, 'boundary': 'SAVED_TRAJECTORY_QUALITY_ONLY_NO_CANDIDATE_CALLS',
              'actualContactPresence': 'UNAVAILABLE_EMPTY_CONTACTS_DIAGNOSTIC_ONLY'}
    stage = 'authentication'
    try:
        assert digest(SOURCE) == '2c8bc7f6cd809e865c986a859b8614c963c4862296920555eb31c9487411af26'
        assert digest(Path(sys.executable)) == 'a1f6d9dc20d4787a84dc2fe782094a7bac5946f49a962aa0af48a02f0e8d5bc5'
        runtime = json.loads((RUNTIME / 'result.json').read_text())
        assert runtime['status'] == 'RUNTIME_DIAGNOSTIC_COMPLETED' and runtime['firstFailure'] is None and runtime['integrityFailure'] is None
        spec = importlib.util.spec_from_file_location('immutable_stack_quality', SOURCE)
        quality = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(quality)
        for scene_index, scene in enumerate(SCENES):
            stage = scene + ':decode'
            report = runtime['reports'][scene_index]
            assert report['scene'] == scene and report['code'] == 0 and report['stopReason'] is None
            recorded = report['result']
            assert recorded['engineReturned'] == recorded['diagnosticAccepted'] == recorded['normalKktAccepted'] == 1200
            assert recorded['runtimeDigest'] == PROVIDER
            raw = (RUNTIME / (scene + '.f64le')).read_bytes()
            assert len(raw) == 1201*936 == recorded['rawBytes'] == report['observedRaw']['bytes']
            assert hashlib.sha256(raw).hexdigest() == recorded['rawSha256'] == report['observedRaw']['sha256']
            metadata = json.loads((RUNTIME / (scene + '-initial-body-metadata.json')).read_text())
            assert metadata['runtimeDigest'] == PROVIDER and metadata['fixedStepSeconds'] == 1/120
            initial_bodies = metadata['bodies']
            assert len(initial_bodies) == 9
            initial_words = b''.join(struct.pack('<d', value) for body in initial_bodies for key, _ in FIELDS for value in body[key])
            assert raw[:936] == initial_words
            floor_words = initial_words[-104:]

            def state(step):
                chunk = raw[936*step:936*(step+1)]
                assert len(chunk) == 936 and chunk[-104:] == floor_words
                values = struct.unpack('<117d', chunk)
                assert all(math.isfinite(value) for value in values)
                bodies = copy.deepcopy(initial_bodies)
                offset = 0
                for body in bodies:
                    for key, count in FIELDS:
                        body[key] = list(values[offset:offset+count])
                        offset += count
                assert offset == 117
                return {'bodies': bodies, 'contacts': [], 'stepIndex': step, 'timeSeconds': step*(1/120)}

            initial, baseline = state(0), state(960)
            maximum, minimum = {}, {}
            summary = {'scene': scene, 'qualityAccepted': 0, 'settlingFramesAccepted': 0,
                       'baselineStep': 960, 'baselineFrameSha256': hashlib.sha256(raw[936*960:936*961]).hexdigest(),
                       'maxima': maximum, 'minima': minimum, 'prefixResultExact': 0}
            result['reports'].append(summary)
            with (out / (scene + '-quality.jsonl')).open('xb') as stream:
                for step in range(1201):
                    assert time.monotonic() < deadline, 'INTERNAL170S_DEADLINE'
                    stage = scene + ':frame' + str(step)
                    request = {'state': state(step), 'initial': initial, 'timeSeconds': step*(1/120),
                               'referenceAt8s': baseline if step >= 960 else None}
                    encoded = wire(request)
                    assert len(encoded) <= WIRE
                    response = quality.evaluate(request)
                    line = wire({'step': step, 'requestSha256': hashlib.sha256(encoded).hexdigest(), 'result': response})
                    assert len(line) <= WIRE and written + len(line) < CAP - 1024*1024
                    stream.write(line)
                    written += len(line)
                    assert response['ok'] is True and response['metrics']['referencePrecisionResolved'] is True and response['violations'] == [], response
                    if step <= 16:
                        ordinal = scene_index*33 + (1 if step == 0 else 2*step+1)
                        old = json.loads((CENSUS / ('geometry-' + str(ordinal) + '-reply.json')).read_text())
                        assert response == {k: old[k] for k in ('ok', 'metrics', 'violations')}, 'complete prefix evaluate result mismatch'
                        summary['prefixResultExact'] += 1
                    for key, value in response['metrics'].items():
                        if type(value) in (float, int):
                            maximum[key] = max(maximum.get(key, value), value)
                            minimum[key] = min(minimum.get(key, value), value)
                    summary['qualityAccepted'] += 1
                    if step >= 960:
                        summary['settlingFramesAccepted'] += 1
            summary['qualityEvidenceSha256'] = digest(out / (scene + '-quality.jsonl'))
        result['status'] = 'PASS_SAVED_ORIGINAL_QUALITY_ALL_3603_FRAMES'
    except Exception as error:
        result['status'] = 'FIRST_FAILURE'
        result['firstFailure'] = {'stage': stage, 'errorClass': type(error).__name__, 'message': str(error)}
    finally:
        after = {name: digest(ROOT / name) if not Path(name).is_absolute() else digest(Path(name)) for name in before}
        save('inputs-after.json', after)
        if after != before:
            result['status'] = 'FIRST_FAILURE'
            result['firstFailure'] = result['firstFailure'] or {'stage': 'integrity', 'message': 'frozen input changed'}
        result.update(wholeAuditWallNs=time.perf_counter_ns()-start, wholeAuditSelfCpuNs=time.process_time_ns()-cpu,
                      evidenceBytesBeforeFinalReceipt=written, candidateCalls=0, referenceCalls=sum(r['qualityAccepted'] for r in result['reports']))
        save('result.json', result)
    print(json.dumps({'status': result['status'], 'firstFailure': result['firstFailure'],
                      'qualityAccepted': [r['qualityAccepted'] for r in result['reports']]}, allow_nan=False))
    return 0 if result['status'].startswith('PASS_') else 1


if __name__ == '__main__':
    sys.exit(main())
