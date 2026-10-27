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

test('analytic Boolean: a traced curve through a cone\'s apex on the other face goes on to the apex (L4 fuzz 158, D208)', () => {
  // (The cylinder passes through the cone's apex, where the cone's normal is undefined: the march stopped 1e-4 short of
  // it, the cut ended short of the domain's side at the apex and the cone's face inside the cylinder was not divided.)
  holds({ op: 'difference', a: leaf('cyl', { r: 2, h: 6 }, [['y', 270], ['z', 270]], [1, 0, 3]), b: leaf('cone', { r1: 3, r2: 0, h: 2 }, [], [-1, 1, 1]) }, 'a cylinder − a cone, its apex on the wall');
});
