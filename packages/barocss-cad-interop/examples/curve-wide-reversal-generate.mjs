import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { compileCadModel, reverseCurveWide, validateWideReversedCurveResult } from '@barocss/cad';
import { parseBaroCadSource } from '../dist/native.js';

const originalPath = new URL('./curve-wide-edit-data/edited.barocad', import.meta.url);
const reversedPath = new URL('./curve-wide-reversal-data/reversed.barocad', import.meta.url);
const originalBytes = readFileSync(originalPath);
const originalSource = originalBytes.toString('utf8');
const compiled = compileCadModel(originalSource, { sourceVersion: 0 });
assert.equal(compiled.ok, true, JSON.stringify(compiled.diagnostics));
assert.equal(compiled.model.objects.length, 1);
const original = compiled.model.objects[0];
assert.equal(original.kind, 'curve');
assert.equal(original.id, 'joined_refined_64');
assert.equal(original.controlPoints.length, 64);
assert.equal(original.knots.length, 68);
const reversed = reverseCurveWide(original, { curveId: 'joined_refined_64_reversed' });
assert.deepEqual(validateWideReversedCurveResult(reversed), reversed.report);
assert.equal(reversed.curve.id, 'joined_refined_64_reversed');
assert.equal(reversed.report.originalCurveId, original.id);
assert.equal(reversed.report.curveId, reversed.curve.id);
assert.equal(reversed.report.poleCount, 64);
assert.equal(reversed.report.knotCount, 68);
const [a, b] = [original.knots[original.degree], original.knots[original.controlPoints.length]];
assert.deepEqual(reversed.report.domain, [a, b]);
assert.deepEqual(reversed.provenance.decreasingParameterMap,
  { formula: 'u=a+(b-v)', orientation: -1, d1Factor: -1,
    endpointAssignments: { reversedStart: { reversed: a, original: b },
      reversedEnd: { reversed: b, original: a } } });
for (let index = 0; index < 64; index++) {
  const originalIndex = 63 - index;
  for (let axis = 0; axis < 3; axis++) {
    assert.ok(Object.is(reversed.curve.controlPoints[index][axis],
      original.controlPoints[originalIndex][axis]), `pole ${index}/${axis}`);
  }
  assert.ok(Object.is(reversed.curve.weights[index], original.weights[originalIndex]));
}
assert.ok(Object.is(original.controlPoints[0][0], -0));
assert.ok(Object.is(reversed.curve.controlPoints[63][0], -0));
for (const observation of [reversed.report.observations[0],
  reversed.report.observations[Math.floor(reversed.report.observations.length / 2)],
  reversed.report.observations.at(-1)]) {
  assert.ok(observation);
  assert.equal(observation.originalParameter,
    observation.reversedParameter === a ? b
      : observation.reversedParameter === b ? a
        : a + (b - observation.reversedParameter));
  assert.ok(observation.pointDifferenceMM <= reversed.report.quality.pointComparisonMM);
  if (observation.derivativeDifferenceMM !== null) {
    assert.ok(observation.expectedDerivativeMM);
    assert.ok(observation.derivativeDifferenceMM <=
      reversed.report.quality.relativeD1Comparison *
      Math.max(1, Math.hypot(...observation.expectedDerivativeMM)));
  }
}
assert.ok(reversed.report.guardCount > 0);
assert.equal(reversed.report.observationCount, reversed.report.observations.length);
assert.equal(reversed.report.guardCount, reversed.report.guards.length);
assert.ok(reversed.report.observationCount <= 256);
assert.ok(reversed.report.guardCount <= 64);
if (process.argv.includes('--write')) writeFileSync(reversedPath, reversed.source);
else assert.equal(readFileSync(reversedPath, 'utf8'), reversed.source);
assert.deepEqual(readFileSync(originalPath), originalBytes);

const options = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
  curveDisplay: { version: 1, chordToleranceMM: 0.02, maxSegments: 512, maxDepth: 16 } };
const before = parseBaroCadSource(originalSource, options);
const after = parseBaroCadSource(reversed.source, options);
assert.equal(before.curves.length, 1);
assert.equal(after.curves.length, 1);
assert.equal(before.curves[0].curveId, original.id);
assert.equal(after.curves[0].curveId, reversed.curve.id);
assert.equal(after.model.objects[0].controlPoints.length, 64);
assert.ok(after.curves[0].sample.pointsMM.length > 16);
const sha = source => createHash('sha256').update(source).digest('hex');
console.log(JSON.stringify({
  originalId: original.id, reversedId: reversed.curve.id,
  originalSourceSha256: sha(originalSource), reversedSourceSha256: sha(reversed.source),
  originalSourceBytes: originalBytes.length, reversedSourceBytes: Buffer.byteLength(reversed.source),
  originalSamples: before.curves[0].sample.pointsMM.length,
  reversedSamples: after.curves[0].sample.pointsMM.length,
  originalSegments: before.curves[0].sample.segments.length,
  reversedSegments: after.curves[0].sample.segments.length,
  nativeObservations: reversed.report.observationCount,
  nativeGuards: reversed.report.guardCount,
  signedZeroRetained: Object.is(reversed.curve.controlPoints[63][0], -0),
}));
