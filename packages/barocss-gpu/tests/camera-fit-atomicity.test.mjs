import test from 'node:test';
import assert from 'node:assert/strict';
import { Camera } from '../dist/viewer/camera.js';

const box = () => ({ min: [1, 1, 1], max: [3, 3, 3] });
const camera = () => new Camera({ position: [0, -5, 0], target: [0, 0, 0], up: [0, 0, 1], fovY: 40 });
function refusesWithoutMutation(c, run) {
  const position = c.position, target = c.target, up = c.up;
  const before = structuredClone({ state: c.state(), near: c.near, far: c.far });
  assert.throws(run, { code: 'SIZE_INVALID' });
  assert.equal(c.position, position, 'failed fit keeps position array identity');
  assert.equal(c.target, target, 'failed fit keeps target array identity');
  assert.equal(c.up, up, 'failed fit keeps up array identity');
  assert.deepEqual({ state: c.state(), near: c.near, far: c.far }, before, 'failed fit keeps all camera values');
}
for (const [label, value] of [['zero', 0], ['negative', -1], ['NaN', NaN], ['positive infinity', Infinity], ['negative infinity', -Infinity]]) {
  test(`camera fit refuses ${label} aspect before changing state`, () => {
    const c = camera(); refusesWithoutMutation(c, () => c.fit(box(), value));
  });
  test(`camera fit refuses ${label} margin before changing state`, () => {
    const c = camera(); refusesWithoutMutation(c, () => c.fit(box(), 1, value));
  });
}
test('camera fit refuses finite positive aspect whose fitted distance overflows', () => {
  const c = camera(); refusesWithoutMutation(c, () => c.fit(box(), Number.MIN_VALUE));
});
test('camera fit refuses finite positive margin whose fitted radius overflows', () => {
  const c = camera(); refusesWithoutMutation(c, () => c.fit(box(), 1, Number.MAX_VALUE));
});
test('camera fit refuses a finite box whose span overflows without replacing its target', () => {
  const c = camera();
  refusesWithoutMutation(c, () => c.fit({ min: [-Number.MAX_VALUE, -1, -1], max: [Number.MAX_VALUE, 1, 1] }, 1));
});
test('camera fit refuses a finite box whose centre overflows before assigning either field', () => {
  const c = camera();
  refusesWithoutMutation(c, () => c.fit({ min: [Number.MAX_VALUE / 2, 1, 1], max: [Number.MAX_VALUE, 3, 3] }, 1));
});
for (const [label, bad] of [['NaN bound', { min: [NaN, 1, 1], max: [3, 3, 3] }], ['infinite bound', { min: [1, 1, 1], max: [Infinity, 3, 3] }]]) {
  test(`camera fit refuses ${label} with nonfinite computed output atomically`, () => {
    const c = camera(); refusesWithoutMutation(c, () => c.fit(bad, 1));
  });
}
test('camera fit preserves the existing finite framing equation for both projections', () => {
  // Independent sphere-fit equation: r=sqrt(3), half FOV=20deg, centre=[2,2,2], view from -Y.
  const distance = Math.sqrt(3) * 1.1 / Math.sin(20 * Math.PI / 180);
  for (const projection of ['perspective', 'orthographic']) {
    const c = camera(); c.projection = projection;
    const sourceBox = box(), beforeBox = structuredClone(sourceBox), up = c.up;
    c.fit(sourceBox, 1);
    assert.deepEqual(c.target, [2, 2, 2]);
    assert.ok(Math.abs(c.position[0] - 2) < 1e-12);
    assert.ok(Math.abs(c.position[1] - (2 - distance)) < 1e-12);
    assert.ok(Math.abs(c.position[2] - 2) < 1e-12);
    assert.ok(Math.abs(c.distance - distance) < 1e-12);
    assert.equal(c.projection, projection); assert.equal(c.fovY, 40); assert.equal(c.up, up);
    assert.deepEqual(sourceBox, beforeBox, 'fit does not edit caller bounds');
    assert.ok(c.position.every(Number.isFinite));
  }
});
test('camera fit keeps finite fallback direction for an initially coincident eye and target', () => {
  const c = camera(); c.position = [0, 0, 0]; c.fit(box(), 1);
  assert.deepEqual(c.target, [2, 2, 2]);
  assert.ok(c.position.every(Number.isFinite));
  assert.equal(c.position[0], 2); assert.equal(c.position[2], 2); assert.ok(c.position[1] < 2);
});
