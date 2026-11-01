"""Independent check of a two-circle band sketch (strip or filled) and of its extruded volume. Product imports: zero."""
import json, math, sys

data = json.load(sys.stdin)
doc = data['doc']; exp = data['expect']; mode = data['mode']; reported = data.get('volume')
params = doc.get('parameters') or {}

def finite(v, path):
    if isinstance(v, bool): return  # (the construction flag)
    if isinstance(v, (int, float)): assert math.isfinite(v), ('non-finite', path)
    elif isinstance(v, list):
        for i, x in enumerate(v): finite(x, path + '[' + str(i) + ']')
    elif isinstance(v, dict):
        for k, x in v.items(): finite(x, path + '.' + k)
    elif v is None: raise AssertionError(('null', path))
finite(doc, 'doc')

def resolve(x):
    if isinstance(x, dict):
        assert list(x.keys()) == ['parameter'], ('binding shape', x)
        return float(params[x['parameter']])
    assert isinstance(x, (int, float)) and not isinstance(x, bool), ('not a plain number', x)
    return float(x)

def area(R1, R2, C):
    s = (R1 - R2) / C; assert abs(s) < 1, ('one circle inside the other', R1, R2, C)
    b = math.asin(s)
    return (R1 + R2) * C * math.cos(b) + 0.5 * R1 * R1 * (math.pi + 2 * b) + 0.5 * R2 * R2 * (math.pi - 2 * b)

def hull_area(circles, d, n=50000):
    pts = []
    for (cx, cy, r) in circles:
        for k in range(n): t = 2 * math.pi * k / n; pts.append((cx + (r + d) * math.cos(t), cy + (r + d) * math.sin(t)))
    pts = sorted(set(pts))
    def cross(o, a, b): return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lower = []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0: lower.pop()
        lower.append(p)
    upper = []
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0: upper.pop()
        upper.append(p)
    h = lower[:-1] + upper[:-1]
    return abs(sum(h[i][0] * h[(i + 1) % len(h)][1] - h[(i + 1) % len(h)][0] * h[i][1] for i in range(len(h)))) / 2

out = {'status': 'PASS', 'productImports': 0, 'mode': mode}
if mode == 'overlap':
    R = exp['R']; r2 = exp['r2']; C = exp['C']
    assert R + r2 > C and abs(R - r2) < C, ('the circles overlap (neither apart nor nested)', R, r2, C)
    out.update({'R': R, 'r2': r2, 'C': C, 'sum': R + r2, 'overlap': R + r2 - C})
elif mode == 'volume':
    nodes = doc['nodes']; assert [n['kind'] for n in nodes] == ['sketch', 'extrude'], [n['kind'] for n in nodes]
    sk, ex = nodes[0], nodes[1]
    assert sk['profile'] == 'band' and set(sk['band'].keys()) <= {'version', 'id', 'sources', 'offset', 'width'}, ('band node', sk.get('profile'), sk.get('band'))
    band = sk['band']; assert band['version'] == 1 and band['id'] == 'b1', band
    assert len(band['sources']) == 2 and len(set(band['sources'])) == 2, band['sources']
    cons = sk['construction']; assert len(cons) == 2 and all(c['kind'] == 'circle' for c in cons), cons
    circles = []
    for ref in band['sources']:
        match = [c for c in cons if ref in (c.get('ids') or [])]; assert len(match) == 1, ('source resolves to one circle', ref)
        c = match[0]; circles.append((resolve(c['c'][0]), resolve(c['c'][1]), resolve(c['r'])))
    bound = exp.get('bound') or {}
    for k, c in enumerate([[m for m in cons if ref in m['ids']][0] for ref in band['sources']]):
        for slot, value in (('r', c['r']), ('c0', c['c'][0]), ('c1', c['c'][1])):
            name = bound.get('%d%s' % (k, slot))
            if name: assert value == {'parameter': name}, ('binding of source %d %s' % (k + 1, slot), value, name)
            else: assert isinstance(value, (int, float)) and not isinstance(value, bool), ('plain number', k, slot, value)
    (x1, y1, R1), (x2, y2, R2) = circles
    assert [round(x1, 9), round(y1, 9), round(R1, 9), round(x2, 9), round(y2, 9), round(R2, 9)] == [exp['x1'], exp['y1'], exp['R1'], exp['x2'], exp['y2'], exp['R2']], ('source circles', circles, exp)
    C = math.hypot(x2 - x1, y2 - y1); assert abs(C - exp['C']) < 1e-9, ('centre distance', C)
    offset = resolve(band['offset']) if 'offset' in band else 0.0; width = resolve(band['width']) if 'width' in band else None
    assert offset == exp['offset'] and width == exp['width'], ('offset / width', offset, width, exp)
    ob = exp.get('boundBand') or {}
    for key in ('offset', 'width'):
        if key in ob: assert band[key] == {'parameter': ob[key]}, (key, band.get(key))
    outer = offset + (width or 0.0)
    strip = area(R1 + outer, R2 + outer, C) - (area(R1 + offset, R2 + offset, C) if width is not None else 0.0)
    hull = hull_area(circles, outer) - (hull_area(circles, offset) if width is not None else 0.0)
    assert abs(strip - hull) <= 1e-8 * strip, ('closed form against the sampled convex hull', strip, hull, abs(strip - hull) / strip)
    assert ex['sketch'] == 0 and abs(float(ex['height'])) == exp['height'], ('extrude', ex)
    vol = abs(float(ex['height'])) * strip
    if reported is not None:
        rel = abs(vol - reported) / vol; assert rel <= 1e-6, ('Studio volume against height x strip area', vol, reported, rel)
        out.update({'studioVolume': reported, 'volumeRelative': rel})
    out.update({'R1': R1, 'R2': R2, 'C': C, 'offset': offset, 'width': width, 'stripArea': strip, 'hullArea': hull, 'oracleVolume': vol})
else:
    raise AssertionError(('unknown mode', mode))
print(json.dumps(out, indent=2))
