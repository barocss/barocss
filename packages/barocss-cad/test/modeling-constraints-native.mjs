import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { EXPECTED_CAMPAIGN, DEFAULTS, constrainedPlate, clockwisePlate, proveSnapshot, proveConflict, proveUnderconstrained,
  provePreview, work, hold, unchanged, signedData, sha256, dataHash, exactData, snapshotData, errorData } from './modeling-constraints-fixture.mjs';

// Frozen source share: six public model calls, including both refusals, and
// exactly one genuine convex preview. No standalone validator or mass query.
assert.equal(Number(process.versions.node.split('.')[0]), 22); assert.ok(process.execArgv.includes('--no-opt'));
assert.match([...process.execArgv, process.env.NODE_OPTIONS ?? ''].join(' '), /--max[-_]old[-_]space[-_]size(?:=|\s+)1536(?:\s|$)/);
assert.equal(process.argv.length, 2); assert.ok(process.env.CAD_MODEL_TEST_MODULE); assert.ok(process.env.CAD_MODEL_EVIDENCE_DIR);
const entry = resolve(process.env.CAD_MODEL_TEST_MODULE), directory = resolve(process.env.CAD_MODEL_EVIDENCE_DIR), started = performance.now();
mkdirSync(directory, { recursive: true }); const receipt = resolve(directory, 'source-flow.json');
const flow = { status: 'running', issue: 1835, timingScope: 'stage action plus artifact persistence; not isolated kernel timing', processId: process.pid, processInstanceId: randomUUID(), nodeVersion: process.version,
  startedAt: new Date().toISOString(), groupStartedAtMS: Date.now(), entrySHA256: sha256(readFileSync(entry)),
  modelCalls: 0, tessellations: 0, massQueries: 0, cpuBufferPreparations: 0, standaloneValidators: 0,
  nativeElapsedMS: 0, stages: [], artifacts: {}, transport: {}, returnedLedgers: { sketches: [], prisms: [], preview: [] },
  expectedWholeCampaign: EXPECTED_CAMPAIGN, fullTransitiveNativeCoverage: 'NOT_MEASURED', sourceDerivedExpectedWorkIsNotInstrumented: true,
  limits: { heapMiB: 1536, freeDiskMiB: 500, processGroupSeconds: 600 }, externalSerialProcessGroupTimeoutRequired: true };
