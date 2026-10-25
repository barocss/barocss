import test from 'node:test';
import assert from 'node:assert/strict';
import { momentOfInertiaAboutAxis, isSolidMassError } from '../dist/index.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) <= 1e-9, `${actual} != ${expected}`);
// A uniform 12 g cuboid, 2 by 6 by 4 mm. Ic = m/12 times the sums of squared side lengths.
const cuboid = () => ({ volume: 48, mass: 12, centroid: [1, 2, 3], inertia: [[52, 0, 0], [0, 20, 0], [0, 0, 40]], method: 'closed-form' });
const query = () => ({ point: [1, 2, 3], direction: [0, 0, 1] });
const tensorBody = () => ({ volume: 1, mass: 2, centroid: [0, 0, 0], inertia: [[10, 2, -1], [2, 20, 3], [-1, 3, 30]], method: 'closed-form' });
const sparseVector = () => Object.assign(Array(3), { 0: 0, 2: 0 });
const rejected = (props, axis, label) => assert.throws(() => momentOfInertiaAboutAxis(props, axis),
  e => isSolidMassError(e) && e.code === 'SOLID_MASS', label);

test('axis inertia: cuboid COM axes and a physical-pendulum support axis use g and mm', () => {
  const props = cuboid();
  for (const [direction, expected] of [[[1, 0, 0], 52], [[0, 1, 0], 20], [[0, 0, 1], 40]]) {
    close(momentOfInertiaAboutAxis(props, { point: [1, 2, 3], direction }), expected);
  }
  // A Z support axis 3 mm above the COM: 40 + 12*3^2 = 148 g mm^2.
  close(momentOfInertiaAboutAxis(props, { point: [1, 5, 3], direction: [0, 0, 1] }), 148);
  // A parallel Z axis 3 mm in X and 4 mm in Y from the COM: 40 + 12*5^2.
  close(momentOfInertiaAboutAxis(props, { point: [4, 6, 3], direction: [0, 0, 1] }), 340);
});

test('axis inertia: an oblique axis uses all tensor entries and the perpendicular distance', () => {
  const props = tensorBody();
  // Unit direction (1,2,2)/3 gives (10+80+120+8-4+24)/9 = 238/9.
  close(momentOfInertiaAboutAxis(props, { point: [0, 0, 0], direction: [1, 2, 2] }), 238 / 9);
  // From point (3,0,0), squared perpendicular distance is 9-1=8; mass is 2 g.
  close(momentOfInertiaAboutAxis(props, { point: [3, 0, 0], direction: [1, 2, 2] }), 382 / 9);
});

test('axis inertia: axis reversal, rescaling and extreme finite directions preserve the axis', () => {
  for (const direction of [[1, 2, 2], [-1, -2, -2], [7, 14, 14], [1e-300, 2e-300, 2e-300], [Number.MAX_VALUE / 2, Number.MAX_VALUE, Number.MAX_VALUE]]) {
    close(momentOfInertiaAboutAxis(tensorBody(), { point: [3, 0, 0], direction }), 382 / 9);
  }
  close(momentOfInertiaAboutAxis(cuboid(), { point: [1, 2, 3], direction: [Number.MAX_VALUE, Number.MAX_VALUE, 0] }), 36);
  close(momentOfInertiaAboutAxis(cuboid(), { point: [1, 2, 3], direction: [0, 0, Number.MIN_VALUE] }), 40);
});

test('axis inertia: shifting the axis point along the axis or translating the frame preserves inertia', () => {
  const props = cuboid();
  close(momentOfInertiaAboutAxis(props, { point: [1, 5, 30], direction: [0, 0, 1] }), 148);
  close(momentOfInertiaAboutAxis(props, { point: [1, 2, -40], direction: [0, 0, 1] }), 40);
  const translated = { ...props, centroid: [101, -48, 12] };
  close(momentOfInertiaAboutAxis(translated, { point: [101, -45, 12], direction: [0, 0, 1] }), 148);
});

