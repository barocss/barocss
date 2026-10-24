import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { cad } from '../dist/index.js';
import { AUTHORED_SHA256, EXPECTED_CAMPAIGN, proveMass, hold, unchanged, signedData, sha256, dataHash, exactData,
  snapshotData, errorData, work } from '../test/modeling-mass-fixture.mjs';

// Fresh emitted process: exactly one cold model call and one mass query.
assert.equal(Number(process.versions.node.split('.')[0]), 22); assert.ok(process.execArgv.includes('--no-opt'));
assert.match([...process.execArgv, process.env.NODE_OPTIONS ?? ''].join(' '), /--max[-_]old[-_]space[-_]size(?:=|\s+)1536(?:\s|$)/);
assert.equal(process.argv.length, 3); const directory = resolve(process.argv[2]), started = performance.now();
const sourceBytes = readFileSync(resolve(directory, 'source-flow.json')), source = JSON.parse(sourceBytes);
assert.equal(source.status, 'passed'); assert.equal(source.issue, 1790); assert.equal(source.modelCalls, 2); assert.equal(source.massQueries, 5); assert.equal(source.tessellations, 0);
exactData(source.expectedWholeCampaign, EXPECTED_CAMPAIGN);
function input(filename) {
  const bytes = readFileSync(resolve(directory, filename)); assert.equal(sha256(bytes), source.artifacts[filename].sha256); assert.equal(bytes.length, source.artifacts[filename].bytes); return bytes;
}
const text = input('initial.cad-model.json').toString('utf8'); assert.equal(sha256(text), AUTHORED_SHA256);
const prior = JSON.parse(input('01-baseline.snapshot.json')), priorMass = JSON.parse(input('03-pocket.mass.json'));
const receipt = resolve(directory, 'cold-flow.json');
const flow = { status: 'running', issue: 1790, processId: process.pid, processInstanceId: randomUUID(), nodeVersion: process.version,
  entrySHA256: sha256(readFileSync(new URL('../dist/index.js', import.meta.url))), sourceReceiptSHA256: sha256(sourceBytes), authoredInputSHA256: AUTHORED_SHA256,
  modelCalls: 0, massQueries: 0, tessellations: 0, nativeElapsedMS: source.nativeElapsedMS, sourceNativeElapsedMS: source.nativeElapsedMS,
  expectedWholeCampaign: EXPECTED_CAMPAIGN, fullTransitiveNativeCoverage: 'NOT_MEASURED', stages: [], artifacts: {}, returnedLedgers: {},
  externalSerialProcessGroupTimeoutRequired: true };
writeFileSync(receipt, signedData(flow) + '\n', { flag: 'wx' }); const write = () => writeFileSync(receipt, signedData(flow) + '\n');
function stage(kind, label, action, filename) {
  const disk = statfsSync(directory); assert.ok(disk.bavail * disk.bsize >= 500 * 1024 * 1024);
  assert.equal(flow[kind], 0); assert.ok(flow.nativeElapsedMS < 600000 && performance.now() - started < 600000);
  flow[kind]++; flow.pending = { kind, label }; write(); const begin = performance.now(); let outcome = 'threw', failure;
  const persist = (filename, value) => { const bytes = signedData(value) + '\n'; assert.ok(Buffer.byteLength(bytes) <= 32 * 1024 * 1024);
    writeFileSync(resolve(directory, filename), bytes, { flag: 'wx' }); flow.artifacts[filename] = { bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) }; write(); };
  try { const result = action(); outcome = 'returned'; persist(filename, kind === 'modelCalls' ? snapshotData(result) : result); return result; }
  catch (error) { failure = errorData(error); persist(filename + '.refusal.json', failure); throw error; }
  finally { const elapsedMS = performance.now() - begin; flow.nativeElapsedMS += elapsedMS;
    flow.stages.push({ kind, label, outcome, elapsedMS, ...(failure ? { failure } : {}) }); flow.pending = null; write(); }
}
try {
  const reopened = stage('modelCalls', '3 emitted cold load genuine authored baseline', () => cad.load(text), '08-cold.snapshot.json');
  work(reopened, [], [0, 1, 2, 3, 4]); assert.equal(reopened.save(), text);
  exactData(reopened.bodies, prior.bodies); exactData(reopened.evidence, prior.evidence);
  assert.equal(dataHash(reopened.bodies), source.initialBodiesSHA256); const before = hold(reopened);
  flow.returnedLedgers.prisms = reopened.evidence.filter(e => e.kind === 'extrude').map(e => e.native.report.childNativeWork);
  flow.returnedLedgers.difference = reopened.evidence[4].native.report.directCounts;
  const result = stage('massQueries', '6 emitted cold part density2700', () => reopened.massProperties('part', { density: 2700 }), '09-cold-pocket.mass.json');
  flow.pocket = proveMass(result, reopened, 'part', 'pocket'); exactData(result, priorMass); unchanged(reopened, before);
  assert.equal(dataHash(result), source.pocket.resultSHA256); assert.equal(dataHash(result.details.native), source.pocket.nativeSHA256);
  flow.returnedLedgers.mass = result.details.native.report; flow.returnedLedgers.massRetainedParent = result.details.native.boolean.report.directCounts;
  const modelPanels = source.returnedLedgers.differences.reduce((n, e) => n + e.report.faceBuildCount, 0) + flow.returnedLedgers.difference.faceBuildCount;
  const massRetainedPanels = source.returnedLedgers.mass.filter(e => e.family === 'orthogonal-cell').reduce((n, e) => n + e.retainedParentReport.faceBuildCount, 0) + flow.returnedLedgers.massRetainedParent.faceBuildCount;
  assert.equal(modelPanels, 124); assert.equal(massRetainedPanels, 170);
  flow.accounting = { modelCalls: source.modelCalls + flow.modelCalls, massQueries: source.massQueries + flow.massQueries, tessellations: 0,
    returnedModelPrismReports: source.returnedLedgers.prisms.length + flow.returnedLedgers.prisms.length, returnedModelDifferenceReports: 3,
    returnedMassReports: source.returnedLedgers.mass.length + 1, returnedModelPanelCount: modelPanels,
    retainedSuccessfulMassParentPanelCount: massRetainedPanels, failedMassParentPanelsSourceDerivedOnly: 46,
    combinedBooleanRootsSourceDerivedOnly: 8, combinedBooleanPanelsSourceDerivedOnly: 340, fullTransitiveNativeCoverage: 'NOT_MEASURED' };
  assert.equal(flow.accounting.modelCalls, 3); assert.equal(flow.accounting.massQueries, 6); assert.equal(flow.accounting.returnedModelPrismReports, 5);
  flow.status = 'passed'; flow.completedAt = new Date().toISOString(); flow.wallElapsedMS = performance.now() - started; write();
  console.log(signedData({ status: flow.status, modelCalls: 1, massQueries: 1, nativeElapsedMS: flow.nativeElapsedMS, accounting: flow.accounting }));
} catch (error) { flow.status = 'failed'; flow.failure = errorData(error); flow.failedAt = new Date().toISOString(); write(); throw error; }
