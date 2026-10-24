import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, tessellateBrep, checkOutput, massPropertiesOf } from '../dist/index.js';
import { oracle } from '../scripts/rb/fuzz-oracle.mjs';
import { documentOf } from '../scripts/rb/fuzz-gen.mjs';

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
const leaf = (kind, dims, move) => ({ leaf: { kind, ...dims, rot: [], move } });

test('analytic Boolean: a traced curve through a ball\'s pole is cut there, its points kept on both patches (L4 fuzz seed 20261023 #110, D235)', () => {
  // A cylinder r 1 whose wall holds the line through the ball's poles: their curve (Viviani's) runs through the north pole.
  // On the ball its two halves meet the pole's side of the domain at two u; one cut across it left the face no region.
  // Cut at the pole, the subdivision beside it took a point from a hint across the pole, 1.2e-5 mm off the ball.
  for (const op of ['union', 'difference']) holds({ op, a: leaf('cyl', { r: 1, h: 4 }, [-2, 2, 2.5]), b: leaf('sphere', { r: 2 }, [-2, 3, 2]) }, op);
});
