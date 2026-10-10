import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  evaluateNurbsSourceLoftFeatureGraph,
  updateNurbsSourceLoftFeatureGraph,
  evaluateSurface,
  NurbsSourceLoftFeatureGraphError
} from '@barocss/cad';
import type {
  NurbsSourceLoftFeatureGraphV0,
  NurbsSourceLoftFeatureGraphOptions,
  NurbsSourceLoftFeatureGraphEdits
} from '@barocss/cad';
import {
  readBaroCadNurbsSourceLoftFeatureGraph,
  readBaroCadNurbsSourceLoftFeatureGraphUpdate,
  BaroCadNurbsSourceLoftReadError
} from '@barocss/cad-interop/nurbs-source-loft-feature-graph';

// Run from apps/library-docs with the separate source profile pinned below.
// The old source5f playground and its runner are unrelated to this consumer.
const sourceProfile = '7e96b959746a3fee957644fd1b5ccaf79c992c6c';
const inputPath = 'samples/loft-graph/main-revision0.authored.json';
const inputBytes = readFileSync(resolve(inputPath));
const inputSha256 = createHash('sha256').update(inputBytes).digest('hex');
assert.equal(inputBytes.length, 2927);
assert.equal(inputSha256, 'c2504c0e257860b092145c804345471fa0c4079cb6bdb85af6319b222a3f09ed');
const document = JSON.parse(inputBytes.toString('utf8')) as NurbsSourceLoftFeatureGraphV0;
const options: NurbsSourceLoftFeatureGraphOptions = {
  maximumSources: 3,
  maximumSourceEdits: 3,
  maximumFeatureEvaluations: 4,
  maximumLoftSections: 3
};

function objectSet(value: unknown, result = new Set<object>()): Set<object> {
  if (value !== null && typeof value === 'object' && !result.has(value)) {
    result.add(value);
    for (const child of Object.values(value)) objectSet(child, result);
  }
  return result;
}
function assertIndependent(left: unknown, right: unknown, name: string): void {
  const objects = objectSet(left);
  assert.ok([...objectSet(right)].every(value => !objects.has(value)), name);
}

const before = evaluateNurbsSourceLoftFeatureGraph(document, options);
assert.equal(before.document.revision, 0);
assert.equal(before.loft.status, 'active');
assert.ok(before.loft.evaluation);
assert.equal(before.loft.evaluation.model.objects.length, 4);
assert.equal(before.originalSources[0].model.objects.length, 4);
assert.equal(before.originalSources[0].source, document.sources[0].source);
assert.deepEqual(before.originalSources[0].model.objects.map(object => object.id), [
  'section_first', 'unrelated_original_surface', 'section_middle', 'section_last'
]);
assert.ok(!before.loft.evaluation.model.objects.some(object =>
  object.id === 'unrelated_original_surface'));

const graphInput = structuredClone(before);
const graphRead = readBaroCadNurbsSourceLoftFeatureGraph(graphInput);
assert.deepEqual(graphRead.native, before);
assert.deepEqual(graphRead.validationReport, before.report);
assert.equal(graphRead.sourceText, null);
assert.equal(graphRead.profile.packetRole, 'graph');
assertIndependent(graphInput, graphRead.native, 'Graph input and admitted native must be independent');
assertIndependent(graphRead.native, graphRead.validationReport, 'Graph report must be independent');
// Mutate only a caller copy and an independent report canary.
graphInput.originalSources[0].source += '/* caller-only mutation */';
assert.equal(graphRead.native.originalSources[0].source, before.originalSources[0].source);
graphRead.validationReport.revision = 99;
assert.equal(graphRead.native.report.revision, 0);
assert.equal(before.report.revision, 0);
graphRead.validationReport.revision = before.report.revision;
assert.deepEqual(graphRead.validationReport, before.report);

const edits: NurbsSourceLoftFeatureGraphEdits = {
  expectedRevision: 0,
  revision: 1,
  nodeEdits: [{ nodeId: 'edit_middle', edits: {
    poleEdits: [{ index: 2, zMM: 3, weight: 4.5 }]
  } }],
  loftSuppressed: null
};
const update = updateNurbsSourceLoftFeatureGraph(before, edits);
const after = update.result;
const transaction = update.transaction.report;
assert.equal(after.document.revision, 1);
assert.deepEqual(transaction.affectedSourceEditNodeIds, ['edit_middle']);
assert.deepEqual(transaction.reusedSourceEditNodeIds, ['edit_first', 'edit_last']);
assert.equal(transaction.loftAction, 'rebuilt');
assert.equal(transaction.directCounts.sourceEditEvaluationCount, 1);
assert.equal(transaction.directCounts.loftEvaluationCount, 1);
assert.equal(transaction.workScope, 'prior-owned-validation-and-producer-internal-work-excluded');
assert.deepEqual(after.originalSources, before.originalSources);
assert.equal(after.document.sources[0].source, document.sources[0].source);
for (const id of ['edit_first', 'edit_last']) {
  assert.deepEqual(after.evaluatedNodes.find(node => node.nodeId === id),
    before.evaluatedNodes.find(node => node.nodeId === id));
}
const beforeMiddle = before.evaluatedNodes.find(node => node.nodeId === 'edit_middle')!;
const afterMiddle = after.evaluatedNodes.find(node => node.nodeId === 'edit_middle')!;
assert.equal(beforeMiddle.evaluation.curve.controlPoints[2][2], 2);
assert.equal(beforeMiddle.evaluation.curve.weights[2], 4);
assert.equal(afterMiddle.evaluation.curve.controlPoints[2][2], 3);
assert.equal(afterMiddle.evaluation.curve.weights[2], 4.5);
assert.notEqual(afterMiddle.evaluation.source, beforeMiddle.evaluation.source);
assert.ok(afterMiddle.evaluation.report.preservation.untouchedSourceSpans);
for (const original of afterMiddle.evaluation.originalModel.objects) {
  if (original.id !== 'section_middle') {
    assert.deepEqual(afterMiddle.evaluation.model.objects.find(object => object.id === original.id), original);
  }
}
assert.ok(after.loft.evaluation);
assert.equal(after.loft.evaluation.surface.controlPoints[2][1][2], 3);
assert.equal(after.loft.evaluation.surface.weights[2][1], 4.5);

