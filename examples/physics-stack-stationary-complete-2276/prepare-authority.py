"""Root-only bounded data IO. No solver/reference/World/import/build execution."""
import argparse
import gzip
import hashlib
import json
from math import isfinite
from pathlib import Path
import struct

HOME = Path(__file__).resolve().parent
ROOT = HOME.parents[1]
PROFILE = 'STATIONARY_NORMAL_EXACT_V1'
ADMISSION = 'ROOT_SAME32_SOURCE_NATIVE_FRACTION_FLOAT_CONFIRMED'
CAP = 2**21
SCENES = ('ALIGNED', 'OFFSET', 'YAW')


def need(value, reason):
    if not value:
        raise ValueError(reason)


def pin(path):
    path = Path(path)
    need(path.is_file() and not path.is_symlink(), 'REGULAR_FILE:' + str(path))
    before = path.stat()
    h = hashlib.sha256()
    with path.open('rb') as stream:
        while block := stream.read(65536):
            h.update(block)
    after = path.stat()
    need((before.st_size, before.st_mtime_ns) == (after.st_size, after.st_mtime_ns), 'INPUT_CHANGED')
    return dict(bytes=after.st_size, sha256=h.hexdigest())


def bounded(path, limit=CAP):
    need(path.stat().st_size <= limit, 'INPUT_BOUND:' + str(path))
    blocks = []
    with path.open('rb') as stream:
        while block := stream.read(65536):
            blocks.append(block)
    return b''.join(blocks)


def read(path):
    return json.loads(bounded(path))


def relative(path):
    return Path(path).resolve().relative_to(ROOT).as_posix()


def inflated(path, limit):
    need(path.stat().st_size <= CAP, 'COMPRESSED_PIECE_BOUND')
    blocks, size = [], 0
    with gzip.open(path, 'rb') as stream:
        while block := stream.read(min(65536, limit + 1 - size)):
            size += len(block)
            need(size <= limit, 'DECODED_PIECE_BOUND')
            blocks.append(block)
    return b''.join(blocks)


def numeric_count(value):
    if type(value) in (int, float):
        need(isfinite(float(value)), 'FINITE_RECORD_NUMBER')
        return 1
    if type(value) is dict:
        return sum(numeric_count(x) for x in value.values())
    if type(value) is list:
        return sum(numeric_count(x) for x in value)
    return 0


def json_number_equivalent(a, b):
    # Node has one finite Number type; JSON0 cannot preserve a previous negative zero.
    if type(a) in (int, float) and type(b) in (int, float):
        return isfinite(float(a)) and isfinite(float(b)) and float(a) == float(b)
    if type(a) is not type(b):
        return False
    if type(a) is dict:
        return list(a) == list(b) and all(json_number_equivalent(a[k], b[k]) for k in a)
    if type(a) is list:
        return len(a) == len(b) and all(json_number_equivalent(x, y) for x, y in zip(a, b))
    return a == b


def raw_agrees(record, raw, step):
    frames = [record['state']['bodies']] if step == 0 else [record['before']['bodies'],
        record['prepared']['diagnostics']['freeBodies'], record['prepared']['diagnostics']['velocityBodies'],
        record['prepared']['candidateBodies']]
    need(len(raw) == len(frames)*936, 'EXACT_BODY_RAW_POPULATION')
    at = 0
    for bodies in frames:
        need(len(bodies) == 9, 'NINE_BODY_RAW_FRAME')
        for body in bodies:
            for key, count in [('positionM', 3), ('velocityMps', 3), ('orientation', 4), ('angularVelocityRadps', 3)]:
                need(len(body[key]) == count, 'BODY_FIELD_SHAPE')
                for value in body[key]:
                    n = struct.unpack_from('<d', raw, at)[0]
                    at += 8
                    need(isfinite(n) and n == float(value), 'JSON_BODY_VS_RAW_NONZERO')
    # JSON cannot recover -0. Raw source/native bytes are compared independently.


