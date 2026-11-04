"""Fresh coherence public initial frames; data only, no package or World imports."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

HOME = Path(__file__).resolve().parent
ROOT = HOME.parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('id')
parser.add_argument('--public', required=True)
args = parser.parse_args()
assert args.id and all(c.isalnum() or c == '-' for c in args.id)
paid = (ROOT / args.public).resolve()
manifest = json.loads(paid.read_text())
assert manifest['status'] == 'COHERENCE_PUBLIC_SOURCE_NATIVE_EIGHT_CASES_CONFIRMED'
assert manifest['sourceIntegrity'] == 'PASS' and manifest['failure'] is None
observer = ROOT / 'examples/physics-anisotropic-inertia-2276/initial-frame-audit.py'
assert hashlib.sha256(observer.read_bytes()).hexdigest() == '56d126c4211d059597b4afbae7026fbb923a94f2af6c093156e7c8efe6ba1109'
spec = importlib.util.spec_from_file_location('coherence_authored_frames', observer)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
out = HOME / 'evidence' / args.id
out.mkdir()
pins = {}
def pin(path):
    pins[str(path.relative_to(ROOT))] = hashlib.sha256(path.read_bytes()).hexdigest()
for path in (Path(__file__), HOME / 'INITIAL-CONTRACT.md', observer, paid):
    pin(path)
results, failure = [], None
try:
    for graph in ('source', 'native'):
        for case in module.CASES:
            path = paid.parent / (graph + '-' + case + '.json')
            raw = path.read_bytes()
            assert len(raw) <= 2097152
            pin(path)
            answer = module.audit_packet(json.loads(raw))
            results.append({'graph': graph, 'caseId': case, 'reply': answer})
            assert answer['ok'] and answer['resolved'] and not answer['executionFailure'], answer
    assert len(results) == 16
    assert sum(x['reply']['certificate']['initialQuaternionChecks'] for x in results) == 48
except Exception as error:
    failure = {'name': type(error).__name__, 'message': str(error)}
finally:
    for path, expected in pins.items():
        assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == expected
    result = {'status': 'COHERENCE_AUTHORED_INITIAL_FRAMES_CONFIRMED' if failure is None else 'COHERENCE_INITIAL_FRAME_NO_GO',
              'firstFailure': failure, 'sourceIntegrity': 'PASS', 'paidPacketAudits': len(results),
              'initialQuaternionChecks': sum(x['reply'].get('certificate', {}).get('initialQuaternionChecks', 0) for x in results),
              'worldCalls': 0, 'candidateCalls': 0, 'compilerCalls': 0, 'results': results, 'inputs': pins}
    with (out / 'result.json').open('x') as stream:
        json.dump(result, stream, indent=2)
        stream.write('\n')
    print(result['status'])
if failure:
    raise SystemExit(1)
