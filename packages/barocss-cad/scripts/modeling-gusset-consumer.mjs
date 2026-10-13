import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { cad } from '../dist/index.js';
import { EXPECTED_CAMPAIGN, DEFAULTS, proveSnapshot, work, hold, unchanged, signedData, sha256, dataHash, exactData,
  snapshotData, errorData } from '../test/modeling-gusset-fixture.mjs';

// A fresh Node process imports the actual emitted public package. Only saved
// authored intent crosses into cad.load; no source-process cache is adopted.
assert.equal(Number(process.versions.node.split('.')[0]), 22); assert.ok(process.execArgv.includes('--no-opt'));
assert.match([...process.execArgv, process.env.NODE_OPTIONS ?? ''].join(' '), /--max[-_]old[-_]space[-_]size(?:=|\s+)1536(?:\s|$)/);
assert.equal(process.argv.length, 3); const directory = resolve(process.argv[2]), started = performance.now();
const sourceBytes = readFileSync(resolve(directory, 'source-flow.json')), source = JSON.parse(sourceBytes);
assert.equal(source.status, 'passed'); assert.equal(source.issue, 1862); assert.equal(source.modelCalls, 5); assert.equal(source.tessellations, 1);
assert.equal(source.massQueries, 0); assert.equal(source.cpuBufferPreparations, 0); assert.equal(source.standaloneValidators, 0);
exactData(source.expectedWholeCampaign, EXPECTED_CAMPAIGN);
function input(filename) {
  const bytes = readFileSync(resolve(directory, filename)); assert.equal(sha256(bytes), source.artifacts[filename].sha256);
  assert.equal(bytes.length, source.artifacts[filename].bytes); return bytes;
}
const text = input('initial.cad-model.json').toString('utf8'), baselinePrior = JSON.parse(input('01-baseline.snapshot.json'));
const recoveredText = input('recovered.cad-model.json').toString('utf8'), recoveredPrior = JSON.parse(input('04-recovered.snapshot.json'));
// Verify the retained actual preview transfer without tessellating it again.
const transfer = JSON.parse(input('baseline-transfer.json')), preview = JSON.parse(input('baseline.preview.json'));
exactData(transfer.preview, preview); exactData(transfer.bodies, baselinePrior.bodies); assert.equal(transfer.text, text);
const receipt = resolve(directory, 'cold-flow.json');
const flow = { status: 'running', issue: 1862, timingScope: 'stage action plus artifact persistence; not isolated kernel timing', processId: process.pid, processInstanceId: randomUUID(), nodeVersion: process.version,
  entrySHA256: sha256(readFileSync(new URL('../dist/index.js', import.meta.url))), sourceReceiptSHA256: sha256(sourceBytes), authoredInputSHA256: sha256(text),
  sourceProcessInstanceId: source.processInstanceId, groupStartedAtMS: source.groupStartedAtMS,
  modelCalls: 0, tessellations: 0, massQueries: 0, cpuBufferPreparations: 0, standaloneValidators: 0,
  nativeElapsedMS: source.nativeElapsedMS, sourceNativeElapsedMS: source.nativeElapsedMS,
  expectedWholeCampaign: EXPECTED_CAMPAIGN, fullTransitiveNativeCoverage: 'NOT_MEASURED', sourceDerivedExpectedWorkIsNotInstrumented: true,
  limits: { heapMiB: 1536, freeDiskMiB: 500, processGroupSeconds: 600 },
  stages: [], artifacts: {}, returnedLedgers: { sketches: [], prisms: [] }, externalSerialProcessGroupTimeoutRequired: true };
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
    const result = action(); outcome = 'returned'; persist(filename, snapshotData(result), 'actual complete cold returned data captured before oracle');
    for (const index of result.recomputation.evaluatedFeatures) {
      const evidence = result.evidence[index];
      if (evidence.kind === 'sketch') flow.returnedLedgers.sketches.push({ label, index, report: evidence.native.report });
      if (evidence.kind === 'extrude') flow.returnedLedgers.prisms.push({ label, index, report: evidence.native.report.childNativeWork });
    }
    return result;
  } catch (error) { failure = errorData(error); persist(filename + '.refusal.json', failure, 'complete original cold failure before any assertion'); throw error; }
  finally {
    const elapsedMS = performance.now() - begin; flow.nativeElapsedMS += elapsedMS;
    flow.stages.push({ label, outcome, elapsedMS, ...(failure ? { failure } : {}) }); flow.pending = null; write();
  }
}
try {
  const reopened = stage('6 emitted cold cad.load baseline saved intent', () => cad.load(text), '06-cold.snapshot.json');
  const before = hold(reopened); work(reopened); flow.cold = proveSnapshot(reopened);
  assert.equal(reopened.save(), text); exactData(snapshotData(reopened), baselinePrior);
  assert.equal(dataHash(reopened.bodies.gusset.native), source.initialBodySHA256); assert.equal(dataHash(reopened.bodies), source.initialBodiesSHA256);
  const recovered = stage('7 emitted cold baseline height12 recovery edit', () => reopened.withParameters({ height: 12 }), '07-cold-recovered.snapshot.json');
  work(recovered, reopened); flow.recovered = proveSnapshot(recovered, { ...DEFAULTS, height: 12 });
  assert.equal(recovered.save(), recoveredText); exactData(snapshotData(recovered), recoveredPrior);
  assert.equal(dataHash(recovered.bodies.gusset.native), source.recoveredBodySHA256); assert.equal(dataHash(recovered.bodies), source.recoveredBodiesSHA256);
  unchanged(reopened, before); assert.equal(flow.modelCalls, 2); assert.equal(flow.returnedLedgers.prisms.length, 2);
  const prisms = [...source.returnedLedgers.prisms, ...flow.returnedLedgers.prisms], previewReports = source.returnedLedgers.preview;
  const sum = (reports, key) => reports.reduce((n, entry) => n + entry.report[key], 0);
  exactData([prisms.length, sum(prisms, 'sourceCompilationCount'), sum(prisms, 'bindingObservationCount'), sum(prisms, 'totalD1Count')], [5, 65, 720, 2160]);
  const combined = [...prisms, ...previewReports];
  exactData([sum(combined, 'sourceCompilationCount'), sum(combined, 'bindingObservationCount'), sum(combined, 'totalD1Count')], [71, 792, 2376]);
  const standaloneSketchReports = source.returnedLedgers.sketches.length + flow.returnedLedgers.sketches.length; assert.equal(standaloneSketchReports, 5);
  flow.accounting = { publicModelCalls: source.modelCalls + flow.modelCalls, successfulPrismReports: prisms.length,
    actualNativeConflicts: 1, actualRepresentabilityRefusals: 1, actualTessellations: source.tessellations,
    returnedStandaloneSketchReports: standaloneSketchReports, returnedLedgerSourceCompilations: sum(combined, 'sourceCompilationCount'),
    returnedLedgerBindingObservations: sum(combined, 'bindingObservationCount'), returnedLedgerD1: sum(combined, 'totalD1Count'),
    sourceDerivedSolverAttempts: 12, sourceDerivedSuccessfulSketchCompilations: 10,
    knownSourceCompilationsIncludingStandaloneSourceCallSites: sum(combined, 'sourceCompilationCount') + standaloneSketchReports,
    massQueries: 0, cpuBufferPreparations: 0, standaloneValidators: 0, fullTransitiveNativeCoverage: 'NOT_MEASURED' };
  assert.equal(flow.accounting.publicModelCalls, 7); assert.equal(flow.accounting.knownSourceCompilationsIncludingStandaloneSourceCallSites, 76);
  exactData([flow.cold.volumeMM3, flow.recovered.volumeMM3], [6912, 3648]);
  assert.ok(flow.nativeElapsedMS < 600000 && Date.now() - flow.groupStartedAtMS < 600000);
  flow.status = 'passed'; flow.completedAt = new Date().toISOString(); flow.wallElapsedMS = performance.now() - started; write();
  console.log(signedData({ status: flow.status, modelCalls: flow.modelCalls, tessellations: 0, nativeElapsedMS: flow.nativeElapsedMS, accounting: flow.accounting }));
} catch (error) { flow.status = 'failed'; flow.failure = errorData(error); flow.failedAt = new Date().toISOString(); write(); throw error; }
