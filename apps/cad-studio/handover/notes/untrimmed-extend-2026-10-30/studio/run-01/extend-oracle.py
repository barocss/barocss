"""Independent exact (Fraction) check of an Extend result against the analytic panel. Product imports: zero."""
import json, sys
from fractions import Fraction as F
from math import isqrt

def fr(x):
    assert not isinstance(x, bool), 'boolean is not a scalar'
    return F(x)

def sub(a, b): return [x - y for x, y in zip(a, b)]
def l1(a): return sum((abs(x) for x in a), F(0))
def cross(a, b): return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
def dot(a, b): return sum((x * y for x, y in zip(a, b)), F(0))

data = json.load(sys.stdin)
case = data['case']; objects = data['objects']
A = [F(7), F(-11), F(13)]; U = [F(3), F(4), F(0)]; V = [F(0), F(0), F(2)]; N = [F(4, 5), F(-3, 5), F(0)]
# T(s,t) = A + a0*V + s*su*U + t*tv*V ; degree after each case
CASES = {'original': (F(0), F(3), F(4), 1), 'u-max': (F(0), F(7, 2), F(4), 3), 'u-max-then-v-min': (F(-5, 4), F(7, 2), F(21, 4), 3)}
assert case in CASES, ('unknown case', case)
a0, su, tv, deg = CASES[case]
def T(s, t): return [A[k] + a0 * V[k] + s * su * U[k] + t * tv * V[k] for k in range(3)]
Ts = [su * x for x in U]; Tt = [tv * x for x in V]

# Hidden source preservation: the original object still holds the fixture exactly.
fixture = {'degreeU': 1, 'degreeV': 1, 'knotsU': [2, 2, 5, 5], 'knotsV': [-1, -1, 3, 3],
           'controlPoints': [[[7, -11, 13], [7, -11, 21]], [[16, 1, 13], [16, 1, 21]]], 'weights': [[1, 1], [1, 1]]}
originals = [o for o in objects if o['name'] == 'd347 · panel']
assert len(originals) == 1, 'exactly one original d347 · panel object'
og = originals[0]['geometry']
assert originals[0]['kind'] == 'surface' and not originals[0]['trims']
assert og['degreeU'] == 1 and og['degreeV'] == 1
assert [fr(x) for x in og['knotsU']] == [fr(x) for x in fixture['knotsU']] and [fr(x) for x in og['knotsV']] == [fr(x) for x in fixture['knotsV']]
assert [[[fr(c) for c in p] for p in row] for row in og['controlPoints']] == [[[fr(c) for c in p] for p in row] for row in fixture['controlPoints']], 'original poles'
assert [[fr(w) for w in row] for row in og['weights']] == [[fr(w) for w in row] for row in fixture['weights']], 'original weights'
if case == 'original': assert not originals[0]['hidden']
else: assert originals[0]['hidden'], 'original must be hidden after Extend'

visible = [o for o in objects if not o['hidden'] and o['kind'] == 'surface']
assert len(visible) == 1, ('exactly one visible surface', len(visible))
surface = visible[0]; g = surface['geometry']
assert not surface['trims'], 'no trims on the result'
du, dv = g['degreeU'], g['degreeV']
assert du == deg and dv == deg, ('degree', du, dv, deg)
ku = [fr(x) for x in g['knotsU']]; kv = [fr(x) for x in g['knotsV']]
P = [[[fr(c) for c in p] for p in row] for row in g['controlPoints']]
W = [[fr(w) for w in row] for row in g['weights']]
nu = len(P); nv = len(P[0]); assert all(len(row) == nv for row in P) and all(len(p) == 3 for row in P for p in row)
assert all(w == 1 for row in W for w in row) and len(W) == nu and all(len(row) == nv for row in W), 'weights exactly 1'
def clamped(k, n, d, name):
    assert len(k) == n + d + 1, (name, 'knot count', len(k), n, d)
    assert all(k[i] <= k[i + 1] for i in range(len(k) - 1)), (name, 'nondecreasing')
    assert len(set(k[:d + 1])) == 1 and len(set(k[-(d + 1):])) == 1, (name, 'clamped ends')
    assert k[0] < k[-1], (name, 'domain')
clamped(ku, nu, du, 'u'); clamped(kv, nv, dv, 'v')
def greville(k, i, d): return sum(k[i + 1:i + d + 1], F(0)) / d
u0, u1, v0, v1 = ku[0], ku[-1], kv[0], kv[-1]

position = F(0)
for i in range(nu):
    s = (greville(ku, i, du) - u0) / (u1 - u0)
    for j in range(nv):
        t = (greville(kv, j, dv) - v0) / (v1 - v0)
        position = max(position, l1(sub(P[i][j], T(s, t))))
assert position <= F(1, 10 ** 7), ('position', float(position))

es = F(0); et = F(0)
for i in range(nu - 1):
    d = ku[i + du + 1] - ku[i + 1]; assert d > 0
    for j in range(nv):
        q = [du * (P[i + 1][j][k] - P[i][j][k]) / d * (u1 - u0) for k in range(3)]
        es = max(es, l1(sub(q, Ts)))
for i in range(nu):
    for j in range(nv - 1):
        d = kv[j + dv + 1] - kv[j + 1]; assert d > 0
        q = [dv * (P[i][j + 1][k] - P[i][j][k]) / d * (v1 - v0) for k in range(3)]
        et = max(et, l1(sub(q, Tt)))
c = cross(Ts, Tt)
n2 = sum((x * x for x in c), F(0))
lower_norm = F(isqrt(int(n2 * 10 ** 40)), 10 ** 20)
jacobian = lower_norm - l1(Ts) * et - l1(Tt) * es - es * et
assert jacobian > 0, ('jacobian lower bound', float(jacobian))
orientation = dot(c, N)
assert orientation > 0, ('orientation', float(orientation))
print(json.dumps({'status': 'PASS', 'case': case, 'object': surface['id'], 'name': surface['name'], 'degree': [du, dv], 'poles': [nu, nv],
  'position': float(position), 'positionExact': str(position), 'derivS': float(es), 'derivT': float(et),
  'jacobianLower': float(jacobian), 'orientationDot': float(orientation), 'productImports': 0}, indent=2))
