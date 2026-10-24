import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, intersectPatches, tessellateBrep, checkOutput, massPropertiesOf } from '../dist/index.js';
import { oracle } from '../scripts/rb/fuzz-oracle.mjs';
import { documentOf } from '../scripts/rb/fuzz-gen.mjs';

/** A ball of radius r about c, (θ, φ) over [−π, π] × [−π/2, π/2]; `flip` puts its seam on the +x side. */
const ball = (c, r, flip) => ({
  at: ([u, v]) => [c[0] + r * (flip ? -1 : 1) * Math.cos(u) * Math.cos(v), c[1] + r * Math.sin(u) * Math.cos(v), c[2] + r * Math.sin(v)],
  box: [[-Math.PI, -Math.PI / 2], [Math.PI, Math.PI / 2]],
});

test('surface intersection: a closed curve closes on its first lap whatever the step (L4 fuzz seed 20261023 #119, D236)', () => {
  // Two unit balls 1.5 apart meet in a circle of radius √7/4 about the x axis. Before, the start was found again only
  // within 0.375 of a step (the loop had halved the step once more), so a quarter of the steps traced the circle twice.
  const A = ball([0, 0, 0], 1, false), B = ball([1.5, 0, 0], 1, true), laps = [];
  for (let i = 0; i < 40; i++) {
    const chains = intersectPatches(A, B, { step: 0.08 + 0.002 * i, tolerance: 1e-6 });
    assert.equal(chains.length, 1, `step ${0.08 + 0.002 * i}: one chain`);
    assert.equal(chains[0].closed, true, `step ${0.08 + 0.002 * i}: closed`);
    const ps = [...chains[0].points, chains[0].points[0]];
    let turn = 0;
    for (let k = 1; k < ps.length; k++) { const d = Math.atan2(ps[k][2], ps[k][1]) - Math.atan2(ps[k - 1][2], ps[k - 1][1]); turn += Math.atan2(Math.sin(d), Math.cos(d)); }
    laps.push(Math.abs(turn) / (2 * Math.PI));
  }
  assert.ok(laps.every(n => Math.abs(n - 1) < 1e-9), `laps per step: ${laps.map(n => n.toFixed(2)).join(' ')}`);
});

test('analytic Boolean: two balls patterned ∪ a ball, its circle traced once (L4 fuzz seed 20261023 #119, D236)', () => {
  // The circle where the second copy meets the ball passed its start 0.41 of a step away: traced twice, its two halves
  // ran over each other and the stitch found an edge used six times. The result is two bodies: the first copy alone.
  const tree = { op: 'union', a: { pattern: { kind: 'circular', axis: 'z', deg: 81.238, count: 2, pivot: [-0.834, 2.832, 0] }, child: { leaf: { kind: 'sphere', r: 1.655, rot: [{ axis: 'x', deg: 34.277 }], move: [-1.231, -2.668, -1.569] } } },
    b: { leaf: { kind: 'sphere', r: 2.021, rot: [{ axis: 'z', deg: 220.265 }], move: [1.763, 0.973, 0.703] } } };
  const { document, root } = documentOf(tree), o = evaluateCadPart(document).outputs.find(x => x.id === root), v = checkOutput(o);
  assert.equal(v.valid, true, v.issues[0]);
  assert.equal(o.bodyCount, 2);
  const mesh = tessellateBrep(o.brep, { segmentsPerQuarter: 8 }), P = mesh.positions, uses = new Map();
  for (let t = 0; t < mesh.indices.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = mesh.indices[t + k], b = mesh.indices[t + (k + 1) % 3], ka = `${P[3 * a]},${P[3 * a + 1]},${P[3 * a + 2]}`, kb = `${P[3 * b]},${P[3 * b + 1]},${P[3 * b + 2]}`, e = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    uses.set(e, (uses.get(e) ?? 0) + 1);
  }
  assert.ok([...uses.values()].every(n => n === 2), 'watertight');
  const m = massPropertiesOf(o), q = oracle(tree, 256, 6);
  assert.ok(Math.abs(m.volume - q.volumeMM3) <= 3 * q.e + 1e-6, `${m.volume} vs the oracle ${q.volumeMM3} ± ${q.e}`);
});
