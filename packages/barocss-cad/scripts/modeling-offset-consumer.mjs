import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { cad } from '../dist/index.js';
import { EXPECTED_CAMPAIGN, snapshotData, work, proveSnapshot, nativeBodyHash, allBodiesHash, signedData, sha256, exactData, deepFrozen, errorData } from '../test/modeling-offset-fixture.mjs';

// A new Node process imports only the actual emitted package. No prior process
// frame/cache is imported; these are exactly campaign calls7 and8.
assert.equal(Number(process.versions.node.split('.')[0]), 22); assert.ok(process.execArgv.includes('--no-opt'));
assert.match([...process.execArgv, process.env.NODE_OPTIONS ?? ''].join(' '), /--max[-_]old[-_]space[-_]size(?:=|\s+)1536(?:\s|$)/);
assert.equal(process.argv.length, 3); const directory = resolve(process.argv[2]), started = performance.now();
const sourceBytes = readFileSync(resolve(directory, 'source-flow.json')), source = JSON.parse(sourceBytes);
assert.equal(source.status, 'passed'); assert.equal(source.issue, 1724); assert.equal(source.modelCalls, 6); assert.equal(source.tessellations, 46); assert.equal(source.prismValidators, 1);
exactData(source.expectedWholeCampaign, EXPECTED_CAMPAIGN);
function input(filename) {
  const bytes = readFileSync(resolve(directory, filename)); assert.equal(sha256(bytes), source.artifacts[filename].sha256); assert.equal(bytes.length, source.artifacts[filename].bytes); return bytes;
}
const text = input('initial.cad-model.json').toString('utf8'), prior = JSON.parse(input('01-baseline.snapshot.json'));
const deeperText = input('edited.cad-model.json').toString('utf8'), deeperPrior = JSON.parse(input('03-deeper.snapshot.json'));
const receipt = resolve(directory, 'cold-flow.json');
const flow = { status: 'running', issue: 1724, processId: process.pid, processInstanceId: randomUUID(), nodeVersion: process.version,
  entrySHA256: sha256(readFileSync(new URL('../dist/index.js', import.meta.url))), sourceReceiptSHA256: sha256(sourceBytes), authoredInputSHA256: sha256(text),
  modelCalls: 0, tessellations: 0, prismValidators: 0, nativeElapsedMS: source.nativeElapsedMS, sourceNativeElapsedMS: source.nativeElapsedMS,
  expectedWholeCampaign: EXPECTED_CAMPAIGN, fullTransitiveNativeCoverage: 'NOT_MEASURED', stages: [], artifacts: {},
  returnedLedgers: { prisms: [], differences: [] }, externalSerialProcessGroupTimeoutRequired: true };
writeFileSync(receipt, signedData(flow) + '\n', { flag: 'wx' }); const write = () => writeFileSync(receipt, signedData(flow) + '\n');
function stage(label, action, filename) {
  const disk = statfsSync(directory); assert.ok(disk.bavail * disk.bsize >= 500 * 1024 * 1024);
  assert.ok(flow.modelCalls < 2 && flow.nativeElapsedMS < 600000 && performance.now() - started < 600000);
  flow.modelCalls++; flow.pending = label; write(); const begin = performance.now(); let outcome = 'threw', failure;
  try {
    const result = action(); outcome = 'returned'; const bytes = signedData(snapshotData(result)) + '\n';
    assert.ok(Buffer.byteLength(bytes) <= 32 * 1024 * 1024); writeFileSync(resolve(directory, filename), bytes, { flag: 'wx' });
    flow.artifacts[filename] = { bytes: Buffer.byteLength(bytes), sha256: sha256(bytes), scope: 'actual returned cold data captured before fixture oracle' }; write();
    for (const index of result.recomputation.evaluatedFeatures) {
      const e = result.evidence[index];
      if (e.kind === 'extrude') flow.returnedLedgers.prisms.push({ label, index, report: e.native.report.childNativeWork });
      if (e.kind === 'difference') flow.returnedLedgers.differences.push({ label, report: e.native.report.directCounts });
    }
    return result;
  } catch (error) { failure = errorData(error); throw error; }
  finally { const elapsedMS = performance.now() - begin; flow.nativeElapsedMS += elapsedMS;
    flow.stages.push({ label, outcome, elapsedMS, ...(failure ? { failure } : {}) }); flow.pending = null; write(); }
}
try {
  const reopened = stage('7 direct emitted cold cad.load saved baseline', () => cad.load(text), '07-cold.snapshot.json');
  work(reopened, [], [0, 1, 2, 3, 4]); flow.cold = proveSnapshot(reopened, 5632);
  assert.equal(reopened.save(), text); exactData(reopened.bodies, prior.bodies); exactData(reopened.evidence, prior.evidence);
  assert.equal(nativeBodyHash(reopened), source.initialBodySHA256); assert.equal(allBodiesHash(reopened), source.initialBodiesSHA256);
  const oldHash = allBodiesHash(reopened), oldBodies = reopened.bodies;
  const edited = stage('8 direct emitted cold baseline depth6 edit', () => reopened.withParameters({ depth: 6 }), '08-cold-edited.snapshot.json');
  work(edited, [0, 1, 2], [3, 4], reopened); flow.edited = proveSnapshot(edited, 5376);
  assert.equal(edited.save(), deeperText); exactData(edited.bodies, deeperPrior.bodies); exactData(edited.evidence, deeperPrior.evidence);
  assert.equal(nativeBodyHash(edited), source.editedBodySHA256); assert.equal(allBodiesHash(edited), source.editedBodiesSHA256);
  assert.equal(reopened.save(), text); assert.equal(allBodiesHash(reopened), oldHash); assert.equal(reopened.bodies, oldBodies); deepFrozen(reopened);
  assert.equal(flow.modelCalls, 2); assert.equal(flow.tessellations, 0); assert.equal(flow.prismValidators, 0);
  assert.equal(flow.returnedLedgers.prisms.length, 3); assert.equal(flow.returnedLedgers.differences.length, 2);
  const booleans = [...source.returnedLedgers.differences, ...flow.returnedLedgers.differences];
  assert.equal(booleans.reduce((sum, e) => sum + e.report.faceBuildCount, 0), 228);
  assert.equal(booleans.reduce((sum, e) => sum + e.report.observationCount, 0), 3420);
  flow.accounting = { publicModelCalls: source.modelCalls + flow.modelCalls, geometryEvaluatingAttempts: 7,
    returnedPrismFeatureReports: source.returnedLedgers.prisms.length + flow.returnedLedgers.prisms.length,
    unreturnedPrismFeaturesSourceDerivedOnly: 1, returnedValidatorReports: source.returnedLedgers.validator.length,
    returnedDifferenceReports: booleans.length, actualTessellations: source.tessellations,
    fullTransitiveNativeCoverage: 'NOT_MEASURED' };
  flow.status = 'passed'; flow.completedAt = new Date().toISOString(); flow.wallElapsedMS = performance.now() - started; write();
  console.log(signedData({ status: flow.status, modelCalls: 2, tessellations: 0, nativeElapsedMS: flow.nativeElapsedMS, accounting: flow.accounting }));
} catch (error) { flow.status = 'failed'; flow.failure = errorData(error); flow.failedAt = new Date().toISOString(); write(); throw error; }
