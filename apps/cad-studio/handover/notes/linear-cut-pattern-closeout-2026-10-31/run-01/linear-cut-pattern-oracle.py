"""Independent check of a linear cut pattern from the saved document. Product imports: zero."""
import json, sys
data = json.load(sys.stdin)
doc = data['doc']; studio = data['studioVolume']; count = data['expectCount']
nodes = doc['nodes']
pattern = [n for n in nodes if n['kind'] == 'linear-feature-pattern']
assert len(pattern) == 1, ('one pattern node', len(pattern))
p = pattern[0]
assert p['count'] == count and p['axis'] == 'x' and p['spacing'] == 16, p
assert nodes[-1] is p or nodes[-1] == p, 'the pattern is the last node'
# Block: nodes[0] rectangle sketch + nodes[1] extrude. Cut: nodes[2] sketch + nodes[3] extrude, moved by nodes[4] translate.
b, be = nodes[0], nodes[1]; c, ce, tr = nodes[2], nodes[3], nodes[4]
assert b['profile'] == 'rectangle' and c['profile'] == 'rectangle' and tr['kind'] == 'translate' and nodes[5]['kind'] == 'difference'
off = tr['offset']; assert all(isinstance(v, (int, float)) for v in off), off
bw, bd, bh = b['max'][0] - b['min'][0], b['max'][1] - b['min'][1], be['height']
cw, cd, ch = c['max'][0] - c['min'][0], c['max'][1] - c['min'][1], ce['height']
cx0 = c['min'][0] + off[0]; cy0 = c['min'][1] + off[1]
assert (bw, bd, bh) == (60, 30, 10) and (cw, cd, ch) == (4, 4, 10), ((bw, bd, bh), (cw, cd, ch))
sp = p['spacing']; assert sp >= cw, 'cuts are disjoint'
for k in range(count):
    x0 = cx0 + k * sp
    assert b['min'][0] <= x0 and x0 + cw <= b['max'][0], ('cut inside the block in x', k, x0)
assert b['min'][1] <= cy0 and cy0 + cd <= b['max'][1] and ch >= bh, 'through cut inside in y'
volume = bw * bd * bh - count * cw * cd * bh
assert abs(volume - studio) <= 1e-6 * volume, ('studio volume', volume, studio)
print(json.dumps({'status': 'PASS', 'volume': volume, 'studio': studio, 'count': count}, indent=2))
