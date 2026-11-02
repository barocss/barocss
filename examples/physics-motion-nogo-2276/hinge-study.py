#!/usr/bin/env python3
"""Bounded saved-DATA study. Importing this module performs no I/O or arithmetic study."""
import argparse
from fractions import Fraction
import gzip
import hashlib
import io
import json
import math
import os
from pathlib import Path
import struct
import subprocess
import sys
import time

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
BANK = ROOT / 'examples/physics-rigid-hinge-velocity-world-reference/evidence/completed-world-a341f222'
MANIFEST_SHA = '60e389dbce2640f7f28378927f54cd6d2d8af203bcf374d54177a957b91d2191'
HISTORICAL_FREEZE_SHA = 'f25d064ebb082e556202491000f545f41726eef3c8e426a1452a66814e6d7954'
NATIVE = {'offset': 15860593, 'bytes': 208605, 'sha256': '88b2800cb2c56052ab82ff607509f13ce4a4e50c958ce92cea3630621e0e1444'}
RECORD = {'offset': 123916, 'bytes': 1635, 'sha256': '1119026b4d21f2828438800b1cf31166efce29874b26e1a0557fafcca82e654a'}
RAW = {'postContact': {'offset': 191776, 'bytes': 416, 'sha256': 'bc860dd78f5c6e8bb9bb2fe25618f15d04cca481bebc59a5f9df52b9f8d20b08'},
       'projected': {'offset': 192192, 'bytes': 416, 'sha256': '0ac9fd68b1ae6f81f327899549ab41c8170b100b66d5f6319cf70c62085d6e7d'}}
SOURCE_PINS = {
    'packages/barocss-physics/src/math.ts': '6605633830fa7fdf39f9531fbf988b52e306a6835655a318c961eb44c6b05ff8',
    'packages/barocss-physics/src/disjoint-hinge/measure.ts': '27831cb402d7625677ba0410b14197ee6c39359f9ff2a4263b5c9480a5ba9d42',
    'packages/barocss-physics/src/disjoint-hinge/pose.ts': '2796746d57c14f6dfc76025241c79460c8f198325e3fb57491541d8b718f99de',
    'packages/barocss-physics/src/disjoint-hinge/report.ts': '6a385f7c33428332a68e27122d36571df621c27ded494526875962aa4b45693a',
    'examples/physics-rigid-coupled-hinge-reference/candidate.ts': 'ea9c7bf81d281053a4576a66fe0944d1fe3a329485b41c02cc987e0333796532',
    'examples/physics-rigid-hinge-velocity-reference/diagnostics.ts': 'c432f6f2eb4e48dbac260490489badf6be25d0711fdf866f4b096b4baee68257',
    'examples/physics-rigid-hinge-motor-reference/report.ts': 'b687dadc56d3bd12dabe7938bfba141344f3899a0415e6cd93f5f43a9bcd2b01',
    'examples/physics-rigid-hinge-velocity-world-reference/postcontact-pair.ts': '0c127a3fff5f0d0900681e50814706d6ab5a9fe48b3f30d9666c64cd9006929e'}
HISTORICAL_BITS = 'a3ddc9485055d33f'
CANDIDATE_BITS = 'a4ddc9485055d33f'
BODY_IDS = ['pairA0', 'pairB0', 'pairA1', 'pairB1']


class StudyError(Exception):
    pass


def need(condition, message):
    if not condition:
        raise StudyError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def bits(value):
    return struct.pack('<d', value).hex()


def unique(pairs):
    result = {}
    for key, value in pairs:
        need(key not in result, 'Duplicate JSON key')
        result[key] = value
    return result


def parse(data):
    try:
        return json.loads(data, object_pairs_hook=unique,
                          parse_constant=lambda value: (_ for _ in ()).throw(StudyError('Nonfinite JSON')))
    except (UnicodeError, ValueError) as error:
        raise StudyError('Invalid JSON') from error


def read_bounded(path, maximum):
    with path.open('rb') as stream:
        data = stream.read(maximum + 1)
    need(len(data) <= maximum, 'File exceeds bound: ' + str(path))
    return data


