import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, checkBrep, massPropertiesOf } from '../dist/index.js';
import { documentOf } from '../scripts/rb/fuzz-gen.mjs';

const leaf = (kind, dims, rot, move) => ({ leaf: { kind, ...dims, rot: rot.map(([axis, deg]) => ({ axis, deg })), move } });

test('analytic Boolean: a planar piece whose middle lies where a cylinder only touches it is re-judged too: two bodies (L4 fuzz 15, D210)', () => {
  // (A box and a cylinder r 1 lying under it, touching its bottom face along a line through that face's middle: the face
  // was judged opposite, as on the cylinder, and dropped, and the stitch refused. Now the two bodies of D204's contract,
  // 3 · 4 · 2 + π · 4 mm³, either way round.)
  const box = leaf('box', { w: 3, d: 4, h: 2 }, [], [1, -1, -1]), cyl = leaf('cyl', { r: 1, h: 4 }, [['x', 90], ['z', 90]], [0, 1, -2]), exact = 24 + 4 * Math.PI;
  for (const [a, b] of [[box, cyl], [cyl, box]]) {
    const { document, root } = documentOf({ op: 'union', a, b }), o = evaluateCadPart(document).outputs.find(x => x.id === root), m = massPropertiesOf(o);
    assert.equal(o.bodyCount, 2);
    assert.equal(checkBrep(o.brep, { strict: true }).valid, true);
    assert.ok(Math.abs(m.volume - exact) <= 1e-6 * exact, `${m.volume} vs ${exact}`);
  }
});
