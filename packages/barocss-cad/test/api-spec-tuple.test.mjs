// Tuple admission source regressions. Execution is deferred with the API improvement bundle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { moveSpec, scaleSpec, splitSpec, boxSpec, linearPatternSpec, rotateSpec, BarocssError } from '../dist/api/index.js';

const value = error => error instanceof BarocssError && error.code === 'VALUE' && error.where === 'facade';

test('move, scale pivot and split normal reject malformed tuples instead of dropping coordinates', () => {
  const malformed = [null, undefined, [], [1], [1, 2], [1, 2, 3, 4], '123', { 0: 1, 1: 2, 2: 3, length: 3 },
    [1, 2, NaN], [1, Infinity, 3], [-Infinity, 2, 3], [1, 2, '3'], [1, 2, Symbol('z')], new Array(3)];
  for (const tuple of malformed) {
    assert.throws(() => moveSpec(tuple), value);
    assert.throws(() => splitSpec({ normal: tuple, at: 2 }), value);
    if (tuple !== undefined) assert.throws(() => scaleSpec({ factor: 2, pivot: tuple }), value);
  }
});

test('valid frozen tuples preserve exact values, omitted pivot and non-unit split normals', () => {
  const tuple = Object.freeze([-2, 3, 4]);
  assert.deepEqual(moveSpec(tuple), { command: 'move', values: { x: -2, y: 3, z: 4 } });
  assert.deepEqual(scaleSpec({ factor: 2, pivot: tuple }), { command: 'scale', values: { factor: 2, px: -2, py: 3, pz: 4 } });
  assert.deepEqual(scaleSpec({ factor: 2 }).values, { factor: 2, px: 0, py: 0, pz: 0 });
  assert.deepEqual(scaleSpec({ factor: 2, pivot: undefined }).values, { factor: 2, px: 0, py: 0, pz: 0 });
  assert.deepEqual(splitSpec({ normal: tuple, at: 5 }), { command: 'split', values: { axis: 'n', nx: -2, ny: 3, nz: 4, at: 5 } });
  assert.deepEqual(splitSpec({ axis: 'x', at: 5 }), { command: 'split', values: { axis: 'x', at: 5 } });
  assert.throws(() => splitSpec({ normal: [0, 0, 0], at: 5 }), value);
  const input = [1, 2, 3], spec = moveSpec(input);
  input[0] = 99;
  assert.equal(spec.values.x, 1);
  assert.deepEqual(tuple, [-2, 3, 4]);
});

test('invalid scalar Symbols preserve typed VALUE refusals and rotation checks its axis', () => {
  const symbol = Symbol('invalid');
  for (const call of [
    () => boxSpec({ w: symbol, d: 3, h: 4 }),
    () => boxSpec({ w: 2, d: 3, h: 4, x: symbol }),
    () => rotateSpec('x', symbol),
    () => linearPatternSpec({ axis: 'x', spacing: 3, count: symbol }),
    () => scaleSpec({ factor: symbol }),
  ]) assert.throws(call, value);
  for (const axis of ['q', '+x', 'toString', '', null, undefined, 0, symbol]) assert.throws(() => rotateSpec(axis, 90), value);
  for (const axis of ['x', 'y', 'z']) {
    assert.deepEqual(rotateSpec(axis, -90), { command: 'rotate', values: { axis, angle: -90, px: 0, py: 0, pz: 0 } });
  }
});
