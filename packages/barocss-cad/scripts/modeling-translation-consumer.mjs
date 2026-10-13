import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { cad } from '../dist/index.js';
import { EXPECTED_CAMPAIGN, WIDER, proveSnapshot, work, hold, unchanged, signedData, sha256, dataHash, exactData,
  snapshotData, errorData, emptyLedgers, collectLedgers, accounting } from '../test/modeling-translation-fixture.mjs';

// Fresh emitted package process; exactly one cold load then its spacing64 edit.
// Only authored bytes enter cad.load. Retained native/mesh data is compared only.
assert.equal(Number(process.versions.node.split('.')[0]), 22); assert.ok(process.execArgv.includes('--no-opt'));
assert.match([...process.execArgv, process.env.NODE_OPTIONS ?? ''].join(' '), /--max[-_]old[-_]space[-_]size(?:=|\s+)1536(?:\s|$)/);
assert.equal(process.argv.length, 3); const directory = resolve(process.argv[2]), started = performance.now();
const sourceBytes = readFileSync(resolve(directory, 'source-flow.json')), source = JSON.parse(sourceBytes);
assert.equal(source.status, 'passed'); assert.equal(source.issue, 1880); assert.equal(source.modelCalls, 5); assert.equal(source.tessellations, 2);
assert.equal(source.massQueries, 0); assert.equal(source.cpuBufferPreparations, 0); assert.equal(source.standaloneValidators, 0);
exactData(source.expectedWholeCampaign, EXPECTED_CAMPAIGN);
function input(filename) {
  const bytes = readFileSync(resolve(directory, filename)); assert.equal(sha256(bytes), source.artifacts[filename].sha256);
  assert.equal(bytes.length, source.artifacts[filename].bytes); return bytes;
}
const text = input('initial.cad-model.json').toString('utf8'), baselinePrior = JSON.parse(input('01-baseline.snapshot.json'));
const widerText = input('wider.cad-model.json').toString('utf8'), widerPrior = JSON.parse(input('02-wider.snapshot.json'));
const transfer = JSON.parse(input('baseline-transfer.json'));
for (const name of ['left', 'right']) exactData(transfer.previews[name], JSON.parse(input('baseline-' + name + '.preview.json')));
exactData(transfer.bodies, baselinePrior.bodies); exactData(transfer.evidence, baselinePrior.evidence);
exactData(transfer.lineage, baselinePrior.evidence[2].native.lineage); assert.equal(transfer.text, text);
const receipt = resolve(directory, 'cold-flow.json');
const flow = { status: 'running', issue: 1880, timingScope: 'stage action plus artifact persistence; not isolated kernel timing',
  processId: process.pid, processInstanceId: randomUUID(), nodeVersion: process.version,
  entrySHA256: sha256(readFileSync(new URL('../dist/index.js', import.meta.url))), sourceReceiptSHA256: sha256(sourceBytes),
  authoredInputSHA256: sha256(text), sourceProcessInstanceId: source.processInstanceId, groupStartedAtMS: source.groupStartedAtMS,
  modelCalls: 0, tessellations: 0, massQueries: 0, cpuBufferPreparations: 0, standaloneValidators: 0,
  nativeElapsedMS: source.nativeElapsedMS, sourceNativeElapsedMS: source.nativeElapsedMS,
  expectedWholeCampaign: EXPECTED_CAMPAIGN, fullTransitiveNativeCoverage: 'NOT_MEASURED', sourceDerivedExpectedWorkIsNotInstrumented: true,
  limits: { heapMiB: 1536, freeDiskMiB: 500, processGroupSeconds: 600 },
  stages: [], artifacts: {}, returnedLedgers: emptyLedgers(), externalSerialProcessGroupTimeoutRequired: true };