def authenticate(data, locator, label):
    need(len(data) == locator['bytes'] and sha(data) == locator['sha256'], label + ' bytes/hash mismatch')


def gzip_slice(encoded, locator, maximum_prefix):
    end = locator['offset'] + locator['bytes']
    need(0 <= locator['offset'] and end <= maximum_prefix, 'Decoded prefix bound exceeded')
    with gzip.GzipFile(fileobj=io.BytesIO(encoded)) as stream:
        prefix = stream.read(end)
    need(len(prefix) == end, 'Archived prefix ended early')
    selected = prefix[locator['offset']:end]
    authenticate(selected, locator, 'Selected archive span')
    return selected


def raw_bodies(encoded):
    need(len(encoded) == 416, 'Raw frame must have four bodies')
    bodies = [list(struct.unpack_from('<13d', encoded, i * 104)) for i in range(4)]
    need(all(math.isfinite(value) for body in bodies for value in body), 'Nonfinite raw body')
    return bodies


def binary(a, b, operation):
    """Independent nearest-even rounding after each exact rational operation."""
    fa, fb = Fraction(a), Fraction(b)
    exact = fa * fb if operation == 'multiply' else fa + fb
    if exact:
        return float(exact)
    # IEEE signed zero must survive quaternion transcription.
    if operation == 'multiply':
        negative = math.copysign(1, a) != math.copysign(1, b)
    else:
        negative = a == 0 and b == 0 and math.copysign(1, a) < 0 and math.copysign(1, b) < 0
    return -0.0 if negative else 0.0


def operands(a, b):
    """Independent rounded basic operations for b * inverse(a), then dot with +Z."""
    ax, ay, az, aw = b
    bx, by, bz, bw = [-a[0], -a[1], -a[2], a[3]]
    mul = lambda x, y: binary(x, y, 'multiply')
    add = lambda x, y: binary(x, y, 'add')
    sub = lambda x, y: add(x, -y)
    q = [sub(add(add(mul(aw, bx), mul(ax, bw)), mul(ay, bz)), mul(az, by)),
         add(add(sub(mul(aw, by), mul(ax, bz)), mul(ay, bw)), mul(az, bx)),
         add(sub(add(mul(aw, bz), mul(ax, by)), mul(ay, bx)), mul(az, bw)),
         sub(sub(sub(mul(aw, bw), mul(ax, bx)), mul(ay, by)), mul(az, bz))]
    y = 0.0
    for value, axis in zip(q[:3], [0.0, 0.0, 1.0]):
        y = add(y, mul(value, axis))
    return q, y, q[3]


def atan_bounds(ratio):
    need(isinstance(ratio, Fraction) and 0 < ratio < Fraction(1, 4), 'Atan domain is outside (0,1/4)')
    square = ratio * ratio
    power = ratio
    lower = Fraction(0)
    for index in range(64):
        term = power / (2 * index + 1)
        lower += term if index % 2 == 0 else -term
        power *= square
    # S64 ends with a negative term. S64 < atan(r) < S65.
    return lower, lower + power / 129


def rounded_interval(lower, upper):
    need(isinstance(lower, Fraction) and isinstance(upper, Fraction) and lower <= upper,
         'Invalid rational rounding interval')
    low, high = float(lower), float(upper)
    need(math.isfinite(low) and bits(low) == bits(high), 'UNRESOLVED: interval crosses a binary64 rounding boundary')
    return low


def certify(y, x):
    need(type(x) is float and type(y) is float and math.isfinite(x) and math.isfinite(y)
         and x > 0 and y > 0, 'Invalid positive binary64 operands')
    lower, upper = atan_bounds(Fraction(y) / Fraction(x))
    scalar = rounded_interval(lower, upper)
    doubled = binary(scalar, 2.0, 'multiply')
    return {'yBits': bits(y), 'xBits': bits(x), 'atan2CorrectlyRoundedBits': bits(scalar),
            'doubledCorrectlyRoundedAtan2Bits': bits(doubled),
            'lower': {'numerator': str(lower.numerator), 'denominator': str(lower.denominator)},
            'upper': {'numerator': str(upper.numerator), 'denominator': str(upper.denominator)},
            'terms': [64, 65], 'matchesHistoricalBits': bits(doubled) == HISTORICAL_BITS,
            'matchesRecordedCandidateBits': bits(doubled) == CANDIDATE_BITS}


