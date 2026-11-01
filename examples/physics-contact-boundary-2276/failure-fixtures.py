#!/usr/bin/env python3
"""Authenticate immutable DATA and export six boundary fixtures. No geometry import."""
import argparse
import copy
import gzip
import hashlib
import io
import json
import math
from pathlib import Path
import signal
import struct
import sys

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
ARCHIVE_RELATIVE = 'examples/physics-stack-solver-2276/evidence/world-source-03'
ARCHIVE = ROOT / ARCHIVE_RELATIVE
BASE = '8d7474ba0b4df5367dbeee93b3a95cb777dcac48'
PINS = {
    'ALIGNED.jsonl.gz': (96725, '5b736f932da555d4f481770fa16d7b04bd3cfb6b98a57fc9ec60f36c84244dd9', 1015937, '401799636780ef1e64088a14fba8ee8d9f9fba9558759e6eb7245ecb0973f430', '7770dd9dcf5f4f5b9392f321388d9da553d7c57a'),
    'OFFSET.jsonl.gz': (23251, '8668779657e073257dfd52c1289ab1b6babca773e7014df4c4b2371d6cf4647a', 364535, 'e613eb54ee91734fa20a03c9e05f6d847ffc63f897fc145d709dc585b20f6f9b', 'd8cbb9390fe7031c10444f122eb801d1a4ba0eb2'),
    'YAW.jsonl.gz': (34794, 'a47d33315f99ad1569bf20c503cd8a0fd169c7c9e8c5e66c42333cf9b97ae8e2', 445724, '56dae93241f95abd6fa10798fbebaba569651c14a92d2b970b20feb01843abdf', '2dd5f75fefe72717ffc84acc66ac137211712bb0'),
    'ALIGNED.f64le.gz': (1367, '1ea8dfd206a8999ac5261cef0797e74adee15ee7c80673ca690240a9c8724f7f', 15912, '61198eb4d101981bb084d4a7770584655502138caa276bbd74970ac4dbbf0b46', '7ebd6ee8e6a25abe29f4527d076f2ac17d8f0f0a'),
    'OFFSET.f64le.gz': (523, '0ef45dc8e0f5f208dfb24f35161b04e0d5267c113d7aaa0eb81aa10267a9ab0d', 8424, '6a22ebe2cc0ea930956624ce4751e516f79dff2ad09f217b3447ae739b2694f6', '97f293478ae15b0df49e8f506c725d9e7c8923ce'),
    'YAW.f64le.gz': (558, '73f2f5ce8b8bf704167ed4b51d62a67c89f385a886ca76e581f8edfcf6a1a2a8', 8424, 'e201b3e0eda626cb1c1961f7502dddebc68ac4a533a7c7fedec6c3a0b749cf5a', '2c4f89057686c57bfc97fa96710a90d216d4669e'),
}
JSON_PINS = {
    'result.json': (26621, '29f278e54caf91b67904b23b13a682cf1eed7545744417d98b9d27f7096358da'),
    'source.json': (17864, 'b6cead754f4fb1b8ac6e02069beacb82eac397588bf96962bff7eb10d17b561d'),
}
CASE_PINS = {
    'ALIGNED:1': ('2e4790c746788bc1f77e0656a3b536f7fd0e8b86f5badb8255a53ac74d317871', 0),
    'ALIGNED:2': ('f0bc26cc9cf0f97c58d92a07bc2d19557a3721d1d93c3d5e0acbce11edc27bcb', 31),
    'OFFSET:1': ('493899ea1bec814949433b5e4882dfa07a49c49a822ba110f00dda7e0be1d12b', 14),
    'YAW:1': ('41743b1962f48b3ae0e92c324d6edd588dfdba08f8705bb9f15a02ac6911ff54', 32),
}
NEW_ARCHIVE_RELATIVE = 'examples/physics-contact-boundary-2276/evidence/world-source-01'
NEW_PINS = {
    'ALIGNED.jsonl.gz': (322766, '10a0a5791a38e1dde80d040c1774b817147bb15738dbf1476ac2179ad773a017', 2497299, '988f3438ac63a74f9fbd7b6ef56b2739455c256e0e6e4fb4ab3d597275328db5'),
    'OFFSET.jsonl.gz': (140767, '3b8567b349dbefc51d4767392b5ef412fdd0582526b58ac19ead132e6637aaaa', 1301068, '004651d2330efd7a770dc5f82b68310c3c6738ee15689ba1029481884c00f237'),
    'ALIGNED.f64le.gz': (4569, 'abc0bed0f94c69716873954b388d94f99fe92fd2f7438724111e1faeb5de8926', 30888, 'e784ee225fe7d54d2ad752a451a8b12833d29f0ca7d6cfd4141d90a2d8db702f'),
    'OFFSET.f64le.gz': (1404, '7634a96dbb8cb45d13bada32bdb3af0c898b554f7638e3c506db06113016ecc8', 15912, 'e165944ad8570c8f32c8e236420cfd5ddc92fdaf393a8144c0ca91c7d895e71a'),
}
NEW_JSON_PINS = {
    'source.json': (21891, 'fd32ccfa7c09c9f243b9f7bc3ec5a6b8016ea3cba717a9bc33c2fad37e3c0b6e'),
    'world-consumer-graph.json': (7797, 'e921d9a886671542593f15903548b7cb013d853bb2284c27e7fd263b63db3782'),
    'ALIGNED-result.json': (1632, '80d2f6a2817ac1484c87fd9529b667eed78799ca8850cf34e66616ff4722eb6f'),
    'OFFSET-result.json': (412684, 'de5be4d1d8a82a8bbe359822874c85543efc61c43464af53ff11fcc2036b6349'),
}
NEW_CASE_PINS = {
    'ALIGNED:4': ('ac472eb027a2b40f8f473a852a61b01cf9be0a4df87cba78ec8160e77e86172c', [26], []),
    'OFFSET:2': ('152fcba2eaaa29a9b5fecc8b7eaf041842dfcd13f7a49a5234e9da23863e739f', [11], [18]),
}
ORIGIN_SOURCE_PINS = {
    'examples/physics-rigid-feature-geometry/face-contact.ts': '63a9fead6d88a25d07afc005d3fbd2cebb5fdb88c949123e84fb5681f2f4d3dc',
    'examples/physics-rigid-feature-geometry/strict-line.ts': '972b48005563fb4815aa54a86eab8356a4a52952b6dfaec1990f72e610ba5bee',
    'examples/physics-stack-solver-2276/trajectory-reference.py': 'f2c1850b193a14944de657848d065c461e3ff2440e9e9bf452b6d24519af0ea0',
}
FIELDS = (('positionM', 3), ('velocityMps', 3), ('orientation', 4), ('angularVelocityRadps', 3))
MAX_FILE = 16 * 1024 ** 2


