import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createCadGeometryReference, queryCadDocumentBounds, validateCadDocumentBounds } from '@barocss/cad';
import { parseBaroCadDocument } from '../dist/document.js';
import { createBaroCadDocumentThreeDisplay } from '../dist/three-document.js';

const source = readFileSync(new URL('./document-gpu-v2.cad-document.json', import.meta.url));
const document = parseBaroCadDocument(source.toString('utf8'));
const bodyIds = ['body_0_curve', 'body_0_surface', 'body_1_curve', 'body_1_surface'];
const bounds = bodyIds.map(bodyId => {
  const { reference } = createCadGeometryReference(document, { bodyId });
  const result = queryCadDocumentBounds(document, reference);
  assert.deepEqual(validateCadDocumentBounds(document, result), result.report);
  assert.equal(result.reference.bodyId, bodyId);
  assert.equal(result.report.geometryAuthority, 'original-native-control-hull');
  assert.equal(result.report.quality.globalBinary64ContainmentCertified, false);
  assert.equal(result.extrema.length, 6);
  const poles = result.geometry.kind === 'curve'
    ? result.geometry.controlPoints.map((pointMM, poleIndex) => ({ pointMM, poleIndex, uIndex: null, vIndex: null }))
    : result.geometry.controlPoints.flatMap((row, uIndex) => row.map((pointMM, vIndex) =>
      ({ pointMM, poleIndex: null, uIndex, vIndex })));
  for (const witness of result.extrema) {
    const pole = result.geometry.kind === 'curve' ? poles[witness.poleIndex] :
      poles.find(value => value.uIndex === witness.uIndex && value.vIndex === witness.vIndex);
    assert.ok(pole);
    assert.deepEqual(witness.pointMM, pole.pointMM);
    assert.ok(Object.is(witness.valueMM, pole.pointMM[witness.axis]));
  }
  return result;
});
const native = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
  curveDisplay: { version: 1, chordToleranceMM: 0.02, maxSegments: 512, maxDepth: 16 } };
const display = createBaroCadDocumentThreeDisplay(document, { native,
  basis: 'authored-xyz-matches-rhyup', bodyIds });
try {
  assert.deepEqual(display.bindings.map(binding => binding.bodyId), bodyIds);
  assert.equal(display.root.children.length, 2);
  assert.deepEqual(display.bindings.map(binding => binding.geometryId),
    ['guide_path_native', 'support_patch_native', 'guide_path_native', 'support_patch_native']);
  for (const [index, binding] of display.bindings.entries()) {
    assert.equal(binding.assetId, bounds[index].reference.assetId);
    assert.equal(binding.assetRevision, bounds[index].reference.assetRevision);
    assert.equal(binding.documentRevision, bounds[index].reference.documentRevision);
    assert.equal(binding.geometryId, bounds[index].reference.geometryId);
    assert.equal(binding.object.name, binding.geometryId);
  }
} finally { display.dispose(); display.dispose(); }
const min = [0, 1, 2].map(axis => Math.min(...bounds.map(result => result.boundsMM.min[axis])));
const max = [0, 1, 2].map(axis => Math.max(...bounds.map(result => result.boundsMM.max[axis])));
const scale = 0.001, aspect = 800 / 480;
const poses = { 'asset-a': -0.006, asset_b: 0.006 };
const posedMin = [0, 1, 2].map(axis => Math.min(...bounds.map(result =>
  result.boundsMM.min[axis] * scale + (axis === 0 ? poses[result.reference.assetId] : 0))));
const posedMax = [0, 1, 2].map(axis => Math.max(...bounds.map(result =>
  result.boundsMM.max[axis] * scale + (axis === 0 ? poses[result.reference.assetId] : 0))));
const centre = posedMin.map((value, axis) => (value + posedMax[axis]) / 2);
const halfHeight = Math.max((posedMax[1] - posedMin[1]) / 2,
  (posedMax[0] - posedMin[0]) / (2 * aspect)) * 1.25;
const eyeZ = centre[2] + Math.max(0.05, 2 * (posedMax[2] - posedMin[2]) + 0.01);
assert.ok(halfHeight > 0 && halfHeight < 0.5 && eyeZ - max[2] * scale > 0.001);
const original = bounds[0];
for (const action of [
  () => queryCadDocumentBounds(document, { ...original.reference, documentRevision: 4 }),
  () => createCadGeometryReference(document, { bodyId: 'missing_body' }),
  () => validateCadDocumentBounds(document, { ...original, boundsMM: { min: [99, 99, 99], max: original.boundsMM.max } }),
]) assert.throws(action);
const sha = createHash('sha256').update(source).digest('hex');
console.log(JSON.stringify({ sourceBytes: source.length, sourceSha256: sha,
  documentId: document.document.documentId, documentRevision: document.document.revision,
  bodyIds, assetRevisions: bounds.map(result => result.reference.assetRevision),
  poleCounts: bounds.map(result => result.report.controlPoleCount),
  nativeBoundsMM: { min, max }, hostAssetPoses: poses,
  posedBoundsScene: { min: posedMin, max: posedMax },
  camera: { target: centre, eyeZ, halfHeight, halfWidth: halfHeight * aspect },
  extremaWitnesses: bounds.map(result => result.extrema.length), refused: 3,
  repeatedGeometryIdsRemainQualified: true }));
