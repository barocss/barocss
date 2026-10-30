"""Independent check of a ruled band sheet between two coaxial circles. Product imports: zero."""
import json, math, sys

data = json.load(sys.stdin)
doc = data['doc']; read = data['read']; exp = data['expect']
params = doc.get('parameters') or {}

def finite(v, path):
    if isinstance(v, bool): return
    if isinstance(v, (int, float)): assert math.isfinite(v), ('non-finite', path)
    elif isinstance(v, list):
        for i, x in enumerate(v): finite(x, path + '[' + str(i) + ']')
    elif isinstance(v, dict):
        for k, x in v.items(): finite(x, path + '.' + k)
    elif v is None: raise AssertionError(('null', path))
finite(doc, 'doc')

def resolve(x):
    if isinstance(x, dict): return float(params[x['parameter']])
    return float(x)

nodes = doc['nodes']
bands = [n for n in nodes if n['kind'] == 'band-surface']; assert len(bands) == 1, ('one band node', len(bands))
band = bands[0]
r1 = resolve(nodes[0]['radius']); r2 = resolve(nodes[2]['radius']); z1 = float(nodes[1]['height']); z2 = float(nodes[3]['from'])
assert abs(r1 - exp['r1']) < 1e-12 and abs(r2 - exp['r2']) < 1e-12, ('radii', r1, r2, exp)
assert band['a']['parent'] == {'node': 1, 'side': 'solid'} and band['b']['parent'] == {'node': 3, 'side': 'solid'}, ('parents', band['a'], band['b'])
assert len(band['a']['edges']) >= 1 and len(band['b']['edges']) >= 1
assert not set(band['a']['edges']) & set(band['b']['edges']), 'a name on one side only'
assert band['a']['edges'] == exp['aEdges'] and band['b']['edges'] == exp['bEdges'], ('stored names', band['a']['edges'], band['b']['edges'])
assert not band.get('flip'), 'flip is off'
for k in ('thickness', 'side'): assert k not in band, ('v1 has no ' + k)

h = z2 - z1
want = math.pi * (r1 + r2) * math.sqrt((r1 - r2) ** 2 + h * h)
bodies = read['bodies']; sheets = [b for b in bodies if b.get('band')]; assert len(sheets) == 1, ('one sheet body', [b['key'] for b in bodies])
sheet = sheets[0]; assert len(bodies) == 3, ('two cylinders and the band stay bodies', [b['key'] for b in bodies])
# The kernel's area over the exact surfaces must equal the frustum; the faceted display mesh only to its chord error.
assert sheet.get('areaBasis') == 'exact', ('the band area is computed on the exact surfaces', sheet.get('areaBasis'))
exact = sheet['area']; rel_exact = abs(exact - want) / want
assert rel_exact <= 1e-9, ('exact band area against the frustum', exact, want, rel_exact)
area = sum(sheet['faceAreas']); rel = abs(area - want) / want
assert rel <= 1e-2, ('display mesh area against the frustum (faceted)', area, want, rel)
assert abs(sheet['zMin'] - z1) < 1e-6 and abs(sheet['zMax'] - z2) < 1e-6, ('sheet z range', sheet['zMin'], sheet['zMax'])
for r in sheet['radiiAtZMin']: assert abs(r - r1) < 1e-6, ('boundary radius at A', r, r1)
for r in sheet['radiiAtZMax']: assert abs(r - r2) < 1e-6, ('boundary radius at B', r, r2)
assert len(sheet['radiiAtZMin']) >= 8 and len(sheet['radiiAtZMax']) >= 8
assert sheet['volume'] in (None, 0), ('a sheet has no volume', sheet['volume'])
rep = sheet['band']; assert rep['closed'] is True and rep['exact'] is True, rep
assert rep['boundaryDeviation'] <= 1e-6, ('boundary deviation', rep['boundaryDeviation'])
assert 'chord' not in rep or rep['chord'] is None, 'no thickness, no chord'
print(json.dumps({'status': 'PASS', 'r1': r1, 'r2': r2, 'h': h, 'frustumArea': want, 'exactArea': exact, 'exactRelative': rel_exact, 'meshArea': area, 'relative': rel, 'report': rep}, indent=2))