class DataError(Exception):
    pass


def need(condition, message):
    if not condition:
        raise DataError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def read(path, maximum):
    with Path(path).open('rb') as stream:
        data = stream.read(maximum + 1)
    need(len(data) <= maximum, 'File bound exceeded: ' + str(path))
    return data


def unique(pairs):
    result = {}
    for key, value in pairs:
        need(key not in result, 'Duplicate JSON key')
        result[key] = value
    return result


def parse(data):
    def invalid(_):
        raise DataError('Nonfinite JSON constant')
    return json.loads(data, object_pairs_hook=unique, parse_constant=invalid)


def encode(value):
    return (json.dumps(value, indent=2, allow_nan=False, ensure_ascii=False) + '\n').encode()


def write_new(path, value):
    encoded = encode(value)
    need(len(encoded) <= MAX_FILE, 'Output exceeds 16 MiB')
    with Path(path).open('xb') as stream:
        stream.write(encoded)


def restore_bodies(bodies, raw):
    need(type(bodies) is list and len(bodies) == 9 and len(raw) == 936, 'Nine raw13 bodies required')
    result, offset = copy.deepcopy(bodies), 0
    for body in result:
        for field, count in FIELDS:
            values = list(struct.unpack_from('<' + 'd' * count, raw, offset))
            need(all(math.isfinite(value) for value in values), 'Nonfinite body raw data')
            need(values == body[field], 'Body JSON/raw numeric mismatch')
            body[field] = values
            offset += count * 8
    return result


def restore_points(ledger, raw_hex):
    need(type(ledger) is list and len(ledger) == 32 and type(raw_hex) is str
         and len(raw_hex) == 3072 and all(c in '0123456789abcdef' for c in raw_hex), '32 raw points required')
    raw, result = bytes.fromhex(raw_hex), copy.deepcopy(ledger)
    for index, point in enumerate(result):
        values = struct.unpack_from('<6d', raw, index * 48)
        need(all(math.isfinite(value) for value in values), 'Nonfinite point raw data')
        need(list(values[:3]) == point['pointM'] and list(values[3:]) == point['normal'], 'Point JSON/raw numeric mismatch')
        point['pointM'], point['normal'] = list(values[:3]), list(values[3:])
    return result


