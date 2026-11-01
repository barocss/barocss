"""Independent exact check of a plain extruded rectangle (no hole, no fillet) drawn after a Bezier in the same sketch. Product imports: zero."""
import json, sys
from fractions import Fraction as F

def fr(x):
    assert not isinstance(x, bool), 'boolean is not a scalar'
    return F(x)

data = json.load(sys.stdin)
doc = data['doc']; reported = data['volume']; first = data['first']
nodes = doc['nodes']; sk, ex = nodes[0], nodes[1]
assert [n['kind'] for n in nodes] == ['sketch', 'extrude'] and [n['id'] for n in nodes] == ['n0', 'n1'], 'nodes: sketch, extrude'
assert ex['sketch'] == 0 and fr(ex['height']) == 10, ('extrude', ex.get('sketch'), ex.get('height'))
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
assert lo == [0, 0] and hi == [60, 40], ('rectangle', [str(c) for c in lo], [str(c) for c in hi])
assert not sk.get('holes') and not sk.get('regions'), 'no holes, no regions'
assert sk['construction'] == [{'kind': 'bezier', 'poles': [[0, 50], [10, 60], [20, 50]]}], ('construction', sk['construction'])
assert sk['sideTags'] == first['sideTags'], ('sideTags differ from the first Finish', sk['sideTags'], first['sideTags'])
assert len(sk['sideTags']['outer']) == 4 and not sk['sideTags'].get('holes'), ('sideTags shape', sk['sideTags'])
volume = float((hi[0] - lo[0]) * (hi[1] - lo[1]) * fr(ex['height']))
assert volume == 24000 and abs(volume - reported) <= 1e-6, ('volume', volume, reported)
print(json.dumps({'status': 'PASS', 'sideTags': sk['sideTags'], 'analyticVolume': volume, 'reportedVolume': reported, 'productImports': 0}, indent=2))
