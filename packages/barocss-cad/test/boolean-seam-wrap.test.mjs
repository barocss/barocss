import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, tessellateBrep, checkOutput, massPropertiesOf } from '../dist/index.js';
import { oracle } from '../scripts/rb/fuzz-oracle.mjs';
import { documentOf } from '../scripts/rb/fuzz-gen.mjs';

/** A fuzz tree's output: strictly valid, watertight (by position), its volume within 3 e of the ray oracle at 192² × 6. */
function holds(tree, name) {
  const { document, root } = documentOf(tree), o = evaluateCadPart(document).outputs.find(x => x.id === root), v = checkOutput(o);
  assert.equal(v.valid, true, `${name}: ${v.issues[0]}`);
  const mesh = tessellateBrep(o.brep, { segmentsPerQuarter: 8 }), P = mesh.positionsMM, uses = new Map();
  for (let t = 0; t < mesh.indices.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = mesh.indices[t + k], b = mesh.indices[t + (k + 1) % 3], ka = `${P[3 * a]},${P[3 * a + 1]},${P[3 * a + 2]}`, kb = `${P[3 * b]},${P[3 * b + 1]},${P[3 * b + 2]}`, e = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    uses.set(e, (uses.get(e) ?? 0) + 1);
  }
  assert.ok([...uses.values()].every(n => n === 2), `${name}: watertight`);
  const m = massPropertiesOf(o), q = oracle(tree, 192, 6);
  assert.ok(Math.abs(m.volume - q.volumeMM3) <= 3 * q.e + 1e-6, `${name}: ${m.volume} vs the oracle ${q.volumeMM3} ± ${q.e}`);
}
const leaf = (kind, dims, rot, move) => ({ leaf: { kind, ...dims, rot: rot.map(([axis, deg]) => ({ axis, deg })), move } });

test('analytic Boolean: a cross-section past a cylinder face\'s seam goes on from the domain\'s other side (L4 fuzz 151, 46, D206)', () => {
  // (A plane's circle on a cylinder is probed in two half turns from a quarter before the face's seam. The second ran
  // past the domain's window, so on a face over most of a turn the edges beyond the seam were never met: the plane's
  // cut was missing and the stitch refused.)
  holds({ op: 'difference', a: leaf('box', { w: 5, d: 5, h: 4 }, [], [-2, 1, 0]), b: { op: 'union', a: leaf('cyl', { r: 3, h: 4 }, [['y', 180]], [-1, 0, 2]), b: leaf('sphere', { r: 3 }, [], [1, 2, 0]) } }, 'a box − (a cylinder ∪ a ball)');
  holds({ pattern: { kind: 'linear', axis: 'x', spacing: 4, count: 3 }, child: { op: 'union', a: leaf('cyl', { r: 3, h: 6 }, [], [-2, 0, -3]), b: leaf('box', { w: 3, d: 4, h: 6 }, [['z', 90], ['x', 90]], [-3, -1, -2]) } }, 'three (a cylinder ∪ a box) in a row');
});