def frame_arrays(record):
    if record['kind'] == 'initial':
        return [('initial', record['state']['bodies'])]
    need([stage['stage'] for stage in record['stages']] == ['free-ready', 'velocity-ready', 'closure-ready'], 'Stage order differs')
    arrays = [('before', record['before']['state']['bodies'])]
    for stage in record['stages']:
        for key in ['freeBodies', 'velocityBodies', 'finalBodies']:
            if stage['ledger'].get(key) is not None:
                arrays.append((stage['stage'] + '.' + key, stage['ledger'][key]))
    arrays.append(('after', record['after']['state']['bodies']))
    need(len(arrays) == 8, 'Expected eight raw frames per step')
    return arrays


def load_archive(archive, pins, metadata_pins, case_pins, scenes, new_origin=False):
    """Return deterministic authenticated DATA. No independent geometry functions run."""
    decoded, authentication = {}, {}
    for name, (count, digest) in metadata_pins.items():
        data = read(archive / name, 1024 ** 2 if new_origin else 65536)
        need(len(data) == count and sha(data) == digest, 'Immutable metadata mismatch: ' + name)
        authentication[name] = {'bytes': count, 'sha256': digest}
    if new_origin:
        source = parse(read(archive / 'source.json', 65536))
        need(source['mode'] == 'world-source' and source['parent'] == BASE, 'New archive origin differs')
        origins = {entry['path']: entry['sha256'] for entry in source['files']}
        need(len(origins) == len(source['files']), 'Duplicate origin source entry')
        need(all(origins.get(path) == digest for path, digest in ORIGIN_SOURCE_PINS.items()), 'Frozen origin source differs')
        authentication['origin'] = {'authority': 'UNCOMMITTED_SAVED_BYTES_AND_SOURCE_RECEIPT',
                                    'sourceFiles': source['files'], 'parent': source['parent'],
                                    'gitBlobClaimed': False}
    else:
        summary = parse(read(archive / 'result.json', 65536))
        need(summary['publicApi'] == 'NO_GO' and summary['allPrivateTrajectoriesGO'] is False, 'Prior scope changed')
    for name, pin in pins.items():
        size, digest, decoded_size, decoded_sha = pin[:4]
        encoded = read(archive / name, 512 * 1024 if new_origin else 128 * 1024)
        need(len(encoded) == size and sha(encoded) == digest, 'Compressed archive mismatch: ' + name)
        if not new_origin:
            git_blob = pin[4]
            blob = hashlib.sha1(('blob ' + str(size) + '\0').encode() + encoded).hexdigest()
            need(blob == git_blob, 'Commit8d Git blob identity differs: ' + name)
        maximum = (4 if new_origin else 2) * 1024 ** 2 if '.jsonl.' in name else 32 * 1024
        with gzip.GzipFile(fileobj=io.BytesIO(encoded)) as stream:
            data = stream.read(maximum + 1)
        need(len(data) <= maximum and len(data) == decoded_size and sha(data) == decoded_sha, 'Decoded archive mismatch: ' + name)
        decoded[name] = data
        authentication[name] = {'compressedBytes': size, 'compressedSha256': digest,
                                'decodedBytes': decoded_size, 'decodedSha256': decoded_sha}
        if not new_origin:
            authentication[name]['gitBlob'] = git_blob
    cases, locations, raw_frames_checked = [], [], 0
    for scene in scenes:
        raw, raw_offset = decoded[scene + '.f64le.gz'], 0
        lines = decoded[scene + '.jsonl.gz'].splitlines(keepends=True)
        expected_records = (5 if scene == 'ALIGNED' else 3) if new_origin else (3 if scene == 'ALIGNED' else 2)
        need(len(lines) == expected_records, 'Unexpected archive record count')
        for line_number, line in enumerate(lines, 1):
            need(line.endswith(b'\n') and len(line) <= 1024 ** 2, 'Selected JSON record bound/layout')
            record = parse(line)
            need(record['scene'] == scene, 'Scene differs')
            free, free_raw = None, None
            for label, bodies in frame_arrays(record):
                frame = raw[raw_offset:raw_offset + 936]
                restored = restore_bodies(bodies, frame)
                if label == 'free-ready.freeBodies':
                    free, free_raw = restored, frame
                raw_offset += 936
                raw_frames_checked += 1
            if record['kind'] == 'initial':
                continue
            case_id = scene + ':' + str(record['step'])
            if new_origin and case_id not in case_pins:
                continue
            need(case_id in case_pins and sha(line) == case_pins[case_id][0], 'Selected record identity/hash differs')
            baseline = record['contactGeometry']
            need(baseline['pointChecks'] == 32 and len(baseline['rows']) == 32, 'Saved baseline not complete')
            unresolved = [index for index, row in enumerate(baseline['rows']) if row['precisionResolved'] is False]
            failed = [index for index, row in enumerate(baseline['rows']) if row['precisionResolved'] is True and row['violations']]
            if new_origin:
                need(failed == case_pins[case_id][1] and unresolved == case_pins[case_id][2], 'New failure/unresolved coverage differs')
            else:
                need(len(failed) == case_pins[case_id][1] and not unresolved, 'Saved failure coverage differs')
            need(baseline['resolved'] is (not unresolved) and baseline['executionFailure'] is bool(unresolved),
                 'Saved baseline resolution flags differ')
            ledger = record['stages'][1]['ledger']['points']
            points = restore_points(ledger, record['pointOperandF64leHex'])
            need(len({(point['pairKey'], point['pointId']) for point in points}) == 32, 'Saved row identity collision')
            need(all(point['family'] == 'face' for point in points), 'Only saved face rows admitted')
            for index, point in enumerate(points):
                row = record['event']['problem']['points'][index]
                need(row['pointM'] == point['pointM'] and row['normalAtoB'] == point['normal']
                     and row['aId'] == point['aId'] and row['bId'] == point['bId'], 'Event/ledger point correspondence')
                need(point['aPositionM'] == free[point['aIndex']]['positionM']
                     and point['bPositionM'] == free[point['bIndex']]['positionM'], 'Point/free COM correspondence')
            cases.append({'caseId': case_id, 'scene': scene, 'step': record['step'],
                          'freeBodies': free, 'freeBodyRawHex': free_raw.hex(),
                          'originalPointLedger': points, 'pointOperandF64leHex': record['pointOperandF64leHex'],
                          'expectedFailedIndexes': failed, 'baselineReference': baseline})
            cases[-1]['expectedUnresolvedIndexes'] = unresolved
            locations.append({'caseId': case_id, 'jsonLineNumber': line_number, 'jsonLineBytes': len(line),
                              'jsonLineSha256': sha(line), 'freeBodyRawSha256': sha(free_raw)})
        need(raw_offset == len(raw), 'Trailing/missing raw body frames')
    need([case['caseId'] for case in cases] == list(case_pins), 'Fixed selected-case order')
    return cases, authentication, locations, raw_frames_checked


