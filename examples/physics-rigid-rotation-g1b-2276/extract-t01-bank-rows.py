#!/usr/bin/env python3
"""Copy closed JSON values exactly. No physics/numeric conversions or imports."""
from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
OLD = HERE / 'evidence/g1b-trajectory-01'
OUT = HERE / 'evidence/g1b-trajectory-01-reference-rows'

def pin(path):
    data = path.read_bytes()
    return {'path':str(path.relative_to(ROOT)), 'bytes':len(data), 'sha256':hashlib.sha256(data).hexdigest()}

def check_tree(value):
    if type(value) is dict:
        assert all(type(k) is str for k in value)
        for child in value.values(): check_tree(child)
    elif type(value) is list:
        for child in value: check_tree(child)
    else:
        assert type(value) in (str, bool, int, type(None)), 'No floating conversions in closed DATA'

def write(name, value):
    check_tree(value)
    data = (json.dumps(value, separators=(',', ':'), ensure_ascii=True) + '\n').encode('ascii')
    assert len(data) <= 32768
    path = OUT / name
    with path.open('xb') as stream: stream.write(data)
    assert json.loads(path.read_bytes()) == value, 'Exact JSON tree equality'
    return pin(path)

assert Path.cwd().resolve() == ROOT
bank_path = OLD / 'reference/bank.json'
bank = json.loads(bank_path.read_bytes())
reply = json.loads((OLD / 'reference/reply-0001.json').read_bytes())
progress = json.loads((OLD / 'reference/progress.json').read_bytes())
assert reply['status'] == 'PASS_G1B_TRAJECTORY_BANK' and reply['requestOrdinal'] == 1
assert reply['bank']['bytes'] == bank_path.stat().st_size
assert reply['bank']['sha256'] == pin(bank_path)['sha256']
assert progress['counts']['requestsReturned'] == 1 and progress['nextAudit'] == 0
assert bank['newCounts']['taylorWindowsReturned'] == 44
assert bank['newCounts']['decimalOperations'] == 20876116
assert bank['newCounts']['endpointDecimalSqrtOperations'] == 88
OUT.mkdir(exist_ok=False)
metadata = write('metadata.json', {k:v for k,v in bank.items() if k not in ('bank', 'principals')})
rows = []
for precision in ('80', '120'):
    assert set(bank['bank'][precision]) == {str(i) for i in range(1, 25)}
    for index in range(1, 25):
        row = write('bank-' + precision + '-' + str(index).zfill(2) + '.json', bank['bank'][precision][str(index)])
        rows.append({'precision':precision, 'index':index, **row, 'originalPointer':'/bank/' + precision + '/' + str(index)})
principals = []
for key, value in bank['principals'].items():
    principals.append({'key':key, **write('principal-' + key.replace(':','-') + '.json', value), 'originalPointer':'/principals/' + key})
manifest = {'status':'AUTHENTICATED_CLOSED_T01_BANK_ROWS', 'originalBank':pin(bank_path),
    'initReply':pin(OLD / 'reference/reply-0001.json'), 'progress':pin(OLD / 'reference/progress.json'),
    'requestProof':pin(OLD / 'protocol.jsonl'), 'inputs':[{'index':i, **pin(OLD / ('input-' + str(i) + '.json'))} for i in range(8)],
    'sourceCoefficients':pin(OLD / 'source-coefficients.json'), 'rows':rows, 'principals':principals,
    'metadata':metadata, 'valueIdentity':'EXACT_JSON_TREE_NO_CONVERSIONS', 'extractionSource':pin(Path(__file__).resolve()),
    'actualCalls':{'World':0,'candidate':0,'referenceIntegration':0,'Fraction':0,'Decimal':0,'nativeFloatConversions':0},
    'method':'Each closed JSON subtree serialized once to fresh file; parsed exact structure equals original. All original file bytes unchanged. No mathematical quantity is recomputed.'}
with (HERE / 'REFERENCE-BANK-REUSE-T02.json').open('x') as stream:
    json.dump(manifest, stream, indent=2); stream.write('\n')
print(json.dumps({'status':manifest['status'],'rows':len(rows),'principals':len(principals),'origin':manifest['originalBank']}))
