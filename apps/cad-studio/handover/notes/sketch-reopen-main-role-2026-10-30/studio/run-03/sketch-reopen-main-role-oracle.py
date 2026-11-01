"""Independent check of an extruded circle (radius may be bound to parameter R) with one rectangle region beside it. Product imports: zero."""
import json, math, sys
from fractions import Fraction as F

data = json.load(sys.stdin)
doc = data['doc']; reported = data['volume']; exp = data['expect']
bad = []
def scan(v, path):
    if v is None or (isinstance(v, float) and not math.isfinite(v)):
        bad.append(path)
    elif isinstance(v, list):
        for i, x in enumerate(v): scan(x, path + '[' + str(i) + ']')
    elif isinstance(v, dict):
        for k, x in v.items(): scan(x, path + '.' + k)
scan(doc, 'doc')
assert bad == [], ('null or non-finite values in the document', bad)
params = doc['parameters']
assert params == {'R': exp['R']}, ('parameters', params)
def fr(x):
    assert not isinstance(x, bool), 'boolean is not a scalar'
    assert isinstance(x, (int, float)), ('not a plain number', x)
    return F(x)
def resolve(x):
    if isinstance(x, dict):
        assert x == {'parameter': 'R'}, ('binding shape', x)
        return fr(params['R'])
    return fr(x)
nodes = doc['nodes']
sk, ex = nodes[0], nodes[1]
assert [n['kind'] for n in nodes] == ['sketch', 'extrude'] and [n['id'] for n in nodes] == ['n0', 'n1'] and doc['nextId'] == 2, 'nodes: sketch, extrude'
assert ex['sketch'] == 0 and fr(ex['height']) == 10 and doc['outputs'] == {'b1': {'node': 1, 'side': 'solid'}}, ('extrude', ex, doc['outputs'])
assert sk['profile'] == 'circle', ('the main profile stays the circle', sk['profile'])
assert sk['radius'] == {'parameter': 'R'}, ('the radius keeps its R binding', sk['radius'])
assert [resolve(c) for c in sk['center']] == [0, 0], ('centre', sk['center'])
R = resolve(sk['radius']); assert R == fr(exp['R']) and R > 0
assert not sk.get('holes'), 'no holes'
regions = sk.get('regions'); assert regions is not None and len(regions) == 1, ('one region', regions)
loop = regions[0]; nseg = exp.get('segments', 4)
assert len(loop) == nseg and all(s['kind'] == 'line' for s in loop), ('rectangle loop of straight lines', nseg, loop)
pts = [[resolve(c) for c in s['start']] for s in loop]
area = F(0)
for i in range(nseg):
    a, b = pts[i], pts[(i + 1) % nseg]; area += a[0] * b[1] - b[0] * a[1]
area = abs(area) / 2
assert area == 200, ('rectangle area exact', str(area))
xs = sorted({p[0] for p in pts}); ys = sorted({p[1] for p in pts})
assert xs[0] == 20 and xs[-1] == 40 and ys == [-5, 5], ('rectangle extent', [str(x) for x in xs], [str(y) for y in ys])
assert set(xs) <= {20, 30, 40}, ('split point at x=30 only', [str(x) for x in xs])
if nseg == 5: assert 30 in xs, 'the bottom edge is split at x=30'
assert R < 20, 'circle and rectangle do not overlap'
tags = sk['sideTags']
assert len(tags['outer']) == 1 and len(tags['regions']) == 1 and len(tags['regions'][0]) == nseg, ('sideTags shape', tags)
ids = tags['outer'] + tags['regions'][0]; assert len(set(ids)) == 1 + nseg, ('distinct side ids', ids)
volume = 10 * (math.pi * float(R) ** 2 + float(area))
assert abs(volume - reported) <= 1e-6 * volume, ('volume', volume, reported)
assert abs(volume - exp['volume']) <= 1e-9 * volume, ('expected volume', volume, exp['volume'])
print(json.dumps({'status': 'PASS', 'R': str(R), 'rectangleArea': str(area), 'analyticVolume': volume, 'reportedVolume': reported, 'delta': abs(volume - reported), 'productImports': 0}, indent=2))