writeFileSync(receipt, signedData(flow) + '\n', { flag: 'wx' }); const write = () => writeFileSync(receipt, signedData(flow) + '\n');
function artifact(filename, value, scope, raw = false) {
  const bytes = raw ? value : signedData(value) + '\n'; assert.ok(Buffer.byteLength(bytes) <= 32 * 1024 * 1024);
  writeFileSync(resolve(directory, filename), bytes, { flag: 'wx' });
  flow.artifacts[filename] = { bytes: Buffer.byteLength(bytes), sha256: sha256(bytes), scope }; write(); return bytes;
}
function stage(kind, label, action, filename) {
  const disk = statfsSync(directory); assert.ok(disk.bavail * disk.bsize >= 500 * 1024 * 1024);
  assert.ok(Date.now() - flow.groupStartedAtMS < 600000 && flow.nativeElapsedMS < 600000);
  assert.ok(flow[kind] < ({ modelCalls: 6, tessellations: 1 })[kind]);
  flow[kind]++; flow.pending = { kind, label }; write(); const begin = performance.now(); let outcome = 'threw', failure;
  try {
    const result = action(); outcome = 'returned';
    artifact(filename, kind === 'modelCalls' ? snapshotData(result) : result, 'actual complete returned data captured before fixture oracle');
    if (kind === 'modelCalls') {
      for (const index of result.recomputation.evaluatedFeatures) {
        const evidence = result.evidence[index];
        if (evidence.kind === 'sketch') flow.returnedLedgers.sketches.push({ label, index, report: evidence.native.report });
        if (evidence.kind === 'extrude') flow.returnedLedgers.prisms.push({ label, index, report: evidence.native.report.childNativeWork });
      }
    } else flow.returnedLedgers.preview.push({ label, report: result.report.parentNativeWork });
    return result;
  } catch (error) {
    failure = errorData(error); artifact(filename + '.refusal.json', failure, 'original thrown error and complete cause captured before refusal oracle'); throw error;
  } finally {
    const elapsedMS = performance.now() - begin; flow.nativeElapsedMS += elapsedMS;
    flow.stages.push({ kind, label, outcome, elapsedMS, ...(failure ? { failure } : {}) }); flow.pending = null; write();
  }
}
try {
  const { cad, CadModelError, XYAffineSketchError, tessellateConvexPlanarSolid } = await import(pathToFileURL(entry).href);
  const initial = stage('modelCalls', '1 fully constrained baseline with redundant fixed(b)', constrainedPlate(cad).build, '01-baseline.snapshot.json');
  artifact('initial.cad-model.json', initial.save(), 'actual accepted authored baseline for fresh emitted cold load', true);
  const before = hold(initial); work(initial); flow.baseline = proveSnapshot(initial);
  flow.initialBodySHA256 = dataHash(initial.bodies.part.native); flow.initialBodiesSHA256 = dataHash(initial.bodies);
  artifact('baseline.sketch.json', initial.evidence[0].native, 'complete genuine standalone baseline sketch');
  artifact('baseline.prism.json', initial.evidence[1].native, 'complete genuine reconstructed-sketch prism and qualified solid');
  const preview = stage('tessellations', 'one complete baseline convex mesh with fan budget40',
    () => tessellateConvexPlanarSolid(initial.bodies.part.native, { maximumFanTriangles: 40 }), 'baseline.preview.json');
  flow.preview = provePreview(preview, initial.bodies.part.native); unchanged(initial, before);
  const transfer = artifact('baseline-transfer.json', { ...snapshotData(initial), summary: flow.baseline, preview,
    bodySHA256: flow.initialBodySHA256, basis: 'authored XYZ; no coordinate conversion',
    scope: 'complete actual baseline native results and sole genuine convex preview; no CPU preparation, editor or physical acceptance' },
  'reusable actual native and mesh transfer; no synthesized substitute geometry');
  if (process.env.CAD_MODEL_TRANSPORT_DIR) {
    const out = resolve(process.env.CAD_MODEL_TRANSPORT_DIR); mkdirSync(out, { recursive: true });
    const path = resolve(out, 'modeling-constraints-baseline-native.json'); writeFileSync(path, transfer, { flag: 'wx' });
    assert.equal(sha256(readFileSync(path)), sha256(transfer));
    flow.transport.baseline = { path, bytes: Buffer.byteLength(transfer), sha256: sha256(transfer) }; write();
  }
  const wider = stage('modelCalls', '2 baseline width40 rebuild', () => initial.withParameters({ width: 40 }), '02-wider.snapshot.json');
  const widerBefore = hold(wider); work(wider, initial); flow.wider = proveSnapshot(wider, { ...DEFAULTS, width: 40 }); unchanged(initial, before);
  let conflict;
  try { stage('modelCalls', '3 original baseline lockY1 genuine conflict', () => initial.withParameters({ lockY: 1 }), '03-conflict.unexpected.snapshot.json'); }
  catch (error) { conflict = error; }
  // Any unexpected throw or unexpected return fails here, before another call.
  flow.conflict = proveConflict(conflict, { CadModelError, XYAffineSketchError }, initial);
  unchanged(initial, before); unchanged(wider, widerBefore);
  const recovered = stage('modelCalls', '4 same original baseline height16 recovery', () => initial.withParameters({ height: 16 }), '04-recovered.snapshot.json');
  artifact('recovered.cad-model.json', recovered.save(), 'accepted recovery intent for exact cold recovery parity', true);
  const recoveredBefore = hold(recovered); work(recovered, initial); flow.recovered = proveSnapshot(recovered, { ...DEFAULTS, height: 16 });
  flow.recoveredBodySHA256 = dataHash(recovered.bodies.part.native); flow.recoveredBodiesSHA256 = dataHash(recovered.bodies);
  unchanged(initial, before); unchanged(wider, widerBefore);
  let underconstrained;
  try { stage('modelCalls', '5 fixed(a) only plus cyclic H/V explicit DOF2 refusal', constrainedPlate(cad, true).build, '05-underconstrained.unexpected.snapshot.json'); }
  catch (error) { underconstrained = error; }
  flow.underconstrained = proveUnderconstrained(underconstrained, CadModelError);
  artifact('underconstrained.native.json', underconstrained.cause, 'complete actual frozen underconstrained native success; no adopted prism');
  flow.returnedLedgers.sketches.push({ label: '5 complete actual refusal cause', index: 0, report: underconstrained.cause.report });
  const clockwise = stage('modelCalls', '6 clockwise5x3 offset-1 extrusion2', clockwisePlate(cad).build, '06-clockwise.snapshot.json');
  artifact('clockwise.cad-model.json', clockwise.save(), 'actual cycle-indexed clockwise intent with authored negative zero', true);
  work(clockwise); flow.clockwise = proveSnapshot(clockwise, {}, 'cw');
  unchanged(initial, before); unchanged(wider, widerBefore); unchanged(recovered, recoveredBefore);
  assert.equal(flow.modelCalls, 6); assert.equal(flow.tessellations, 1);
  assert.equal(flow.returnedLedgers.prisms.length, 4); assert.equal(flow.returnedLedgers.sketches.length, 5); assert.equal(flow.returnedLedgers.preview.length, 1);
  assert.equal(flow.stages.filter(s => s.kind === 'modelCalls' && s.outcome === 'threw').length, 2);
  exactData(flow.returnedLedgers.prisms.map(p => p.report.sourceCompilationCount), [13, 13, 13, 13]);
  flow.status = 'passed'; flow.completedAt = new Date().toISOString(); flow.wallElapsedMS = performance.now() - started; write();
  console.log(signedData({ status: flow.status, modelCalls: flow.modelCalls, tessellations: flow.tessellations,
    nativeElapsedMS: flow.nativeElapsedMS, volumesMM3: [flow.baseline.volumeMM3, flow.wider.volumeMM3, flow.recovered.volumeMM3, flow.clockwise.volumeMM3],
    conflict: flow.conflict.code, underconstrainedDOF: flow.underconstrained.degreesOfFreedom, transfer: flow.transport }));
} catch (error) { flow.status = 'failed'; flow.failure = errorData(error); flow.failedAt = new Date().toISOString(); write(); throw error; }
