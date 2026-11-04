"""Root-only eight checker controls using already saved actual unit receipts."""
import copy
import json
from pathlib import Path
import struct
import sys
import checker

row = json.loads(Path(sys.argv[1]).read_text().splitlines()[0])
problem = checker.restore_words(row['problem'], row['problemWordsF64leHex'])
result = checker.restore_words(row['result'], row['resultWordsF64leHex'])
population = row.get('unitDynamicCount', 8)
passed = []

def case(name, run):
    run()
    passed.append(name)

def refuses(edit):
    candidate = copy.deepcopy(result)
    edit(candidate)
    assert not checker.verify(problem, candidate, population)['ok']

def sign_words():
    restored = checker.restore_words({'x': 0, 'n': 1}, '0000000000000080000000000000f03f')
    assert struct.pack('>d', restored['x']).hex() == '8000000000000000'
    for value, raw in (([1], '0000000000000040'), ([1], ''), ([], '0000000000000000')):
        try:
            checker.restore_words(value, raw)
        except ValueError:
            continue
        raise AssertionError('word mismatch/missing/trailing accepted')

case('01 actual Fraction witness', lambda: checker.need(checker.verify(problem, result, population)['ok'], 'original witness'))
case('02 lossless zero and word refusals', sign_words)
case('03 false certificate boolean', lambda: refuses(lambda r: r['exactApplied'].__setitem__('allRowsPrimalZero', False)))
case('04 extra certificate field', lambda: refuses(lambda r: r['exactApplied'].__setitem__('invented', True)))
case('05 nonreduced exact multiplier', lambda: refuses(lambda r: r['exactApplied']['points'][0].__setitem__('lambda', {'n': '2', 'd': '8'})))
case('06 forged coefficient word', lambda: refuses(lambda r: r['exactApplied']['points'][0]['a']['words'].__setitem__(1, '0000000000000000')))
case('07 nonzero reported accepted velocity', lambda: refuses(lambda r: r['bodies'][1].__setitem__('velocityMps', [0, 0.01, 0])))
case('08 boolean or excessive stats', lambda: refuses(lambda r: r['stats'].__setitem__('triangleTrials', True)))
print(json.dumps({'status': 'PASS_CHECKER_FIXED8', 'groups': passed, 'candidateImports': 0}))
