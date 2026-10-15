import test from 'node:test';
import assert from 'node:assert/strict';
import { finishBrepEdges, brepFromPrismatic, prismaticFromProfile, transformBrep, checkBrep, tessellateBrep, brepMassProperties, BrepError } from '../dist/index.js';

const pi = Math.PI, corner = r => r * r * (1 - pi / 4), k = (10 - 3 * pi) / (12 - 3 * pi);
const rect = (x0, y0, x1, y1) => [{ kind: 'line', start: [x0, y0] }, { kind: 'line', start: [x1, y0] }, { kind: 'line', start: [x1, y1] }, { kind: 'line', start: [x0, y1] }];
const prism = (outer, h, tag) => brepFromPrismatic(prismaticFromProfile({ outer, heightMM: h, tag }), { id: tag });
const volume = b => brepMassProperties(b, 1000, { segmentsPerQuarter: 48 }).volumeMM3;
const near = (a, b, rel) => Math.abs(a - b) <= rel * Math.abs(b);
function watertight(b) {
  const m = tessellateBrep(b, { segmentsPerQuarter: 16 }), p = m.positionsMM, ix = m.indices, he = new Map(), key = i => p[i * 3] + ',' + p[i * 3 + 1] + ',' + p[i * 3 + 2];
  for (let t = 0; t < ix.length; t += 3) for (let e = 0; e < 3; e++) { const s = key(ix[t + e]) + '>' + key(ix[t + (e + 1) % 3]); he.set(s, (he.get(s) ?? 0) + 1); }
  return [...he].every(([s, n]) => { const [x, y] = s.split('>'); return he.get(y + '>' + x) === n; });
}

test('fillets meeting at the corners of a box top form mitres (checked against a direct grid count)', () => {
  const box = prism(rect(0, 0, 20, 10), 5, 'e');
  // Inside test of the finished box: outside a fillet's cylinder within its corner wedge is removed.
  const inside = (x, y, z, r, which) => {
    if (x < 0 || x > 20 || y < 0 || y > 10 || z < 0 || z > 5) return false;
    const cut = (d1, d2) => d1 < r && d2 < r && (r - d1) ** 2 + (r - d2) ** 2 > r * r, dz = 5 - z;
    return !((which.includes(0) && cut(y, dz)) || (which.includes(1) && cut(20 - x, dz)) || (which.includes(2) && cut(10 - y, dz)) || (which.includes(3) && cut(x, dz)));
  };
  const edge = i => `e.side${i}|e.top`;
  for (const [which, r] of [[[0, 1], 2], [[0, 1, 2, 3], 1], [[0, 1, 2, 3], 2]]) {
    const out = finishBrepEdges(box, which.map(edge), r, 'fillet', 'f'), report = checkBrep(out);
    assert.equal(report.valid, true, `${which}: ${report.issues}`);
    assert.ok(watertight(out), `${which}: watertight`);
    let removed = 0; const M = 400, hx = 20 / M, hy = 10 / (M / 2), hz = r / 60;
    for (let a = 0; a < M; a++) for (let b = 0; b < M / 2; b++) for (let c = 0; c < 60; c++) if (!inside((a + .5) * hx, (b + .5) * hy, 5 - r + (c + .5) * hz, r, which)) removed++;
    const reference = 1000 - removed * hx * hy * hz;
    assert.ok(near(volume(out), reference, 3e-4), `${which} r${r}: ${volume(out)} vs ${reference}`);
  }
});

test('concave edges gain material; tangent chains are finished whole; what cannot be finished is refused', () => {
  // An L section stood up: its inside corner (concave) and an outside corner.
  const ell = transformBrep(prism([{ kind: 'line', start: [0, 0] }, { kind: 'line', start: [30, 0] }, { kind: 'line', start: [30, 5] }, { kind: 'line', start: [5, 5] }, { kind: 'line', start: [5, 20] }, { kind: 'line', start: [0, 20] }], 10, 'e'), { matrix: [1, 0, 0, 0, 0, -1, 0, 1, 0] });
  const L = (30 * 5 + 5 * 15) * 10;
  for (const [edge, expected] of [['e.side2|e.side3', L + corner(3) * 10], ['e.side0|e.side1', L - corner(3) * 10]]) {
    const out = finishBrepEdges(ell, [edge], 3, 'fillet', 'f');
    assert.equal(checkBrep(out).valid, true, edge);
    assert.ok(near(volume(out), expected, 1e-4), `${edge}: ${volume(out)} vs ${expected}`);
  }
  // A slot's top rim: one straight edge names the whole loop (lines and arcs).
  const slot = prism([{ kind: 'line', start: [0, -4] }, { kind: 'arc', start: [20, -4], center: [20, 0], direction: 'ccw' }, { kind: 'line', start: [20, 4] }, { kind: 'arc', start: [0, 4], center: [0, 0], direction: 'ccw' }], 6, 'e');
  const rim = slot.edges.find(e => /side0/.test(e.name) && /top/.test(e.name)).name;
  const out = finishBrepEdges(slot, [rim], 1, 'fillet', 'f');
  assert.equal(checkBrep(out).valid, true);
  assert.ok(watertight(out));
  assert.ok(near(volume(out), (160 + 16 * pi) * 6 - corner(1) * 40 - 2 * pi * (4 - k) * corner(1), 1e-4), String(volume(out)));
  assert.ok(out.faces.filter(f => f.name.startsWith('f.face')).length >= 4, 'the rim is one fillet in four pieces');
  // Refusals.
  const refuses = (fn, pattern) => assert.throws(fn, e => e instanceof BrepError && pattern.test(e.message), pattern.source);
  refuses(() => finishBrepEdges(ell, ['nope'], 1, 'fillet', 'f'), /SELECTION: no edge named nope/);
  refuses(() => finishBrepEdges(slot, [slot.edges.find(e => /side0/.test(e.name) && /side1/.test(e.name)).name], 1, 'fillet', 'f'), /meet tangentially/);
});
