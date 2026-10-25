import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { solidMassFromIntegrals, combineMassProperties, evaluateCadPart, massPropertiesOf, brepMassProperties, revolveMassProperties } from '../dist/index.js';
import { readNativeSIInertia } from '../dist/internal/native-si-mass.js';

const cubeIntegrals = [1000, 5000, 5000, 5000, 100000 / 3, 100000 / 3, 100000 / 3, 25000, 25000, 25000];
const close = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) <= tolerance, `${a} vs ${b}`);
const rectangle = { id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] };
const extrude = { id: 'e', kind: 'extrude', sketch: 's', height: 10 };
const part = features => evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });

test('native SI lookup preserves the public MMGS cube and actual density', () => {
  for (const density of [1, 2.7, 7.85]) {
    const props = solidMassFromIntegrals(cubeIntegrals, density, 'closed-form');
    const before = structuredClone(props), keys = Object.keys(props);
    const result = readNativeSIInertia(props);
    assert.equal(result.ok, true); assert.equal(result.density, density);
    assert.deepEqual(Object.keys(props), ['volume', 'mass', 'centroid', 'method', 'inertia']);
    assert.deepEqual(Object.keys(props), keys); assert.deepEqual(props, before);
    assert.equal(props.volume, 1000); close(props.mass, density);
    assert.deepEqual(props.centroid, [5, 5, 5]);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      close(props.inertia[i][j], i === j ? density * 100 / 6 : 0);
      close(result.inertia[i][j], i === j ? density * 100 / 6 * 1e-9 : 0, 1e-20);
    }
    assert.equal(readNativeSIInertia(props), result, 'repeat lookup reuses the private result');
    assert.equal(Object.isFrozen(props), false, 'do not change public object mutability');
  }
});

test('native SI applies the former density coefficient before rounding to MMGS', () => {
  const sum = 84160467.257164;
  const props = solidMassFromIntegrals([1, 0, 0, 0, 0, sum, 0, 0, 0, 0], 2.7, 'closed-form');
  const result = readNativeSIInertia(props);
  assert.equal(result.ok, true);
  assert.equal(result.inertia[0][0], (2700 * 1e-15) * sum);
  assert.equal(result.inertia[0][0], 0.0002272332615943428);
  assert.notEqual(result.inertia[0][0], props.inertia[0][0] * 1e-9);
  assert.equal(Object.is(result.inertia[0][1], -0), true);
  assert.deepEqual(props.inertia[0], [0.0027 * sum, -0, -0]);
});

test('invalid density and volume keep the existing typed refusal', () => {
  for (const density of [0, -1, NaN, Infinity]) assert.throws(() => solidMassFromIntegrals(cubeIntegrals, density, 'closed-form'), e => e.code === 'SOLID_MASS');
  assert.throws(() => solidMassFromIntegrals([0, ...cubeIntegrals.slice(1)], 2.7, 'closed-form'), e => e.code === 'SOLID_MASS');
});

test('a clone or fabricated mass result cannot claim native SI provenance', () => {
  const props = solidMassFromIntegrals(cubeIntegrals, 2.7, 'closed-form');
  for (const copy of [{ ...props }, structuredClone(props)]) assert.deepEqual(readNativeSIInertia(copy), { ok: false, code: 'NATIVE_SI_PROVENANCE_UNAVAILABLE', reason: 'untracked' });
});

test('combined public mass remains physical and reports its unsupported SI order explicitly', () => {
  const props = solidMassFromIntegrals(cubeIntegrals, 2.7, 'closed-form');
  const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const combined = combineMassProperties([{ props, axes, offset: [0, 0, 0] }, { props, axes, offset: [20, 0, 0] }]);
  close(combined.volume, 2000); close(combined.mass, 5.4);
  combined.centroid.forEach((x, i) => close(x, [15, 5, 5][i]));
  [90, 630, 630].forEach((x, i) => close(combined.inertia[i][i], x));
  assert.deepEqual(readNativeSIInertia(combined), { ok: false, code: 'NATIVE_SI_PROVENANCE_UNAVAILABLE', reason: 'combined' });
});

test('part mass passes integral provenance while a transformed exact result is explicit', () => {
  const plain = massPropertiesOf(part([rectangle, extrude]).outputs.at(-1), 2.7);
  assert.equal(readNativeSIInertia(plain).ok, true);
  const moved = massPropertiesOf(part([rectangle, extrude, { id: 'r', kind: 'rotate', target: 'e', axis: 'z', angle: 90 }]).outputs.at(-1), 2.7);
  close(moved.volume, 1000); close(moved.mass, 2.7);
  assert.deepEqual(readNativeSIInertia(moved), { ok: false, code: 'NATIVE_SI_PROVENANCE_UNAVAILABLE', reason: 'transformed' });
});

test('revolved mass is not silently reinterpreted as an integral result', () => {
  const input = { profile: [[10, 0], [20, 0], [20, 10], [10, 10]].map(start => ({ kind: 'line', start })), axis: { origin: [0, 0], direction: [0, 1] }, angle: 360 };
  const props = revolveMassProperties(input, 2.7);
  close(props.volume, Math.PI * (400 - 100) * 10);
  assert.deepEqual(readNativeSIInertia(props), { ok: false, code: 'NATIVE_SI_PROVENANCE_UNAVAILABLE', reason: 'revolved' });
  const o = part([{ id: 'c', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 10 }, { id: 'x', kind: 'extrude', sketch: 'c', height: 10 }]).outputs.at(-1);
  const tessellated = brepMassProperties(o.brep, 2.7, { quadratureSegments: 0, segmentsPerQuarter: 4 });
  assert.equal(tessellated.method, 'tessellated');
  assert.equal(typeof tessellated.volumeBound, 'number');
  assert.equal(readNativeSIInertia(tessellated).ok, true, 'metadata-only volumeBound wrapper retains provenance');
});

test('package source and emitted internal entries share the same mass module', () => {
  const p = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(p.exports['./internal/native-si-mass'].import, './src/internal/native-si-mass.ts');
  assert.equal(p.publishConfig.exports['./internal/native-si-mass'].import, './dist/internal/native-si-mass.js');
  assert.equal(readNativeSIInertia(solidMassFromIntegrals(cubeIntegrals, 2.7, 'closed-form')).ok, true);
});