def validate(run, canonical):
    need(run.is_dir() and run.parent.name == 'evidence' and run.parent.parent.name == 'physics-stack-stationary-library-2276', 'NEW_LIBRARY_RUN_ONLY')
    result = read(run / 'result.json')
    need(result['status'] == 'PASS_BOUNDED_EXACT_STATIONARY_PACKAGE_STACK_PHASE' and result['parity'] is True and result['firstFailure'] is None, 'ACTUAL_NEW_LIBRARY_PASS')
    source, native = read(run / 'source/result.json'), read(run / 'native/result.json')
    expected = [(scene, n) for n in (1, 16) for scene in SCENES]
    for value in (source, native):
        need(value['status'] == 'PASS_INTERNAL_PHASE_FIRST32_ONE_STEP_AND_FRESH16' and value['firstFailure'] is None, 'ACTUAL_PHASE_PASS')
        need([(r['scene'], r['selectedSteps']) for r in value['reports']] == expected, 'ACTUAL_FIXED_REPORT_SCHEDULE')
        for row in value['reports']:
            need(row['failure'] is None and row['phaseAccepted'] == row['selectedSteps'], 'ALL_PHASE_ACCEPTED')
    need(source['reports'] == native['reports'], 'SOURCE_NATIVE_REPORT_WORD_RAW_PARITY')
    before, after = read(run / 'frozen-before.json'), read(run / 'frozen-after.json')
    need(before == after, 'QUALIFIED_RUN_SOURCE_INTEGRITY')
    provenance = read(canonical)
    need(provenance.get('qualifiedRuntimeClosure') is True, 'ROOT_QUALIFIED_AST_RUNTIME_CLOSURE_REQUIRED')
    need(provenance['aggregateAlgorithm'] == 'SHA256_UTF8_COMPACT_JSON_ORDERED_ARRAY_OF_PATH_AND_SHA256_PROVIDER_ONLY', 'DECLARED_PROVIDER_ONLY_AGGREGATE')
    rows = [dict(path=name, sha256=value['sha256']) for name, value in provenance['files'].items() if name.startswith('canonical-provider/')]
    digest = hashlib.sha256(json.dumps(rows, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()
    need(digest == provenance['providerDigest'], 'ACTUAL_PROVIDER_AGGREGATE')
    need(provenance.get('sources'), 'EXPLICIT_CURRENT_SOURCE_GRAPH')
    for name, expected_pin in provenance['sources'].items():
        path = ROOT / name
        need(pin(path) == expected_pin and before.get(str(path.resolve())) == expected_pin['sha256'], 'CANONICAL_VS_ACTUAL_RUN_SOURCE:' + name)
    for name, expected_pin in provenance['files'].items():
        need(not Path(name).is_absolute() and '..' not in Path(name).parts, 'CANONICAL_RELATIVE_PATH')
        need(pin(canonical.parent / name) == expected_pin, 'ACTUAL_CANONICAL_FILE:' + name)
    return provenance, native


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--run', required=True, type=Path)
    parser.add_argument('--canonical', required=True, type=Path)
    args = parser.parse_args()
    run, canonical = args.run.resolve(), args.canonical.resolve()
    target = HOME / 'AUTHORITY.json'
    need(not target.exists(), 'FRESH_AUTHORITY_REQUIRED')
    provenance, native = validate(run, canonical)
    records, authority, decoded = {}, {}, {}
    descriptor = lambda path: dict(path=relative(path), **pin(path))
    # Read own Source+Native pieces. No old QR or runtime05 trajectory is opened.
    total_records = 0
    for report in native['reports']:
        scene, count = report['scene'], report['selectedSteps']
        json_hash, raw_hash = hashlib.sha256(), hashlib.sha256()
        leaves = raw_bytes = 0
        for step in range(count+1):
            stem = f'{scene}-{count}-{step}'
            paths = {graph: (run / graph / (stem+'.jsonl.gz'), run / graph / (stem+'.f64le.gz')) for graph in ('source', 'native')}
            left = inflated(paths['source'][0], CAP)
            right = inflated(paths['native'][0], CAP)
            lb = inflated(paths['source'][1], 3744)
            rb = inflated(paths['native'][1], 3744)
            need(left == right and lb == rb, 'WHOLE_SOURCE_NATIVE_RECORD_RAW_BYTES')
            record = json.loads(right)
            need(record['scene'] == scene and (record['state']['stepIndex'] if step == 0 else record['step']) == step, 'RECORD_SEMANTIC_IDENTITY')
            raw_agrees(record, rb, step)
            json_hash.update(right)
            raw_hash.update(rb)
            leaves += numeric_count(record)
            raw_bytes += len(rb)
            if count == 16:
                records[f'{scene}:{step}'] = dict(json=descriptor(paths['native'][0]), raw=descriptor(paths['native'][1]))
                decoded[f'{scene}:{step}'] = record
            total_records += 1
        evidence = report['evidence']
        need(json_hash.hexdigest() == evidence['decodedRecordSha256'] and raw_hash.hexdigest() == evidence['rawSha256'], 'ACTUAL_DECODED_RAW_REPORT_HASHES')
        need(raw_bytes == evidence['rawBytes'] and leaves == evidence['numericLeaves'], 'ACTUAL_RECORD_POPULATION')
        need(len(evidence['binary64BeWordSha256']) == 64, 'ACTUAL_LIVE_WORD_DIGEST_REQUIRED')
    cursor = dict(geometry=0, position=0)
    pairs_checked = 0
    for report in native['reports']:
        scene, count = report['scene'], report['selectedSteps']
        for step in range(count+1):
            for op in (['quality'] if step == 0 else ['contacts', 'world', 'step-ledger', 'quality']):
                label = 'geometry' if op in ('contacts', 'quality') else 'position'
                cursor[label] += 1
                stem = f'{label}-{cursor[label]}'
                pair = {}
                values = {}
                for kind in ('request', 'reply'):
                    path = run / 'native' / (stem+'-'+kind+'.json')
                    data = bounded(path)
                    need(data == bounded(run / 'source' / path.name), 'EXACT_SOURCE_NATIVE_RPC_BYTES')
                    pair[kind] = descriptor(path)
                    values[kind] = json.loads(data)
                request, reply = values['request'], values['reply']
                need(request['op'] == op and reply['resolved'] is True and not reply.get('executionFailure', False) and reply['violations'] == [], 'ACTUAL_REFERENCE_PASS')
                if op in ('world', 'step-ledger'):
                    need(request['scene'] == scene and request['stepIndex'] == step, 'RPC_SCENE_STEP')
                if op == 'quality':
                    need(request['request']['state']['stepIndex'] == step, 'QUALITY_STEP')
                if op == 'world':
                    check = request['stationaryNormalWitnessCheck']
                    need(set(check) == {'problem', 'result', 'problemWordsF64leHex', 'resultWordsF64leHex'}, 'FOUR_KEY_ACTUAL_WITNESS_WIRE')
                    exact = reply['stationaryNormalWitnessCheck']
                    need(exact['ok'] is True and exact['resolved'] is True and exact['executionFailure'] is False and exact['violations'] == [] and exact['status'] == 'EXACT_STATIONARY_WITNESS_VERIFIED', 'ACTUAL_FRACTION_REPORT')
                if count == 16:
                    key = f'{scene}:{step}:{op}'
                    authority[key] = pair
                    record = decoded[f'{scene}:{step}']
                    field = dict(contacts='contactGeometry', world='positionCheck', **{'step-ledger':'ledgerCheck'}, quality='quality')[op]
                    need(json_number_equivalent(reply, record[field]), 'WIRE_REPLY_VS_COMPLETE_RECORD_VALUES')
                pairs_checked += 1
    need(total_records == 57 and len(records) == 51 and len(authority) == 195 and pairs_checked == 210, 'FIXED_ACTUAL_SELECTION')
    result = dict(format='stationary-complete-authority-v1', profile=PROFILE, stationaryCandidateAdmission=ADMISSION,
        providerDigest=provenance['providerDigest'], canonicalProvenance=descriptor(canonical),
        libraryRunReceipt=relative(run/'result.json'), sourceReceipt=relative(run/'source/result.json'),
        nativeReceipt=relative(run/'native/result.json'), nativeRoot=relative(run/'native'), records=records, authority=authority,
        selectionProof=dict(actualOwnRecordsRead=57, fresh16SelectedRecords=51, actualPairsByteCompared=210,
            selectedFresh16Pairs=195, liveWordDigests='ACTUAL_SOURCE_NATIVE_REPORT_PARITY_NOT_RECONSTRUCTED_FROM_JSON',
            jsonZeroSignLimit='RAW_BODY_BYTES_SEPARATE;ALLWORD_DIGESTS_FROM_ACTUAL_LIVE_REPORTS',
            solverCalls=0, referenceCalls=0, API=False))
    validate(run, canonical)
    encoded = (json.dumps(result, sort_keys=True, indent=2)+'\n').encode()
    need(len(encoded) <= CAP, 'AUTHORITY_METADATA_BOUND')
    with target.open('xb') as stream:
        stream.write(encoded)
    print(json.dumps(dict(status='ACTUAL_AUTHORITY_IO_CONFIRMED', path=relative(target), pin=pin(target))))

if __name__ == '__main__':
    main()
