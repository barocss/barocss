import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, outputOf, brepMassProperties, momentOfInertiaAboutAxis } from '../dist/index.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) <= 1e-9, `${actual} != ${expected}`);
const radians = degrees => degrees * Math.PI / 180;
const gravity = 9.80665; // Declared world acceleration [0,0,-9.80665] m/s^2.
const shoulder = [0, 0, 0], jointAxis = [0, 1, 0];

function linkMass(length, angle, offset) {
  const snapshot = evaluateCadPart({
    format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {},
    features: [
      { id: 's', kind: 'sketch', profile: 'rectangle', min: [0, -2], max: [length, 2] },
      { id: 'e', kind: 'extrude', sketch: 's', height: 4, from: -2 },
      { id: 'r', kind: 'rotate', target: 'e', axis: 'y', angle, pivot: [0, 0, 0] },
      { id: 't', kind: 'translate', target: 'r', offset },
    ],
  });
  // Explicit fixture density 2.5 g/cm^3; not a measured material or a native-SI claim.
  // Integrate each final world B-rep directly; do not use a carried construction mass callback.
  return brepMassProperties(outputOf(snapshot, 't').brep, 2.5);
}

// Test-only r cross F oracle; this does not call a Model or production gravity solver.
function gravityTorque(props, pivot) {
  const r = props.centroid.map((coordinate, i) => coordinate - pivot[i]); // World mm.
  // Convert mass g to kg exactly once. Newton force times mm lever gives N mm.
  // Do not also divide the lever by 1000: this query intentionally returns N mm.
  const force = [0, 0, -(props.mass / 1000) * gravity];
  return [r[1] * force[2] - r[2] * force[1],
    r[2] * force[0] - r[0] * force[2], r[0] * force[1] - r[1] * force[0]];
}

for (const [q1, q2] of [[0, 0], [60, -30], [-30, 90]]) {
  test(`serial links: public B-rep mass feeds a static-moment oracle and separate axis moments at Ry(${q1},${q2})`, () => {
    const a = radians(q1), b = radians(q1 + q2);
    // Analytic pivots: Ry(q1)[20,0,0]. They are never inferred from actual COM values.
    const elbow = [20 * Math.cos(a), 0, -20 * Math.sin(a)];
    const first = linkMass(20, q1, [0, 0, 0]);
    const second = linkMass(10, q1 + q2, elbow);
    assert.equal(first.method, 'planar-exact'); assert.equal(second.method, 'planar-exact');
    close(first.volume, 320); close(second.volume, 160);
    close(first.mass, 0.8); close(second.mass, 0.4);
    const expectedFirstCOM = [10 * Math.cos(a), 0, -10 * Math.sin(a)];
    const expectedSecondCOM = [20 * Math.cos(a) + 5 * Math.cos(b), 0, -20 * Math.sin(a) - 5 * Math.sin(b)];
    expectedFirstCOM.forEach((expected, i) => close(first.centroid[i], expected));
    expectedSecondCOM.forEach((expected, i) => close(second.centroid[i], expected));
    // Independent lengths: shoulder-to-elbow 20; link COM distances from their own pivots 10 and 5 mm.
    close(Math.hypot(...elbow), 20);
    close(Math.hypot(...first.centroid.map((x, i) => x - shoulder[i])), 10);
    close(Math.hypot(...second.centroid.map((x, i) => x - elbow[i])), 5);
    close(Math.hypot(...second.centroid.map((x, i) => x - shoulder[i])), Math.sqrt(425 + 200 * Math.cos(radians(q2))));

    const firstAtShoulder = gravityTorque(first, shoulder);
    const secondAtShoulder = gravityTorque(second, shoulder);
    const secondAtElbow = gravityTorque(second, elbow);
    const actualGravity1 = firstAtShoulder[1] + secondAtShoulder[1];
    const actualGravity2 = secondAtElbow[1];
    // Independent cos formulas use authored lengths and literal kg masses, not measured props.
    const expectedGravity1 = gravity * (0.0008 * 10 * Math.cos(a) + 0.0004 * (20 * Math.cos(a) + 5 * Math.cos(b)));
    const expectedGravity2 = gravity * 0.0004 * 5 * Math.cos(b);
    close(actualGravity1, expectedGravity1); close(actualGravity2, expectedGravity2);
    const actualHolding1 = -actualGravity1, actualHolding2 = -actualGravity2;
    close(actualHolding1, -expectedGravity1); close(actualHolding2, -expectedGravity2);
    for (const torque of [firstAtShoulder, secondAtShoulder, secondAtElbow]) {
      close(torque[0], 0); close(torque[2], 0);
    }

    // Separate MMGS axis-inertia checks, in g mm^2. These are not static torques or coupled dynamics.
    // Ic_yy = m*(L^2+4^2)/12; the local +Y axis is unchanged by Ry.
    close(first.inertia[1][1], 416 / 15); close(second.inertia[1][1], 58 / 15);
    const firstShoulderMoment = momentOfInertiaAboutAxis(first, { point: shoulder, direction: jointAxis });
    const secondShoulderMoment = momentOfInertiaAboutAxis(second, { point: shoulder, direction: jointAxis });
    const secondElbowMoment = momentOfInertiaAboutAxis(second, { point: elbow, direction: jointAxis });
    close(firstShoulderMoment, 1616 / 15);
    close(secondShoulderMoment, 2608 / 15 + 80 * Math.cos(radians(q2)));
    close(firstShoulderMoment + secondShoulderMoment, 1408 / 5 + 80 * Math.cos(radians(q2)));
    close(secondElbowMoment, 208 / 15);
    // No Physics solver, assembly constraints, holding controller or time evolution is exercised here.
  });
}
