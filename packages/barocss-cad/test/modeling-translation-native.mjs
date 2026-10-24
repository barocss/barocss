import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { EXPECTED_CAMPAIGN, DEFAULTS, WIDER, RECOVERED, ZERO, translatedPair, proveSnapshot, proveRefusal,
  provePreview, work, hold, unchanged, signedData, sha256, dataHash, exactData, snapshotData, errorData,
  emptyLedgers, collectLedgers, accounting } from './modeling-translation-fixture.mjs';

// Five public model calls, two actual baseline previews. No other geometry,
// standalone validation, mass query, CPU preparation or adaptive retry.
assert.equal(Number(process.versions.node.split('.')[0]), 22); assert.ok(process.execArgv.includes('--no-opt'));
assert.match([...process.execArgv, process.env.NODE_OPTIONS ?? ''].join(' '), /--max[-_]old[-_]space[-_]size(?:=|\s+)1536(?:\s|$)/);
assert.equal(process.argv.length, 2); assert.ok(process.env.CAD_MODEL_TEST_MODULE); assert.ok(process.env.CAD_MODEL_EVIDENCE_DIR);
const entry = resolve(process.env.CAD_MODEL_TEST_MODULE), directory = resolve(process.env.CAD_MODEL_EVIDENCE_DIR), started = performance.now();
mkdirSync(directory, { recursive: true }); const receipt = resolve(directory, 'source-flow.json');
const flow = { status: 'running', issue: 1880, timingScope: 'stage action plus artifact persistence; not isolated kernel timing',
  processId: process.pid, processInstanceId: randomUUID(), nodeVersion: process.version, startedAt: new Date().toISOString(),
  groupStartedAtMS: Date.now(), entrySHA256: sha256(readFileSync(entry)), modelCalls: 0, tessellations: 0,
  massQueries: 0, cpuBufferPreparations: 0, standaloneValidators: 0, nativeElapsedMS: 0,
  stages: [], artifacts: {}, transport: {}, returnedLedgers: emptyLedgers(), expectedWholeCampaign: EXPECTED_CAMPAIGN,
  fullTransitiveNativeCoverage: 'NOT_MEASURED', sourceDerivedExpectedWorkIsNotInstrumented: true,
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
  assert.ok(flow[kind] < ({ modelCalls: 5, tessellations: 2 })[kind]);
  flow[kind]++; flow.pending = { kind, label }; write(); const begin = performance.now(); let outcome = 'threw', failure;
  try {
    const result = action(); outcome = 'returned';
    artifact(filename, kind === 'modelCalls' ? snapshotData(result) : result, 'actual complete returned data captured before fixture oracle');
    if (kind === 'modelCalls') collectLedgers(flow.returnedLedgers, result, label);
    else flow.returnedLedgers.previews.push({ label, report: result.report.parentNativeWork });
    return result;
  } catch (error) {
    failure = errorData(error); artifact(filename + '.refusal.json', failure, 'original thrown error and complete cause captured before refusal oracle');
    throw error;
  } finally {
    const elapsedMS = performance.now() - begin; flow.nativeElapsedMS += elapsedMS;
    flow.stages.push({ kind, label, outcome, elapsedMS, ...(failure ? { failure } : {}) }); flow.pending = null; write();
  }
}
try {
  const { cad, CadModelError, tessellateConvexPlanarSolid } = await import(pathToFileURL(entry).href);
  const initial = stage('modelCalls', '1 original constrained gusset plus owned copy at [48,-0,0]', translatedPair(cad).build, '01-baseline.snapshot.json');
  artifact('initial.cad-model.json', initial.save(), 'actual signed-zero authored baseline for emitted cold load', true);
  const before = hold(initial); work(initial, [], [0, 1, 2]); flow.baseline = proveSnapshot(initial, DEFAULTS);
  const historicalPath = new URL('./modeling-gusset-evidence/01-baseline.snapshot.json', import.meta.url), historicalBytes = readFileSync(historicalPath);
  const historical = JSON.parse(historicalBytes);
  exactData(initial.bodies.left.native, historical.bodies.gusset.native, 'unchanged actual #1862 original native body');
  exactData(initial.evidence.slice(0, 2), historical.evidence, 'unchanged #1862 sketch/prism evidence');
  flow.historicalParent = { issue: 1862, snapshotSHA256: sha256(historicalBytes), bodySHA256: dataHash(historical.bodies.gusset.native), exactParity: true };
  flow.baselineSnapshotSHA256 = dataHash(snapshotData(initial)); flow.baselineBodiesSHA256 = dataHash(initial.bodies); flow.baselineEvidenceSHA256 = dataHash(initial.evidence);
  artifact('baseline.translation.json', initial.evidence[2].native, 'complete parent, actual reconstructed target, native reports and complete lineage');
  const previews = {
    left: stage('tessellations', 'baseline left actual convex preview, fan budget40',
      () => tessellateConvexPlanarSolid(initial.bodies.left.native, { maximumFanTriangles: 40 }), 'baseline-left.preview.json'),
    right: stage('tessellations', 'baseline right actual convex preview, fan budget40',
      () => tessellateConvexPlanarSolid(initial.bodies.right.native, { maximumFanTriangles: 40 }), 'baseline-right.preview.json'),
  };
  // Both complete actual packets have been persisted before either mesh oracle.
  flow.previews = { left: provePreview(previews.left, initial.bodies.left.native), right: provePreview(previews.right, initial.bodies.right.native) };
  unchanged(initial, before);
  const outputIdentities = Object.fromEntries(Object.entries(initial.bodies).map(([name, body]) => [name,
    { family: body.family, solidId: body.native.request.options.solidId, sourceIds: body.native.request.assets.map(a => a.sourceId) }]));
  const transfer = artifact('baseline-transfer.json', { ...snapshotData(initial), summary: flow.baseline, previews, outputIdentities,
    lineage: initial.evidence[2].native.lineage, bodiesSHA256: flow.baselineBodiesSHA256, basis: 'authored XYZ; no coordinate conversion',
    scope: 'complete actual two-output native baseline and exactly two genuine convex previews; no editor or physical acceptance' },
  'reusable actual native, canonical save, summaries, output identities, lineage and both complete native preview packets');
  if (process.env.CAD_MODEL_TRANSPORT_DIR) {
    const out = resolve(process.env.CAD_MODEL_TRANSPORT_DIR); mkdirSync(out, { recursive: true });
    const path = resolve(out, 'modeling-translation-baseline-native.json'); writeFileSync(path, transfer, { flag: 'wx' });
    assert.equal(sha256(readFileSync(path)), sha256(transfer));
    flow.transport.baseline = { path, bytes: Buffer.byteLength(transfer), sha256: sha256(transfer) }; write();
  }
  const wider = stage('modelCalls', '2 original spacing64 reuses unchanged sketch and prism', () => initial.withParameters({ spacing: 64 }), '02-wider.snapshot.json');
  artifact('wider.cad-model.json', wider.save(), 'actual spacing64 authored result for whole cold parity', true);
  const widerBefore = hold(wider); work(wider, [0, 1], [2], initial); flow.wider = proveSnapshot(wider, WIDER);
  flow.widerSnapshotSHA256 = dataHash(snapshotData(wider)); flow.widerBodiesSHA256 = dataHash(wider.bodies); flow.widerEvidenceSHA256 = dataHash(wider.evidence);
  unchanged(initial, before);
  let representability;
  try {
    stage('modelCalls', '3 original spacing0.1 refuses after parent validation before target Faces',
      () => initial.withParameters({ spacing: .1 }), '03-representability.unexpected.snapshot.json');
  } catch (error) { representability = error; }
  flow.representability = proveRefusal(representability, CadModelError, initial);
  flow.returnedLedgers.parents.push({ label: '3 actual refusal parent validation', index: 2,
    report: representability.cause.report.parentValidation.childNativeWork });
  unchanged(initial, before); unchanged(wider, widerBefore);
  artifact('after-rejection.original.snapshot.json', snapshotData(initial), 'actual unchanged original state after failed edit');
  artifact('after-rejection.original.cad-model.json', initial.save(), 'actual preserved save after failed edit', true);
  const recovered = stage('modelCalls', '4 same original height12/spacing-48/offsetY-8/offsetZ-4 atomic recovery',
    () => initial.withParameters({ height: 12, spacing: -48, offsetY: -8, offsetZ: -4 }), '04-recovered.snapshot.json');
  artifact('recovered.cad-model.json', recovered.save(), 'actual successful signed negative-offset recovery save', true);
  const recoveredBefore = hold(recovered); work(recovered, [], [0, 1, 2], initial); flow.recovered = proveSnapshot(recovered, RECOVERED);
  unchanged(initial, before); unchanged(wider, widerBefore);
  const zero = stage('modelCalls', '5 original spacing0/offsetY+0 retains real independent coincident copy',
    () => initial.withParameters({ spacing: 0, offsetY: 0 }), '05-zero.snapshot.json');
  artifact('zero.cad-model.json', zero.save(), 'actual positive-zero edited save retaining independently owned copy', true);
  work(zero, [0, 1], [2], initial); flow.zero = proveSnapshot(zero, ZERO);
  assert.ok(Object.is(initial.parameters.offsetY, -0)); assert.ok(Object.is(zero.parameters.offsetY, 0));
  exactData(zero.bodies.right.native.graph.vertices.map(v => v.point), zero.bodies.left.native.graph.vertices.map(v => v.point));
  unchanged(initial, before); unchanged(wider, widerBefore); unchanged(recovered, recoveredBefore);
  assert.equal(flow.modelCalls, 5); assert.equal(flow.tessellations, 2);
  assert.equal(flow.stages.filter(s => s.kind === 'modelCalls' && s.outcome === 'threw').length, 1);
  flow.accounting = accounting(flow.returnedLedgers, [2, 2, 5, 4, 4, 2]);
  exactData(flow.accounting, { returnedLedgerSourceCompilations: 92, returnedLedgerBindingObservations: 1080, returnedLedgerD1: 3240,
    knownSourceCompilations: 118, combinedBindingObservations: 1368, knownD1: 4104, initialFaceConstructionCount: 24,
    fullTransitiveNativeCoverage: 'NOT_MEASURED' });
  exactData([flow.baseline.volumesMM3, flow.wider.volumesMM3, flow.recovered.volumesMM3, flow.zero.volumesMM3],
    [{ left: 6912, right: 6912 }, { left: 6912, right: 6912 }, { left: 3648, right: 3648 }, { left: 6912, right: 6912 }]);
  assert.ok(flow.nativeElapsedMS < 600000 && Date.now() - flow.groupStartedAtMS < 600000);
  flow.status = 'passed'; flow.completedAt = new Date().toISOString(); flow.wallElapsedMS = performance.now() - started; write();
  console.log(signedData({ status: flow.status, modelCalls: flow.modelCalls, tessellations: flow.tessellations,
    nativeElapsedMS: flow.nativeElapsedMS, representability: flow.representability.code, accounting: flow.accounting, transfer: flow.transport }));
} catch (error) { flow.status = 'failed'; flow.failure = errorData(error); flow.failedAt = new Date().toISOString(); write(); throw error; }
