import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { thinPlate, proveThin, proveExport, proveCollapse, decodeBinaryStl, hold, unchanged,
  sha256, signedData, dataHash, exactData, snapshotData, errorData, checkProcess, recorder,
  accounting, SOURCE_ACCOUNTING } from '../modeling-stl-fixture.mjs';

// Resume only the two unexecuted source actions. This file never reconstructs
// the accepted pair or exports it again. Cold load/export remain a separate run.
checkProcess(); assert.ok(process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === '--preflight'));
const directory = resolve(process.env.CAD_MODEL_EVIDENCE_DIR), entry = resolve(process.env.CAD_MODEL_TEST_MODULE);
const originalBytes = readFileSync(resolve(directory, 'source-flow.json')), original = JSON.parse(originalBytes);
assert.equal(original.status, 'failed'); assert.equal(original.issue, 1890);
assert.equal(original.failure.name, 'AssertionError');
assert.equal(original.modelCalls, 1); assert.equal(original.exportCalls, 2); assert.equal(original.tessellations, 2);
assert.equal(original.stages.length, 3); assert.ok(original.stages.every(stage => stage.outcome === 'returned'));
assert.equal(sha256(readFileSync(entry)), original.entrySHA256);
const pinned = {};
function input(filename) {
  const bytes = readFileSync(resolve(directory, filename)), record = original.artifacts[filename]; assert.ok(record);
  assert.equal(bytes.length, record.bytes); assert.equal(sha256(bytes), record.sha256);
  pinned[filename] = { bytes: bytes.length, sha256: record.sha256 }; return bytes;
}
for (const filename of Object.keys(original.artifacts)) input(filename);
const prior = JSON.parse(input('01-baseline.snapshot.json')), text = input('initial.cad-model.json').toString('utf8');
const left = JSON.parse(input('baseline-left.export.json')), right = JSON.parse(input('baseline-right.export.json'));
const leftBytes = input('baseline-left.stl'), rightBytes = input('baseline-right.stl');
assert.equal(prior.text, text); exactData(left.bytes, [...leftBytes]); exactData(right.bytes, [...rightBytes]);
exactData(prior, JSON.parse(input('after-refusal.pair.snapshot.json')));
assert.equal(text, input('after-refusal.pair.cad-model.json').toString('utf8'));
exactData(left, JSON.parse(input('after-refusal.left.export.json'))); exactData(right, JSON.parse(input('after-refusal.right.export.json')));
const historicalBytes = readFileSync(new URL('../modeling-translation-evidence/01-baseline.snapshot.json', import.meta.url));
exactData(prior, JSON.parse(historicalBytes));
const exports = { left: proveExport(left, prior, 'left', { retainedReplay: true }), right: proveExport(right, prior, 'right', { retainedReplay: true }) };
const leftDecoded = decodeBinaryStl(leftBytes), rightDecoded = decodeBinaryStl(rightBytes);
assert.notDeepEqual([...leftBytes], [...rightBytes]);
for (const [i, facet] of leftDecoded.facets.entries()) {
  exactData(rightDecoded.facets[i].normal, facet.normal);
  exactData(rightDecoded.facets[i].points, facet.points.map(point => [point[0] + 48, point[1], point[2]]));
}
const preflight = { status: 'passed', modelCalls: 0, exportCalls: 0,
  originalFailedReceiptSHA256: sha256(originalBytes), sourceEntrySHA256: original.entrySHA256, inputs: pinned, exports,
  baselineSnapshotSHA256: dataHash(prior), baselineBodiesSHA256: dataHash(prior.bodies), baselineEvidenceSHA256: dataHash(prior.evidence),
  historicalParent: { issue: 1880, dependencyCommit: '31ad07d5234326bf68b937c070000e94d2c45501', snapshotSHA256: sha256(historicalBytes), exactParity: true },
  scope: 'pure checks over exact retained packets; parsed replay does not establish live freeze or shared object identity' };
if (process.argv[2]) {
  writeFileSync(resolve(directory, 'continuation-preflight.json'), signedData(preflight) + '\n', { flag: 'wx' });
  console.log('Retained baseline preflight passed: zero model/export calls'); process.exit(0);
}
const recordedPreflight = readFileSync(resolve(directory, 'continuation-preflight.json')); exactData(JSON.parse(recordedPreflight), preflight);
const { flow, artifact, stage, finish, fail, write } = recorder(directory, 'continuation', {
  entrySHA256: original.entrySHA256, originalFailedReceiptSHA256: sha256(originalBytes), preflightSHA256: sha256(recordedPreflight),
  remainingBudget: { modelCalls: 1, exportCalls: 1, tessellations: 1 }, inputs: pinned });
