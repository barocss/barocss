import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, outputOf, brepMassProperties, momentOfInertiaAboutAxis } from '../dist/index.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) <= 1e-9, `${actual} != ${expected}`);
const root2 = Math.sqrt(2);
// Independent rigid transform of the authored COM [1,2,3]: Rz(45 degrees) C + [10,-7,3].
const worldCOM = [10 - 1 / root2, -7 + 3 / root2, 6];
const worldPivot = [13 - 1 / root2, -7 + 3 / root2, 6];
const worldDirection = [1, 2, 2];

function boxMass(transformed) {
  const features = [
    { id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [2, 4] },
    { id: 'e', kind: 'extrude', sketch: 's', height: 6 },
  ];
  if (transformed) features.push(
    { id: 'r', kind: 'rotate', target: 'e', axis: 'z', angle: 45, pivot: [0, 0, 0] },
    { id: 't', kind: 'translate', target: 'r', offset: [10, -7, 3] },
  );
  const snapshot = evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
  // Declared fixture density only: 2.5 g/cm^3, not a measured material.
  return brepMassProperties(outputOf(snapshot, transformed ? 't' : 'e').brep, 2.5);
}

test('axis inertia rigid frame: public rotated and translated B-rep mass matches independent world COM, tensor and axes', () => {
  const props = boxMass(true);
  assert.equal(props.method, 'planar-exact');
  close(props.volume, 48); close(props.mass, 0.12);
  worldCOM.forEach((expected, i) => close(props.centroid[i], expected));
  // Original Ic = diag(.52,.4,.2); Rz(45) Ic Rz(45)^T has positive XY products .06.
  const expectedTensor = [[0.46, 0.06, 0], [0.06, 0.46, 0], [0, 0, 0.2]];
  expectedTensor.forEach((row, i) => row.forEach((expected, j) => close(props.inertia[i][j], expected)));
  // Every axis point is a fixed analytic world value, never taken from the actual COM.
  close(momentOfInertiaAboutAxis(props, { point: worldCOM, direction: worldDirection }), 167 / 450);
  // u=(1,2,2)/3; the 3 mm X offset contributes .12*9*(1-1/9)=.96 g mm^2.
  close(momentOfInertiaAboutAxis(props, { point: worldPivot, direction: worldDirection }), 599 / 450);
  close(momentOfInertiaAboutAxis(props, { point: [10 - 1 / root2, -4 + 3 / root2, 6], direction: [0, 0, 1] }), 1.28);
});

test('axis inertia rigid frame: co-rotated and co-translated analytic axes preserve the original B-rep moments', () => {
  const original = boxMass(false), moved = boxMass(true);
  // Rz(-45)*(1,2,2)=(3/sqrt(2),1/sqrt(2),2); normalization leaves the same axis.
  const originalDirection = [3 / root2, 1 / root2, 2];
  // Rz(-45) transforms the world pivot offset [3,0,0] to [3/sqrt(2),-3/sqrt(2),0].
  const originalPivot = [1 + 3 / root2, 2 - 3 / root2, 3];
  for (const [oldPoint, newPoint, expected] of [
    [[1, 2, 3], worldCOM, 167 / 450],
    [originalPivot, worldPivot, 599 / 450],
  ]) {
    const before = momentOfInertiaAboutAxis(original, { point: oldPoint, direction: originalDirection });
    const after = momentOfInertiaAboutAxis(moved, { point: newPoint, direction: worldDirection });
    close(before, expected); close(after, expected); close(after, before);
  }
  // The parallel Z-axis point [1,5,3] moves with the same rigid frame.
  const beforeZ = momentOfInertiaAboutAxis(original, { point: [1, 5, 3], direction: [0, 0, 1] });
  const afterZ = momentOfInertiaAboutAxis(moved, { point: [10 - 4 / root2, -7 + 6 / root2, 6], direction: [0, 0, 1] });
  close(beforeZ, 1.28); close(afterZ, 1.28); close(afterZ, beforeZ);
});
