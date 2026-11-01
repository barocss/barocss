"""Independent check of an ellipse sketch (closed tangent-arc outline of 192 points) and of the exact NURBS curve Make curves writes. Product imports: zero."""
import json, math, sys

data = json.load(sys.stdin)
doc = data['doc']; exp = data['expect']; mode = data['mode']; reported = data.get('volume')
cx, cy = exp['center']; rx = exp['rx']; ry = exp['ry']; ang = exp['angle']
ca, sa = math.cos(math.radians(ang)), math.sin(math.radians(ang))
longer = max(rx, ry)

def local(x, y):
    dx, dy = x - cx, y - cy
    return (ca * dx + sa * dy, -sa * dx + ca * dy)
def implicit(x, y):
    u, v = local(x, y)
    return (u / rx) ** 2 + (v / ry) ** 2 - 1

GRID = 256
TABLE = [(rx * math.cos(2 * math.pi * k / GRID), ry * math.sin(2 * math.pi * k / GRID)) for k in range(GRID)]
def distance(x, y):
    u, v = local(x, y)
    best = min(range(GRID), key=lambda k: (TABLE[k][0] - u) ** 2 + (TABLE[k][1] - v) ** 2)
    lo = 2 * math.pi * (best - 1) / GRID; hi = 2 * math.pi * (best + 1) / GRID
    def d2(t): return (rx * math.cos(t) - u) ** 2 + (ry * math.sin(t) - v) ** 2
    for _ in range(80):
        a = lo + (hi - lo) / 3; b = hi - (hi - lo) / 3
        if d2(a) < d2(b): hi = b
        else: lo = a
    return math.sqrt(d2((lo + hi) / 2))

def finite(v, path):
    if isinstance(v, bool): raise AssertionError(('boolean is not a number', path))
    if isinstance(v, (int, float)): assert math.isfinite(v), ('non-finite', path)
    elif isinstance(v, list):
        for i, x in enumerate(v): finite(x, path + '[' + str(i) + ']')
    elif isinstance(v, dict):
        for k, x in v.items(): finite(x, path + '.' + k)
    elif v is None: raise AssertionError(('null', path))
finite(doc, 'doc')
out = {'status': 'PASS', 'productImports': 0, 'mode': mode}

if mode == 'sketch':
    node = doc['nodes'][0]; assert node['kind'] == 'sketch', node['kind']
    outline = node['outline']; assert outline['ellipse'] == {'center': [cx, cy], 'rx': rx, 'ry': ry, 'angle': ang}, ('stored definition', outline['ellipse'], exp)
    pts = outline['points']; n = len(pts); assert n == 192, ('outline points', n)
    bulges = outline.get('bulges') or [0] * n; assert len(bulges) == n, 'one bulge per point'
    tags = node['sideTags']['outer']; assert len(tags) == 192 and len(set(tags)) == 192, ('192 distinct outer side ids', len(tags), len(set(tags)))
    worst_implicit = 0.0; worst_position = 0.0
    for k in range(96):
        t = 2 * math.pi * k / 96; x = rx * math.cos(t); y = ry * math.sin(t)
        ex = cx + ca * x - sa * y; ey = cy + sa * x + ca * y; p = pts[2 * k]
        worst_position = max(worst_position, math.hypot(p[0] - ex, p[1] - ey) / longer)
        worst_implicit = max(worst_implicit, abs(implicit(p[0], p[1])))
    assert worst_implicit <= 1e-9, ('fit points on the exact ellipse', worst_implicit)
    assert worst_position <= 1e-9, ('fit points at the parameter positions', worst_position)
    worst_dist = 0.0; area = 0.0
    for i in range(n):
        p = pts[i]; q = pts[(i + 1) % n]; b = bulges[i]
        area += (p[0] * q[1] - q[0] * p[1]) / 2
        if b == 0:
            samples = [(p[0] + (q[0] - p[0]) * k / 32, p[1] + (q[1] - p[1]) * k / 32) for k in range(33)]
        else:
            c = math.hypot(q[0] - p[0], q[1] - p[1]); m = ((p[0] + q[0]) / 2, (p[1] + q[1]) / 2)
            nx, ny = -(q[1] - p[1]) / c, (q[0] - p[0]) / c; d = (c / 2) * (1 - b * b) / (2 * b)
            ctr = (m[0] + nx * d, m[1] + ny * d); r = math.hypot(p[0] - ctr[0], p[1] - ctr[1])
            start = math.atan2(p[1] - ctr[1], p[0] - ctr[0]); sweep = 4 * math.atan(b)
            samples = [(ctr[0] + r * math.cos(start + sweep * k / 32), ctr[1] + r * math.sin(start + sweep * k / 32)) for k in range(33)]
            end = samples[-1]; assert math.hypot(end[0] - q[0], end[1] - q[1]) <= 1e-7 * longer, ('arc ' + str(i) + ' ends on its chord end', end, q)
            area += r * r / 2 * (sweep - math.sin(sweep))
        for s in samples: worst_dist = max(worst_dist, distance(s[0], s[1]))
    area = abs(area)
    assert worst_dist <= 1e-5 * longer, ('outline within 1e-5 of the longer semi-axis', worst_dist, worst_dist / longer)
    exact = math.pi * rx * ry; rel_exact = abs(area - exact) / exact
    assert rel_exact <= 2e-5, ('area against pi rx ry', area, exact, rel_exact)
    out.update({'points': n, 'sideIds': len(tags), 'worstFitImplicit': worst_implicit, 'worstFitPosition': worst_position, 'worstOutlineDistance': worst_dist, 'worstOutlineDistanceRelative': worst_dist / longer,
                'outlineArea': area, 'exactArea': exact, 'areaRelativeToExact': rel_exact})
    if reported is not None:
        ext = [m for m in doc['nodes'] if m['kind'] == 'extrude' and m['sketch'] == 0]; assert len(ext) == 1, 'one extrude of the sketch'
        h = abs(float(ext[0]['height'])); assert h == exp['height'], ('extrude height', h)
        vol = area * h; rel = abs(vol - reported) / vol; rel_pi = abs(exact * h - reported) / (exact * h)
        assert rel <= 1e-6, ('Studio volume against height x outline area', vol, reported, rel)
        assert rel_pi <= 2e-5, ('Studio volume against pi rx ry height', exact * h, reported, rel_pi)
        out.update({'outlineVolume': vol, 'studioVolume': reported, 'volumeRelativeToOutline': rel, 'volumeRelativeToExact': rel_pi})
