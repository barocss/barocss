import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, checkBrep, CadPartError } from '../dist/index.js';

const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const w = Math.SQRT1_2;
// A quarter circle of radius 20 about the origin in the XZ plane, from (20, 0, 0) up to (0, 0, 20).
const QUARTER = { degree: 2, knots: [0, 0, 0, 1, 1, 1], controlPoints: [[20, 0, 0], [20, 0, 20], [0, 0, 20]], weights: [1, w, 1] };
const LINE = { degree: 1, knots: [0, 0, 1, 1], controlPoints: [[0, 0, 0], [0, 0, 10]], weights: [1, 1] };

test('a circle swept along a quarter turn: a bent rod, its volume by Pappus (the area times the centre’s path)', () => {
  const part = evaluateCadPart(D([{ id: 's', kind: 'sketch', profile: 'circle', center: [50, 50], radius: 2 }, { id: 'w', kind: 'sweep-curve', sketch: 's', path: QUARTER }]));
  const o = part.outputs[0]; assert.deepEqual(checkBrep(o.brep).issues, []);
  const v = o.massProperties(1).volumeMM3, want = Math.PI * 4 * (Math.PI / 2 * 20);
  assert.ok(Math.abs(v - want) / want < 0.01, `${v} vs ${want}`);
  // It starts on the path's start, square to it: the start cap lies in the plane z = 0 round (20, 0).
  const box = o.brep.vertices.reduce((b, x) => ({ min: b.min.map((m, k) => Math.min(m, x.point[k])), max: b.max.map((m, k) => Math.max(m, x.point[k])) }), { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
  assert.ok(Math.abs(box.min[2]) < 1e-9 && Math.abs(box.max[0] - 22) < 0.01 && Math.abs(box.max[2] - 22) < 0.01, JSON.stringify(box));
});

test('a ring swept straight is a tube: its hole runs through; a closed path or a bad curve is refused', () => {
  const ring = { id: 's', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 2, holes: [[{ kind: 'arc', start: [1, 0], center: [0, 0], direction: 'ccw' }]] };
  const tube = evaluateCadPart(D([ring, { id: 'w', kind: 'sweep-curve', sketch: 's', path: LINE }])).outputs[0];
  const v = tube.massProperties(1).volumeMM3, want = Math.PI * 3 * 10;
  assert.ok(Math.abs(v - want) / want < 0.02, `${v} vs ${want}`);
  const closed = { degree: 2, knots: [0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4], controlPoints: [[10, 0, 0], [10, 10, 0], [0, 10, 0], [-10, 10, 0], [-10, 0, 0], [-10, -10, 0], [0, -10, 0], [10, -10, 0], [10, 0, 0]], weights: [1, w, 1, w, 1, w, 1, w, 1] };
  assert.throws(() => evaluateCadPart(D([ring, { id: 'w', kind: 'sweep-curve', sketch: 's', path: closed }])), e => e instanceof CadPartError && /closed/.test(e.message));
  assert.throws(() => evaluateCadPart(D([ring, { id: 'w', kind: 'sweep-curve', sketch: 's', path: { degree: 1, knots: [0, 1], controlPoints: [[0, 0, 0]], weights: [1] } }])), e => e instanceof CadPartError && e.code === 'INPUT');
});
