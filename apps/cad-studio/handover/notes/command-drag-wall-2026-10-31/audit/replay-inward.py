# Replays the new driver's inward() check (one-frame lag allowed for the pointer bound; oscillation bound unchanged) on recorded samples.
import json, sys
STEP, LIMIT_OK, BACK = 0.5, 7.9, 4.0
def inward(ss, pointer, before, lag):
    ups, fails = 0, []
    for i, s in enumerate(ss):
        prev = ss[i-1]['value'] if i else before
        reach = max(pointer[i], pointer[i-1] if i else pointer[i]) if lag else pointer[i]
        if s['value'] > reach + STEP/2 + 1e-9: fails.append(('above pointer', i, s['value'], round(reach, 2)))
        if s['value'] > LIMIT_OK and s['status'] == 'preview': fails.append(('past limit accepted', i, s['value']))
        if s['value'] > prev:
            ups += 1
            if 'evaluating' not in (s['status'] or ''): fails.append(('increase not evaluating', i, s['value']))
    if ups > 1: fails.append(('increases', ups))
    return fails
for run in sys.argv[1:]:
    D = json.load(open(f'{run}/samples-D.json')); BC = json.load(open(f'{run}/samples-BC.json')); A = json.load(open(f'{run}/samples-A.json'))
    keysBC = list(BC.keys()); keysA = list(A.keys())
    inn = D['in2']; ptr = [14 + (BACK - 14) * (i + 1) / 6 for i in range(len(inn))]
    print(run, 'D old (no lag):', inward(inn, ptr, D['out2'][-1]['value'], False) or 'pass', '| D new (lag):', inward(inn, ptr, D['out2'][-1]['value'], True) or 'pass')
    B = BC.get('B'); Ah = A.get('Ah') or A.get(keysA[-1])
    if B: ptrB = [15 + (BACK - 15) * (i + 1) / 15 for i in range(len(B))]; print('   B old:', inward(B, ptrB, Ah[-1]['value'], False) or 'pass', '| B new:', inward(B, ptrB, Ah[-1]['value'], True) or 'pass')
    else: print('   BC keys', keysBC, 'A keys', keysA)
