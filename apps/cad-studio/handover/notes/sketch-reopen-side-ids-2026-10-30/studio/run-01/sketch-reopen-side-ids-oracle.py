"""Independent exact check of a filleted box with one circular hole made from a rectangle sketch. Product imports: zero."""
import json, math, sys
from fractions import Fraction as F

def fr(x):
    assert not isinstance(x, bool), 'boolean is not a scalar'
    return F(x)

data = json.load(sys.stdin)
doc = data['doc']; reported = data['volume']; opened = data['opened']; width = F(data['width'])
nodes = doc['nodes']
sk, ex, fil = nodes[0], nodes[1], nodes[2]
assert [n['kind'] for n in nodes] == ['sketch', 'extrude', 'fillet'] and [n['id'] for n in nodes] == ['n0', 'n1', 'n2'] and doc['nextId'] == 3, 'nodes: sketch, extrude, fillet'
assert ex['sketch'] == 0
# The rectangle: min/max, or the four axis-aligned points of its outline / polygon.
if sk['profile'] == 'rectangle':
    lo = [fr(c) for c in sk['min']]; hi = [fr(c) for c in sk['max']]
else:
    assert sk['profile'] in ('polygon', 'loop'), ('profile', sk['profile'])
    raw = sk['outline']['points'] if sk.get('outline') else (sk['points'] if sk['profile'] == 'polygon' else [s['start'] for s in sk['segments']])
    pts = [[fr(c) for c in p] for p in raw]
    assert len(pts) == 4, 'a rectangle outline has four points'
    xs = sorted({p[0] for p in pts}); ys = sorted({p[1] for p in pts})
    assert len(xs) == 2 and len(ys) == 2, 'axis-aligned'
    lo = [xs[0], ys[0]]; hi = [xs[1], ys[1]]
w = hi[0] - lo[0]; d = hi[1] - lo[1]; h = fr(ex['height'])
assert lo == [0, 0] and d == 40 and h == 10 and abs(float(w - width)) <= 1e-9, ('rectangle', [str(c) for c in lo], str(w), str(d), str(h), str(width))
assert len(sk['holes']) == 1 and not sk.get('regions'), 'one hole, no regions'
loop = sk['holes'][0]; assert len(loop) == 1 and loop[0]['kind'] == 'arc', 'the hole is one full arc'
c = [fr(v) for v in loop[0]['center']]; s0 = [fr(v) for v in loop[0]['start']]
r = math.sqrt(float((s0[0] - c[0]) ** 2 + (s0[1] - c[1]) ** 2))
assert float(c[0]) == 15 and float(c[1]) == 20 and abs(r - 5) <= 1e-9, ('hole', [str(v) for v in c], r)
assert lo[0] < c[0] - 5 and c[1] - 5 > lo[1] and c[1] + 5 < hi[1], 'the hole lies inside the rectangle'
assert fil['parent'] == {'node': 1, 'side': 'solid'} and fil['edges'] == ['n1.side[e2]|n1.side[e3]'] and fil['radius'] == 3, ('fillet node', fil)
assert not (fil.get('rematched') or fil.get('held') or fil.get('suppressed')), 'fillet carries no rematched/held/suppressed mark'
assert sk['sideTags'] == opened['sideTags'], ('sideTags differ from the opened document', sk['sideTags'], opened['sideTags'])
assert sk['sideTags']['outer'] == ['e1', 'e2', 'e3', 'e4'] and sk['sideTags']['holes'] == [['e5']], ('sideTags', sk['sideTags'])
rf = fr(fil['radius'])
volume = float(w * d * h) - math.pi * r * r * float(h) - (float(rf * rf) - math.pi * float(rf * rf) / 4) * float(h)
assert abs(volume - reported) <= 1e-6, ('volume', volume, reported)
print(json.dumps({'status': 'PASS', 'width': str(w), 'depth': str(d), 'height': str(h), 'holeRadius': r, 'filletRadius': str(rf), 'sideTags': sk['sideTags'], 'analyticVolume': volume, 'reportedVolume': reported,
  'delta': abs(volume - reported), 'productImports': 0}, indent=2))
