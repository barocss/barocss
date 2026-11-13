import assert from 'node:assert/strict';
import { test } from 'node:test';
import { projectedBezier } from '../src/viewport/projectedBezier';

test('a collinear cubic keeps both excursions beyond its endpoint chord', () => {
  const path = projectedBezier([[0, 0], [300, 0], [-300, 0], [10, 0]]);
  // At t = 1/4 and 3/4 the Bernstein values are 84.53125 and -80.15625.
  assert.ok(Math.max(...path.map(([x]) => x)) >= 84.53125 - 0.25);
  assert.ok(Math.min(...path.map(([x]) => x)) <= -80.15625 + 0.25);
  assert.deepEqual(path[0], [0, 0]);
  assert.deepEqual(path.at(-1), [10, 0]);
});

test('an S curve and a returning quadratic subdivide even with a misleading chord', () => {
  const inflection = projectedBezier([[0, 0], [160, 150], [240, -150], [400, 0]]);
  assert.ok(inflection.some(([, y]) => y > 40) && inflection.some(([, y]) => y < -40));
  const returnPath = projectedBezier([[0, 0], [40, 100], [0, 0]]);
  assert.deepEqual(returnPath, [[0, 0], [20, 50], [0, 0]]);
});

test('invalid projection draws no curve and extreme scale uses the segment cap', () => {
  assert.deepEqual(projectedBezier([[0, 0], [0, Infinity], [0, 1]]), []);
  const path = projectedBezier([[0, 0], [1e12, 1e12], [2e12, 0]]);
  assert.equal(path.length, 513);
  assert.deepEqual(path[0], [0, 0]);
  assert.deepEqual(path.at(-1), [2e12, 0]);
});
