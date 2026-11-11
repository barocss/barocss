import assert from 'node:assert/strict';
import test from 'node:test';
import { boxSection, cutoutCorner, middlePlane, planeAxis } from '../src/viewport/sectionView';
import { projectedSectionSpan, sectionDragRange, sectionDragValue, sectionMidpoint } from '../src/viewport/sectionSpan';

const close = (value: number, expected: number) => assert.ok(Math.abs(value - expected) < 1e-12, `${value} != ${expected}`);

test('default sections use unrounded centres and preserve the camera-facing side', () => {
  const box = { min: [0.1, -0.3, 10.1], max: [0.3, -0.1, 10.3] };
  for (const [axis, k, at] of [['x', 0, 0.2], ['y', 1, -0.2], ['z', 2, 10.2]] as const) {
    const plane = middlePlane(axis, box);
    assert.ok(plane);
    assert.equal(plane.axis, axis);
    close(plane.offset, at);
    assert.equal(plane.normal[k], 1);
  }
  const planes = cutoutCorner(box, [-5, 5, 0], 3);
  assert.deepEqual(planes.map(p => planeAxis(p)?.keep), ['positive', 'negative', 'positive']);
  planes.forEach((p, i) => close(planeAxis(p)!.at, [0.2, -0.2, 10.2][i]));
});

test('small finite spans clamp continuously without moving a stationary drag', () => {
  for (const width of [0.2, 0.49, 0.5, 0.75, 0.99, 1]) for (const lo of [0, 0.1, -8.123]) {
    const hi = lo + width, start = lo + width / 2;
    const range = sectionDragRange(lo, hi);
    assert.ok(range && range.lower > lo && range.upper < hi);
    assert.equal(range.snap, false);
    close(sectionDragValue(range, start, 0), start);
    close(sectionDragValue(range, start, width / 100), start + width / 100);
    close(sectionDragValue(range, start, -width / 100), start - width / 100);
    close(sectionDragValue(range, start, -20), lo + width / 10);
    close(sectionDragValue(range, start, 20), hi - width / 10);
    close(sectionDragValue(range, start, NaN), start);
  }
});

test('ordinary spans retain half-mm steps and narrow ranges without a grid point stay ordered', () => {
  const regular = sectionDragRange(0, 8);
  assert.deepEqual(regular, { lower: 0.5, upper: 7.5, snap: true });
  assert.equal(sectionDragValue(regular!, 4, 0.31), 4.5);
  assert.equal(sectionDragValue(regular!, 4, -0.31), 3.5);
  const noTick = sectionDragRange(0.1, 1.11);
  assert.ok(noTick && !noTick.snap);
  close(sectionDragValue(noTick, 0.605, 0.001), 0.606);
  const box = boxSection([0, 0, 0], [20, 12, 8]);
  box.planes.forEach((p, i) => close(planeAxis(p)!.at, [2, 18, 1.2, 10.8, 0.8, 7.2][i]));
});

test('a general unit normal and its flip have opposite projected ranges', () => {
  const scale = Math.sqrt(40001), normal = [0, 1 / scale, 200 / scale];
  const box = { min: [0, 0, 0.1], max: [20, 12, 0.3] };
  const span = projectedSectionSpan(box, normal), flipped = projectedSectionSpan(box, normal.map(v => -v));
  assert.ok(span && flipped);
  close(span[0], 20 / scale);
  close(span[1], 72 / scale);
  close(flipped[0], -72 / scale);
  close(flipped[1], -20 / scale);
  const range = sectionDragRange(...span), flipRange = sectionDragRange(...flipped);
  assert.ok(range && flipRange && !range.snap && !flipRange.snap);
  close(sectionDragValue(range, 46 / scale, -20), 25.2 / scale);
  close(sectionDragValue(flipRange, -46 / scale, 20), -25.2 / scale);
});

test('nonfinite, reversed, zero and unrepresentable spans have no interior', () => {
  for (const [lo, hi] of [[0, 0], [2, 1], [0, Infinity], [NaN, 5], [2 ** 52, 2 ** 52 + 1]]) {
    assert.equal(sectionMidpoint(lo, hi), null);
    assert.equal(sectionDragRange(lo, hi), null);
  }
  assert.deepEqual(sectionDragRange(2 ** 52, 2 ** 52 + 2), { lower: 2 ** 52 + 1, upper: 2 ** 52 + 1, snap: false });
  const collapsed = { min: [0, 0, 0], max: [0, 1, 2] };
  assert.equal(middlePlane('x', collapsed), null);
  assert.deepEqual(cutoutCorner(collapsed, null), []);
  assert.equal(projectedSectionSpan({ min: [0, 0, 1], max: [1, 1, 0] }, [0, 1, 0]), null);
  assert.equal(projectedSectionSpan(collapsed, [0, Infinity, 0]), null);
});
