"""Compare captured data only; never call a solver or generate a fixture."""
import gzip
import hashlib
import json
import math
from pathlib import Path
import struct
import sys

ROOT = Path(__file__).resolve().parents[2]
LIMIT = 2 * 1024 * 1024
assert len(sys.argv) == 3, 'usage: compare-original-first32.py RUN_ID FRESH_OUTPUT'
run = Path(__file__).resolve().parent / 'evidence' / sys.argv[1]
artifact = run / 'source/ALIGNED-1-1.jsonl.gz'
original = ROOT / 'examples/physics-stack-solver-2276/evidence/fixture-01/fixture.json'
assert artifact.stat().st_size <= LIMIT and original.stat().st_size <= LIMIT
with gzip.open(artifact, 'rb') as stream:
    captured = stream.read(LIMIT + 1)
assert len(captured) <= LIMIT
actual = json.loads(captured)['prepared']['diagnostics']['normalProblem']
expected = json.loads(original.read_bytes())['problem']
failures = []
numeric_words = 0


def compare(a, b, path='$'):
    global numeric_words
    if type(a) in (int, float) and type(b) in (int, float):
        assert math.isfinite(a) and math.isfinite(b)
        numeric_words += 1
        if struct.pack('<d', a) != struct.pack('<d', b):
            failures.append({'path': path, 'actual': a, 'original': b,
                'actualHex': struct.pack('<d', a).hex(),
                'originalHex': struct.pack('<d', b).hex()})
    elif type(a) is dict and type(b) is dict:
        if list(a) != list(b):
            failures.append({'path': path, 'kind': 'keys-or-order'})
        for key in a:
            if key in b:
                compare(a[key], b[key], path + '/' + key)
    elif type(a) is list and type(b) is list:
        if len(a) != len(b):
            failures.append({'path': path, 'kind': 'length'})
        for i, (left, right) in enumerate(zip(a, b)):
            compare(left, right, path + '/' + str(i))
    elif type(a) is not type(b) or a != b:
        failures.append({'path': path, 'actual': a, 'original': b})


compare(actual, expected)
report = {'status': 'PASS' if not failures else 'FAIL_EXACT_ORIGINAL_INPUT_COMPARISON',
    'gate': 'EXACT_KEYS_ORDER_IDS_AND_BINARY64_WORDS_NO_NORMALIZATION',
    'numericWordsCompared': numeric_words, 'mismatchCount': len(failures),
    'firstMismatches': failures[:12],
    'capturedCompressedSHA256': hashlib.sha256(artifact.read_bytes()).hexdigest(),
    'originalFixtureSHA256': hashlib.sha256(original.read_bytes()).hexdigest(),
    'scope': 'ACTUAL_ALIGNED_FIRST_NORMAL_PROBLEM_VS_ORIGINAL32_NOT_TRAJECTORY_GO'}
with (run / sys.argv[2]).open('x') as output:
    json.dump(report, output, indent=2, allow_nan=False)
    output.write('\n')
print(json.dumps(report, allow_nan=False))
sys.exit(0 if not failures else 1)
