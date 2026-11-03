#!/usr/bin/env python3
"""Compare saved complete physical prefix payloads; execute no physics."""
import gzip
import hashlib
import json
from pathlib import Path
import re
import sys

HOME = Path(__file__).resolve().parent
assert len(sys.argv) == 3
base, candidate = sys.argv[1:]
assert re.fullmatch(r'run-[a-z0-9-]{1,48}', base) and re.fullmatch(r'run-[a-z0-9-]{1,48}', candidate)
roots = [HOME / 'evidence' / name for name in (base, candidate)]
checks = {}
for graph in ('source', 'native'):
    left, right = [p / graph for p in roots]
    a, b = [json.loads((p / 'result.json').read_text()) for p in (left, right)]
    assert a['firstFailure'] is None and b['firstFailure'] is None
    assert a['reports'] == b['reports'], 'all six physical reports, original numeric-word hashes and raw hashes must agree'
    assert len(a['reports']) == 6
    compared_files = 0
    for name in ('first32.json', 'first-step-repeat.json', 'controls.json'):
        assert (left / name).read_bytes() == (right / name).read_bytes(), name
        compared_files += 1
    for report in a['reports']:
        stem = report['scene'] + '-' + str(report['selectedSteps'])
        for frame in range(report['selectedSteps'] + 1):
            for suffix in ('jsonl.gz', 'f64le.gz'):
                name = f'{stem}-{frame}.{suffix}'
                old, new = [(p / name).read_bytes() for p in (left, right)]
                assert len(old) <= 2*1024*1024 and len(new) <= 2*1024*1024
                assert old == new, name + ': full compressed payload mismatch'
                decoded = gzip.decompress(old)
                assert len(decoded) <= 2*1024*1024
                compared_files += 1
    checks[graph] = {'phaseAccepted': sum(r['phaseAccepted'] for r in a['reports']),
                     'recordNumericWords': sum(r['evidence']['numericLeaves'] for r in a['reports']),
                     'physicalReportsExact': True, 'completePayloadFilesExact': compared_files,
                     'baselineResultSha256': hashlib.sha256((left/'result.json').read_bytes()).hexdigest(),
                     'candidateResultSha256': hashlib.sha256((right/'result.json').read_bytes()).hexdigest()}
    assert checks[graph]['phaseAccepted'] == 51 and checks[graph]['recordNumericWords'] == 453231
result = {'status': 'PASS_COMPLETE_PREFIX_PAYLOAD_AND_RAW_WORD_IDENTITY', 'baseline': base, 'candidate': candidate,
          'checks': checks, 'metadataExceptions': 0, 'normalization': False, 'subtreeOmission': False,
          'full1200Qualification': False, 'physicsCalls': 0,
          'scriptSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
path = roots[1] / 'baseline-word-parity.json'
with path.open('x') as f:
    json.dump(result, f, indent=2)
    f.write('\n')
print(json.dumps(result))
