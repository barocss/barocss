// @barocss/cad's guarantees in small: lumps that only touch stay separate, valid bodies; what the kernel can't do is
// a typed refusal naming the feature. The robustness page includes the #region blocks. Run: pnpm test:samples
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, CadPartError } from '@barocss/cad';

const part = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
/** A 10 mm high block from min to max: a rectangle sketch and its extrude. */
const block = (id, min, max) => [{ id: `${id}s`, kind: 'sketch', profile: 'rectangle', min, max }, { id, kind: 'extrude', sketch: `${id}s`, height: 10 }];
const refusal = doc => { try { evaluateCadPart(doc); } catch (e) { if (e instanceof CadPartError) return e; throw e; } assert.fail('refused'); };

test('two blocks touching along an edge: one output, two separate valid bodies', () => {
  // #region touching
  const snapshot = evaluateCadPart(part([...block('a', [0, 0], [10, 10]), ...block('b', [10, 10], [20, 20]),
    { id: 'u', kind: 'union', target: 'a', tool: 'b' }]));
  const [joined] = snapshot.outputs;
  assert.equal(joined.bodyCount, 2);              // not welded along the shared edge
  assert.equal(joined.validate().valid, true);
  // #endregion touching
});

test('refusals: a fillet too large for its walls, an edge that is not there', () => {
  // #region refusals
  const tooLarge = refusal(part([...block('a', [0, 0], [10, 10]),
    { id: 'f', kind: 'fillet', target: 'a', edges: ['a.side0|a.top'], radius: 50 }]));
  assert.equal(tooLarge.code, 'PARAMETER');
  assert.equal(tooLarge.feature, 'f');
  assert.match(tooLarge.message, /\[RADIUS_EXCEEDS_FACE\] edge a\.side0\|a\.top: fillet 50 mm is too large for walls of 10 and 10 mm/);

  const missing = refusal(part([...block('a', [0, 0], [10, 10]),
    { id: 'f', kind: 'fillet', target: 'a', edges: ['a.side9|a.top'], radius: 1 }]));
  assert.equal(missing.code, 'SELECTION');
  assert.match(missing.message, /no edge named a\.side9\|a\.top; edges: a\.bottom\|a\.side0, /);   // and the edges there are
  // #endregion refusals
});
