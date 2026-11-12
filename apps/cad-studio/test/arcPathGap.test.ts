import assert from 'node:assert/strict';
import test from 'node:test';
import { arcOf, type P2 } from '@barocss/cad-model/sketch/profile';
import type { SketchShape } from '@barocss/cad-model/sketch/types';
import { planArcPathGap, prepareArcPathGap } from '../src/sketch/arcPathGap';

function source(a: P2, b: P2, bulge: number): Extract<SketchShape, { kind: 'polygon' }> {
  return { kind: 'polygon', points: [a, b], bulges: [bulge, 0], closed: false, construction: true, ids: ['e5', 'e6'] };
}

function close(actual: number, expected: number, tolerance: number) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected} by more than ${tolerance}`);
}

test('a 4 mm semicircle gap uses signed arc length for both sweep directions', () => {
  for (const sign of [1, -1]) {
    const a: P2 = [30, 20], b: P2 = [10, 20], shape = source(a, b, sign);
    const prepared = prepareArcPathGap(shape);
    assert.ok(prepared);
    assert.equal(prepared.shape, shape);
    const plan = planArcPathGap(prepared, [20, 20 + sign * 9.5], 4);
    assert.ok(plan);

    const y = sign > 0 ? 29.800666 : 10.199334;
    assert.deepEqual([plan.cutA, plan.cutB], [[21.986693, y], [18.013307, y]]);
    assert.deepEqual([plan.removed[0], plan.removed.at(-1)], [plan.cutA, plan.cutB]);
    close(plan.hit[0], 20, 1e-12);
    close(plan.hit[1], 20 + sign * 10, 1e-12);
    close(plan.cutA[0] - plan.cutB[0], 20 * Math.sin(0.2), 1e-6);
    for (const [index, [start, end]] of ([[a, plan.cutA], [plan.cutB, b]] as const).entries()) {
      const retained = arcOf(start, end, plan.bulges[index]);
      close(Math.hypot(retained.center[0] - 20, retained.center[1] - 20), 0, 1e-5);
      close(retained.radius, 10, 1e-5);
      close(retained.sweep, sign * (Math.PI / 2 - 0.2), 2e-9);
      close(retained.radius * Math.abs(retained.sweep), 5 * Math.PI - 2, 1e-5);
    }
    assert.deepEqual(shape, source([30, 20], [10, 20], sign));
  }
});

test('a major arc accepts a cut across the angle seam and refuses the unused sector', () => {
  const prepared = prepareArcPathGap(source([0, 10], [10, 20], 1 + Math.SQRT2));
  assert.ok(prepared);
  const plan = planArcPathGap(prepared, [10, 0], 4);
  assert.ok(plan);
  assert.deepEqual([plan.cutA, plan.cutB], [[8.013307, 0.199334], [11.986693, 0.199334]]);
  close(plan.hit[0], 10, 1e-12);
  close(plan.hit[1], 0, 1e-12);
  assert.ok(plan.bulges.every(bulge => bulge > 0));
  assert.equal(planArcPathGap(prepared, [3, 17], 4), null);
});

test('the gap refuses nonfinite, tiny and endpoint-spanning cuts or unstable stored arcs', () => {
  const prepared = prepareArcPathGap(source([30, 20], [10, 20], 1));
  assert.ok(prepared);
  for (const length of [-1, 0, 1e-4, NaN, Infinity, 10 * Math.PI])
    assert.equal(planArcPathGap(prepared, [20, 30], length), null);
  assert.equal(planArcPathGap(prepared, [30, 20], 4), null);
  assert.equal(planArcPathGap(prepared, [29.95, 21], 4), null);
  assert.equal(planArcPathGap(prepared, [20, 20.01], 4), null);
  assert.equal(planArcPathGap(prepared, [20, Infinity], 4), null);
  // Retaining 0.0002 mm at each end survives the join threshold, but endpoint rounding moves the stored centres.
  assert.equal(planArcPathGap(prepared, [20, 30], 10 * Math.PI - 0.0004), null);
});

test('only a completed identified construction arc with independent geometry is eligible', () => {
  const shape = source([30, 20], [10, 20], 1);
  for (const changed of [
    { closed: true }, { construction: undefined }, { pending: true }, { ids: ['e5'] }, { ids: ['e5', 'e5'] },
    { fromSpline: true as const }, { fromEllipse: true as const }, { radii: { 0: 10 } }, { lengths: { 0: 20 } },
    { circles: [{ c: [0, 0] as P2, r: 1 }] },
  ]) assert.equal(prepareArcPathGap({ ...shape, ...changed }), null);
  for (const bulge of [0, NaN, Infinity, Number.MIN_VALUE, Number.MAX_VALUE])
    assert.equal(prepareArcPathGap(source([30, 20], [10, 20], bulge)), null);
  assert.equal(prepareArcPathGap(source([30, 20], [30, 20], 1)), null);
  assert.equal(prepareArcPathGap(source([9899, 0], [9999, -100], Math.SQRT2 - 1)), null);
});
