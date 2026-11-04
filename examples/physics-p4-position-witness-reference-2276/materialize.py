#!/usr/bin/env python3
"""Root-run data/literal materializer. AUTHOR MUST NOT EXECUTE."""
from pathlib import Path
from hashlib import sha256
import copy
import json
import struct
import sys
import time

HOME = Path(__file__).resolve().parent
ROOT = HOME.parents[1]
MAX_REPLY = 2 * 1024 * 1024
MAX_EVIDENCE = 16 * 1024 * 1024
MAX_RETAINED = 64 * 1024 * 1024
START = None
WRITTEN = 0


def need(value, reason):
    if not value:
        raise ValueError(reason)


def deadline():
    need(START is None or time.monotonic() - START < 170, 'MATERIALIZER_170S_LIMIT')


def pin(path):
    data = path.read_bytes()
    return {'bytes': len(data), 'sha256': sha256(data).hexdigest()}


def loaded(path):
    deadline()
    need(path.stat().st_size <= MAX_REPLY, 'MATERIALIZER_INPUT_FILE_LIMIT')
    return json.loads(path.read_text())


def encoded(value):
    return (json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False) + '\n').encode()


def allocation(value, seen=None):
    if seen is None:
        seen = set()
    if id(value) in seen:
        return 0
    seen.add(id(value))
    size = sys.getsizeof(value)
    if isinstance(value, dict):
        size += sum(allocation(k, seen) + allocation(v, seen) for k, v in value.items())
    elif isinstance(value, (list, tuple)):
        size += sum(allocation(v, seen) for v in value)
    need(size <= MAX_RETAINED, 'MATERIALIZER_ACTUAL_RETAINED_DATA_LIMIT')
    return size


def put(path, data):
    global WRITTEN
    deadline()
    need(len(data) <= MAX_REPLY and WRITTEN + len(data) <= MAX_EVIDENCE, 'MATERIALIZER_OUTPUT_LIMIT')
    with path.open('xb') as stream:
        stream.write(data)
    WRITTEN += len(data)
    return {'bytes': len(data), 'sha256': sha256(data).hexdigest()}


def mutate(request, control):
    value = copy.deepcopy(request)
    result, change = value['result'], control['mutation']
    kind = change['kind']
    if kind == 'duplicate-observed-index':
        result['basisRows'][change['position']] = change['value']
    elif kind == 'add-observed-index':
        result['basisRows'].append(change['row'])
        result['basisRows'].sort()
        result['basisRank'] = change['basisRank']
    elif kind == 'remove-observed-index':
        result['basisRows'].remove(change['row'])
        result['basisRank'] = change['basisRank']
    elif kind == 'replace-observed-component':
        # This is a fixed data literal, not a solve or a fitted perturbation.
        numerator, denominator = change['newExactM'].split('/')
        body = next(item for item in result['translations'] if item['id'] == change['bodyId'])
        body['u'][change['axis']] = int(numerator) / int(denominator)
    else:
        raise ValueError('MATERIALIZER_UNKNOWN_FROZEN_MUTATION')
    return value


def force_provenance(bank):
    authority = bank['same32ForceBank']
    fixtures = loaded(ROOT / authority['fixture'])
    frame = next(c for c in fixtures['cases'] if c['caseId'] == 'ALIGNED:1')
    ledger = frame['originalPointLedger']
    need(len(ledger) == 32 and len({(p['pairKey'], p['pointId']) for p in ledger}) == 32,
         'MATERIALIZER_ORIGINAL_FORCE32_ID_ORDER')
    raw_operands = b''.join(struct.pack('<6d', *(p['pointM'] + p['normal'])) for p in ledger).hex()
    need(raw_operands == frame['pointOperandF64leHex'], 'MATERIALIZER_ORIGINAL_FORCE32_OPERAND_WORDS')
    geometry = loaded(ROOT / authority['geometryProof'])
    equilibrium = loaded(ROOT / authority['equilibriumResult'])
    allocation((bank, fixtures, geometry, equilibrium))
    need(geometry['status'] == 'PASS_INDEPENDENT_FINITE_CELL_GEOMETRY_ONLY' and
         geometry['originalSameRawRows'] == {'source': 32, 'strict-nodenext': 32} and
         geometry['maximumOriginalMovementSquaredExact'] == '0' and
         equilibrium['status'] == 'PASS_SAME_32_STATIC_FORCE_MOMENT_ONLY', 'MATERIALIZER_REUSED_FORCE32_RECEIPTS')
    return {'authority': 'ORIGINAL_FORCE_LEDGER_IDS_ORDER_NORMAL_SIGNED_ZERO_AND_OPERAND_HEX',
            'caseId': frame['caseId'], 'originalPointLedger': ledger,
            'pointOperandF64leHex': frame['pointOperandF64leHex'],
            'genericFiniteCellAuthority': 'EXISTING_ID_MAP_AND_COORDINATE_WORD_PROOF_ONLY',
            'genericOriginalToSelectedMap': geometry['originalRows'],
            'newGeometryOrForceCalculations': 0, 'distinctPositionConstraintRows': 36,
            'equilibriumAuthority': 'EXISTING_SAME32_FORCE_MOMENT_PROOF_NOT_POSITION_QP'}


