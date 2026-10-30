"""Independent exact check of a closed line-and-arc loop made by the Spline tool: fit points on the outline, arc equidistance, joint tangency, area. Product imports: zero."""
import json, sys, math
from fractions import Fraction as F

def fr(x):
    assert not isinstance(x, bool), 'boolean is not a scalar'
    return F(x)
def pt(p): return (fr(p[0]), fr(p[1]))
def sub(a, b): return (a[0] - b[0], a[1] - b[1])
def cross(a, b): return a[0] * b[1] - a[1] * b[0]
def dot(a, b): return a[0] * b[0] + a[1] * b[1]
def sq(a): return dot(a, a)

data = json.load(sys.stdin)
doc = data['doc']; node = doc['nodes'][data['node']]
assert node['kind'] == 'sketch' and node['profile'] == 'loop', 'loop sketch'
segs = node['segments']; n = len(segs); assert n >= 3, 'at least three segments'
starts = [pt(s['start']) for s in segs]
fit = [pt(p) for p in data['fit']]
out = {'status': 'PASS', 'productImports': 0, 'segments': n, 'arcs': sum(1 for s in segs if s['kind'] == 'arc'), 'lines': sum(1 for s in segs if s['kind'] == 'line')}

# (1) every fit point equals some segment start exactly
missing = [[str(p[0]), str(p[1])] for p in fit if p not in starts]
assert not missing, ('fit points not on the stored outline as segment starts', missing)
out['fitPoints'] = len(fit)

# (2) every arc: start and end equidistant from the centre
worst_gap = F(0); worst_rel = 0.0
for i, s in enumerate(segs):
    if s['kind'] != 'arc': continue
    c = pt(s['center']); a = starts[i]; b = starts[(i + 1) % n]
    da, db = sq(sub(a, c)), sq(sub(b, c)); assert da > 0, ('degenerate arc', i)
    gap = abs(db - da) / da
    rel = abs(math.sqrt(float(db)) - math.sqrt(float(da))) / math.sqrt(float(da))
    worst_gap = max(worst_gap, gap); worst_rel = max(worst_rel, rel)
    assert rel <= 1e-9, ('arc ' + str(i) + ' start/end distances from the centre differ', rel, float(gap))
out['worstRadiusGapRelative'] = worst_rel; out['worstSquaredGapRelative'] = float(worst_gap)

# (3) tangency at every joint (cross and dot of the incoming and outgoing directions, exact)
def tangent(i, at_end):
    s = segs[i]; a = starts[i]; b = starts[(i + 1) % n]
    if s['kind'] == 'line': return sub(b, a)
    c = pt(s['center']); r = sub(b if at_end else a, c)
    perp = (-r[1], r[0])
    return perp if s['direction'] == 'ccw' else (-perp[0], -perp[1])
worst_tan = 0.0; joints = []
for i in range(n):
    t_in = tangent(i, True); t_out = tangent((i + 1) % n, False)
    assert sq(t_in) > 0 and sq(t_out) > 0, ('zero-length tangent at joint', i)
    cr, dt = cross(t_in, t_out), dot(t_in, t_out)
    ang = abs(math.atan2(float(cr), float(dt))); worst_tan = max(worst_tan, ang)
    joints.append({'joint': (i + 1) % n, 'angle': ang})
    assert ang <= 1e-9, ('joint ' + str((i + 1) % n) + ' is not tangent', ang)
out['worstTangentAngle'] = worst_tan; out['joints'] = len(joints)

# (4) area by the shoelace over the vertices plus each arc's circular-segment area, times the extrude height, against the Studio volume
shoe = F(0)
for i in range(n):
    a = starts[i]; b = starts[(i + 1) % n]; shoe += cross(a, b)
shoe = shoe / 2
seg_area = 0.0
for i, s in enumerate(segs):
    if s['kind'] != 'arc': continue
    c = pt(s['center']); ra = sub(starts[i], c); rb = sub(starts[(i + 1) % n], c)
    th = math.atan2(float(cross(ra, rb)), float(dot(ra, rb)))
    if s['direction'] == 'ccw' and th < -1e-7: th += 2 * math.pi
    if s['direction'] == 'cw' and th > 1e-7: th -= 2 * math.pi
    seg_area += float(sq(ra)) / 2 * (th - math.sin(th))
area = abs(float(shoe) + seg_area); out['area'] = area; out['shoelaceArea'] = float(shoe)
if data.get('volume') is not None:
    ext = [m for m in doc['nodes'] if m['kind'] == 'extrude' and m['sketch'] == data['node']]; assert len(ext) == 1, 'one extrude of the sketch'
    h = abs(float(ext[0]['height'])); assert h == 10, ('extrude height', h)
    vol = area * h; rel = abs(vol - data['volume']) / data['volume']
    out['oracleVolume'] = vol; out['studioVolume'] = data['volume']; out['volumeRelativeDifference'] = rel
    assert rel <= 1e-6, ('volume', vol, data['volume'], rel)

# (5) no equalRadii / concentric relation the user did not draw (the loop sketch's outline field)
outline = node.get('outline') or {}
out['outline'] = {k: outline.get(k) for k in ('equalRadii', 'concentric', 'tangents', 'hv', 'rules', 'radii', 'lengths') if k in outline}
for key in ('equalRadii', 'concentric'):
    assert not outline.get(key), ('outline carries ' + key, outline.get(key))
print(json.dumps(out, indent=2))
