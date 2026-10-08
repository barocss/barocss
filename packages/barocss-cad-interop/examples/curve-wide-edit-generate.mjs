import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { compileCadModel, editCurveControlPolygonWide,
  validateWideCurveControlPolygonEdit } from '@barocss/cad';
import { parseBaroCadSource } from '../dist/native.js';

const originalPath = new URL('./curve-operations-data/refined.barocad', import.meta.url);
const editedPath = new URL('./curve-wide-edit-data/edited.barocad', import.meta.url);
const originalSource = readFileSync(originalPath, 'utf8');
const originalBytes = Buffer.from(originalSource, 'utf8');
const compiled = compileCadModel(originalSource, { sourceVersion: 0 });
assert.equal(compiled.ok, true, JSON.stringify(compiled.diagnostics));
assert.equal(compiled.model.objects.length, 1);
const original = compiled.model.objects[0];
assert.equal(original.kind, 'curve');
assert.equal(original.degree, 3);
assert.equal(original.controlPoints.length, 64);
assert.equal(original.knots.length, 68);
const edits = { poleEdits: [
  { index: 5, yMM: original.controlPoints[5][1] + 0.125 },
  { index: 63, weight: 1.5 },
] };
const result = editCurveControlPolygonWide(original, edits);
assert.deepEqual(validateWideCurveControlPolygonEdit(result), result.report);
assert.equal(result.report.changedPoleCount, 2);
assert.equal(result.report.changedFieldCount, 2);
assert.equal(result.curve.id, original.id);
assert.equal(result.curve.degree, original.degree);
assert.deepEqual(result.curve.knots, original.knots);
assert.equal(result.curve.controlPoints.length, 64);
assert.ok(Object.is(result.curve.controlPoints[0][0], -0));
for (let index = 0; index < 64; index++) {
  for (let axis = 0; axis < 3; axis++) {
    if (index === 5 && axis === 1) continue;
    assert.ok(Object.is(result.curve.controlPoints[index][axis],
      original.controlPoints[index][axis]), `unchanged pole ${index}/${axis}`);
  }
  if (index !== 63) assert.ok(Object.is(result.curve.weights[index], original.weights[index]));
}
assert.equal(result.curve.controlPoints[5][1], edits.poleEdits[0].yMM);
assert.equal(result.curve.weights[63], 1.5);
assert.ok(result.source !== originalSource);
assert.deepEqual(readFileSync(originalPath), originalBytes);
if (process.argv.includes('--write')) writeFileSync(editedPath, result.source);
else assert.equal(readFileSync(editedPath, 'utf8'), result.source);
const displayOptions = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
  curveDisplay: { version: 1, chordToleranceMM: 0.02, maxSegments: 512, maxDepth: 16 } };
const before = parseBaroCadSource(originalSource, displayOptions);
const after = parseBaroCadSource(result.source, displayOptions);
assert.equal(before.curves.length, 1);
assert.equal(after.curves.length, 1);
assert.equal(before.curves[0].curveId, after.curves[0].curveId);
assert.equal(before.model.objects[0].controlPoints.length, 64);
assert.equal(after.model.objects[0].controlPoints.length, 64);
assert.equal(before.curves[0].sample.pointsMM.length, 91);
assert.equal(after.curves[0].sample.pointsMM.length, 89);
assert.equal(before.curves[0].sample.segments.length, 90);
assert.equal(after.curves[0].sample.segments.length, 88);
assert.ok(before.curves[0].positions.some((value, index) =>
  !Object.is(value, after.curves[0].positions[index])));
assert.deepEqual(readFileSync(originalPath), originalBytes);
const sha = source => createHash('sha256').update(source).digest('hex');
console.log(JSON.stringify({
  originalId: original.id, editedId: result.curve.id,
  originalSourceSha256: sha(originalSource), editedSourceSha256: sha(result.source),
  originalSourceBytes: originalBytes.length, editedSourceBytes: Buffer.byteLength(result.source),
  originalSamples: before.curves[0].sample.pointsMM.length,
  editedSamples: after.curves[0].sample.pointsMM.length,
  changedFields: result.report.changedFieldCount,
  signedZeroRetained: Object.is(result.curve.controlPoints[0][0], -0),
}));
