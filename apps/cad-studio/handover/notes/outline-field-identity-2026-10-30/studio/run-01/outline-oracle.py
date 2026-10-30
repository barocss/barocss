"""Independent exact (Fraction) check of an L plate with one rectangular hole and a corner fillet. Product imports: zero."""
import json, math, sys
from fractions import Fraction as F

def fr(x):
    assert not isinstance(x, bool), 'boolean is not a scalar'
    return F(x)

def shoelace(poly):
    s = F(0)
    for i, p in enumerate(poly):
        q = poly[(i + 1) % len(poly)]
        s += p[0] * q[1] - q[0] * p[1]
    return s / 2

data = json.load(sys.stdin)
doc = data['doc']; reported = data['volume']; expect = data.get('expectLengths')
nodes = doc['nodes']
sketches = [n for n in nodes if n['kind'] == 'sketch']; extrudes = [n for n in nodes if n['kind'] == 'extrude']; fillets = [n for n in nodes if n['kind'] == 'fillet']
assert len(sketches) == 1 and len(extrudes) == 1 and len(fillets) == 1, 'one sketch, one extrude, one fillet'
sk = sketches[0]; ex = extrudes[0]; fl = fillets[0]
outline = sk['outline']
pts = [[fr(c) for c in p] for p in outline['points']]
n = len(pts); assert n >= 3
# closed: the outline is a closed loop of n edges (edge i runs points[i] -> points[(i+1) % n]); no duplicate closing point, no zero edge
assert pts[0] != pts[-1], 'outline must not repeat its first point'
hv = outline.get('hv') or {'h': [], 'v': []}
H = set(hv.get('h', [])); V = set(hv.get('v', []))
for i in range(n):
    a = pts[i]; b = pts[(i + 1) % n]
    assert a != b, ('zero-length edge', i)
    if i in H: assert a[1] == b[1], ('hv edge not exactly horizontal', i)
    if i in V: assert a[0] == b[0], ('hv edge not exactly vertical', i)
    assert not (i in H and i in V)
lengths = {int(k): fr(v) for k, v in (outline.get('lengths') or {}).items()}
for i, L in lengths.items():
    a = pts[i]; b = pts[(i + 1) % n]
    d2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2
    assert d2 == L * L, ('stored length is not the exact edge length', i, str(L), str(d2))
if expect is not None:
    assert {int(k): fr(v) for k, v in expect.items()} == lengths, ('lengths differ from the expected edit', expect, outline.get('lengths'))
holes = [[[fr(c) for c in seg['start']] for seg in loop] for loop in (sk.get('holes') or [])]
assert len(holes) == 1, 'one hole'
area_outer = abs(shoelace(pts)); area_hole = abs(shoelace(holes[0]))
assert area_hole > 0 and area_outer > area_hole
h = fr(ex['height']); r = fr(fl['radius'])
assert h == 10 and r == 3, ('extrude height / fillet radius', str(h), str(r))
# V = h * (A_outer - A_hole) - h * r^2 * (1 - pi/4); pi enters only at the final float step
base = h * (area_outer - area_hole) - h * r * r
volume = float(base) + float(h * r * r) * math.pi / 4
assert abs(volume - reported) <= 1e-6, ('volume', volume, reported)
print(json.dumps({'status': 'PASS', 'outerArea': str(area_outer), 'holeArea': str(area_hole), 'height': str(h), 'radius': str(r), 'lengths': {str(k): str(v) for k, v in lengths.items()},
  'analyticVolume': volume, 'reportedVolume': reported, 'delta': abs(volume - reported), 'productImports': 0}, indent=2))
