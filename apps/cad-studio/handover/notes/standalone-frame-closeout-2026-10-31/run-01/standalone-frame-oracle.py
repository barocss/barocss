"""Independent check of a standalone geometric control frame in an exported sheet SVG. Product imports: zero."""
import json, math, re, sys
import xml.etree.ElementTree as ET

data = json.load(sys.stdin)
svg = data['svg']; frame = data['frame']; exp = data['expect']
NS = '{http://www.w3.org/2000/svg}'
root = ET.fromstring(svg.encode('utf-8'))
nums = lambda s: [float(x) for x in re.findall(r'-?\d+(?:\.\d+)?(?:[eE]-?\d+)?', s)]

# The saved frame: standalone (no dim), the view, a finite dense place[2], only supported keys.
allowed = {'id', 'view', 'place', 'dim', 'characteristic', 'value', 'datums', 'diameter', 'material', 'datumModifiers', 'projected', 'freeState', 'tangentPlane', 'composite'}
assert set(frame) <= allowed, ('keys', sorted(set(frame) - allowed))
assert 'dim' not in frame, 'standalone frame has no dim'
assert frame['id'] == exp['id'] and frame['view'] == exp['view'], (frame['id'], frame['view'])
place = frame['place']; assert isinstance(place, list) and len(place) == 2 and all(isinstance(v, (int, float)) and math.isfinite(v) for v in place), place

# The view's own drawn lines give its origin and scale: a 12 x 6 box view spans [0, 12] x [0, 6] model mm, y up (sheet y down).
view_lines = []
for g in root.iter(NS + 'g'):
    if g.get('class') == 'view' and g.get('data-view') == exp['view']:
        for e in g.iter(NS + 'line'):
            view_lines.append([float(e.get(k)) for k in ('x1', 'y1', 'x2', 'y2')])
assert view_lines, ('no lines drawn for the view', exp['view'])
xs = [v for l in view_lines for v in (l[0], l[2])]; ys = [v for l in view_lines for v in (l[1], l[3])]
minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
sx = (maxx - minx) / exp['viewWidth']; sy = (maxy - miny) / exp['viewHeight']
assert abs(sx - sy) <= 2e-3 * sx, ('one scale on both axes', sx, sy)
scale = sx
assert abs(scale - exp['reportedScale']) <= 2e-3 * scale, ('scale against the hook', scale, exp['reportedScale'])
origin = (minx, maxy)

# The frame group: exactly one, standalone identity, no dimension / datum-target identity.
groups = [g for g in root.iter(NS + 'g') if g.get('data-standalone-frame') == exp['id']]
assert len(groups) == 1, ('one frame group', len(groups))
g = groups[0]; assert g.get('class') == 'control' and g.get('data-view') == exp['view'], (g.get('class'), g.get('data-view'))
assert g.get('data-dim') is None and g.get('data-datum-target') is None
border = next((e for e in g.iter(NS + 'polyline')), None); assert border is not None, 'frame border'
pts = nums(border.get('points')); pts = [(pts[i], pts[i + 1]) for i in range(0, len(pts), 2)]
assert len(pts) == 5 and pts[0] == pts[4], pts
want = (origin[0] + scale * place[0], origin[1] - scale * place[1])
assert abs(pts[0][0] - want[0]) <= 5e-3 and abs(pts[0][1] - want[1]) <= 5e-3, ('border top-left against view origin + scale * place', pts[0], want)
x0, y0 = pts[0]; x1 = max(p[0] for p in pts); y1 = max(p[1] for p in pts)
assert abs((y1 - y0) - 6) <= 1e-3, ('the frame stays 6 paper mm high', y1 - y0)
assert (x1 - x0) >= 7 + 6, ('symbol cell 7 plus a value cell', x1 - x0)
texts = [(t.text, float(t.get('x')), float(t.get('y')), t.get('text-anchor')) for t in g.iter(NS + 'text')]
assert [t[0] for t in texts] == [exp['symbolText']], ('the symbol text', texts)
text, tx, ty, anchor = texts[0]
assert x0 + 7 < tx < x1 and abs(ty - (y0 + 4.5)) <= 1e-3 and anchor == 'middle', ('text inside the value cell', texts[0], (x0, y0, x1, y1))
print(json.dumps({'status': 'PASS', 'scale': scale, 'origin': origin, 'place': place, 'borderTopLeft': [x0, y0], 'expectedTopLeft': list(want), 'width': x1 - x0, 'text': texts[0]}, indent=2))
