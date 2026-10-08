import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { buildThreeSectionLoftSurface, compileCadModel, editCurveControlPolygonWide,
  evaluateSurface, validateThreeSectionLoftSurface, validateWideCurveControlPolygonEdit } from '@barocss/cad';
import { parseBaroCadSource } from '../dist/native.js';

const sectionsPath = new URL('./loft-three-data/sections.barocad', import.meta.url);
const originalPath = new URL('./loft-three-data/loft.barocad', import.meta.url);
const editedMiddlePath = new URL('./loft-three-data/edited_middle.barocad', import.meta.url);
const editedLoftPath = new URL('./loft-three-data/edited_loft.barocad', import.meta.url);
const sectionsBytes = readFileSync(sectionsPath), originalBytes = readFileSync(originalPath);
const compiled = compileCadModel(sectionsBytes.toString('utf8'), { sourceVersion: 0 });
assert.equal(compiled.ok, true, JSON.stringify(compiled.diagnostics));
assert.deepEqual(compiled.model.objects.map(object => object.id),
  ['first_equal', 'middle_equal', 'last_equal']);
const [first, middle, last] = compiled.model.objects;
assert.ok([first, middle, last].every(object => object.kind === 'curve'));
const original = buildThreeSectionLoftSurface(first, middle, last,
  { surfaceId: 'equal_curved_middle_surface' });
assert.deepEqual(validateThreeSectionLoftSurface(original), original.report);
assert.equal(original.source, originalBytes.toString('utf8'));

const edit = editCurveControlPolygonWide(middle, { poleEdits: [{ index: 1, zMM: 3.25 }] });
assert.deepEqual(validateWideCurveControlPolygonEdit(edit), edit.report);
assert.equal(edit.report.changedPoleCount, 1);
assert.equal(edit.report.changedFieldCount, 1);
assert.equal(edit.curve.id, middle.id);
assert.equal(edit.curve.degree, middle.degree);
assert.deepEqual(edit.curve.knots, middle.knots);
assert.deepEqual(edit.curve.weights, middle.weights);
assert.equal(edit.curve.controlPoints[1][2], 3.25);
for (const [index, pole] of middle.controlPoints.entries()) for (let axis = 0; axis < 3; axis++) {
  if (index === 1 && axis === 2) continue;
  assert.ok(Object.is(edit.curve.controlPoints[index][axis], pole[axis]));
}
assert.ok(Object.is(edit.curve.controlPoints[0][0], -0));
const edited = buildThreeSectionLoftSurface(first, edit.curve, last,
  { surfaceId: 'edited_middle_surface' });
assert.deepEqual(validateThreeSectionLoftSurface(edited), edited.report);
assert.deepEqual(edited.sections[0], first);
assert.deepEqual(edited.sections[1], edit.curve);
assert.deepEqual(edited.sections[2], last);
assert.deepEqual(edited.report.sectionIds, [first.id, middle.id, last.id]);
assert.deepEqual(edited.report.controlPointGrid, [3, 3]);
assert.equal(edited.report.observationCount, 9);
assert.equal(edited.report.derivativeObservationCount, 9);
assert.deepEqual(edited.model.objects.map(object => object.id),
  ['first_equal', 'middle_equal', 'last_equal', 'edited_middle_surface']);
assert.ok(Object.is(edited.surface.controlPoints[0][0][0], -0));
const oldPoint = evaluateSurface(original.surface, 1, 0.5);
const newPoint = evaluateSurface(edited.surface, 1, 0.5);
const middleDifferenceMM = Math.hypot(...oldPoint.map((value, axis) => value - newPoint[axis]));
assert.ok(middleDifferenceMM > 0.01);
if (process.argv.includes('--write')) {
  writeFileSync(editedMiddlePath, edit.source);
  writeFileSync(editedLoftPath, edited.source);
} else {
  assert.equal(readFileSync(editedMiddlePath, 'utf8'), edit.source);
  assert.equal(readFileSync(editedLoftPath, 'utf8'), edited.source);
}
assert.deepEqual(readFileSync(sectionsPath), sectionsBytes);
assert.deepEqual(readFileSync(originalPath), originalBytes);
const reopenedMiddle = compileCadModel(readFileSync(editedMiddlePath, 'utf8'), { sourceVersion: 0 });
assert.equal(reopenedMiddle.ok, true, JSON.stringify(reopenedMiddle.diagnostics));
assert.deepEqual(reopenedMiddle.model.objects[0], edit.curve);

const options = { sourceVersion: 0, countU: 9, countV: 9, unitsPerMillimeter: 0.001,
  curveDisplay: { version: 1, chordToleranceMM: 0.02, maxSegments: 128, maxDepth: 12 } };
const before = parseBaroCadSource(original.source, options);
const after = parseBaroCadSource(edited.source, options);
assert.equal(before.surfaces.length, 1);
assert.equal(after.surfaces.length, 1);
assert.equal(before.curves.length, 3);
assert.equal(after.curves.length, 3);
assert.deepEqual(before.model.objects.slice(0, 1), after.model.objects.slice(0, 1));
assert.deepEqual(before.model.objects.slice(2, 3), after.model.objects.slice(2, 3));
assert.ok(before.surfaces[0].mesh.positions.some((value, index) =>
  !Object.is(value, after.surfaces[0].mesh.positions[index])));
const sha = value => createHash('sha256').update(value).digest('hex');
console.log(JSON.stringify({
  originalSurfaceId: original.surface.id, editedSurfaceId: edited.surface.id,
  editedMiddleId: edit.curve.id, changedFields: edit.report.changedFieldCount,
  middleDifferenceMM, nativeObservations: edited.report.observationCount,
  nativeDerivativeStates: edited.report.derivativeObservationCount,
  sectionsSourceSha256: sha(sectionsBytes), originalSourceSha256: sha(original.source),
  editedMiddleSha256: sha(edit.source), editedLoftSha256: sha(edited.source),
  editedMiddleBytes: Buffer.byteLength(edit.source), editedLoftBytes: Buffer.byteLength(edited.source),
  originalCurveSamples: before.curves.map(curve => curve.sample.pointsMM.length),
  editedCurveSamples: after.curves.map(curve => curve.sample.pointsMM.length),
  signedZeroRetained: Object.is(edit.curve.controlPoints[0][0], -0),
}));