def load_fixtures():
    """Return one canonical six-case DATA set. No geometry functions run."""
    cases, authentication, locations, raw_frames_checked = load_archive(
        ARCHIVE, PINS, JSON_PINS, CASE_PINS, ['ALIGNED', 'OFFSET', 'YAW'])
    added, new_authentication, new_locations, new_frames = load_archive(
        ROOT / NEW_ARCHIVE_RELATIVE, NEW_PINS, NEW_JSON_PINS, NEW_CASE_PINS, ['ALIGNED', 'OFFSET'], True)
    cases.extend(added)
    need([case['caseId'] for case in cases] == list(CASE_PINS) + list(NEW_CASE_PINS), 'Canonical six-case order')
    return {'version': 1, 'provenance': {'base': BASE, 'archive': ARCHIVE_RELATIVE,
            'authentication': authentication, 'selectedRecords': locations,
            'newArchive': NEW_ARCHIVE_RELATIVE, 'newAuthentication': new_authentication,
            'newSelectedRecords': new_locations,
            'rawBodyFramesChecked': raw_frames_checked + new_frames,
            'priorTrajectoryErrorHelperWiring': 'UNWIRED_IN_PRIOR_RUNNER; NEW_PARENT_RUNNER_REQUIRED',
            'worldCalls': 0, 'solverCalls': 0, 'geometryCalls': 0},
            'totals': {'cases': 6, 'rows': 192, 'historicalFailedRows': 79, 'historicalUnresolvedRows': 1,
                       'historicalBadRows': 80, 'historicalPassingRows': 112,
                       'positiveControlRows': 32}, 'cases': cases}


def deadline(_signal, _frame):
    raise TimeoutError('170s process deadline')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    need(not args.output.exists(), 'Output path must be new')
    signal.signal(signal.SIGALRM, deadline)
    signal.alarm(170)
    try:
        fixtures = load_fixtures()
        write_new(args.output, fixtures)
        print(json.dumps({'status': 'AUTHENTICATED_BOUNDARY_DATA_EXPORTED', **fixtures['totals'],
                          'fixtureSha256': sha(encode(fixtures)), 'worldCalls': 0, 'solverCalls': 0}))
        return 0
    except Exception as error:
        write_new(args.output, {'status': 'EXECUTION_FAILURE', 'errorType': type(error).__name__, 'message': str(error),
                                'worldCalls': 0, 'solverCalls': 0, 'geometryCalls': 0})
        return 1
    finally:
        signal.alarm(0)


if __name__ == '__main__':
    sys.exit(main())