elif mode == 'curve':
    curves = data['curves']; assert len(curves) == 1, ('one direct curve', [c['name'] for c in curves])
    c = curves[0]; assert c['name'].startswith('Sketch curve 1'), c['name']
    p = c['degree']; P = c['controlPoints']; W = c['weights']; U = c['knots']; n = len(P) - 1
    assert p == 2, ('degree 2', p); assert len(W) == len(P) and len(U) == len(P) + p + 1, ('lengths', len(P), len(W), len(U))
    assert all(U[i] <= U[i + 1] for i in range(len(U) - 1)), 'knots do not decrease'
    assert len(set(U[:p + 1])) == 1 and len(set(U[-p - 1:])) == 1 and U[0] < U[-1], ('clamped knots', U)
    assert all(w > 0 for w in W), ('positive weights', W); assert any(abs(w - 1) > 1e-6 for w in W), ('rational: some weight differs from 1', W)
    assert all(abs(q[2]) <= 1e-12 for q in P), ('all poles at z 0', [q[2] for q in P])
    assert max(abs(P[0][i] - P[-1][i]) for i in range(3)) <= 1e-9 * longer, ('closed: first pole equals last', P[0], P[-1])
    def find_span(t):
        if t >= U[n + 1]: return n
        lo, hi = p, n + 1; mid = (lo + hi) // 2
        while t < U[mid] or t >= U[mid + 1]:
            if t < U[mid]: hi = mid
            else: lo = mid
            mid = (lo + hi) // 2
        return mid
    def at(t):
        i = find_span(t); N = [0.0] * (p + 1); N[0] = 1.0; left = [0.0] * (p + 1); right = [0.0] * (p + 1)
        for j in range(1, p + 1):
            left[j] = t - U[i + 1 - j]; right[j] = U[i + j] - t; saved = 0.0
            for r in range(j):
                temp = N[r] / (right[r + 1] + left[j - r]); N[r] = saved + right[r + 1] * temp; saved = left[j - r] * temp
            N[j] = saved
        num = [0.0, 0.0, 0.0]; den = 0.0
        for j in range(p + 1):
            w = N[j] * W[i - p + j]; den += w
            for k in range(3): num[k] += w * P[i - p + j][k]
        return [x / den for x in num]
    a = U[p]; b = U[-p - 1]; worst = 0.0; max_u = 0.0; max_v = 0.0; count = 800
    for k in range(count + 1):
        q = at(a + (b - a) * k / count); worst = max(worst, abs(implicit(q[0], q[1]))); assert abs(q[2]) <= 1e-12, ('point at z 0', q)
        u, v = local(q[0], q[1]); max_u = max(max_u, abs(u)); max_v = max(max_v, abs(v))
    assert worst <= 1e-9, ('every point satisfies the ellipse equation', worst)
    assert abs(max_u - rx) <= 1e-3 * rx and abs(max_v - ry) <= 1e-3 * ry, ('the curve reaches both semi-axes', max_u, max_v)
    s0 = at(a); s1 = at(b); assert max(abs(s0[i] - s1[i]) for i in range(3)) <= 1e-9 * longer, ('closed: start equals end', s0, s1)
    worst_product = 0.0
    for e in c['evals']:
        q = at(e['t']); worst_product = max(worst_product, max(abs(q[i] - e['point'][i]) for i in range(3)))
    assert worst_product <= 1e-9 * longer, ('product evaluation equals the oracle evaluation', worst_product)
    out.update({'name': c['name'], 'degree': p, 'poles': len(P), 'weights': W, 'knots': U, 'worstImplicit': worst, 'samples': count + 1, 'maxLocalU': max_u, 'maxLocalV': max_v, 'worstProductDifference': worst_product})
else:
    raise AssertionError(('unknown mode', mode))
print(json.dumps(out, indent=2))
