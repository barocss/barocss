"""Independent check of the box with two fillets (R8 on the 30 mm edge, r on the 40 mm top edge following its tangent chain): document structure and volume in closed form. Product imports: zero."""
import json, math, sys

data = json.load(sys.stdin)
doc = data['doc']; shown = data['shown']; reported = data['volume']
assert isinstance(shown, (int, float)) and not isinstance(shown, bool) and math.isfinite(shown), ('shown radius', shown)

def finite(v, path):
    if isinstance(v, bool): return
    if isinstance(v, (int, float)): assert math.isfinite(v), ('non-finite', path)
    elif isinstance(v, list):
        for i, x in enumerate(v): finite(x, path + '[' + str(i) + ']')
    elif isinstance(v, dict):
        for k, x in v.items(): finite(x, path + '.' + k)
    elif v is None: raise AssertionError(('null', path))
finite(doc, 'doc')
nodes = doc['nodes']; assert len(nodes) == 4, ('four nodes: sketch, extrude, fillet R8, fillet r', len(nodes))
sk, ex, f1, f2 = nodes
assert sk['kind'] == 'sketch' and sk['profile'] == 'rectangle' and sk['min'] == [0, 0] and sk['max'] == [40, 30], ('rectangle 40 x 30', sk)
assert ex['kind'] == 'extrude' and ex['sketch'] == 0 and abs(ex['height']) == 20, ('extrude 20', ex)
assert f1['kind'] == 'fillet' and f1['edges'] == ['n1.side1|n1.top'] and f1['radius'] == 8, ('first fillet R8 on the 30 mm edge', f1)
assert f2['kind'] == 'fillet' and f2['edges'] == ['n1.side0|n1.top'], ('second fillet on the 40 mm top edge', f2)
r = f2['radius']; R = f1['radius']
assert r == shown, ('stored radius equals the value shown at release', r, shown)
assert 0.1 <= r < R, ('radius below the R8 circle (the kernel refuses r >= 8)', r)
A = lambda x: (1 - math.pi / 4) * x * x
box = 40 * 30 * 20
first = A(R) * 30
second = A(r) * (32 + 12) + (math.pi / 2) * (R * A(r) - r ** 3 * (5 / 6 - math.pi / 4))
expected = box - first - second
rel = abs(expected - reported) / expected
assert rel <= 1e-9, ('Studio volume against the closed form', expected, reported, rel)
print(json.dumps({'status': 'PASS', 'productImports': 0, 'radius': r, 'boxVolume': box, 'firstRound': first, 'secondRound': second, 'expectedVolume': expected, 'studioVolume': reported, 'relativeDifference': rel}, indent=2))
