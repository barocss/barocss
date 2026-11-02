import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { importStep, exportStep, stepValidationProperties, evaluateCadPart, evaluateSurface } from '../dist/index.js';
import { brepBounds, stepValidationBounds } from '../dist/brep/brep-bounds.js';
import { representabilitySphereStep } from './step-sphere-representability-fixtures.mjs';

// Match the saved ordinary native input used by the independent D438 witness.
// The JSON boundary also removes private caches from this writer regression.
const sphere = JSON.parse(JSON.stringify(importStep(representabilitySphereStep({ radius: '5', center: ['0', '0', '0'], compound: false }))));
const prism = evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
  { id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [4, 3] },
  { id: 'e', kind: 'extrude', sketch: 's', height: 2 },
] }).outputs[0].brep;
const options = { name: 'D437-ordinaryR5', timestamp: '2026-11-02T00:00:00' };

test('a trimmed sphere keeps its legacy estimate but omits only the false STEP bbox declaration', () => {
  const before = structuredClone(sphere), box = brepBounds(sphere);
  assert.deepEqual(box, { min: [-5, -4.994061996270625, -5.000000000000001], max: [5.000000000000001, 4.994061996270626, 5.000000000000001] });
  // The independent exact trim certificate admits this point at (1/2,1/2).
  // This check is a regression witness, not an analytic C+-R assumption.
  const face = sphere.faces.find(f => f.name === 'literal-sphere#1');
  assert.ok(face, 'The authored witness face is present');
  const point = evaluateSurface(face.surface, 0.5, 0.5);
  assert.ok(point[1] < box.min[1], 'An admitted native point is outside the unchanged numerical estimate');
  assert.equal(stepValidationBounds(sphere), undefined);
  const text = exportStep(sphere, options), properties = stepValidationProperties(text);
  assert.equal(properties.box, undefined);
  assert.ok(properties.volume > 0 && properties.area > 0 && properties.centroid.every(Number.isFinite));
  assert.doesNotMatch(text, /REPRESENTATION\('bounding box'|CARTESIAN_POINT\('minimum point'|CARTESIAN_POINT\('maximum point'/);
  // Captured D437 bytes with only bbox entities #135..139 removed. Geometry,
  // header, units, uncertainty, volume, area and centroid must all remain exact.
  assert.equal(createHash('sha256').update(text).digest('hex'), '816838f297b4ea1f982d0b9183a57f373c87c7181ad20140dac146d6237c4e3a');
  assert.deepEqual(sphere, before, 'The writer and its private policy do not mutate native geometry');
});

test('a planar solid retains its complete validation properties and numerical bounds', () => {
  const box = { min: [0, 0, 0], max: [4, 3, 2] };
  assert.deepEqual(brepBounds(prism), box);
  assert.deepEqual(stepValidationBounds(prism), box);
  const properties = stepValidationProperties(exportStep(prism, { name: 'prism', timestamp: options.timestamp }));
  assert.deepEqual(properties.box, box);
  assert.equal(properties.volume, 24);
  assert.equal(properties.area, 52);
  assert.deepEqual(properties.centroid, [2, 1.5, 1]);
});

test('one unqualified solid suppresses the global bbox rather than declaring only the other solid', () => {
  for (const bodies of [[prism, sphere], [sphere, prism]]) {
    const text = exportStep(bodies, { name: 'combined', timestamp: options.timestamp }), properties = stepValidationProperties(text);
    assert.equal(properties.box, undefined);
    assert.ok(properties.volume > 24 && properties.area > 52 && properties.centroid.every(Number.isFinite));
    assert.equal((text.match(/=MANIFOLD_SOLID_BREP\(/g) ?? []).length, 2);
    assert.doesNotMatch(text, /REPRESENTATION\('bounding box'/);
  }
});
