// @barocss/cad's guarantees in small: lumps that only touch stay separate, valid bodies; what the kernel can't do is
// a typed refusal naming the feature. The robustness page includes the #region blocks. Run: pnpm test:samples
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, CadPartError, checkOutput } from '@barocss/cad';
// #region boolean-import
import { part as cadPart } from '@barocss/cad/api';
// #endregion boolean-import

const part = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
/** A 10 mm high block from min to max: a rectangle sketch and its extrude. */
const block = (id, min, max) => [{ id: `${id}s`, kind: 'sketch', profile: 'rectangle', min, max }, { id, kind: 'extrude', sketch: `${id}s`, height: 10 }];
const refusal = doc => { try { evaluateCadPart(doc); } catch (e) { if (e instanceof CadPartError) return e; throw e; } assert.fail('refused'); };

// #region integer-mesh-volume
// Independent volume check for this integer-coordinate, planar example only.
// Each oriented triangle contributes det(a, b, c) / 6, the signed volume to the origin.
function integerMeshVolume(p) {
  let six = 0n;
  for (const mesh of p.meshes()) {
    const P = [];
    for (const x of mesh.positions) {
      assert.ok(Number.isSafeInteger(x));
      P.push(BigInt(x));
    }
    for (let t = 0; t < mesh.indices.length; t += 3) {
      const a = 3 * mesh.indices[t], b = 3 * mesh.indices[t + 1], c = 3 * mesh.indices[t + 2];
      six += P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1])
        - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c])
        + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c]);
    }
  }
  assert.equal(six % 6n, 0n);
  return Number((six < 0n ? -six : six) / 6n);
}
// #endregion integer-mesh-volume

test('Boolean set operations: two overlapping cubes have union 1500, difference 500 and intersection 500 mm³', () => {
  // #region boolean-operations
  const target = cadPart('overlap').box({ w: 10, d: 10, h: 10 });
  const tool = p => p.box({ w: 10, d: 10, h: 10, x: 5 });

  const joined = target.union(tool);
  const cut = target.subtract(tool);       // the document's difference
  const common = target.intersect(tool);

  assert.equal(integerMeshVolume(joined), 1500);
  assert.equal(integerMeshVolume(cut), 500);
  assert.equal(integerMeshVolume(common), 500);
  assert.equal(integerMeshVolume(target), 1000); // the input is unchanged
  // #endregion boolean-operations
  for (const p of [joined, cut, common]) assert.equal(checkOutput(evaluateCadPart(p.doc).outputs[0]).valid, true);
});

test('two blocks touching along an edge: one output, two separate valid bodies', () => {
  // #region touching
  const snapshot = evaluateCadPart(part([...block('a', [0, 0], [10, 10]), ...block('b', [10, 10], [20, 20]),
    { id: 'u', kind: 'union', target: 'a', tool: 'b' }]));
  const [joined] = snapshot.outputs;
  assert.equal(joined.bodyCount, 2);              // not welded along the shared edge
  assert.equal(checkOutput(joined).valid, true);
  // #endregion touching
});

test('refusals: a fillet too large for its walls, an edge that is not there', () => {
  // #region refusals
  const tooLarge = refusal(part([...block('a', [0, 0], [10, 10]),
    { id: 'f', kind: 'fillet', target: 'a', edges: ['a.side0|a.top'], radius: 50 }]));
  assert.equal(tooLarge.code, 'RADIUS_EXCEEDS_FACE');         // the specific code its message carries
  assert.equal(tooLarge.details.category, 'PARAMETER');       // and the kind of refusal it is
  assert.equal(tooLarge.feature, 'f');
  assert.match(tooLarge.message, /\[RADIUS_EXCEEDS_FACE\] edge a\.side0\|a\.top: fillet 50 mm is too large for walls of 10 and 10 mm/);

  const missing = refusal(part([...block('a', [0, 0], [10, 10]),
    { id: 'f', kind: 'fillet', target: 'a', edges: ['a.side9|a.top'], radius: 1 }]));
  assert.equal(missing.code, 'SELECTION');                   // no specific code: the category
  assert.equal(missing.details.category, 'SELECTION');
  assert.match(missing.message, /no edge named a\.side9\|a\.top; edges: a\.bottom\|a\.side0, /);   // and the edges there are
  // #endregion refusals
});