try {
  const { cad, CadModelError } = await import(pathToFileURL(entry).href);
  const thin = stage('modelCalls', '2 exact 2x2 affine prism, height1/4096, from9999', () => thinPlate(cad).build(), '02-thin.snapshot.json');
  artifact('thin.cad-model.json', thin.save(), 'actual authored accepted thin prism; never tuned', true); const before = hold(thin);
  let refusal;
  try { stage('exportCalls', '3 genuine thin-prism Float32 facet COLLAPSE', () => thin.exportStl('thin'), 'thin.unexpected-export.json', 'thin.unexpected.stl'); }
  catch (error) { refusal = error; }
  artifact('after-refusal.thin.snapshot.json', snapshotData(thin), 'actual retained thin snapshot after first export outcome'); unchanged(thin, before);
  if (refusal) { flow.originalEncodingFailure = errorData(refusal); write(); }
  flow.thin = proveThin(thin); flow.collapse = proveCollapse(refusal, CadModelError, thin);
  artifact('thin.completed-native-mesh.json', refusal.cause.progress.native, 'complete genuine mesh from original encoder refusal');
  artifact('thin.encoding-progress.json', refusal.cause.progress, 'original completed vertex phase and null bytes');
  // Recheck prior persisted packets. They are not a reconstructed live snapshot.
  for (const filename of Object.keys(original.artifacts)) input(filename);
  const transfer = { ...prior, summary: original.baseline, exports: { left, right }, translationLineage: prior.evidence[2].native.lineage,
    outputIdentities: Object.fromEntries(Object.entries(prior.bodies).map(([name, body]) => [name,
      { family: body.family, solidId: body.native.request.options.solidId, sourceIds: body.native.request.assets.map(a => a.sourceId) }])),
    basis: 'authored XYZ; no axis conversion, recentering, scaling or welding',
    scope: 'exact retained actual baseline, parsed for transport; original successful packets and first failure remain immutable' };
  artifact('baseline-transfer.json', transfer, 'complete retained baseline bodies and both actual STL packets, no geometry replay');
  assert.equal(flow.modelCalls, 1); assert.equal(flow.exportCalls, 1); assert.equal(flow.tessellations, 1);
  flow.acceptedThinSnapshotPreserved = true; flow.originalArtifactsStillExact = true; finish();
  const continuationBytes = readFileSync(resolve(directory, 'continuation-flow.json'));
  const combinedLedgers = Object.fromEntries(Object.keys(original.returnedLedgers).map(key => [key, [...original.returnedLedgers[key], ...flow.returnedLedgers[key]]]));
  const measured = accounting(combinedLedgers, [2, 2, 1, 1, 1, 3]); exactData(measured, SOURCE_ACCOUNTING);
  const completed = { ...original, ...flow, status: 'passed', firstAttemptStatus: original.status, firstAttemptFailure: original.failure,
    modelCalls: original.modelCalls + flow.modelCalls, exportCalls: original.exportCalls + flow.exportCalls,
    tessellations: original.tessellations + flow.tessellations, nativeElapsedMS: original.nativeElapsedMS + flow.nativeElapsedMS,
    stages: [...original.stages, ...flow.stages], artifacts: { ...original.artifacts, ...flow.artifacts }, returnedLedgers: combinedLedgers,
    baseline: original.baseline, exports, ...Object.fromEntries(['baselineSnapshotSHA256', 'baselineBodiesSHA256', 'baselineEvidenceSHA256', 'historicalParent'].map(k => [k, preflight[k]])),
    originalFailedReceiptSHA256: sha256(originalBytes), continuationReceiptSHA256: sha256(continuationBytes), accounting: measured,
    scope: 'aggregate of one failed-oracle attempt plus only remaining source actions; no claim of first-run pass' };
  writeFileSync(resolve(directory, 'source-completed.json'), signedData(completed) + '\n', { flag: 'wx' });
  console.log(signedData({ status: 'passed', continuationModelCalls: 1, continuationExportCalls: 1, combinedSourceModelCalls: 2, combinedSourceExportCalls: 3, collapse: flow.collapse.code }));
} catch (error) { fail(error); throw error; }
