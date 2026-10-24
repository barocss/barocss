import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, intersectPatches, tessellateBrep, checkOutput, massPropertiesOf } from '../dist/index.js';
import { oracle } from '../scripts/rb/fuzz-oracle.mjs';
import { documentOf } from '../scripts/rb/fuzz-gen.mjs';

test('surface intersection: a march through a point where the surfaces touch keeps its direction (L4 fuzz seed 20261023 #110, D238)', () => {
  // A cylinder r 1 about the z axis inside a ball r 2 about (0, 1, 0): tangent at (0, −1, 0), where their curve crosses
  // itself. n₁ × n₂ turns its sign there; the march turned back with it and ran to and fro across the point.
  const cyl = { at: ([u, v]) => [Math.cos(u), Math.sin(u), v], box: [[-Math.PI, -1], [Math.PI, 1]] };
  const ball = { at: ([u, v]) => [2 * Math.cos(u) * Math.cos(v), 1 + 2 * Math.sin(u) * Math.cos(v), 2 * Math.sin(v)], box: [[-Math.PI, -1.2], [Math.PI, 1.2]] };
  const chains = intersectPatches(cyl, ball, { step: 0.05, tolerance: 1e-4 });
  assert.ok(chains.length >= 1);
  for (const ch of chains) {
    for (let k = 1; k < ch.points.length; k++) {
      const a = ch.points[k - 1], b = ch.points[k], c = ch.points[k + 1];
      if (!c) break;
      const d1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], d2 = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
      assert.ok(d1[0] * d2[0] + d1[1] * d2[1] + d1[2] * d2[2] > 0, `the chain turns back at ${b.map(x => x.toFixed(4))}`);
    }
  }
});

/** A fuzz tree's output: strictly valid, watertight (by position), one body, its volume within 3 e of the ray oracle at 256² × 6. */
function holds(tree, name) {
  const { document, root } = documentOf(tree), o = evaluateCadPart(document).outputs.find(x => x.id === root), v = checkOutput(o);
  assert.equal(v.valid, true, `${name}: ${v.issues[0]}`);
  assert.equal(o.bodyCount, 1, `${name}: one body`);
  const mesh = tessellateBrep(o.brep, { segmentsPerQuarter: 8 }), P = mesh.positionsMM, uses = new Map();
  for (let t = 0; t < mesh.indices.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = mesh.indices[t + k], b = mesh.indices[t + (k + 1) % 3], ka = `${P[3 * a]},${P[3 * a + 1]},${P[3 * a + 2]}`, kb = `${P[3 * b]},${P[3 * b + 1]},${P[3 * b + 2]}`, e = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    uses.set(e, (uses.get(e) ?? 0) + 1);
  }
  assert.ok([...uses.values()].every(n => n === 2), `${name}: watertight`);
  const m = massPropertiesOf(o), q = oracle(tree, 256, 6);
  assert.ok(Math.abs(m.volume - q.volumeMM3) <= 3 * q.e + 1e-6, `${name}: ${m.volume} vs the oracle ${q.volumeMM3} ± ${q.e}`);
}

test('analytic Boolean: Booleans whose surfaces touch at a point their curve passes through (L4 fuzz seed 20261023 #110, #25, D238)', () => {
  // 110: the cylinder's wall tangent to the ball where its bottom rim meets the equator. The cut along one branch ran past
  // the point and back several times, and the stitch found an edge used six times beside it.
  holds({ op: 'union', a: { leaf: { kind: 'cyl', r: 1, h: 4, rot: [], move: [-2, 2, 2] } }, b: { leaf: { kind: 'sphere', r: 2, rot: [], move: [-2, 3, 2] } } }, '110');
  // 25: a ball tangent to a rounded box's side at that side's corner, where the fillet's curve with the ball ends.
  holds({ op: 'union', a: { leaf: { kind: 'rbox', w: 3, d: 6, h: 4, r: 1, rot: [{ axis: 'z', deg: 270 }, { axis: 'y', deg: 270 }], move: [0, -2, -2] } }, b: { leaf: { kind: 'sphere', r: 4, rot: [], move: [0, -1, -1] } } }, '25');
});
