#!/usr/bin/env python3
"""Root's single captured-request byte-parity gate, no timing qualification."""
import hashlib
import json
from pathlib import Path
import sys
import time
import candidate
import probe

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
assert len(sys.argv) == 2 and sys.argv[1] == 'probe-01'
OUT = HERE / 'evidence' / sys.argv[1]
OUT.mkdir(parents=True, exist_ok=False)
request = ROOT / 'examples/physics-stack-wholepath-2276/evidence/census-01/position-31-request.json'
expected = request.with_name('position-31-reply.json')
reply, stats = OUT / 'reply.json', OUT / 'stats.json'
files = [Path(__file__), HERE/'candidate.py', HERE/'probe.py', HERE/'CONTRACT.md', HERE/'PINS.json', request, expected]
before = {str(p): candidate.pin(p) for p in files}
(OUT/'inputs-before.json').write_text(json.dumps(before, indent=2)+'\n')
started = time.perf_counter_ns()
result = {'status': 'RUNNING', 'candidateWorldReferenceCalls': 0, 'firstFailure': None, 'API': False, 'resourceQualification': False, 'fullP4Qualification': False}
try:
    assert request.stat().st_size <= 2*1024*1024 and expected.stat().st_size <= 2*1024*1024
    sys.argv = ['probe.py', str(request), str(reply), str(stats)]
    result['candidateWorldReferenceCalls'] = 1
    probe.main()
    assert reply.read_bytes() == expected.read_bytes(), 'complete physical reply differs from immutable captured original'
    detail = json.loads(stats.read_text())
    p = detail['preparation']
    assert p['satPairCalls'] == 288 and p['basisRequests'] == 576 and p['decodeRequests'] == 432
    assert 0 < p['decodeHits'] < 432 and 0 < p['basisHits'] < 576
    assert p['peakBodyEntries'] <= 432 and p['peakBasisEntries'] <= 576
    assert detail['functionsRestored'] is True
    result.update(status='PASS_ONE_ORIGINAL_PHYSICAL_REPLY_BYTE_EXACT', preparation=p,
                  requestPin=candidate.pin(request), physicalReplyPin=candidate.pin(reply), metadataExceptions=0)
except Exception as error:
    result.update(status='FIRST_FAILURE', firstFailure={'errorClass': type(error).__name__, 'message': str(error)})
finally:
    after = {str(p): candidate.pin(p) for p in files}
    (OUT/'inputs-after.json').write_text(json.dumps(after, indent=2)+'\n')
    if after != before:
        result['status'] = 'FIRST_FAILURE'
        result['firstFailure'] = result['firstFailure'] or {'message': 'input integrity changed'}
    result['wallNs'] = time.perf_counter_ns()-started
    (OUT/'result.json').write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps(result))
sys.exit(0 if result['status'].startswith('PASS_') else 1)
