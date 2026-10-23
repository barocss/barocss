import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart } from '../dist/index.js';
import { oracle } from '../scripts/rb/fuzz-oracle.mjs';
import { documentOf } from '../scripts/rb/fuzz-gen.mjs';

const leaf = (kind, dims, rot, move) => ({ leaf: { kind, ...dims, rot: rot.map(([axis, deg]) => ({ axis, deg })), move } });
/** A fuzz tree's quadrature volume against the ray oracle (its error e at 256² × 6). */
function judged(tree) {
  const { document, root } = documentOf(tree), m = evaluateCadPart(document).outputs.find(x => x.id === root).massProperties(1), q = oracle(tree, 256, 6);
  return { m, q, off: Math.abs(m.volumeMM3 - q.volumeMM3) };
}

test('mass: which chords beside a pole take no strip is the same at every step (L4 fuzz 65, D198)', () => {
  // A cone (apex) ∪ a turned cylinder: a long trim near the apex was "beside" it (within four of its lengths) at 8
  // segments a quarter and not at 16, and the extrapolation took the jump for the square of the step's error.
  const { m, q, off } = judged({ op: 'union', a: leaf('cone', { r1: 4, r2: 0, h: 2.5 }, [['y', 171.753], ['y', 326.488]], [-1.5, -2, 0]), b: leaf('cyl', { r: 2.706, h: 4.479 }, [['x', 295.376]], [-0.189, -0.984, -1.557]) });
  assert.equal(m.method, 'quadrature');
  assert.ok(off <= 3 * q.e + 1e-6, `${m.volumeMM3} vs the oracle ${q.volumeMM3} ± ${q.e}`);
});