assert.notEqual(flow.processInstanceId, source.processInstanceId);
writeFileSync(receipt, signedData(flow) + '\n', { flag: 'wx' }); const write = () => writeFileSync(receipt, signedData(flow) + '\n');
function persist(filename, value, scope) {
  const bytes = signedData(value) + '\n'; assert.ok(Buffer.byteLength(bytes) <= 32 * 1024 * 1024);
  writeFileSync(resolve(directory, filename), bytes, { flag: 'wx' });
  flow.artifacts[filename] = { bytes: Buffer.byteLength(bytes), sha256: sha256(bytes), scope }; write();
}
function stage(label, action, filename) {
  const disk = statfsSync(directory); assert.ok(disk.bavail * disk.bsize >= 500 * 1024 * 1024);
  assert.ok(flow.modelCalls < 2 && flow.nativeElapsedMS < 600000 && Date.now() - flow.groupStartedAtMS < 600000);
  flow.modelCalls++; flow.pending = label; write(); const begin = performance.now(); let outcome = 'threw', failure;
  try {
    const result = action(); outcome = 'returned'; persist(filename, snapshotData(result), 'actual complete cold returned data captured before fixture oracle');
    collectLedgers(flow.returnedLedgers, result, label); return result;
  } catch (error) {
    failure = errorData(error); persist(filename + '.refusal.json', failure, 'complete original cold failure before any assertion'); throw error;
  } finally {
    const elapsedMS = performance.now() - begin; flow.nativeElapsedMS += elapsedMS;
    flow.stages.push({ label, outcome, elapsedMS, ...(failure ? { failure } : {}) }); flow.pending = null; write();
  }
}
try {
  const reopened = stage('6 emitted cold baseline cad.load saved authored intent', () => cad.load(text), '06-cold.snapshot.json');
  const before = hold(reopened); work(reopened, [], [0, 1, 2]); flow.cold = proveSnapshot(reopened);
  assert.equal(reopened.save(), text); exactData(snapshotData(reopened), baselinePrior);
  assert.equal(dataHash(snapshotData(reopened)), source.baselineSnapshotSHA256);
  assert.equal(dataHash(reopened.bodies), source.baselineBodiesSHA256); assert.equal(dataHash(reopened.evidence), source.baselineEvidenceSHA256);
  const wider = stage('7 cold baseline spacing64 reuses sketch and prism', () => reopened.withParameters({ spacing: 64 }), '07-cold-wider.snapshot.json');
  work(wider, [0, 1], [2], reopened); flow.wider = proveSnapshot(wider, WIDER);
  assert.equal(wider.save(), widerText); exactData(snapshotData(wider), widerPrior);
  assert.equal(dataHash(snapshotData(wider)), source.widerSnapshotSHA256);
  assert.equal(dataHash(wider.bodies), source.widerBodiesSHA256); assert.equal(dataHash(wider.evidence), source.widerEvidenceSHA256);
  unchanged(reopened, before); assert.equal(flow.modelCalls, 2);
  flow.coldAccounting = accounting(flow.returnedLedgers, [1, 1, 2, 2, 2, 0]);
  exactData(flow.coldAccounting, { returnedLedgerSourceCompilations: 37, returnedLedgerBindingObservations: 432, returnedLedgerD1: 1296,
    knownSourceCompilations: 50, combinedBindingObservations: 576, knownD1: 1728, initialFaceConstructionCount: 12,
    fullTransitiveNativeCoverage: 'NOT_MEASURED' });
  const combined = Object.fromEntries(Object.keys(flow.returnedLedgers).map(name => [name, [...source.returnedLedgers[name], ...flow.returnedLedgers[name]]]));
  flow.accounting = { ...accounting(combined, [3, 3, 7, 6, 6, 2]), publicModelCalls: source.modelCalls + flow.modelCalls,
    successfulTranslatedCopies: combined.targets.length, successfulPrisms: combined.prisms.length, actualRepresentabilityRefusals: 1,
    actualTessellations: source.tessellations, sourceDerivedTotalSolverAttempts: 6, massQueries: 0, cpuBufferPreparations: 0, standaloneValidators: 0 };
  exactData(flow.accounting, { returnedLedgerSourceCompilations: 129, returnedLedgerBindingObservations: 1512, returnedLedgerD1: 4536,
    knownSourceCompilations: 168, combinedBindingObservations: 1944, knownD1: 5832, initialFaceConstructionCount: 36,
    fullTransitiveNativeCoverage: 'NOT_MEASURED', publicModelCalls: 7, successfulTranslatedCopies: 6, successfulPrisms: 3,
    actualRepresentabilityRefusals: 1, actualTessellations: 2, sourceDerivedTotalSolverAttempts: 6,
    massQueries: 0, cpuBufferPreparations: 0, standaloneValidators: 0 });
  exactData([flow.cold.volumesMM3, flow.wider.volumesMM3], [{ left: 6912, right: 6912 }, { left: 6912, right: 6912 }]);
  assert.ok(flow.nativeElapsedMS < 600000 && Date.now() - flow.groupStartedAtMS < 600000);
  flow.status = 'passed'; flow.completedAt = new Date().toISOString(); flow.wallElapsedMS = performance.now() - started; write();
  console.log(signedData({ status: flow.status, modelCalls: flow.modelCalls, tessellations: 0, nativeElapsedMS: flow.nativeElapsedMS, accounting: flow.accounting }));
} catch (error) { flow.status = 'failed'; flow.failure = errorData(error); flow.failedAt = new Date().toISOString(); write(); throw error; }
