"""Independent exact check of the direct curves made from two Bezier curves: poles, degree, clamped knots, unit weights, Bernstein values, end tangents, product evaluation. Product imports: zero."""
import json, sys
from fractions import Fraction as F

def fr(x):
    assert not isinstance(x, bool), 'boolean is not a scalar'
    return F(x)
def v3(p): return tuple(fr(c) for c in p)
def add(a, b): return tuple(x + y for x, y in zip(a, b))
def sub(a, b): return tuple(x - y for x, y in zip(a, b))
def mul(a, s): return tuple(x * s for x in a)

data = json.load(sys.stdin)
curves = data['curves']
def bernstein(poles, t):
    n = len(poles) - 1; from math import comb
    acc = (F(0), F(0), F(0))
    for i, p in enumerate(poles): acc = add(acc, mul(p, comb(n, i) * t ** i * (1 - t) ** (n - i)))
    return acc
def find(degree, poles):
    hits = [c for c in curves if c['degree'] == degree and [v3(p) for p in c['controlPoints']] == poles]
    assert len(hits) == 1, ('curves of degree ' + str(degree) + ' with these exact poles', len(hits), [c['name'] for c in curves])
    return hits[0]
out = {'status': 'PASS', 'productImports': 0, 'curveCount': len(curves), 'names': [c['name'] for c in curves], 'checks': {}}
worst_point = 0.0; worst_tangent = 0.0
def clamped(c):
    d = c['degree']; want = [F(0)] * (d + 1) + [F(1)] * (d + 1)
    assert [fr(k) for k in c['knots']] == want, ('clamped knots', c['knots'])
    assert [fr(w) for w in c['weights']] == [F(1)] * (d + 1), ('unit weights', c['weights'])
def product_at(c, t):
    hit = [e for e in c['evals'] if fr(e['t']) == t]; assert len(hit) == 1, ('product evaluation at', t); return hit[0]['point']
def compare(c, poles, t):
    global worst_point
    exact = bernstein(poles, t); got = product_at(c, t)
    for a, b in zip(exact, got):
        d = abs(float(a) - float(b)); worst_point = max(worst_point, d)
        assert d <= 1e-12, ('product point differs from Bernstein', c['name'], str(t), float(a), float(b), d)
    return [float(a) for a in exact]
quad = [v3(p) for p in data['quad']]; cub = [v3(p) for p in data['cubic']]
q = find(2, quad); clamped(q)
half = F(1, 2); exact_half = bernstein(quad, half)
assert exact_half == (F(10), F(45), F(0)), ('B(1/2) of the quadratic', exact_half)
t0 = mul(sub(quad[1], quad[0]), 2); t1 = mul(sub(quad[2], quad[1]), 2)
assert t0 == (F(20), F(20), F(0)) and t1 == (F(20), F(-20), F(0)), ('end tangents', t0, t1)
out['checks']['quadratic'] = {'name': q['name'], 'halfExact': [float(c) for c in exact_half], 'startTangent': [float(c) for c in t0], 'endTangent': [float(c) for c in t1], 'half': compare(q, quad, half)}
compare(q, quad, F(0)); compare(q, quad, F(1))
for key, want, t in (('start', t0, F(0)), ('end', t1, F(1))):
    got = q['d1'].get(key); assert got is not None, ('product derivative at ' + key)
    for a, b in zip(want, got):
        d = abs(float(a) - float(b)); worst_tangent = max(worst_tangent, d); assert d <= 1e-9, ('product derivative at ' + key, float(a), float(b), d)
c3 = find(3, cub); clamped(c3)
out['checks']['cubic'] = {'name': c3['name'], 'values': {}}
for t in (F(1, 4), F(1, 2), F(3, 4)): out['checks']['cubic']['values'][str(t)] = compare(c3, cub, t)
compare(c3, cub, F(0)); compare(c3, cub, F(1))
assert q['name'] != c3['name'], 'two distinct curves'
out['worstProductPointDifference'] = worst_point; out['worstProductTangentDifference'] = worst_tangent
print(json.dumps(out, indent=2))