const updateInput = structuredClone(update);
const updateRead = readBaroCadNurbsSourceLoftFeatureGraphUpdate(updateInput);
assert.deepEqual(updateRead.native, update);
assert.deepEqual(updateRead.validationReport, transaction);
assert.equal(updateRead.sourceText, null);
assert.equal(updateRead.profile.packetRole, 'update');
assertIndependent(updateInput, updateRead.native, 'Update input and admitted native must be independent');
assertIndependent(updateRead.native, updateRead.validationReport, 'Update report must be independent');
updateInput.result.document.revision = 99;
assert.equal(updateRead.native.result.document.revision, 1);
updateRead.validationReport.directCounts.sourceEditEvaluationCount = 99;
assert.equal(updateRead.native.transaction.report.directCounts.sourceEditEvaluationCount, 1);
assert.equal(transaction.directCounts.sourceEditEvaluationCount, 1);
updateRead.validationReport.directCounts.sourceEditEvaluationCount =
  transaction.directCounts.sourceEditEvaluationCount;
assert.deepEqual(updateRead.validationReport, transaction);

// One genuine complete-packet refusal. Assignment occurs only on successful admission.
let accepted = updateRead;
const acceptedReference = accepted;
const acceptedValue = structuredClone(accepted);
const tampered = structuredClone(update);
tampered.result.evaluatedNodes.find(node => node.nodeId === 'edit_middle')!
  .evaluation.curve.controlPoints[2][2] += 1;
let refusal: { code: string; causeCode: string } | null = null;
try {
  accepted = readBaroCadNurbsSourceLoftFeatureGraphUpdate(tampered);
} catch (error) {
  assert.ok(error instanceof BaroCadNurbsSourceLoftReadError);
  assert.equal(error.code, 'NATIVE');
  assert.ok(error.cause instanceof NurbsSourceLoftFeatureGraphError);
  assert.equal(error.cause.code, 'OWNED');
  refusal = { code: error.code, causeCode: error.cause.code };
}
assert.ok(refusal, 'Tampered whole Update must be refused');
assert.equal(accepted, acceptedReference);
assert.deepEqual(accepted, acceptedValue);
assert.equal(after.document.revision, 1);
assert.equal(before.document.revision, 0);

// These are sampled native positions, not serialized Graph authority or mesh geometry.
const uValues = Array.from({ length: 41 }, (_, index) => index * 2 / 40);
const beforePoints = uValues.map(u => evaluateSurface(before.loft.evaluation!.surface, u, 4));
const afterPoints = uValues.map(u => evaluateSurface(after.loft.evaluation!.surface, u, 4));
const centerBefore = evaluateSurface(before.loft.evaluation.surface, 1, 4);
const centerAfter = evaluateSurface(after.loft.evaluation.surface, 1, 4);
assert.notDeepEqual(centerBefore, centerAfter);
const receipt = {
  format: 'barocss-docs-cad-loft-loader-consumer-v1',
  status: 'passed', sourceProfile, node: process.version,
  input: { path: inputPath, bytes: inputBytes.length, sha256: inputSha256 },
  before: { revision: 0, centerMM: centerBefore, middlePoleZMM: 2, middleWeight: 4 },
  after: { revision: 1, centerMM: centerAfter, middlePoleZMM: 3, middleWeight: 4.5 },
  affectedNodeIds: transaction.affectedSourceEditNodeIds,
  reusedNodeIds: transaction.reusedSourceEditNodeIds,
  loftAction: transaction.loftAction,
  receiptCounts: after.report.receiptCounts,
  directCounts: transaction.directCounts,
  transactionWorkScope: transaction.workScope,
  graphWorkScope: after.report.workScope,
  originalSourceAndSiblingsRetained: true,
  generatedModelObjects: after.loft.evaluation.model.objects.length,
  originalMixedModelObjects: after.originalSources[0].model.objects.length,
  copies: { graphInputIsolated: true, graphReportIsolated: true,
    updateInputIsolated: true, updateReportIsolated: true },
  refusal, acceptedReferenceAndValueRetained: true,
  visualization: { uValues, v: 4, before: beforePoints, after: afterPoints },
  scope: 'One source-profile CPU Graph/update/owned Loader consumer. Sampled curves are display data; no renderer, mesh, file codec, G1/G2, topology, Solid, Boolean or publication proof. Summary vectors are not serialized Graph authority.'
};
writeFileSync(resolve('evidence/cad-loft-loader-consumer.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ status: receipt.status, sourceProfile,
  affected: receipt.affectedNodeIds, reused: receipt.reusedNodeIds,
  centerBefore, centerAfter, refusal, acceptedRetained: true }));
