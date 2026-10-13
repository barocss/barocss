import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { AUTHORED_SHA256, EXPECTED_CAMPAIGN, proveMass, hold, unchanged, signedData, sha256, dataHash, exactData,
  snapshotData, errorData, work } from './modeling-mass-fixture.mjs';

// Frozen source share: exactly two public model calls and five mass queries.
// No direct validator, classification, geometry preview or tessellation call.
assert.equal(Number(process.versions.node.split('.')[0]), 22); assert.ok(process.execArgv.includes('--no-opt'));
assert.match([...process.execArgv, process.env.NODE_OPTIONS ?? ''].join(' '), /--max[-_]old[-_]space[-_]size(?:=|\s+)1536(?:\s|$)/);
assert.equal(process.argv.length, 2); assert.ok(process.env.CAD_MODEL_TEST_MODULE); assert.ok(process.env.CAD_MODEL_EVIDENCE_DIR);
const entry = resolve(process.env.CAD_MODEL_TEST_MODULE), directory = resolve(process.env.CAD_MODEL_EVIDENCE_DIR), started = performance.now();
const authored = readFileSync(new URL('./modeling-offset-evidence/initial.cad-model.json', import.meta.url), 'utf8');
assert.equal(sha256(authored), AUTHORED_SHA256);
const priorBytes = readFileSync(new URL('./modeling-offset-evidence/source-flow.json', import.meta.url));
const prior = JSON.parse(priorBytes); assert.equal(prior.status, 'passed'); assert.equal(prior.issue, 1724);
mkdirSync(directory, { recursive: true });
const receipt = resolve(directory, 'source-flow.json');
const flow = { status: 'running', issue: 1790, processId: process.pid, processInstanceId: randomUUID(), nodeVersion: process.version,
  startedAt: new Date().toISOString(), entrySHA256: sha256(readFileSync(entry)), modelCalls: 0, massQueries: 0, tessellations: 0,
  nativeElapsedMS: 0, stages: [], artifacts: {}, returnedLedgers: { prisms: [], differences: [], mass: [] },
  expectedWholeCampaign: EXPECTED_CAMPAIGN, fullTransitiveNativeCoverage: 'NOT_MEASURED', sourceDerivedExpectedWorkIsNotInstrumented: true,
  limits: { heapMiB: 1536, freeDiskMiB: 500, processGroupSeconds: 600 }, externalSerialProcessGroupTimeoutRequired: true,
  historicalInput: { issue: 1724, authoredSHA256: AUTHORED_SHA256, sourceReceiptSHA256: sha256(priorBytes) } };
