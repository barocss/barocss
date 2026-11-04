import test from 'node:test';
import assert from 'node:assert/strict';
import { part as modelPart, BarocssError as ModelError } from '@barocss/cad-model/api';
import { part as cadPart, BarocssError, type MassResult } from '@barocss/cad/api';
import { bodiesOf, massOf } from '@barocss/cad-model/api/core';

// Declared package entries compiled from workspace source; this is not packed-package consumer proof.
const invalid = [
  ['zero', 0], ['negative zero', -0], ['negative', -1], ['NaN', NaN], ['positive infinity', Infinity], ['negative infinity', -Infinity],
] as const;
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
function densityError(run: () => unknown) {
  assert.throws(run, error => {
    assert.ok(error instanceof BarocssError); assert.ok(error instanceof ModelError);
    assert.equal(error.code, 'DENSITY'); assert.equal(error.where, 'facade');
    assert.match(error.message, /^\[DENSITY\].*positive/); return true;
  });
}
const factories = {
  Model: () => modelPart('Density box').box({ w: 10, d: 20, h: 30 }),
  CAD: () => cadPart('Density box').box({ w: 10, d: 20, h: 30 }),
};
for (const [facade, make] of Object.entries(factories)) {
  for (const [name, density] of invalid) {
    test(`${facade} declared public mass refuses ${name} with the shared typed DENSITY contract`, () => {
      const p = make(), doc = structuredClone(p.doc);
      densityError(() => p.mass({ density })); assert.deepEqual(p.doc, doc);
      // Refusal does not poison an otherwise valid part or its later mass read.
      close(p.mass({ density: 1 }).mass, 6); assert.deepEqual(p.doc, doc);
    });
  }
  for (const density of [1, 2.7, 7.85]) {
    test(`${facade} density ${density} retains analytic MMGS mass, inertia, volume and centroid`, () => {
      const p = make(), doc = structuredClone(p.doc), result = p.mass({ density });
      const expectedMass = 6 * density;
      assert.deepEqual(Object.keys(result), ['volume', 'mass', 'centroid', 'inertia']);
      close(result.volume, 6000); close(result.mass, expectedMass); result.centroid.forEach((value, i) => close(value, [5, 10, 15][i]));
      const diagonal = [expectedMass * (20 ** 2 + 30 ** 2) / 12, expectedMass * (10 ** 2 + 30 ** 2) / 12, expectedMass * (10 ** 2 + 20 ** 2) / 12];
      result.inertia.forEach((row, i) => row.forEach((value, j) => close(value, i === j ? diagonal[i] : 0)));
      const baseline = p.mass({ density: 2.7 });
      assert.equal(result.volume, baseline.volume); assert.deepEqual(result.centroid, baseline.centroid);
      baseline.inertia.forEach((row, i) => row.forEach((value, j) => close(result.inertia[i][j], value * density / 2.7)));
      assert.deepEqual(p.doc, doc);
    });
  }
}

test('Model default material and explicit density retain the same public mass result', () => {
  const p = modelPart().box({ w: 10, d: 20, h: 30 }).material('al6061'), doc = structuredClone(p.doc);
  assert.deepEqual(p.mass(), p.mass('al6061')); assert.deepEqual(p.mass(), p.mass({ density: 2.7 }));
  assert.deepEqual(p.doc, doc);
});

test('Model core density validation and mass reads do not mutate the evaluated body or source document', () => {
  const p = modelPart().box({ w: 10, d: 20, h: 30 }), doc = structuredClone(p.doc), body = bodiesOf(p.doc)[0], before = structuredClone(body);
  for (const [, density] of invalid) { densityError(() => massOf(body, density)); assert.deepEqual(body, before); }
  const results: MassResult[] = [1, 2.7, 7.85].map(density => massOf(body, density));
  assert.ok(results.every(result => Number.isFinite(result.mass) && result.mass > 0));
  assert.deepEqual(body, before); assert.deepEqual(p.doc, doc);
});

test('valid density still refuses an unknown-volume body with MASS_UNKNOWN', () => {
  const p = modelPart().box({ w: 10, d: 20, h: 30 });
  const body = { ...structuredClone(bodiesOf(p.doc)[0]), volume: null, mass: null }, before = structuredClone(body);
  assert.throws(() => massOf(body, 2.7), error => {
    assert.ok(error instanceof BarocssError); assert.equal(error.code, 'MASS_UNKNOWN'); assert.equal(error.where, 'evaluate'); return true;
  });
  assert.deepEqual(body, before);
});

test('invalid density is refused before an unknown-volume body can enter mass calculation', () => {
  const p = modelPart().box({ w: 10, d: 20, h: 30 });
  const body = { ...structuredClone(bodiesOf(p.doc)[0]), volume: null, mass: null }, before = structuredClone(body);
  densityError(() => massOf(body, 0)); assert.deepEqual(body, before);
});
