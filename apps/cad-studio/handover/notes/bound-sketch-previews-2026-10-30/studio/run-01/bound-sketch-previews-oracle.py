"""Independent exact check of D357 documents: a null/NaN scan of the whole document, then (by mode) the two untouched bound sketches, the extruded rectangle, or the ruled loft of two rectangles. Product imports: zero."""
import json, math, sys
from fractions import Fraction as F

data = json.load(sys.stdin)
doc = data['doc']; reported = data['volume']; exp = data['expect']; mode = exp['mode']
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
assert list(params.keys()) == ['W'], ('parameters', params)
def fr(x):
    assert not isinstance(x, bool), 'boolean is not a scalar'
    assert isinstance(x, (int, float)), ('not a plain number', x)
    return F(x)
def resolve(x, W=None):
    """A stored coordinate: a plain finite number, or {'parameter': 'W'} resolved through the document parameters (or the given W)."""
    if isinstance(x, dict):
        assert list(x.keys()) == ['parameter'] and x['parameter'] == 'W', ('binding shape', x)
        return fr(params['W'] if W is None else W)
    return fr(x)
def bound(x):
    return isinstance(x, dict) and x == {'parameter': 'W'}
nodes = doc['nodes']; ids = [n['id'] for n in nodes]
def rect(n, W):
    assert n['kind'] == 'sketch' and n['profile'] == 'rectangle' and not n.get('holes') and not n.get('regions'), ('rectangle sketch', n)
    lo = [resolve(c, W) for c in n['min']]; hi = [resolve(c, W) for c in n['max']]
    return lo, hi
def zof(n):
    return fr(n['plane']['origin'][2]) if n.get('plane') else F(0)
def area(pts):
    s = F(0)
    for i in range(len(pts)):
        a, b = pts[i], pts[(i + 1) % len(pts)]
        s += a[0] * b[1] - b[0] * a[1]
    return abs(s) / 2
W0 = fr(exp['W']); out = {'status': 'PASS', 'mode': mode, 'parameter': str(fr(params['W'])), 'nullScan': 'clean', 'productImports': 0}
# The two original sketches stay as authored (bound), in every mode.
n0, n1 = nodes[0], nodes[1]
assert ids[:2] == ['n0', 'n1'] and n0['kind'] == 'sketch' and n1['kind'] == 'sketch', ('the first two nodes are the bound sketches', ids)
assert n0['max'] == [{'parameter': 'W'}, 40] and n0['min'] == [0, 0], ('n0 keeps its binding', n0)
assert n1['max'] == [{'parameter': 'W'}, 30] and n1['min'] == [10, 10] and n1['plane']['origin'] == [0, 0, 30], ('n1 keeps its binding', n1)
if mode == 'open':
    assert len(nodes) == 2 and doc['nextId'] == 2 and doc['outputs'] == {}, 'no features'
    out['bodies'] = 0
elif mode == 'extrude':
    assert ids == ['n0', 'n1', 'n2'] and [n['kind'] for n in nodes] == ['sketch', 'sketch', 'extrude'] and doc['nextId'] == 3, ('nodes', ids)
    ex = nodes[2]; assert ex['sketch'] == 0 and fr(ex['height']) == 10 and not ex.get('draft') and list(doc['outputs'].values()) == [{'node': 2, 'side': 'solid'}], ('extrude', ex, doc['outputs'])
    lo, hi = rect(n0, None); w = hi[0] - lo[0]; d = hi[1] - lo[1]
    assert lo == [0, 0] and w == fr(params['W']) and d == 40, ('rectangle', [str(c) for c in lo + hi])
    volume = float(w * d * fr(ex['height']))
    assert abs(volume - reported) <= 1e-6, ('volume', volume, reported)
    out.update({'width': str(w), 'depth': str(d), 'height': str(fr(ex['height'])), 'analyticVolume': volume, 'reportedVolume': reported, 'delta': abs(volume - reported)})
elif mode == 'loft':
    assert ids == ['n0', 'n1', 'n2', 'n3', 'n4'] and [n['kind'] for n in nodes] == ['sketch', 'sketch', 'sketch', 'sketch', 'loft'] and doc['nextId'] == 5, ('nodes', ids)
    loft = nodes[4]; assert loft['from'] == [0, 1] and not loft.get('smooth') and not loft.get('guide') and len(loft['sections']) == 2, ('ruled two-section loft', loft)
    assert sorted(s['sketch'] for s in loft['sections']) == [2, 3], ('sections use the two section copies', loft['sections'])
    zs = [fr(s['z']) for s in loft['sections']]; assert zs == [0, 30], ('section heights', [str(z) for z in zs])
    def corners(idx):
        n = nodes[idx]; assert n['kind'] == 'sketch' and n['profile'] == 'loop' and not n.get('holes') and not n.get('regions'), ('section copy', n)
        segs = n['segments']; assert len(segs) == 4 and all(s['kind'] == 'line' for s in segs), ('four line segments', segs)
        return [[resolve(c) for c in s['start']] for s in segs]
    A = corners(loft['sections'][0]['sketch']); B = corners(loft['sections'][1]['sketch'])
    def box(pts):
        xs = sorted({p[0] for p in pts}); ys = sorted({p[1] for p in pts}); assert len(xs) == 2 and len(ys) == 2, ('axis-aligned', [[str(c) for c in p] for p in pts]); return xs, ys
    xa, ya = box(A); xb, yb = box(B)
    if exp['originals'] == 'snapshot':
        loA, hiA = rect(n0, W0); loB, hiB = rect(n1, W0)
        assert (xa, ya) == ([loA[0], hiA[0]], [loA[1], hiA[1]]), ('section A is sketch n0 with W', str(W0), [[str(c) for c in p] for p in A])
        assert (xb, yb) == ([loB[0], hiB[0]], [loB[1], hiB[1]]), ('section B is sketch n1 with W', str(W0), [[str(c) for c in p] for p in B])
    for a, b in zip(A, B):
        assert (a[0] == xa[0]) == (b[0] == xb[0]) and (a[1] == ya[0]) == (b[1] == yb[0]), ('straight correspondence of the section corners', [str(c) for c in a], [str(c) for c in b])
    mid = [[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] for a, b in zip(A, B)]
    h = zs[1] - zs[0]; A0, A1, Am = area(A), area(B), area(mid)
    volume = float(h / 6 * (A0 + 4 * Am + A1)); tol = max(float(exp['tol']), 1e-6)
    assert volume > 0 and abs(volume - reported) <= tol * volume, ('ruled loft volume', volume, reported)
    out.update({'sectionAreas': [str(A0), str(Am), str(A1)], 'height': str(h), 'analyticVolume': volume, 'reportedVolume': reported, 'delta': abs(volume - reported), 'relativeTolerance': tol})
else:
    raise AssertionError(('unknown mode', mode))
print(json.dumps(out, indent=2))
