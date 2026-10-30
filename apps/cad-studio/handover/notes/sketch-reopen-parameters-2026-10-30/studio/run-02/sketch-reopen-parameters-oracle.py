"""Independent exact check of an extruded axis-aligned rectangle whose Width may be bound to a document parameter. Product imports: zero."""
import json, math, sys
from fractions import Fraction as F

def fr(x):
    assert not isinstance(x, bool), 'boolean is not a scalar'
    assert isinstance(x, (int, float)), ('not a plain number', x)
    return F(x)

data = json.load(sys.stdin)
doc = data['doc']; reported = data['volume']; exp = data['expect']
params = doc['parameters']
assert params == {'W': exp['W']}, ('parameters', params)
W = fr(params['W'])
def resolve(x):
    """A stored coordinate: a plain finite number, or {'parameter': name} resolved through the document parameters."""
    if isinstance(x, dict):
        assert list(x.keys()) == ['parameter'], ('binding shape', x)
        return fr(params[x['parameter']])
    return fr(x)
def bound(x):
    return isinstance(x, dict) and x == {'parameter': 'W'}
nodes = doc['nodes']
sk, ex = nodes[0], nodes[1]
assert [n['kind'] for n in nodes] == ['sketch', 'extrude'] and [n['id'] for n in nodes] == ['n0', 'n1'] and doc['nextId'] == 2, 'nodes: sketch, extrude'
assert ex['sketch'] == 0 and fr(ex['height']) == 10 and doc['outputs'] == {'b1': {'node': 1, 'side': 'solid'}}, ('extrude', ex, doc['outputs'])
assert not sk.get('holes') and not sk.get('regions'), 'no holes, no regions'
if sk['profile'] == 'rectangle':
    raw = [[sk['min'][0], sk['min'][1]], [sk['max'][0], sk['max'][1]]]
    corners = [raw[0], raw[1]]
else:
    assert sk['profile'] in ('polygon', 'loop'), ('profile', sk['profile'])
    pts = sk['outline']['points'] if sk.get('outline') else (sk['points'] if sk['profile'] == 'polygon' else [s['start'] for s in sk['segments']])
    assert len(pts) == 4, 'a rectangle outline has four points'
    corners = pts
res = [[resolve(c) for c in p] for p in corners]
xs = sorted({p[0] for p in res}); ys = sorted({p[1] for p in res})
assert len(xs) == 2 and len(ys) == 2, ('axis-aligned', [[str(c) for c in p] for p in res])
lo = [xs[0], ys[0]]; hi = [xs[1], ys[1]]
w = hi[0] - lo[0]; d = hi[1] - lo[1]; h = fr(ex['height'])
assert lo == [0, 0], ('the rectangle starts at the origin', [str(c) for c in lo])
assert w == fr(exp['w']) and d == fr(exp['d']) and h == fr(exp['h']), ('dims', str(w), str(d), str(h), exp)
# Binding positions: every stored x on the far side is {parameter:'W'} (and equals W), every x on the near side and every y is a plain finite number.
for raw_point, point in zip(corners, res):
    x, y = raw_point
    assert isinstance(y, (int, float)) and not isinstance(y, bool) and math.isfinite(float(y)), ('y is a plain number', raw_point)
    if point[0] == hi[0]:
        assert bound(x) and point[0] == W, ('far x keeps the W binding', raw_point, str(W))
    else:
        assert isinstance(x, (int, float)) and not isinstance(x, bool) and point[0] == 0, ('near x is a plain 0', raw_point)
assert sum(1 for p in corners for c in p if bound(c)) >= 1 and w == W, ('width equals the parameter', str(w), str(W))
volume = float(w * d * h)
assert abs(volume - reported) <= 1e-6, ('volume', volume, reported)
print(json.dumps({'status': 'PASS', 'parameter': str(W), 'width': str(w), 'depth': str(d), 'height': str(h), 'boundCoordinates': sum(1 for p in corners for c in p if bound(c)), 'analyticVolume': volume, 'reportedVolume': reported,
  'delta': abs(volume - reported), 'productImports': 0}, indent=2))