test('axis inertia: finite nonsymmetric input uses the full quadratic form without mutation', () => {
  const props = tensorBody();
  props.inertia = [[10, 4, -1], [0, 20, 3], [-1, 3, 30]];
  const axis = { point: [3, 0, 0], direction: [1, 2, 2] }, before = structuredClone({ props, axis });
  props.inertia.forEach(Object.freeze); Object.freeze(props.inertia); Object.freeze(props.centroid); Object.freeze(props);
  Object.freeze(axis.point); Object.freeze(axis.direction); Object.freeze(axis);
  close(momentOfInertiaAboutAxis(props, axis), 382 / 9);
  assert.deepEqual({ props, axis }, before);
});

test('axis inertia: malformed objects, mass and dense finite vectors have typed refusals', () => {
  for (const props of [null, undefined]) rejected(props, query(), 'missing mass properties');
  for (const axis of [null, undefined]) rejected(cuboid(), axis, 'missing axis');
  for (const mass of [0, -1, NaN, Infinity]) rejected({ ...cuboid(), mass }, query(), `mass ${mass}`);
  const invalidVectors = [null, [], [0, 0], [0, 0, 0, 0], sparseVector(), Array(3), [NaN, 0, 0], [0, Infinity, 0], ['0', 0, 0]];
  for (const value of invalidVectors) {
    rejected({ ...cuboid(), centroid: value }, query(), 'invalid centroid');
    rejected(cuboid(), { ...query(), point: value }, 'invalid axis point');
    rejected(cuboid(), { ...query(), direction: value }, 'invalid axis direction');
  }
  rejected(cuboid(), { ...query(), direction: [0, 0, 0] }, 'zero direction');
});

test('axis inertia: malformed, sparse and nonfinite 3 by 3 tensors have typed refusals', () => {
  const tensors = [null, [], [[1, 0, 0], [0, 1, 0]], Array(3),
    Object.assign(Array(3), { 0: [1, 0, 0], 2: [0, 0, 1] }), [[1, 0, 0], sparseVector(), [0, 0, 1]],
    [[1, 0, 0], [0, 1], [0, 0, 1]], [[1, 0, 0], [0, 1, 0, 0], [0, 0, 1]],
    [[1, NaN, 0], [0, 1, 0], [0, 0, 1]], [[1, 0, 0], [0, 1, 0], [Infinity, 0, 1]]];
  for (const inertia of tensors) rejected({ ...cuboid(), inertia }, query(), 'invalid inertia tensor');
});

test('axis inertia: negative central projection is refused even when a pivot term would hide it', () => {
  const props = { ...cuboid(), inertia: [[-1, 0, 0], [0, 20, 0], [0, 0, 40]] };
  rejected(props, { point: [1, 2, 3], direction: [1, 0, 0] }, 'negative COM projection');
  rejected(props, { point: [1, 102, 3], direction: [1, 0, 0] }, 'positive pivot contribution cannot hide negative COM projection');
});

test('axis inertia: nonfinite intermediate calculations and overflow have typed refusals', () => {
  rejected(cuboid(), { point: [Number.MAX_VALUE, 0, 0], direction: [0, 0, 1] }, 'squared distance overflow');
  rejected({ ...cuboid(), centroid: [-Number.MAX_VALUE, 0, 0] }, { point: [Number.MAX_VALUE, 0, 0], direction: [1, 0, 0] }, 'coordinate subtraction overflow');
  rejected({ ...cuboid(), mass: Number.MAX_VALUE }, { point: [1, 4, 3], direction: [0, 0, 1] }, 'parallel-axis mass product overflow');
  const inertia = Array.from({ length: 3 }, () => Array(3).fill(Number.MAX_VALUE));
  rejected({ ...cuboid(), inertia }, { point: [1, 2, 3], direction: [1, 1, 1] }, 'central quadratic form overflow');
});
