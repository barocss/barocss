import assert from 'node:assert/strict';
import test from 'node:test';
import { arcOf, type P2 } from '@barocss/cad-model/sketch/profile';
import type { SketchShape } from '@barocss/cad-model/sketch/types';
import { planPathGap, preparePathGap } from '../src/sketch/pathGap';

function circle(c: P2 = [20, 20], r = 10): Extract<SketchShape, { kind: 'circle' }> {
  return { kind: 'circle', c, r, construction: true, ids: ['e5'] };
}

function near(actual: number, expected: number, tolerance: number) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected} by more than ${tolerance}`);
}

test('a 4 mm gap at the top of a radius-10 circle leaves one CCW major arc', () => {
  const shape = circle();
  const source = preparePathGap(shape);
  assert.ok(source?.kind === 'circle');
  assert.equal(source.shape, shape);
  const plan = planPathGap(source, [20, 29.5], 4);
  assert.ok(plan?.kind === 'circle');
  assert.deepEqual([plan.cutA, plan.cutB], [[21.986693, 29.800666], [18.013307, 29.800666]]);
  assert.deepEqual([plan.removed[0], plan.removed.at(-1)], [plan.cutA, plan.cutB]);
  near(plan.hit[0], 20, 1e-12);
  near(plan.hit[1], 30, 1e-12);
  const chord = plan.cutA[0] - plan.cutB[0];
  near(chord, 20 * Math.sin(0.2), 1e-6);
  near(20 * Math.asin(chord / 20), 4, 1e-6);

  const remainder = arcOf(plan.cutB, plan.cutA, plan.bulges[0]);
  assert.ok(plan.bulges[0] > 1);
  near(Math.hypot(remainder.center[0] - 20, remainder.center[1] - 20), 0, 1e-5);
  near(remainder.radius, 10, 1e-5);
  near(remainder.sweep, 2 * Math.PI - 0.4, 2e-9);
  near(remainder.radius * remainder.sweep, 20 * Math.PI - 4, 1e-5);
  assert.deepEqual(shape, circle());
});

test('a large gap across the angular seam leaves the correct CCW minor arc', () => {
  const source = preparePathGap(circle([0, 0]));
  assert.ok(source?.kind === 'circle');
  const gap = 15 * Math.PI;
  const plan = planPathGap(source, [-10, 0], gap);
  assert.ok(plan?.kind === 'circle');
  assert.deepEqual([plan.cutA, plan.cutB], [[7.071068, 7.071068], [7.071068, -7.071068]]);
  const across = planPathGap(source, [-10, -0], gap);
  assert.ok(across?.kind === 'circle');
  assert.deepEqual([across.cutA, across.cutB, across.bulges], [plan.cutA, plan.cutB, plan.bulges]);
  assert.ok(plan.bulges[0] > 0 && plan.bulges[0] < 1);
  const remainder = arcOf(plan.cutB, plan.cutA, plan.bulges[0]);
  near(remainder.sweep, Math.PI / 2, 2e-9);
  near(remainder.radius * remainder.sweep, 5 * Math.PI, 1e-5);
});

test('circle gaps refuse invalid lengths, a near-centre pointer and a vanishing remainder', () => {
  const source = preparePathGap(circle());
  assert.ok(source?.kind === 'circle');
  const total = 20 * Math.PI;
  for (const gap of [0, -1, 1e-4, NaN, Infinity, total, total + 1, total - 0.00005])
    assert.equal(planPathGap(source, [20, 30], gap), null);
  for (const pointer of [[20, 20], [20, 25], [Infinity, 30]] as P2[])
    assert.equal(planPathGap(source, pointer, 4), null);
});

test('only one identified construction circle inside the modeling range is eligible', () => {
  const shape = circle();
  assert.equal(preparePathGap({ ...shape, construction: undefined }), null);
  assert.equal(preparePathGap({ ...shape, ids: undefined }), null);
  assert.equal(preparePathGap({ ...shape, ids: ['e5', 'e6'] }), null);
  for (const radius of [0, -1, 1e-8, Infinity, NaN]) assert.equal(preparePathGap(circle([20, 20], radius)), null);
  assert.equal(preparePathGap(circle([9999, 0], 2)), null);
});
