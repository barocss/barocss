import assert from 'node:assert/strict';
import test from 'node:test';
import type { P2 } from '@barocss/cad-model/sketch/profile';
import { circleFromChord } from '../src/sketch/circleFromChord';

const near = (actual: number, expected: number, tolerance = 1e-10) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

function centers(a: P2, b: P2, radius: number) {
  const result = circleFromChord(a, b, radius);
  assert.ok('centers' in result, JSON.stringify(result));
  for (const c of result.centers) {
    near(Math.hypot(c[0] - a[0], c[1] - a[1]), radius);
    near(Math.hypot(c[0] - b[0], c[1] - b[1]), radius);
  }
  return result.centers;
}

function refused(a: P2, b: P2, radius: number, reason: RegExp) {
  const result = circleFromChord(a, b, radius);
  assert.ok('error' in result, JSON.stringify(result));
  assert.match(result.error, reason);
}

test('two distinct centers follow the independent 3-4-5 oracle and pick order has no effect', () => {
  const a: P2 = [0, 0], b: P2 = [6, 0];
  const expected = [[3, -4], [3, 4]];
  assert.deepEqual(centers(a, b, 5), expected);
  assert.deepEqual(centers(b, a, 5), expected);
  assert.deepEqual(a, [0, 0]);
  assert.deepEqual(b, [6, 0]);
  assert.deepEqual(centers([0, 0], [0, 6], 5), [[-4, 3], [4, 3]]);
});

test('fractional, rotated and translated centers are kept without grid rounding', () => {
  const exact = Math.sqrt(39) / 2;
  assert.deepEqual(centers([0, 0], [5, 0], 4), [[2.5, -exact], [2.5, exact]]);

  const a: P2 = [1234.125, -987.375], b: P2 = [1238.925, -983.775];
  const expected = [[1234.125, -982.375], [1238.925, -988.775]];
  const actual = centers(a, b, 5);
  actual.forEach((center, i) => center.forEach((value, axis) => near(value, expected[i][axis])));
  assert.deepEqual(centers(b, a, 5), actual);
});

test('only an exact axial or rotated diameter produces a single center', () => {
  assert.deepEqual(centers([0, 0], [6, 0], 3), [[3, 0]]);
  assert.deepEqual(centers([1234.125, -987.375], [1240.125, -979.375], 5), [[1237.125, -983.375]]);
  assert.deepEqual(centers([0, 0], [0.5, 0], 0.25), [[0.25, 0]]);
  refused([0, 0], [6, 0], 2.99, /longer than/);
});

test('a rounded length equal to the diameter is insufficient for a single center', () => {
  assert.equal(Math.hypot(6, 2 ** -30), 6);
  refused([0, 0], [6, 2 ** -30], 3, /longer than/);

  assert.equal(6 - 2 ** -60, 6);
  refused([2 ** -60, 0], [6, 0], 3, /too close to a diameter/);
  refused([0, 0], [6 - 1e-8, 0], 3, /too close to a diameter/);
  assert.equal(centers([0, 0], [6 - 4e-7, 0], 3).length, 2);
});

test('degenerate inputs, invalid radii and circles outside the sketch envelope refuse', () => {
  for (const radius of [0, -1, 0.2499, NaN, Infinity, 10000.01]) {
    refused([0, 0], [0.4, 0], radius, /radius from 0\.25/);
  }
  refused([2, 3], [2, 3], 4, /distinct points/);
  refused([0, 0], [1e-8, 0], 4, /distinct points/);
  refused([10000.01, 0], [0, 0], 4, /two points must be within/);
  refused([NaN, 0], [0, 0], 4, /two points must be within/);
  assert.deepEqual(centers([9990, 0], [10000, 0], 5), [[9995, 0]]);
  assert.deepEqual(centers([-10000, 0], [10000, 0], 10000), [[0, 0]]);
  // One center is in range and the other would put part of its circle outside the range.
  refused([9999, 0], [9999, 6], 5, /circle extends beyond/);
});
