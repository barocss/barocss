#!/usr/bin/env python3
"""Root-only actual Token class qualification; zero reference/physics calls."""
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
assert len(sys.argv) == 2 and sys.argv[1] == 'token-live-01'
out = HERE / 'evidence' / sys.argv[1]
out.mkdir(parents=True, exist_ok=False)
paths = [Path(__file__), HERE/'TOKEN-LIVE-CONTRACT.md', HERE/'owned.py', HERE/'PINS.json', HERE/'evidence/selftest-01/summary.json', ROOT/'examples/physics-stack-reference-prepared-2276/candidate.py']
def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
before = {str(path): digest(path) for path in paths}
(out/'inputs-before.json').write_text(json.dumps(before, indent=2)+'\n')
result = dict(status='RUNNING', firstFailure=None, physicsCalls=0, referenceCalls=0,
              actualTokenImported=False, whole64MiBBound=False, nativeTemporaries='UNKNOWN',
              allLiveFrames='UNKNOWN', CPU='NOT_RUN', RSS='NOT_RUN', full1200='BLOCKED', API=False)
try:
    assert digest(HERE/'PINS.json') == '94e1e6949865c13e7ca20e03129bad8517d89aafc529be0555d08feb2fff0d3e'
    seal = json.loads((HERE/'PINS.json').read_text())
    for name, pin in seal['files'].items():
        path = Path(name) if name.startswith('/') else ROOT/name
        assert path.stat().st_size == pin['bytes']
        h = hashlib.sha256()
        with path.open('rb') as f:
            while chunk := f.read(65536):
                h.update(chunk)
        assert h.hexdigest() == pin['sha256']
    paid = json.loads((HERE/'evidence/selftest-01/summary.json').read_text())
    assert paid['status'] == 'PASS_STACK_RETAINED_DATA_AND_FIXED_LEDGER_COMPONENTS'
    assert digest(paths[-1]) == '9df6b0842f22095b0d9a55a506a3f6b05dfd711c6211ce9e8794114232c8d7f0'
    def load(path, name):
        spec = importlib.util.spec_from_file_location(name, path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module
    owned = load(HERE/'owned.py', 'actual_token_owned')
    candidate = load(paths[-1], 'actual_prepared_token_only')
    from decimal import Decimal, getcontext
    reservation = 4096
    values = [Decimal('0'), Decimal('-0'), Decimal('0E-12'), Decimal('1.000')]
    quaternion = tuple(values)
    norm, serial = Decimal('1.00'), 10001
    token = candidate.Token(serial, {'quaternion': quaternion, 'quaternionNorm': norm})
    subject = [token, token, quaternion, norm]
    registered = [subject, token, quaternion, *values, norm, serial]
    assert len({id(value) for value in registered}) == 9
    expected = sum(sys.getsizeof(value) for value in registered)
    assert expected <= reservation and token.quaternion is quaternion and token.norm is norm
    flags, words = dict(getcontext().flags), [value.as_tuple() for value in [*values, norm]]
    measured = owned.owned_size(subject, data_reservation=reservation, decimal_policy=owned.DECIMAL_POLICY, token_type=candidate.Token)
    assert measured['ownedBytes'] == expected and measured['uniqueNodes'] == 9
    assert [value.as_tuple() for value in [*values, norm]] == words and dict(getcontext().flags) == flags
    assert token.quaternion is quaternion and token.norm is norm and subject[0] is subject[1]
    result.update(status='PASS_ACTUAL_PREPARED_TOKEN_RETAINED_ROOT', actualTokenImported=True,
                  expectedBytes=expected, expectedNodes=9, measurement=measured)
except Exception as error:
    result.update(status='FIRST_FAILURE', firstFailure={'errorClass': type(error).__name__, 'message': str(error)})
finally:
    after = {str(path): digest(path) for path in paths}
    (out/'inputs-after.json').write_text(json.dumps(after, indent=2)+'\n')
    if before != after:
        result.update(status='FIRST_FAILURE', firstFailure=result['firstFailure'] or {'message': 'source integrity changed'})
    (out/'result.json').write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps(result))
sys.exit(0 if result['status'].startswith('PASS_') else 1)
