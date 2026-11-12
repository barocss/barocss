import assert from 'node:assert/strict';
import test from 'node:test';
import type { P2 } from '@barocss/cad-model/sketch/profile';
import type { SketchShape } from '@barocss/cad-model/sketch/types';
import { planPathGap, preparePathGap } from '../src/sketch/pathGap';

function line(a: P2, b: P2): Extract<SketchShape, { kind: 'polygon' }> {
  return { kind: 'polygon', points: [a, b], bulges: [0, 0], closed: false, construction: true, ids: ['e5', 'e6'] };
}

test('a slanted 30 mm segment loses exactly 4 mm and keeps its direction', () => {
  const shape = line([20, 20], [44, 38]);
  const source = preparePathGap(shape);
  assert.ok(source);
  assert.equal(source.kind, 'line');
  assert.equal(source.shape, shape);
  const plan = planPathGap(source, [32.3, 28.6], 4);
  assert.ok(plan);
  assert.ok(Math.hypot(plan.hit[0] - 32, plan.hit[1] - 29) < 1e-12);
  assert.deepEqual([plan.cutA, plan.cutB], [[30.4, 27.8], [33.6, 30.2]]);
  assert.deepEqual(plan.removed, [plan.cutA, plan.cutB]);
  assert.deepEqual(plan.bulges, [0, 0]);
  const reversed = preparePathGap(line([44, 38], [20, 20]));
  assert.ok(reversed);
  const back = planPathGap(reversed, [32.3, 28.6], 4);
  assert.ok(back);
  assert.deepEqual([back.cutA, back.cutB], [plan.cutB, plan.cutA]);
  assert.deepEqual(shape, line([20, 20], [44, 38]));
});

test('a straight gap refuses invalid length, ends and cuts that would rejoin', () => {
  const source = preparePathGap(line([0, 0], [30, 0]));
  assert.ok(source);
  for (const gap of [0, -1, 1e-4, NaN, Infinity, 30]) assert.equal(planPathGap(source, [15, 0], gap), null);
  assert.equal(planPathGap(source, [0, 0], 4), null);
  assert.equal(planPathGap(source, [1, 0], 4), null);
  assert.equal(planPathGap(source, [2.00005, 0], 4), null);
  assert.equal(planPathGap(source, [Infinity, 0], 4), null);
  assert.equal(preparePathGap(line([0, 0], [0, 0])), null);
});
