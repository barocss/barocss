import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, checkBrep, brepMassProperties } from '../dist/index.js';

const sweep = bends => evaluateCadPart({
  format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {},
  features: [
    { id: 's', kind: 'sketch', profile: 'rectangle', min: [-1, -1], max: [1, 1] },
    { id: 'w', kind: 'sweep', sketch: 's', path: Array.from({ length: bends }, () => ({ kind: 'bend', radius: 8, angleDegrees: 90, toward: 'x' })) },
  ],
}).outputs[0];

function near(actual, expected, scale, label) {
  assert.ok(Math.abs(actual - expected) <= 1e-12 * scale, `${label}: ${actual} vs ${expected}`);
}

// Integrate the annular sector r=7..9, y=-1..1, theta=0..angle with dV=r dr dy dtheta.
// x=8-r*cos(theta), z=r*sin(theta). No kernel geometry or mass routine supplies the oracle.
function sectorMass(angle, density) {
  const volumeMM3 = 32 * angle, massKG = volumeMM3 * density * 1e-9;
  const radialMean = 193 / 24, radialSecond = 65;
  const dx = -radialMean * Math.sin(angle) / angle, z = radialMean * (1 - Math.cos(angle)) / angle;
  const xx = radialSecond * (0.5 + Math.sin(2 * angle) / (4 * angle)) - dx * dx;
  const zz = radialSecond * (0.5 - Math.sin(2 * angle) / (4 * angle)) - z * z;
  const xz = -radialSecond * Math.sin(angle) ** 2 / (2 * angle) - dx * z;
  const k = massKG * 1e-6;
  return { volumeMM3, massKG, centroidMM: [8 + dx, 0, z], inertiaCentroidKgM2: [
    [k * (1 / 3 + zz), 0, -k * xz],
    [0, k * (xx + zz), 0],
    [-k * xz, 0, k * (xx + 1 / 3)],
  ] };
}

function checkMass(actual, expected, label) {
  near(actual.volumeMM3, expected.volumeMM3, expected.volumeMM3, `${label} volume`);
  near(actual.massKG, expected.massKG, expected.massKG, `${label} mass`);
  for (let i = 0; i < 3; i++) {
    near(actual.centroidMM[i], expected.centroidMM[i], 8, `${label} centroid ${i}`);
    for (let j = 0; j < 3; j++) near(actual.inertiaCentroidKgM2[i][j], expected.inertiaCentroidKgM2[i][j], expected.inertiaCentroidKgM2[1][1], `${label} inertia ${i}${j}`);
  }
}

test('overlapping fifth bend has the final annulus mass, centroid and inertia, as does the four-bend control', () => {
  for (const bends of [5, 4]) {
    const out = sweep(bends);
    assert.deepEqual(checkBrep(out.brep).issues, []);
    assert.equal(out.bodyCount, 1);
    for (const density of [1, 7850]) {
      const mass = out.massProperties(density), expected = sectorMass(2 * Math.PI, density);
      checkMass(mass, expected, `${bends} bends`);
      checkMass(mass, brepMassProperties(out.brep, density), `${bends} bends B-rep`);
    }
  }
});

test('non-overlapping two-bend control retains closed-form mass and the semicircle inertia tensor', () => {
  const out = sweep(2);
  assert.deepEqual(checkBrep(out.brep).issues, []);
  const mass = out.massProperties(7850);
  assert.equal(mass.method, 'closed-form');
  checkMass(mass, sectorMass(Math.PI, 7850), 'two bends');
  checkMass(mass, brepMassProperties(out.brep, 7850), 'two bends B-rep');
});
