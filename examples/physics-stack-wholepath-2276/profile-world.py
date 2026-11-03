"""Profile one authenticated captured request; preserve original CLI semantics."""
import cProfile
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import pstats
import sys

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
assert len(sys.argv) == 2 and sys.argv[1] == 'profile-01'
OUT = HERE / 'evidence' / sys.argv[1]
OUT.mkdir(exist_ok=False)


def pin(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(65536), b''):
            h.update(chunk)
    return {'bytes': path.stat().st_size, 'sha256': h.hexdigest()}


request = HERE / 'evidence/census-01/position-31-request.json'
authority = HERE / 'evidence/census-01/position-31-reply.json'
assert request.stat().st_size <= 2 * 1024 * 1024
assert authority.stat().st_size <= 2 * 1024 * 1024
data = request.read_bytes()
shape = json.loads(data)
assert (shape['op'], shape['scene'], shape['stepIndex']) == ('world', 'ALIGNED', 16)
pins_path = ROOT / 'examples/physics-stack-library-2276/PINS.json'
files = [ROOT / name for name in json.loads(pins_path.read_bytes())['files'] if name.endswith('.py')]
assert len(files) == 12
files += [pins_path, Path(sys.executable).resolve(), Path(__file__).resolve(),
          HERE / 'PROFILE-CONTRACT.md', request, authority]
before = {str(p): pin(p) for p in files}
(OUT / 'inputs-before.json').write_text(json.dumps(before, indent=2) + '\n')
name = 'original_position_world_profile'
path = ROOT / 'examples/physics-rigid-full-pair-position-world/reference.py'
spec = importlib.util.spec_from_file_location(name, path)
module = importlib.util.module_from_spec(spec)
sys.modules[name] = module
spec.loader.exec_module(module)
profile, original, calls = cProfile.Profile(), module.evaluate, 0


def evaluate(value):
    global calls
    calls += 1
    assert calls == 1
    return profile.runcall(original, value)


module.evaluate = evaluate
stdin, stdout = sys.stdin, sys.stdout
captured = io.StringIO()
try:
    sys.stdin, sys.stdout = io.StringIO(data.decode('utf8')), captured
    module.main()
finally:
    sys.stdin, sys.stdout = stdin, stdout
reply = captured.getvalue().encode('utf8')
assert len(reply) <= 2 * 1024 * 1024
(OUT / 'reply.raw').write_bytes(reply)
assert calls == 1 and reply == authority.read_bytes(), 'exact original physical reply'
profile.dump_stats(str(OUT / 'profile.pstats'))
stats = pstats.Stats(profile)
rows = [{'file': k[0], 'line': k[1], 'function': k[2],
         'primitiveCalls': v[0], 'calls': v[1], 'selfSeconds': v[2], 'cumulativeSeconds': v[3]}
        for k, v in sorted(stats.stats.items(), key=lambda item: -item[1][2])[:25]]
after = {str(p): pin(p) for p in files}
assert before == after
(OUT / 'inputs-after.json').write_text(json.dumps(after, indent=2) + '\n')
assert sum(p.stat().st_size for p in OUT.iterdir()) < 16 * 1024 * 1024
result = {'status': 'PROFILE_WORLD_PHYSICAL_REPLY_EXACT', 'calls': calls,
          'replyPin': pin(OUT / 'reply.raw'), 'profilePin': pin(OUT / 'profile.pstats'),
          'totalProfileSeconds': stats.total_tt, 'topSelfFunctions': rows,
          'scope': 'ONE_FUNCTION_PROFILE_DIAGNOSTIC_NOT_BENCHMARK_OR_RESOURCE_GO',
          'fullP4Qualification': False, 'API': False}
(OUT / 'result.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'status': result['status'], 'calls': calls, 'topSelfFunctions': rows[:6]}))
