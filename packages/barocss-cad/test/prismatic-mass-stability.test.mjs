import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { prismaticExtrude, prismaticMassProperties, isSolidMassError } from '../dist/index.js';
import { rational, add, sub, mul, div, abs, compare, fromNumber, bits, stepStored, longitudinal, rectangularMass, text } from './helpers/prismatic-mass-oracle.mjs';

const observations = [];
after(() => {
  if (process.env.D343_EVIDENCE_DIR) writeFileSync(join(process.env.D343_EVIDENCE_DIR, 'observations.json'), JSON.stringify(observations, null, 2) + '\n');
});
const line = (a, b) => ({ kind: 'line', a, b });
const rectangle = ([x0, y0, x1, y1]) => [line([x0, y0], [x1, y0]), line([x1, y0], [x1, y1]), line([x1, y1], [x0, y1]), line([x0, y1], [x0, y0])];
function freeze(value) { if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } }
function nearExact(actual, expected, tolerance, label) {
  assert.ok(Number.isFinite(actual), `${label}: nonfinite ${actual}`);
  assert.ok(compare(abs(sub(fromNumber(actual), expected)), tolerance) <= 0, `${label}: ${actual} differs from ${JSON.stringify(text(expected))}`);
}
function sameBits(actual, expected, label) { assert.equal(bits(actual), bits(expected), `${label}: ${actual} != ${expected}`); }
function singleRectangle(z0, z1, rect = [-1, -1, 1, 1]) {
  const solid = prismaticExtrude([rectangle(rect)], z0, z1); sameBits(solid.slabs[0].z0, z0, 'stored lower endpoint'); sameBits(solid.slabs[0].z1, z1, 'stored upper endpoint'); return solid;
}
function verifyNormal(label, z0, z1, density = 7.85) {
  const solid = singleRectangle(z0, z1), before = JSON.stringify(solid); freeze(solid);
  const result = prismaticMassProperties(solid, density), oracle = rectangularMass([{ z0, z1, rect: [-1, -1, 1, 1] }], density);
  const ulp = abs(sub(fromNumber(stepStored(z0, 1)), fromNumber(z0))), tolerance = mul(rational(8n), ulp);
  observations.push({ label, input: { z0, z1, density }, result, volumeBits: bits(result.volume).toString(16), massBits: bits(result.mass).toString(16), expectedCentroid: oracle.centroid.map(text), normalTolerance: text(tolerance) });
  assert.equal(JSON.stringify(solid), before, 'mass query must not change its exact input section or endpoints');
  assert.equal(result.method, 'closed-form'); assert.ok(result.volume > 0 && Number.isFinite(result.volume));
  sameBits(result.volume, 4 * (z1 - z0), 'unchanged stored volume path'); sameBits(result.mass, density * (4 * (z1 - z0)) * 1e-3, 'unchanged stored mass path');
  assert.ok(result.centroid[2] >= z0 && result.centroid[2] <= z1, `${label}: normal centroid ${result.centroid[2]} is outside [${z0},${z1}]`);
  result.centroid.forEach((value, k) => nearExact(value, oracle.centroid[k], tolerance, `${label} centroid${k}`));
  return result;
}