def load_data(result):
    source_bytes = {}
    for path, wanted in SOURCE_PINS.items():
        source_bytes[path] = read_bounded(ROOT / path, 65536)
        need(sha(source_bytes[path]) == wanted, 'Source expression changed: ' + path)
    freeze_data = read_bounded(ROOT / 'examples/physics-rigid-hinge-velocity-world-reference/source-freeze.json', 131072)
    need(sha(freeze_data) == HISTORICAL_FREEZE_SHA, 'Historical source freeze changed')
    freeze = parse(freeze_data)
    historical_sources = []
    for path in SOURCE_PINS:
        if '/disjoint-hinge/' in path:
            continue  # These package transfers were authored after the f401 run.
        entries = [entry for entry in freeze['sources'] if entry['path'] == path]
        need(len(entries) == 1, 'Historical provider absent or duplicated: ' + path)
        entry = entries[0]
        authenticate(source_bytes[path], entry, 'Historical expression provider ' + path)
        historical_sources.append({'path': path, 'bytes': entry['bytes'], 'sha256': entry['sha256'],
                                   'currentBytesEqualFrozenHistoricalProvider': True})
    private_angle = [line for line in source_bytes['examples/physics-rigid-coupled-hinge-reference/candidate.ts'].splitlines()
                     if line.startswith(b'function angle(')]
    transferred_angle = [line for line in source_bytes['packages/barocss-physics/src/disjoint-hinge/measure.ts'].splitlines()
                         if line.startswith(b'function angle(')]
    need(len(private_angle) == 1 and private_angle == transferred_angle, 'Historical/transferred angle expressions differ')
    manifest_data = read_bounded(BANK / 'manifest.json', 65536)
    need(sha(manifest_data) == MANIFEST_SHA, 'Bank manifest changed')
    manifest = parse(manifest_data)
    authentication = {'manifestSha256': MANIFEST_SHA, 'sourcePins': SOURCE_PINS, 'archives': {},
                      'selectedNative': NATIVE, 'selectedOutcome': RECORD, 'selectedRaw': RAW,
                      'historicalSourceFreezeSha256': HISTORICAL_FREEZE_SHA,
                      'historicalProviders': historical_sources,
                      'historicalTransferredAngleExpressionBytesEqual': True,
                      'angleExpressionSha256': sha(private_angle[0])}
    result['authentication'] = authentication
    limits = {'main.native.jsonl.gz': 8 * 1024 ** 2, 'main.records.jsonl.gz': 256 * 1024,
              'main.bodies.raw.gz': 64 * 1024}
    archives = {}
    for name, maximum in limits.items():
        relative = 'source-proof/' + name
        entries = [entry for entry in manifest['entries'] if entry['archive'] == relative]
        need(len(entries) == 1, 'Missing or duplicate manifest archive')
        entry = entries[0]
        encoded = read_bounded(BANK / relative, maximum)
        need(len(encoded) == entry['archiveBytes'] and sha(encoded) == entry['archiveSha256'], 'Archive authentication failed: ' + name)
        archives[name] = encoded
        authentication['archives'][name] = {'bytes': len(encoded), 'sha256': sha(encoded)}
    record = parse(gzip_slice(archives['main.records.jsonl.gz'], RECORD, 256 * 1024))
    need(record['attemptedStepIndex'] == 77 and record['acceptedStepIndex'] == 77
         and record['passed'] is True and record['outcome'] == 'returned'
         and record['referenceDisposition'] == 'RETURN', 'Selected historical step is not accepted')
    need(record['nativeLocator'] == {'stream': 'main.native.jsonl', **NATIVE}, 'Independent outcome/native locator mismatch')
    request = parse(gzip_slice(archives['main.native.jsonl.gz'], NATIVE, 20 * 1024 ** 2))['request']
    need(request['sourceState']['stepIndex'] == 76 and request['dt'] == 1 / 120
         and request['commands'] == [] and request['outcome'] == 'returned'
         and request['attempt']['attemptedStepIndex'] == 77 and request['attempt']['stage'] == 'report-ready',
         'Historical cursor/profile differs')
    need([body['id'] for body in request['config']['bodies']] == BODY_IDS, 'Body order differs')
    need([joint['id'] for joint in request['config']['joints']] == ['hinge0', 'hinge1'], 'Joint order differs')
    raw = {}
    for phase, locator in RAW.items():
        matching = [item for item in record['raw'] if item['phase'] == phase]
        need(matching == [{'phase': phase, 'stream': 'main.bodies.raw', **locator}], 'Outcome/raw locator mismatch')
        raw[phase] = gzip_slice(archives['main.bodies.raw.gz'], locator, 256 * 1024)
        need(raw[phase].hex() == request['rawFrames'][phase], 'Native JSON/raw frame mismatch')
        raw_bodies(raw[phase])
    for index, pair in enumerate(request['attempt']['pairs']):
        need(bits(pair['jointReport']['angleRad']) == HISTORICAL_BITS
             and bits(pair['rawPostContactAngleRad']) == HISTORICAL_BITS, 'Historical report angle differs')
        need(index < 2, 'Unexpected pair count')
    need(len(request['attempt']['pairs']) == 2, 'Expected two pairs')
    authentication['decodedNativePrefixBytes'] = NATIVE['offset'] + NATIVE['bytes']
    result['postContactRawHex'] = raw['postContact'].hex()
    result['projectedRawHex'] = raw['projected'].hex()
    return raw_bodies(raw['postContact'])


