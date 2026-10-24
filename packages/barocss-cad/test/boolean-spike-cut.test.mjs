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

test('analytic Boolean: a cut ending inside a planar face, its tip too small to keep, leaves no slit (L4 fuzz seed 20261024 #41, D201)', () => {
  // Two copies (24.47° apart about z) of a ball less a turned box: one ball passes 1.4e-4 mm from a corner of the other's
  // cut face, and the arc it cuts there ran out from the corner and back — strict L0 saw the loop touch itself.
  const piece = { op: 'difference', a: leaf('sphere', { r: 2.997 }, [['x', 306.701], ['z', 161.097]], [0.099, 1.104, 2.832]), b: leaf('box', { w: 5.053, d: 4.228, h: 1.157 }, [['y', 310.702]], [-2.987, -1.324, 1.503]) };
  holds({ pattern: { kind: 'circular', axis: 'z', deg: 24.47, count: 2, pivot: [1.468, 0.778, 0] }, child: piece }, 'two copies');
});

test('analytic Boolean: a planar face a body touches along a line keeps no slit hole (L4 fuzz seed 20261023 #149, D201)', () => {
  // A cylinder (less a rounded box) inside a closed shell's wall, tangent to its outside face along a line: the face had a
  // hole of one line edge, out and back.
  holds({ op: 'union', a: { op: 'difference', a: leaf('cyl', { r: 2, h: 6 }, [], [2, 1, 0]), b: leaf('rbox', { w: 6, d: 8, h: 5, r: 1.5 }, [['x', 90]], [2, 2, 3]) },
    b: leaf('hbox', { w: 7, d: 7, h: 6, t: 0.5, open: false }, [], [-1, -1, 1]) }, 'tangent line');
});