test('prismatic mass: captured translated close-world interval retains physical centroid and original volume bits', t => {
  const z0 = 0.3456789, z1 = 0.34567890000000023, result = verifyNormal('captured-positive', z0, z1);
  t.diagnostic(JSON.stringify({ z0, z1, result, exactFirstLongitudinalIntegral: text(longitudinal(z0, z1, 1)) }));
});
test('prismatic mass: reflected captured interval and ordinary translated siblings retain closed-interval centroids', () => {
  verifyNormal('captured-negative', -0.34567890000000023, -0.3456789);
  verifyNormal('translated-positive-wide', 0.3456789, 0.3466789);
  verifyNormal('translated-negative-wide', -0.3466789, -0.3456789);
});
for (const magnitude of [0.3456789, 1, 1024, 9999]) for (const sign of [-1, 1]) for (const steps of [1, 2, 4, 16]) {
  const z0 = sign * magnitude, z1 = stepStored(z0, steps);
  test(`prismatic mass: ${steps} stored-step gap near ${z0} preserves normal interval`, () => verifyNormal(`ulp-${z0}-${steps}`, z0, z1));
}
for (const [z0, z1] of [[0, 1], [-1, 0], [-1, 1], [2, 5], [-5, -2], [1000, 1000.25]]) {
  test(`prismatic mass: ordinary interval[${z0},${z1}] agrees with independent full tensor and density units`, () => {
    const rect = [-2, -1, 3, 2], solid = singleRectangle(z0, z1, rect), before = JSON.stringify(solid); freeze(solid);
    const density = 7.85, actual = prismaticMassProperties(solid, density), oracle = rectangularMass([{ z0, z1, rect }], density), tolerance = fromNumber(1e-7);
    assert.equal(actual.method, 'closed-form'); nearExact(actual.volume, oracle.volume, tolerance, 'volume'); nearExact(actual.mass, oracle.mass, tolerance, 'mass g');
    actual.centroid.forEach((value, k) => nearExact(value, oracle.centroid[k], tolerance, `centroid${k}`));
    actual.inertia.forEach((row, i) => row.forEach((value, j) => nearExact(value, oracle.inertia[i][j], tolerance, `inertia${i}${j}`)));
    assert.equal(JSON.stringify(solid), before); observations.push({ label: `ordinary-${z0}-${z1}`, actual, expectedInertia: oracle.inertia.map(row => row.map(text)) });
  });
}
for (const secondStart of [-1, 1]) {
  test(`prismatic mass: unequal-area ${secondStart === -1 ? 'adjoining' : 'disjoint'} slabs use weighted moments, not the global midpoint`, () => {
    const fixtures = [{ z0: -2, z1: -1, rect: [-1, -1, 1, 1] }, { z0: secondStart, z1: 3, rect: [2, 0, 6, 3] }];
    const solid = { kind: 'prismatic-solid', slabs: fixtures.flatMap(s => singleRectangle(s.z0, s.z1, s.rect).slabs) }, before = JSON.stringify(solid); freeze(solid);
    const actual = prismaticMassProperties(solid, 1), oracle = rectangularMass(fixtures, 1), tolerance = fromNumber(1e-7), overallMidpoint = div(add(fromNumber(-2), fromNumber(3)), rational(2n));
    assert.notEqual(compare(oracle.centroid[2], overallMidpoint), 0); nearExact(actual.centroid[2], oracle.centroid[2], fromNumber(1e-12), 'weighted normal centroid');
    assert.ok(actual.centroid[2] >= -2 && actual.centroid[2] <= 3); nearExact(actual.volume, oracle.volume, tolerance, 'weighted volume');
    actual.inertia.forEach((row, i) => row.forEach((value, j) => nearExact(value, oracle.inertia[i][j], tolerance, `weighted inertia${i}${j}`)));
    const originalVolumePath = 4 * (-1 - -2) + 12 * (3 - secondStart); sameBits(actual.volume, originalVolumePath, 'weighted unchanged volume bits'); sameBits(actual.mass, originalVolumePath * 1e-3, 'weighted unchanged mass bits');
    assert.equal(JSON.stringify(solid), before); observations.push({ label: `weighted-${secondStart}`, actual, exactWeightedCentroid: oracle.centroid.map(text) });
  });
}
test('prismatic mass: native circle with explicit captured levels retains symmetry without treating pi as an exact rational', () => {
  const z0 = 0.3456789, z1 = 0.34567890000000023, radius = 3;
  const ring = [{ kind: 'arc', c: [0, 0], r: radius, t0: 0, sweep: Math.PI }, { kind: 'arc', c: [0, 0], r: radius, t0: Math.PI, sweep: Math.PI }];
  const solid = prismaticExtrude([ring], z0, z1), before = JSON.stringify(solid); freeze(solid); sameBits(solid.slabs[0].z0, z0, 'circle lower'); sameBits(solid.slabs[0].z1, z1, 'circle upper');
  const actual = prismaticMassProperties(solid, 1), exactMidpoint = div(add(fromNumber(z0), fromNumber(z1)), rational(2n)), guideVolume = Math.PI * radius * radius * (z1 - z0);
  observations.push({ label: 'captured-circle', actual, exactNormalMidpoint: text(exactMidpoint), guideVolume });
  assert.equal(actual.method, 'closed-form'); assert.ok(actual.volume > 0 && Number.isFinite(actual.volume)); assert.ok(actual.centroid[2] >= z0 && actual.centroid[2] <= z1);
  nearExact(actual.centroid[2], exactMidpoint, fromNumber(1e-7), 'circle normal midpoint');
  nearExact(actual.volume, fromNumber(guideVolume), fromNumber(Math.abs(guideVolume) * 1e-12), 'rounded pi volume guide'); assert.equal(JSON.stringify(solid), before);
});
test('prismatic mass: existing density and empty-volume refusals remain unchanged', () => {
  const solid = singleRectangle(0, 1);
  for (const density of [0, -1, NaN, Infinity]) assert.throws(() => prismaticMassProperties(solid, density), e => isSolidMassError(e) && /positive finite density/.test(e.message));
  assert.throws(() => prismaticMassProperties({ kind: 'prismatic-solid', slabs: [] }, 1), e => isSolidMassError(e) && /no positive volume/.test(e.message));
});