def main():
    global START
    START = time.monotonic()
    need(len(sys.argv) == 2, 'ONE_FRESH_OUTPUT_DIRECTORY_REQUIRED')
    out = Path(sys.argv[1]).resolve()
    out.mkdir(parents=False, exist_ok=False)
    bank = loaded(HOME / 'bank.json')
    for relative, expected in bank['sourcePins'].items():
        deadline()
        need(pin(ROOT / relative) == expected, 'MATERIALIZER_ORIGINAL_PIN_DRIFT:' + relative)
    put(out / 'original-force32-provenance.json', encoded(force_provenance(bank)))
    originals, frame_inputs = {}, {}
    for frame in bank['frames']:
        original = loaded(ROOT / frame['request'])
        need(original['scene'] == frame['scene'] and original['stepIndex'] == frame['stepIndex'] and
             len(original['problem']['rows']) == 36 and len(original['problem']['bodies']) == 9 and
             original['result']['basisRows'] == frame['observedNativeBasis'], 'MATERIALIZER_ORIGINAL_POSITION_LAYOUT')
        # Witness/result is copied only from the authenticated observed request.
        kernel = {'op': 'kernel', 'problem': original['problem'], 'result': original['result']}
        originals[frame['id']], frame_inputs[frame['id']] = kernel, frame
    need(len(encoded(originals)) * 16 <= MAX_RETAINED, 'MATERIALIZER_RETAINED_DATA_BOUND')
    retained_bytes = allocation((bank, originals, frame_inputs))
    controls = {c['id']: c for c in bank['controls']}
    stage_a = []
    for case_id in bank['stageA']['order']:
        if case_id in controls:
            control = controls[case_id]
            request = mutate(originals[control['base']], control)
            expected = {'status': control['expectedStatus'], 'reason': control['expectedReason']}
        else:
            request = originals[case_id]
            expected = {'status': 'EXACT_KKT_CERTIFIED'}
        name = 'kernel-' + case_id + '.json'
        request_pin = put(out / name, encoded(request))
        stage_a.append({'id': case_id, 'request': name, 'requestPin': request_pin, 'expected': expected})
    stage_b = []
    for frame in bank['frames']:
        name = 'world-' + frame['id'] + '.json'
        # Preserve the complete original op:world bytes, not regenerated bodies.
        data = (ROOT / frame['request']).read_bytes()
        request_pin = put(out / name, data)
        stage_b.append({'id': frame['id'], 'request': name, 'requestPin': request_pin,
                        'expected': {'referenceStatus': 'SOLVED', 'ok': True, 'resolved': True}})
    common = {'bankPin': pin(HOME / 'bank.json'), 'WorldCalls': 0, 'coldQpCalls': 0,
              'fixtureCalls': 0, 'numericalHelperCalls': 0, 'originalForceProvenance': 'original-force32-provenance.json'}
    put(out / 'stage-a.json', encoded(dict(common, format='p4-position-witness-stage-a-bank-v1',
        candidateChecks=10, callCap=10, compactCalls=0, cases=stage_a)))
    put(out / 'stage-b.json', encoded(dict(common, format='p4-position-witness-stage-b-bank-v1',
        requires='COMPLETE_STAGE_A_PASS', candidateChecks=6, callCap=6, compactCalls=432,
        singleMeasuredBank=True, cases=stage_b)))
    print(json.dumps({'status': 'READY_AUTHENTICATED_POSITION_WITNESS_DATA_ONLY',
                      'output': str(out), 'stageACases': 10, 'stageBCases': 6,
                      'writtenBytes': WRITTEN, 'WorldCalls': 0, 'coldQpCalls': 0,
                      'candidateCalls': 0, 'newGeometryOrForceCalculations': 0,
                      'retainedPreparedRequestBytes': retained_bytes}))


if __name__ == '__main__':
    main()
