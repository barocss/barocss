import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { buildThreeSectionLoftSurface, compileCadModel, evaluateCurve, evaluateSurface,
  validateThreeSectionLoftSurface } from '@barocss/cad';
import { parseBaroCadSource } from '../dist/native.js';

const inputPath = new URL('./loft-three-data/sections.barocad', import.meta.url);
const outputPath = new URL('./loft-three-data/loft.barocad', import.meta.url);
const inputBytes = readFileSync(inputPath);
const inputSource = inputBytes.toString('utf8');
const compiled = compileCadModel(inputSource, { sourceVersion: 0 });
assert.equal(compiled.ok, true, JSON.stringify(compiled.diagnostics));
assert.equal(compiled.model.name, 'loft_sections');
assert.deepEqual(compiled.model.objects.map(object => object.id),
  ['first_equal', 'middle_equal', 'last_equal']);
const sections = compiled.model.objects;
assert.ok(sections.every(object => object.kind === 'curve'));
assert.ok(sections.every(object => object.degree === 2 && object.controlPoints.length === 3));
assert.ok(sections.every(object => Object.is(object.knots[0], -0)));
assert.ok(Object.is(sections[0].controlPoints[0][0], -0));
assert.notEqual(sections[1].controlPoints[1][1],
  (sections[0].controlPoints[1][1] + sections[2].controlPoints[1][1]) / 2);

const result = buildThreeSectionLoftSurface(...sections,
  { surfaceId: 'equal_curved_middle_surface' });
assert.deepEqual(validateThreeSectionLoftSurface(result), result.report);
assert.equal(result.surface.id, 'equal_curved_middle_surface');
assert.equal(result.surface.degreeU, 2);
assert.equal(result.surface.degreeV, 2);
assert.deepEqual(result.surface.knotsV, [0, 0, 0, 1, 1, 1]);
assert.deepEqual(result.provenance.sectionIds, sections.map(section => section.id));
assert.deepEqual(result.provenance.sectionParameters, [0, 0.5, 1]);
assert.equal(result.report.observationCount, 9);
assert.equal(result.report.derivativeObservationCount, 9);
assert.deepEqual(result.model.objects.map(object => object.id),
  ['first_equal', 'middle_equal', 'last_equal', 'equal_curved_middle_surface']);
assert.ok(Object.is(result.surface.controlPoints[0][0][0], -0));
for (const u of [0, 1, 2]) for (const [index, v] of [0, 0.5, 1].entries()) {
  const sectionPoint = evaluateCurve(sections[index], u);
  const surfacePoint = evaluateSurface(result.surface, u, v);
  assert.ok(Math.hypot(...surfacePoint.map((value, axis) => value - sectionPoint[axis])) < 1e-7);
}
if (process.argv.includes('--write')) writeFileSync(outputPath, result.source);
else assert.equal(readFileSync(outputPath, 'utf8'), result.source);
assert.deepEqual(readFileSync(inputPath), inputBytes);

const options = { sourceVersion: 0, countU: 9, countV: 9, unitsPerMillimeter: 0.001,
  curveDisplay: { version: 1, chordToleranceMM: 0.02, maxSegments: 128, maxDepth: 12 } };
const display = parseBaroCadSource(result.source, options);
assert.equal(display.model.objects.length, 4);
assert.equal(display.surfaces.length, 1);
assert.equal(display.curves.length, 3);
assert.deepEqual(display.curves.map(curve => curve.curveId), sections.map(section => section.id));
assert.equal(display.surfaces[0].surfaceId, result.surface.id);
assert.deepEqual(display.unrenderedCurveIds, []);
const sha = value => createHash('sha256').update(value).digest('hex');
console.log(JSON.stringify({
  originalIds: sections.map(section => section.id), surfaceId: result.surface.id,
  inputSourceSha256: sha(inputSource), loftSourceSha256: sha(result.source),
  inputSourceBytes: inputBytes.length, loftSourceBytes: Buffer.byteLength(result.source),
  surfaceGrid: result.report.controlPointGrid,
  nativeObservations: result.report.observationCount,
  nativeDerivativeStates: result.report.derivativeObservationCount,
  surfacePositions: display.surfaces[0].mesh.positions.length,
  surfaceNormals: display.surfaces[0].mesh.normals.length,
  surfaceIndices: display.surfaces[0].mesh.indices.length,
  surfaceParameters: display.surfaces[0].mesh.parameters.length,
  curveSamples: display.curves.map(curve => curve.sample.pointsMM.length),
  signedZeroRetained: Object.is(result.surface.controlPoints[0][0][0], -0),
}));
