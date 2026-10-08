import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createCadGeometryReference, queryCadDocumentCurveArcLength,
  validateCadDocumentCurveArcLength } from '@barocss/cad';
import { parseBaroCadDocument, prepareBaroCadDocumentPrimitiveNativeRefsV2 } from '../dist/document.js';
import { createBaroCadDocumentThreeDisplay } from '../dist/three-document.js';

const bytes = readFileSync(new URL('./curve-arc-length-data/revision1.cad-document.json', import.meta.url));
const sha = createHash('sha256').update(bytes).digest('hex');
assert.equal(bytes.length, 3027);
assert.equal(sha, '6422e2aeeb8560af86b41e8a60c70cddec01f42ef43c3ac93789c6407a186f84');
const document = parseBaroCadDocument(bytes.toString('utf8'));
assert.equal(document.document.documentId, 'arc_length_doc');
assert.equal(document.document.revision, 1);
const { reference } = createCadGeometryReference(document, { bodyId: 'quarter_body' });
assert.equal(reference.assetId, 'quarter_asset');
assert.equal(reference.assetRevision, 1);
assert.equal(reference.geometryId, 'quarter_original');
const options = { interval: null, absoluteToleranceMM: 1e-7, relativeTolerance: 1e-8,
  maximumEvaluations: 4096, maximumSubdivisions: 128, maximumDepth: 12 };
const length = queryCadDocumentCurveArcLength(document, reference, options);
assert.deepEqual(validateCadDocumentCurveArcLength(document, length), length.report);
assert.equal(length.source, document.document.assets.find(asset => asset.id === 'quarter_asset').source);
assert.deepEqual(length.geometry.controlPoints, [[2, 0, 0], [2, 2, 0], [0, 2, 0]]);
assert.deepEqual(length.geometry.knots, [0, 0, 0, 1, 1, 1]);
assert.equal(length.geometry.weights[1], Math.SQRT1_2);
assert.deepEqual(length.report.originalDomain, [0, 1]);
assert.deepEqual(length.report.interval, [0, 1]);
assert.equal(length.report.criterion, 'aggregate-panel-estimator-not-certified-upper-bound');
assert.equal(length.report.quality.globalErrorCertified, false);
assert.ok(Math.abs(length.estimatedLengthMM - Math.PI) < 1e-6);
assert.ok(length.errorEstimateMM > 0 && length.errorEstimateMM <= 1e-7);

const native = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
  curveDisplay: { version: 1, chordToleranceMM: 0.02, maxSegments: 512, maxDepth: 16 } };
const request = { native, basis: 'authored-xyz-matches-rhyup', bodyIds: ['quarter_body'] };
const projection = prepareBaroCadDocumentPrimitiveNativeRefsV2(document, request);
const display = createBaroCadDocumentThreeDisplay(document, request);
let displayChordMM;
try {
  assert.equal(projection.length, 1);
  assert.equal(projection[0].kind, 'curve');
  assert.equal(display.bindings.length, 1);
  const binding = display.bindings[0], sample = projection[0].sample;
  assert.equal(binding.bodyId, reference.bodyId);
  assert.equal(binding.assetId, reference.assetId);
  assert.equal(binding.assetRevision, reference.assetRevision);
  assert.equal(binding.geometryId, reference.geometryId);
  assert.equal(binding.object.name, reference.geometryId);
  assert.ok(binding.object.isLine);
  const expected = Float32Array.from(sample.pointsMM.flat(), value => Math.fround(value * native.unitsPerMillimeter));
  assert.deepEqual([...binding.object.geometry.getAttribute('position').array], [...expected]);
  assert.deepEqual(binding.object.userData.barocss.nativeParameters, sample.parameters);
  displayChordMM = sample.pointsMM.slice(1).reduce((sum, point, index) =>
    sum + Math.hypot(...point.map((value, axis) => value - sample.pointsMM[index][axis])), 0);
  assert.ok(displayChordMM < length.estimatedLengthMM - 0.001);
} finally { display.dispose(); display.dispose(); }

let getterCalls = 0;
const getter = { ...options };
Object.defineProperty(getter, 'absoluteToleranceMM', { enumerable: true, get() {
  getterCalls++; return 1e-7;
} });
for (const action of [
  () => queryCadDocumentCurveArcLength(document, { ...reference, documentRevision: 2 }, options),
  () => createCadGeometryReference(document, { bodyId: 'missing_body' }),
  () => queryCadDocumentCurveArcLength(document, reference, { ...options, interval: [1, 0] }),
  () => validateCadDocumentCurveArcLength(document, { ...length, estimatedLengthMM: 999 }),
  () => queryCadDocumentCurveArcLength(document, reference, getter),
]) assert.throws(action);
assert.equal(getterCalls, 0);
console.log(JSON.stringify({ documentBytes: bytes.length, documentSha256: sha,
  documentId: reference.documentId, documentRevision: reference.documentRevision,
  bodyId: reference.bodyId, assetId: reference.assetId, assetRevision: reference.assetRevision,
  curveId: reference.geometryId, originalInterval: length.report.interval,
  estimatedLengthMM: length.estimatedLengthMM, heuristicEstimatorMM: length.errorEstimateMM,
  localAnalyticDifferenceMM: Math.abs(length.estimatedLengthMM - Math.PI),
  nativeEvaluationCount: length.report.evaluationCount,
  nativePointEvaluationCount: length.report.pointEvaluationCount,
  nativeFinalPanels: length.report.finalPanelCount,
  nativeSubdivisions: length.report.subdivisionCount,
  displaySamples: projection[0].sample.pointsMM.length, displayChordMM,
  refused: 5, getterCalls, nativeAndDisplaySeparate: true }));
