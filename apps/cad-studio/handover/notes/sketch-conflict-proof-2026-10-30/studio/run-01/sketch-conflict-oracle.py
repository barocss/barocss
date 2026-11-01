"""Independent exact (Fraction) decision of probed edge-length edits on an axis-aligned rectangle sketch, and the triangle inequality for a triangle. Product imports: zero."""
import json, sys
from fractions import Fraction as F

TOL = F(4, 10**7)  # D350's per-equation relaxation; the rectangle's x (or y) cycle has 4 equations, so opposite lengths may differ by 4*TOL before it is infeasible

def fr(x):
    assert not isinstance(x, bool), 'boolean is not a scalar'
    return F(x)

data = json.load(sys.stdin)
results = []
for p in data['probes']:
    doc = p['doc']; node = doc['nodes'][p['node']]
    assert node['kind'] == 'sketch' and node['profile'] == 'polygon', 'polygon sketch'
    o = node['outline']; pts = [[fr(c) for c in q] for q in o['points']]
    assert pts == [[fr(c) for c in q] for q in node['points']], 'outline points equal node points'
    stored = {int(k): fr(v) for k, v in (o.get('lengths') or {}).items()}
    n = len(pts)
    def length(i):
        # exact for axis-aligned edges: |dx| + |dy| with one of them zero
        a = pts[i]; b = pts[(i + 1) % n]
        assert a[0] == b[0] or a[1] == b[1], 'axis-aligned edge'
        return abs(a[0] - b[0]) + abs(a[1] - b[1])
    value = fr(p['value']); e = p['edge']; entry = {'label': p['label'], 'kind': p['kind'], 'edge': e, 'value': str(value)}
    if p['kind'] == 'rect':
        assert n == 4
        hv = o.get('hv'); assert hv and sorted(hv['h']) == [0, 2] and sorted(hv['v']) == [1, 3], ('hv', hv)
        for i in (0, 2): assert pts[i][1] == pts[i + 1][1], ('edge ' + str(i) + ' is horizontal')
        for i in (1, 3): assert pts[i][0] == pts[(i + 1) % n][0], ('edge ' + str(i) + ' is vertical')
        for i, v in stored.items(): assert abs(length(i) - v) <= TOL, ('stored length matches the points', i, str(v), str(length(i)))
        opp = (e + 2) % 4
        if opp in stored:
            diff = abs(value - stored[opp])
            verdict = 'conflict' if diff > 4 * TOL else 'implied'
            entry.update({'opposite': opp, 'oppositeStored': str(stored[opp]), 'difference': str(diff)})
        else:
            verdict = 'new'
        entry['verdict'] = verdict
        if 'volume' in p:
            ext = [m for m in doc['nodes'] if m['kind'] == 'extrude' and m['sketch'] == 0]; assert len(ext) == 1
            vol = length(0) * length(1) * fr(ext[0]['height'])
            assert abs(float(vol) - p['volume']) <= 1e-6, ('volume', float(vol), p['volume']); entry['analyticVolume'] = float(vol)
    else:
        assert n == 3 and 0 in stored and 1 in stored and e == 2
        a, b = stored[0], stored[1]
        entry['verdict'] = 'infeasible' if not (abs(a - b) <= value <= a + b) else 'new'
        entry['note'] = 'triangle inequality: the contradiction is real, the product is expected not to claim a proof for it'
    assert entry['verdict'] == p['expect'], ('oracle verdict', entry, p['expect'])
    results.append(entry)
print(json.dumps({'status': 'PASS', 'results': results, 'productImports': 0}, indent=2))
