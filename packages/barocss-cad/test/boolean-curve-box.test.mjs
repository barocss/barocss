import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, tessellateBrep, checkOutput, massPropertiesOf } from '../dist/index.js';
import { oracle } from '../scripts/rb/fuzz-oracle.mjs';
import { documentOf } from '../scripts/rb/fuzz-gen.mjs';

/** A fuzz tree's output: strictly valid, watertight (by position), its volume within 3 e of the ray oracle at 192² × 6. */
function holds(tree, name) {
  const { document, root } = documentOf(tree), o = evaluateCadPart(document).outputs.find(x => x.id === root), v = checkOutput(o);
  assert.equal(v.valid, true, `${name}: ${v.issues[0]}`);
  const mesh = tessellateBrep(o.brep, { segmentsPerQuarter: 8 }), P = mesh.positions, uses = new Map();
  for (let t = 0; t < mesh.indices.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = mesh.indices[t + k], b = mesh.indices[t + (k + 1) % 3], ka = `${P[3 * a]},${P[3 * a + 1]},${P[3 * a + 2]}`, kb = `${P[3 * b]},${P[3 * b + 1]},${P[3 * b + 2]}`, e = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    uses.set(e, (uses.get(e) ?? 0) + 1);
  }
  assert.ok([...uses.values()].every(n => n === 2), `${name}: watertight`);
  const m = massPropertiesOf(o), q = oracle(tree, 192, 6);
  assert.ok(Math.abs(m.volume - q.volumeMM3) <= 3 * q.e + 1e-6, `${name}: ${m.volume} vs the oracle ${q.volumeMM3} ± ${q.e}`);
}
const leaf = (kind, dims, rot, move) => ({ leaf: { kind, ...dims, rot: rot.map(([axis, deg]) => ({ axis, deg })), move } });

test('analytic Boolean: a cut ending on a traced curve where it bulges between samples still divides the face (L4 fuzz 173, D207)', () => {
  // (The arrangement skipped a pair whose boxes were apart. A traced curve's box was its samples', and a box's wall plane
  // ended its cut on the curve 3 µm past them: the crossing was never looked for, the face was not divided and the stitch
  // refused.)
  holds({ op: 'intersect', a: { op: 'union', a: leaf('cyl', { r: 2, h: 4 }, [['y', 180], ['y', 270]], [-2, -2, 0]), b: leaf('cone', { r1: 4, r2: 1, h: 2 }, [], [1, 1, -2]) }, b: leaf('hbox', { w: 6, d: 6, h: 2, t: 0.5, open: true }, [['z', 90], ['z', 180]], [1, 0, -3]) }, '(a cylinder ∪ a cone) ∩ an open box');
});
