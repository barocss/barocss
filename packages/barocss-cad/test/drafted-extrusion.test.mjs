import test from 'node:test';
import assert from 'node:assert/strict';
import { draftedExtrusion, evaluateCadPart, checkBrep, tessellateBrep, CadPartError, massPropertiesOf } from '../dist/index.js';

const pi = Math.PI, tan = d => Math.tan(d * pi / 180);
const rect = (x0, y0, x1, y1) => [{ kind: 'line', start: [x0, y0] }, { kind: 'line', start: [x1, y0] }, { kind: 'line', start: [x1, y1] }, { kind: 'line', start: [x0, y1] }];
function mesh(b, q = 32) {
  const m = tessellateBrep(b, { segmentsPerQuarter: q }), p = m.positionsMM, ix = m.indices, he = new Map(), key = i => p[i * 3] + ',' + p[i * 3 + 1] + ',' + p[i * 3 + 2];
  let v = 0;
  for (let t = 0; t < ix.length; t += 3) {
    const [a, b2, c] = [ix[t] * 3, ix[t + 1] * 3, ix[t + 2] * 3];
    v += (p[a] * (p[b2 + 1] * p[c + 2] - p[b2 + 2] * p[c + 1]) - p[a + 1] * (p[b2] * p[c + 2] - p[b2 + 2] * p[c]) + p[a + 2] * (p[b2] * p[c + 1] - p[b2 + 1] * p[c])) / 6;
    for (let e = 0; e < 3; e++) { const k = key(ix[t + e]) + '>' + key(ix[t + (e + 1) % 3]); he.set(k, (he.get(k) ?? 0) + 1); }
  }
  return { volume: v, watertight: [...he].every(([k, n]) => { const [x, y] = k.split('>'); return he.get(y + '>' + x) === n; }) };
}
const near = (a, b, rel) => Math.abs(a - b) <= rel * Math.abs(b);
/** ∫ area(section shrunk by z·tan θ) dz by midpoint quadrature. */
const integral = (area, h, deg, n = 4000) => { let v = 0; for (let i = 0; i < n; i++) v += area((i + 0.5) / n * h * tan(deg)) * h / n; return v; };

test('drafted extrusions: sloping planes and cones, exact volumes, upright names', () => {
  const slot = [{ kind: 'line', start: [0, -4] }, { kind: 'arc', start: [20, -4], center: [20, 0], direction: 'ccw' }, { kind: 'line', start: [20, 4] }, { kind: 'arc', start: [0, 4], center: [0, 0], direction: 'ccw' }];
  const ell = [{ kind: 'line', start: [0, 0] }, { kind: 'line', start: [30, 0] }, { kind: 'line', start: [30, 10] }, { kind: 'line', start: [10, 10] }, { kind: 'line', start: [10, 30] }, { kind: 'line', start: [0, 30] }];
  const cases = [
    ['a box leaning in 5°', rect(0, 0, 40, 30), 10, 5, d => (40 - 2 * d) * (30 - 2 * d), 1e-9],
    ['a box leaning out 5°', rect(0, 0, 40, 30), 10, -5, d => (40 - 2 * d) * (30 - 2 * d), 1e-9],
    ['an L (the reflex corner too)', ell, 8, 4, d => (30 - 2 * d) * (10 - 2 * d) + (10 - 2 * d) * 20, 1e-9],
    ['a slot (cones on tangent arcs)', slot, 6, 3, d => 20 * 2 * (4 - d) + pi * (4 - d) ** 2, 2e-4],
    ['a cylinder (a cone frustum)', [{ kind: 'arc', start: [10, 0], center: [0, 0], direction: 'ccw' }], 10, 10, d => pi * (10 - d) ** 2, 5e-4],
  ];
  for (const [name, profile, h, deg, area, rel] of cases) {
    const b = draftedExtrusion({ profile, z0: 0, z1: h, draftDegrees: deg, tag: 'e' }), report = checkBrep(b), m = mesh(b);
    assert.equal(report.valid, true, `${name}: ${report.issues}`);
    assert.ok(m.watertight, `${name}: watertight`);
    assert.ok(near(m.volume, integral(area, h, deg), rel), `${name}: ${m.volume} vs ${integral(area, h, deg)}`);
    assert.ok(b.faces.some(f => f.name === 'e.top') && b.faces.some(f => f.name === 'e.bottom') && b.faces.some(f => f.name.startsWith('e.side')));
  }
  assert.throws(() => draftedExtrusion({ profile: rect(0, 0, 4, 4), z0: 0, z1: 10, draftDegrees: 20, tag: 'e' }), /closes a straight wall/);
  assert.throws(() => draftedExtrusion({ profile: [{ kind: 'line', start: [0, 0] }, { kind: 'arc', start: [10, 0], center: [10, 5], direction: 'ccw' }, { kind: 'line', start: [10, 10] }], z0: 0, z1: 5, draftDegrees: 3, tag: 'e' }), /not tangent/);
});

test('extrude with draft in the part model: up and down, then holes and fillets on it', () => {
  const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
  const s = { id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] }, d = 10 * tan(5);
  const exact = 10 * (40 * 30 - 70 * d + 4 * d * d / 3);
  for (const [height, from, z] of [[10, 0, [0, 10]], [-10, 5, [-5, 5]]]) {
    const o = evaluateCadPart(D([s, { id: 'e', kind: 'extrude', sketch: 's', height, from, draft: 5 }])).outputs[0], zs = o.brep.vertices.map(v => v.point[2]);
    assert.equal(checkBrep(o.brep).valid, true);
    assert.ok(near(massPropertiesOf(o).volume, exact, 1e-9), String(massPropertiesOf(o).volume));
    assert.deepEqual([Math.min(...zs), Math.max(...zs)], z);
  }
  // Fillets along sloping walls: one edge, and two meeting at a corner (their mitre).
  for (const draft of [3, 5, 8]) for (const r of [1, 2]) for (const edges of [['e.side0|e.top'], ['e.side0|e.top', 'e.side1|e.top']]) {
    const o = evaluateCadPart(D([s, { id: 'e', kind: 'extrude', sketch: 's', height: 10, draft }, { id: 'f', kind: 'fillet', target: 'e', edges, radius: r }])).outputs[0];
    assert.equal(checkBrep(o.brep).valid, true, `draft ${draft}, r ${r}, ${edges}`);
  }
  const holed = evaluateCadPart(D([s, { id: 'e', kind: 'extrude', sketch: 's', height: 10, draft: 5 }, { id: 'h', kind: 'hole', target: 'e', center: [20, 15], radius: 4 }, { id: 'f', kind: 'fillet', target: 'h', edges: ['e.side0|e.top', 'e.top|h.side0#1'], radius: 1 }])).outputs[0];
  assert.equal(checkBrep(holed.brep).valid, true, 'a hole through the drafted box, its rim and a sloping edge filleted');
  assert.throws(() => evaluateCadPart(D([s, { id: 'e', kind: 'extrude', sketch: 's', height: 10, draft: 89 }])), e => e instanceof CadPartError && e.code === 'INPUT');
});
