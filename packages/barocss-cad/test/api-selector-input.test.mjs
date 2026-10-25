// Selector admission contracts; execution is deferred with the API improvement bundle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EdgeQuery, FaceQuery, BarocssError } from '../dist/api/index.js';

const edges = () => new EdgeQuery([0, 1, 2].map(x => ({ names: [`e${x}`], straight: true, axis: 'x', a: [x, 0, 0], b: [x + 1, 0, 0], faces: ['bottom', 'side'] })));
const faces = () => new FaceQuery([0, 1, 2].map(x => ({ name: `f${x}`, kind: 'plane', normal: [0, 0, -1], centroid: [x, 0, 0], edges: [] })), []);
const value = error => error instanceof BarocssError && error.code === 'VALUE' && error.where === 'facade';

test('selectors refuse malformed axes and directions even on empty queries', () => {
  for (const e of [edges(), new EdgeQuery([])]) for (const axis of ['toString', 'q', '+x', '', null, 0, Symbol('x')]) {
    assert.throws(() => e.along(axis), value);
    assert.throws(() => e.sortBy(axis), value);
  }
  for (const f of [faces(), new FaceQuery([], [])]) {
    for (const axis of ['constructor', 'q', '+x', '', null, Symbol('x')]) assert.throws(() => f.sortBy(axis), value);
    for (const direction of ['xz', 'zz', 'z', '+zextra', '+q', '', null, 0, Symbol('z')]) assert.throws(() => f.facing(direction), value);
  }
  assert.deepEqual(faces().facing('-z').names(), ['f0', 'f1', 'f2']);
  assert.deepEqual(faces().facing('+z').names(), []);
  assert.deepEqual(edges().along('x').names(), ['e0', 'e1', 'e2']);
});

test('selection counts reject coercion and preserve default, zero, bounded and oversized slices', () => {
  for (const q of [edges(), faces(), new EdgeQuery([]), new FaceQuery([], [])]) {
    const before = q.names();
    for (const count of [-1, 0.5, NaN, Infinity, -Infinity, '1', null, false, Symbol('1')]) {
      assert.throws(() => q.first(count), value);
      assert.throws(() => q.last(count), value);
    }
    assert.deepEqual(q.names(), before);
    assert.deepEqual(q.first(0).names(), []);
    assert.deepEqual(q.last(0).names(), []);
    assert.deepEqual(q.first().names(), before.slice(0, 1));
    assert.deepEqual(q.last().names(), before.slice(-1));
    assert.deepEqual(q.first(2).names(), before.slice(0, 2));
    assert.deepEqual(q.last(2).names(), before.slice(-2));
    assert.deepEqual(q.first(99).names(), before);
    assert.deepEqual(q.last(99).names(), before);
  }
});
