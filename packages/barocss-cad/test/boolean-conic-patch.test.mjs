import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, tessellateBrep } from '../dist/index.js';
import { oracle } from '../scripts/rb/fuzz-oracle.mjs';
import { documentOf } from '../scripts/rb/fuzz-gen.mjs';

/** A fuzz tree's output: strictly valid, watertight (by position), its volume within 3 e of the ray oracle at 192² × 6. */
function holds(tree, name) {
  const { document, root } = documentOf(tree), o = evaluateCadPart(document).outputs.find(x => x.id === root), v = o.validate();
  assert.equal(v.valid, true, `${name}: ${v.issues[0]}`);
  const mesh = tessellateBrep(o.brep, { segmentsPerQuarter: 8 }), P = mesh.positionsMM, uses = new Map();
  for (let t = 0; t < mesh.indices.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = mesh.indices[t + k], b = mesh.indices[t + (k + 1) % 3], ka = `${P[3 * a]},${P[3 * a + 1]},${P[3 * a + 2]}`, kb = `${P[3 * b]},${P[3 * b + 1]},${P[3 * b + 2]}`, e = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    uses.set(e, (uses.get(e) ?? 0) + 1);
  }
  assert.ok([...uses.values()].every(n => n === 2), `${name}: watertight`);
  const m = o.massProperties(1), q = oracle(tree, 192, 6);
  assert.ok(Math.abs(m.volumeMM3 - q.volumeMM3) <= 3 * q.e + 1e-6, `${name}: ${m.volumeMM3} vs the oracle ${q.volumeMM3} ± ${q.e}`);
}
const leaf = (kind, dims, rot, move) => ({ leaf: { kind, ...dims, rot: rot.map(([axis, deg]) => ({ axis, deg })), move } });

test('analytic Boolean: a plane\'s conic that dips onto a cone\'s patch between two samples cuts it there (L4 fuzz 2, D203)', () => {
  // A rounded box ∩ a pattern of two frustums: the side x = 0.5 meets one frustum's patch along 0.035 mm of its conic,
  // 0.0046 rad inside the patch's end — under the 256th of its turn the scan steps by. The cut was missed, the side not
  // divided, and the result refused as not manifold.
  holds({ op: 'intersect', a: leaf('rbox', { w: 2.5, d: 6, h: 7, r: 0.5 }, [], [0.5, 2.5, -0.5]),
    b: { pattern: { kind: 'linear', axis: 'y', spacing: 3.104, count: 2 }, child: leaf('cone', { r1: 3.283, r2: 2.739, h: 1.889 }, [['y', 46.703], ['z', 139.663]], [2.968, -1.186, 1.568]) } }, 'a rounded box ∩ two frustums');
});
