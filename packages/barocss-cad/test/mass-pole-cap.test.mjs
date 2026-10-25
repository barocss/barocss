import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, massPropertiesOf } from '../dist/index.js';
import { oracle } from '../scripts/rb/fuzz-oracle.mjs';
import { documentOf } from '../scripts/rb/fuzz-gen.mjs';

const leaf = (kind, dims, rot, move) => ({ leaf: { kind, ...dims, rot: rot.map(([axis, deg]) => ({ axis, deg })), move } });
/** A fuzz tree's quadrature volume against the ray oracle (its error e at 256² × 6). */
function judged(tree) {
  const { document, root } = documentOf(tree), m = massPropertiesOf(evaluateCadPart(document).outputs.find(x => x.id === root)), q = oracle(tree, 256, 6);
  return { m, q, off: Math.abs(m.volume - q.volumeMM3) };
}

test('mass: a cap about a sphere\'s pole, its trim round the whole turn in a few samples, is integrated (L4 fuzz 171, D199)', () => {
  // Three overlapping balls: the cap's domain triangles span some 50° of u each, and the surface over them bends from
  // their flat triangles by 9 % — taken for coverage gone wrong, the body went to the tessellation's mass, 0.09 % off.
  const { m, q, off } = judged({ pattern: { kind: 'circular', axis: 'z', deg: 77.196, count: 3, pivot: [-1.138, 2.239, 0] }, child: leaf('sphere', { r: 4 }, [], [-1.5, 1.5, -1.5]) });
  assert.equal(m.method, 'quadrature');
  assert.ok(off <= 3 * q.e + 1e-6, `${m.volume} vs the oracle ${q.volumeMM3} ± ${q.e}`);
});
