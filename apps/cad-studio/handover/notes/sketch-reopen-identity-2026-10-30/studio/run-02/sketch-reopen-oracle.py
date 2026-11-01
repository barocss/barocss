"""Independent exact (Fraction) check of a box with rectangular cuts made from a sketch drawn on its top face. Product imports: zero."""
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
doc = data['doc']; reported = data['volume']; cuts = data['cuts']
nodes = doc['nodes']
base = nodes[0]; ex = nodes[1]; src = nodes[2]
assert base['kind'] == 'sketch' and base['profile'] == 'rectangle' and ex['kind'] == 'extrude' and ex['sketch'] == 0, 'box = rectangle sketch + extrude'
lo = [fr(c) for c in base['min']]; hi = [fr(c) for c in base['max']]; h = fr(ex['height'])
box = (hi[0] - lo[0]) * (hi[1] - lo[1]) * h
assert src['kind'] == 'sketch' and src['profile'] == 'polygon' and src['id'] == 'n2', 'node 2 is the polygon sketch n2'
assert src.get('on') == {'node': 1, 'side': 'solid'}, ('node 2 lost its on reference', src.get('on'))
assert src['plane']['origin'] == [0, 0, 10] and src['plane']['normal'] == [0, 0, 1], 'sketch lies on the top face'
pts = [[fr(c) for c in p] for p in src['points']]
if src.get('outline'):
    assert [[fr(c) for c in p] for p in src['outline']['points']] == pts, 'outline points equal the node points'
assert len(pts) >= 3
for p in pts:
    assert lo[0] <= p[0] <= hi[0] and lo[1] <= p[1] <= hi[1], ('cut outside the top face', [str(c) for c in p])
area = abs(shoelace(pts))
diffs = [n for n in nodes if n['kind'] == 'difference']
assert len(diffs) == cuts, ('difference count', len(diffs), cuts)
removed = F(0)
for d in diffs:
    assert d['parent'] == {'node': 1, 'side': 'solid'}, ('cut parent', d['parent'])
    tool = nodes[d['tool']['node']]
    assert tool['kind'] == 'extrude' and tool['sketch'] == 2, ('cut tool is an extrude of sketch 2', tool)
    depth = abs(fr(tool['height']))
    assert 0 < depth <= h, ('cut depth', str(depth))
    removed += area * depth
volume = float(box - removed)
assert abs(volume - reported) <= 1e-6, ('volume', volume, reported)
print(json.dumps({'status': 'PASS', 'boxVolume': str(box), 'sketchArea': str(area), 'removed': str(removed), 'cuts': len(diffs), 'analyticVolume': volume, 'reportedVolume': reported,
  'delta': abs(volume - reported), 'nodeTwoOn': src['on'], 'productImports': 0}, indent=2))