def run(output, nodes):
    need(not output.exists(), 'Output must be a fresh path')
    need(1 <= len(nodes) <= 2 and len(set(nodes)) == len(nodes), 'Select one or two distinct installed Node paths')
    need(all(Path(node).is_absolute() and Path(node).is_file() for node in nodes), 'Node paths must be absolute existing files')
    started = time.monotonic()
    result = {'kind': 'ARCHIVED_STEP77_SCALAR_STUDY', 'status': 'IN_PROGRESS',
              'candidateOperandsObserved': False, 'candidateSourcePresent': False,
              'historicalAngleBits': HISTORICAL_BITS, 'recordedCandidateAngleBits': CANDIDATE_BITS,
              'rawBitGateChanged': False, 'publicActivation': 'NO_GO',
              'readOnlyProbeFailure': {'kind': 'SCHEMA_PROBE_KEYERROR', 'key': 'output.joints',
                                      'filesChanged': 0, 'mathematicalCalls': 0,
                                      'note': 'Earlier read-only locator probe printed DATA then assumed a nonexistent output.joints field.'},
              'calls': {'world': 0, 'projection': 0, 'motor': 0, 'free': 0, 'contact': 0, 'solve': 0, 'derive': 0,
                        'atan2Attempted': 0, 'atan2Completed': 0, 'fractionCertificatesCompleted': 0},
              'certificates': [], 'runtimeAttempts': [], 'limitations': [
                  'Reconstructed historical operands are not observations from absent candidate 7178434a.',
                  'Final body-byte equality does not establish equal preprojection operands.',
                  'Correct-rounding classification does not change the historical exact-bit gate.',
                  'A scalar study does not repair or activate PhysicsWorld.',
                  'Historical architecture, V8 and math library provenance remain unproved.']}
    try:
        bodies = load_data(result)
        expected = []
        for index in range(2):
            a, b = bodies[2 * index][6:10], bodies[2 * index + 1][6:10]
            relative, y, x = operands(a, b)
            certificate = certify(y, x)
            certificate.update({'pair': index, 'quaternionABits': list(map(bits, a)),
                                'quaternionBBits': list(map(bits, b)), 'relativeBits': list(map(bits, relative))})
            result['certificates'].append(certificate)
            result['calls']['fractionCertificatesCompleted'] += 1
            expected.append(certificate)
        seen_versions = set()
        for node in nodes:
            remaining = 90 - (time.monotonic() - started)
            need(remaining > 0, 'Process time budget exhausted')
            executable = Path(node).resolve()
            executable_hash = sha(read_bounded(executable, 256 * 1024 ** 2))
            remaining = 90 - (time.monotonic() - started)
            need(remaining > 0, 'Process time budget exhausted during executable authentication')
            attempt = {'executable': str(executable), 'sha256': executable_hash, 'status': 'ATTEMPTED'}
            result['runtimeAttempts'].append(attempt)
            # Two planned scalar calls are charged as attempted at launch. A failed
            # child leaves completed counts unproved rather than filling them in.
            result['calls']['atan2Attempted'] += 2
            environment = dict(os.environ)
            environment.pop('NODE_OPTIONS', None)
            environment.pop('NODE_PATH', None)
            child = subprocess.run([str(executable), str(HERE / 'hinge-runtime.mjs')],
                input=json.dumps({'version': 1, 'postContactRawHex': result['postContactRawHex']}).encode(),
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=remaining, env=environment, check=False)
            attempt.update({'exitCode': child.returncode, 'stdout': child.stdout.decode('utf8', 'replace'),
                            'stderr': child.stderr.decode('utf8', 'replace')})
            need(len(child.stdout) <= 65536 and len(child.stderr) <= 65536, 'Runtime output budget exceeded')
            need(child.returncode == 0, 'Runtime process failed')
            reply = parse(child.stdout)
            need(reply['atan2Calls'] == 2 and len(reply['pairs']) == 2 and reply['candidateOperandsObserved'] is False,
                 'Runtime count/schema differs')
            result['calls']['atan2Completed'] += reply['atan2Calls']
            version = reply['runtime']['node']
            need(version in ('v22.19.0', 'v24.22.1') and version not in seen_versions, 'Runtime version outside frozen selection')
            seen_versions.add(version)
            for actual, wanted in zip(reply['pairs'], expected):
                for key in ('pair', 'quaternionABits', 'quaternionBBits', 'relativeBits', 'yBits', 'xBits'):
                    need(actual[key] == wanted[key], 'Runtime reconstructed operand mismatch: ' + key)
                actual['matchesCorrectlyRoundedAtan2'] = actual['atan2Bits'] == wanted['atan2CorrectlyRoundedBits']
                actual['matchesHistoricalBits'] = actual['targetBits'] == HISTORICAL_BITS
                actual['matchesRecordedCandidateBits'] = actual['targetBits'] == CANDIDATE_BITS
            attempt.update({'status': 'COMPLETE', 'reply': reply})
        result['status'] = 'COMPLETE_SCALAR_CLASSIFICATION_ONLY'
    except Exception as error:
        result['status'] = 'EXECUTION_FAILURE'
        result['error'] = {'type': type(error).__name__, 'message': str(error)}
    result['elapsedSeconds'] = time.monotonic() - started
    result['scriptHashes'] = {name: sha(read_bounded(HERE / name, 131072))
                              for name in ('hinge-study.py', 'hinge-runtime.mjs', 'hinge-contract.md')}
    live = HERE / 'evidence/preread/issue-1489-comments-live.json'
    if live.exists():
        result['liveCommentSnapshotSha256'] = sha(read_bounded(live, 4 * 1024 ** 2))
    encoded = (json.dumps(result, indent=2, allow_nan=False) + '\n').encode()
    need(len(encoded) <= 1024 ** 2, 'Output exceeds 1 MiB')
    with output.open('xb') as stream:
        stream.write(encoded)
    return 0 if result['status'] == 'COMPLETE_SCALAR_CLASSIFICATION_ONLY' else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--node', action='append', required=True)
    args = parser.parse_args()
    return run(args.output, args.node)


if __name__ == '__main__':
    sys.exit(main())