writeFileSync(receipt, signedData(flow) + '\n', { flag: 'wx' });
const write = () => writeFileSync(receipt, signedData(flow) + '\n');
function artifact(filename, data, scope, raw = false) {
  const bytes = raw ? data : signedData(data) + '\n'; assert.ok(Buffer.byteLength(bytes) <= 32 * 1024 * 1024);
  writeFileSync(resolve(directory, filename), bytes, { flag: 'wx' });
  flow.artifacts[filename] = { bytes: Buffer.byteLength(bytes), sha256: sha256(bytes), scope }; write();
}
function stage(kind, label, action, filename) {
  const disk = statfsSync(directory); assert.ok(disk.bavail * disk.bsize >= 500 * 1024 * 1024);
  assert.ok(performance.now() - started < 600000 && flow.nativeElapsedMS < 600000);
  assert.ok(flow[kind] < ({ modelCalls: 2, massQueries: 5 })[kind]);
  flow[kind]++; flow.pending = { kind, label }; write(); const begin = performance.now(); let outcome = 'threw', failure;
  try {
    const result = action(); outcome = 'returned';
    artifact(filename, kind === 'modelCalls' ? snapshotData(result) : result, 'actual returned data captured before oracle');
    if (kind === 'modelCalls') {
      for (const index of result.recomputation.evaluatedFeatures) {
        const e = result.evidence[index];
        if (e.kind === 'extrude') flow.returnedLedgers.prisms.push({ label, index, report: e.native.report.childNativeWork });
        if (e.kind === 'difference') flow.returnedLedgers.differences.push({ label, report: e.native.report.directCounts });
      }
    } else flow.returnedLedgers.mass.push({ label, family: result.family, report: result.details.native.report,
      ...(result.family === 'orthogonal-cell' ? { retainedParentReport: result.details.native.boolean.report.directCounts } : {}) });
    return result;
  } catch (error) { failure = errorData(error); artifact(filename + '.refusal.json', failure, 'complete original thrown error/cause before oracle'); throw error; }
  finally { const elapsedMS = performance.now() - begin; flow.nativeElapsedMS += elapsedMS;
    flow.stages.push({ kind, label, outcome, elapsedMS, ...(failure ? { failure } : {}) }); flow.pending = null; write(); }
}
try {
  const { cad, CadModelError, AxisBoxSolidMassError } = await import(pathToFileURL(entry).href);
  const initial = stage('modelCalls', '1 load genuine #1724 top-pocket intent', () => cad.load(authored), '01-baseline.snapshot.json');
  work(initial, [], [0, 1, 2, 3, 4]); assert.equal(initial.save(), authored);
  assert.equal(dataHash(initial.bodies.part.native), prior.initialBodySHA256); assert.equal(dataHash(initial.bodies), prior.initialBodiesSHA256);
  flow.initialBodiesSHA256 = dataHash(initial.bodies); flow.initialBodySHA256 = dataHash(initial.bodies.part.native);
  artifact('initial.cad-model.json', initial.save(), 'unchanged accepted authored baseline', true);
  const before = hold(initial), acceptedResults = [];
  const plate = stage('massQueries', '1 plate density2700', () => initial.massProperties('plate', { densityKgPerM3: 2700 }), '02-plate.mass.json');
  flow.plate = proveMass(plate, initial, 'plate', 'plate'); acceptedResults.push([plate, dataHash(plate)]); unchanged(initial, before);
  const pocket = stage('massQueries', '2 pocket density2700', () => initial.massProperties('part', { densityKgPerM3: 2700 }), '03-pocket.mass.json');
  flow.pocket = proveMass(pocket, initial, 'part', 'pocket'); acceptedResults.push([pocket, dataHash(pocket)]); unchanged(initial, before);
  const doubled = stage('massQueries', '3 same pocket density5400', () => initial.massProperties('part', { densityKgPerM3: 5400 }), '04-doubled.mass.json');
  flow.doubled = proveMass(doubled, initial, 'part', 'pocket', 5400); acceptedResults.push([doubled, dataHash(doubled)]);
  exactData(doubled.details.native.boolean, pocket.details.native.boolean); exactData(doubled.details.exact.centroidMM, pocket.details.exact.centroidMM);
  unchanged(initial, before);
  let caught;
  try { stage('massQueries', '4 genuine positive mass underflow refusal', () => initial.massProperties('part', { densityKgPerM3: Number.MIN_VALUE }), '05-underflow.mass.json'); }
  catch (error) { caught = error; }
  assert.ok(caught instanceof CadModelError); assert.equal(caught.code, 'NATIVE'); assert.equal(caught.operation, 'massProperties');
  assert.ok(caught.cause instanceof AxisBoxSolidMassError); assert.equal(caught.cause.code, 'REPRESENTABILITY');
  flow.underflow = { error: errorData(caught), originalTypedCause: true, density: Number.MIN_VALUE,
    parentReconstruction: 'one whole Boolean validation is source-derived from unchanged provider before conversion refusal; no failed-query report returned' };
  unchanged(initial, before); for (const [result, hash] of acceptedResults) assert.equal(dataHash(result), hash);
  const window = stage('modelCalls', '2 same original snapshot depth8 recovery', () => initial.withParameters({ depth: 8 }), '06-window.snapshot.json');
  work(window, [0, 1, 2], [3, 4], initial); assert.equal(window.bodies.part.native.report.volumeMM3, 5120);
  const windowBefore = hold(window);
  const windowMass = stage('massQueries', '5 through-window density2700', () => window.massProperties('part', { densityKgPerM3: 2700 }), '07-window.mass.json');
  flow.window = proveMass(windowMass, window, 'part', 'window'); unchanged(window, windowBefore); unchanged(initial, before);
  for (const [result, hash] of acceptedResults) assert.equal(dataHash(result), hash);
  assert.equal(flow.modelCalls, 2); assert.equal(flow.massQueries, 5); assert.equal(flow.returnedLedgers.prisms.length, 3);
  assert.equal(flow.returnedLedgers.differences.length, 2); assert.equal(flow.returnedLedgers.mass.length, 4);
  flow.status = 'passed'; flow.completedAt = new Date().toISOString(); flow.wallElapsedMS = performance.now() - started; write();
  console.log(signedData({ status: flow.status, modelCalls: 2, massQueries: 5, tessellations: 0, nativeElapsedMS: flow.nativeElapsedMS,
    plate: { volumeMM3: plate.volumeMM3, massKG: plate.massKG }, pocket: { volumeMM3: pocket.volumeMM3, massKG: pocket.massKG, centroidMM: pocket.centroidMM },
    window: { volumeMM3: windowMass.volumeMM3, massKG: windowMass.massKG }, refusal: caught.cause.code }));
} catch (error) { flow.status = 'failed'; flow.failure = errorData(error); flow.failedAt = new Date().toISOString(); write(); throw error; }
