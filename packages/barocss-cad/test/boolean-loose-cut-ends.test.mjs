import test from 'node:test';
import assert from 'node:assert/strict';
import { curveFaceRegions, curveRegionArea, evaluateCadPart, tessellateBrep, checkOutput, massPropertiesOf } from '../dist/index.js';
import { oracle } from '../scripts/rb/fuzz-oracle.mjs';
import { documentOf } from '../scripts/rb/fuzz-gen.mjs';

const line = (a, b) => ({ kind: 'line', a, b });
const square = [line([0, 0], [2, 0]), line([2, 0], [2, 3]), line([2, 3], [0, 3]), line([0, 3], [0, 0])];
const areas = regions => regions.map(r => +Math.abs(curveRegionArea(r)).toFixed(9)).sort((a, b) => a - b);

test('curve arrangement: cuts whose ends land a few tolerances apart, or a few off a segment, still divide the face (L4 fuzz 74, D237)', () => {
  // Two cuts that meet where three surfaces meet: each end found against a different face's map of the same edge, 3e-6 apart.
  const exact = areas(curveFaceRegions([square], [line([1.873, 0], [1, 0.8]), line([1, 0.8], [1, 3])], 1e-6));
  const apart = areas(curveFaceRegions([square], [line([1.873, 0], [1.000003, 0.8]), line([1, 0.800002], [1, 3])], 1e-6));
  assert.equal(apart.length, 2);
  for (let k = 0; k < 2; k++) assert.ok(Math.abs(apart[k] - exact[k]) < 1e-5, `${apart} against ${exact}`);
  // A cut ending 3e-6 short of the ring's side, away from its corners.
  assert.equal(curveFaceRegions([square], [line([0.7, 0], [0.7, 2.999997])], 1e-6).length, 2);
  // Farther than 10 tolerances, a loose end stays loose: the face is not divided.
  assert.equal(curveFaceRegions([square], [line([0.7, 0], [0.7, 2.99998])], 1e-6).length, 1);
});

test('analytic Boolean: a box ∩ (a cylinder ∪ a cone), the cuts on the box side meeting at a triple point (L4 fuzz seed 20261023 #74, D237)', () => {
  // On the side x = 1 the cone's hyperbola ended 3e-6 mm from the cylinder's ruling, and on the cone face 3e-6 mm from its
  // edge with the cylinder: the side was not divided, and its corner below the cone's base rim stayed (an edge used once).
  const tree = { op: 'intersect', a: { leaf: { kind: 'box', w: 2, d: 7, h: 3, rot: [{ axis: 'z', deg: 180 }, { axis: 'z', deg: 270 }], move: [1, 2, -2] } },
    b: { op: 'union', a: { leaf: { kind: 'cyl', r: 2, h: 6, rot: [], move: [1, 1, -2] } }, b: { leaf: { kind: 'cone', r1: 4, r2: 1, h: 3, rot: [{ axis: 'z', deg: 90 }], move: [2, 0, -2] } } } };
  const { document, root } = documentOf(tree), o = evaluateCadPart(document).outputs.find(x => x.id === root), v = checkOutput(o);
  assert.equal(v.valid, true, v.issues[0]);
  assert.equal(o.bodyCount, 1);
  const mesh = tessellateBrep(o.brep, { segmentsPerQuarter: 8 }), P = mesh.positionsMM, uses = new Map();
  for (let t = 0; t < mesh.indices.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = mesh.indices[t + k], b = mesh.indices[t + (k + 1) % 3], ka = `${P[3 * a]},${P[3 * a + 1]},${P[3 * a + 2]}`, kb = `${P[3 * b]},${P[3 * b + 1]},${P[3 * b + 2]}`, e = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    uses.set(e, (uses.get(e) ?? 0) + 1);
  }
  assert.ok([...uses.values()].every(n => n === 2), 'watertight');
  const m = massPropertiesOf(o), q = oracle(tree, 256, 6);
  assert.ok(Math.abs(m.volume - q.volumeMM3) <= 3 * q.e + 1e-6, `${m.volume} vs the oracle ${q.volumeMM3} ± ${q.e}`);
});

test('analytic Boolean: three balls in a circular pattern, a cut 1.3e-6 off a half-face\'s ring at the triple point (L4 fuzz seed 20261023 #170, D237)', () => {
  // On the lower half of the first ball, the third ball's circle ended 1.3e-6 mm beside the first two balls' circle, between
  // two of its vertices: the half kept only its piece inside, and the seam from its pole was an edge used once.
  const tree = { pattern: { kind: 'circular', axis: 'z', deg: 120, count: 3, pivot: [2, -1, 0] }, child: { leaf: { kind: 'sphere', r: 3, rot: [{ axis: 'x', deg: 270 }], move: [0, -1, -2] } } };
  const { document, root } = documentOf(tree), o = evaluateCadPart(document).outputs.find(x => x.id === root), v = checkOutput(o);
  assert.equal(v.valid, true, v.issues[0]);
  assert.equal(o.bodyCount, 1);
  const m = massPropertiesOf(o), q = oracle(tree, 256, 6);
  assert.equal(m.method, 'quadrature');
  assert.ok(Math.abs(m.volume - q.volumeMM3) <= 3 * q.e + 1e-6, `${m.volume} vs the oracle ${q.volumeMM3} ± ${q.e}`);
});
