import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, massPropertiesOf } from '../dist/index.js';

// D190 (L4 fuzz): a Boolean on an empty operand — an intersection that met nothing — keeps the Booleans' algebra
// (A ∪ ∅ = A, A − ∅ = A, ∅ − B = ∅, A ∩ ∅ = ∅) where it was refused as SELECTION "… is empty".
const D = f => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: f });
const box = (id, x, y, z, w, d, h) => [{ id: `${id}s`, kind: 'sketch', profile: 'rectangle', min: [x, y], max: [x + w, y + d] }, { id, kind: 'extrude', sketch: `${id}s`, height: h, from: z }];
const base = [...box('a', 0, 0, 0, 2, 2, 2), ...box('b', 10, 10, 0, 1, 1, 1), { id: 'none', kind: 'intersect', target: 'a', tool: 'b' }, ...box('c', 0, 0, 0, 3, 1, 1)];
const run = last => { const s = evaluateCadPart(D([...base, last])); return s.outputs.filter(o => o.id === last.id).map(o => massPropertiesOf(o).volume); };

test('Booleans and patterns with an empty operand: union and difference keep the other side; intersection, an empty target and a pattern of nothing give nothing', () => {
  assert.deepEqual(run({ id: 'u', kind: 'union', target: 'c', tool: 'none' }), [3]);
  assert.deepEqual(run({ id: 'u', kind: 'union', target: 'none', tool: 'c' }), [3]);
  assert.deepEqual(run({ id: 'd', kind: 'difference', target: 'c', tool: 'none' }), [3]);
  assert.deepEqual(run({ id: 'd', kind: 'difference', target: 'none', tool: 'c' }), []);
  assert.deepEqual(run({ id: 'i', kind: 'intersect', target: 'c', tool: 'none' }), []);
  assert.deepEqual(run({ id: 'p', kind: 'linear-pattern', target: 'none', axis: 'x', spacing: 3, count: 2 }), []);
  assert.deepEqual(run({ id: 'p', kind: 'circular-pattern', target: 'none', axis: 'z', angleDegrees: 90, count: 2 }), []);
  // (Another feature on an empty result is still told so: the refusal stays where no algebra applies.)
  assert.throws(() => evaluateCadPart(D([...base, { id: 'm', kind: 'translate', target: 'none', offset: [1, 0, 0] }])), /none is empty/);
});
