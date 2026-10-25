// Input-contract regression source; execution is deferred with the API improvement bundle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Plane, Location, sketch, BarocssError } from '../dist/api/index.js';
const value = error => error instanceof BarocssError && error.code === 'VALUE' && error.where === 'facade';

test('plane, location and builder option records refuse malformed JS arguments', () => {
  for (const bad of [null, undefined, [], 'options', 1, Symbol('options')]) {
    for (const call of [() => Plane.of(bad), () => Location.of(bad),
      () => sketch().rectangle(bad), () => sketch().circle(bad),
      () => sketch().moveTo([0, 0]).arcTo([1, 0], bad)]) assert.throws(call, value);
  }
});

test('typed vectors refuse missing, extra, sparse and nonfinite components without identity fallback', () => {
  const validPlane = { origin: [0, 0, 0], normal: [0, 0, 1], xAxis: [1, 0, 0] };
  assert.throws(() => Location.at(undefined), value);
  for (const bad of [null, [], [1, 2], [1, 2, 3, 4], new Array(3), [1, NaN, 3], [1, Infinity, 3], [1, 2, Symbol('z')]]) {
    assert.throws(() => Location.at(bad), value);
    assert.throws(() => Location.of({ position: bad }), value);
    assert.throws(() => Location.of({ rotation: bad }), value);
    for (const key of ['origin', 'normal', 'xAxis']) assert.throws(() => Plane.of({ ...validPlane, [key]: bad }), value);
  }
  for (const bad of [null, undefined, [], [1], [1, 2, 3], new Array(2), [1, NaN], [Infinity, 2], [1, Symbol('y')]]) {
    assert.throws(() => sketch().moveTo(bad), value);
    assert.throws(() => sketch().polygon([[0, 0], [1, 0], bad]), value);
    assert.throws(() => sketch().moveTo([0, 0]).arcTo([1, 0], { center: bad }), value);
  }
  assert.deepEqual(Location.of({}).data, { position: [0, 0, 0], rotation: [0, 0, 0] });
  assert.deepEqual(Location.of({ position: undefined, rotation: undefined }).data, Location.IDENTITY.data);
});

test('sparse polygons cannot skip coordinate validation; valid input values are preserved', () => {
  assert.throws(() => sketch().polygon(new Array(3)), value);
  const sparse = [[0, 0], , [0, 2]];
  assert.throws(() => sketch().polygon(sparse), value);
  assert.deepEqual(sketch().polygon([[0, 0], [2, 0], [0, 3]]).data.points, [[0, 0], [2, 0], [0, 3]]);
  for (const v of [NaN, Infinity, Symbol('length')]) {
    assert.throws(() => sketch().rectangle({ w: v, d: 2 }), value);
    assert.throws(() => sketch().circle({ r: v }), value);
  }
});
