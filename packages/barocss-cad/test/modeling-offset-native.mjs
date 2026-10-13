import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { EXPECTED_CAMPAIGN, topPocket, offsetPair, snapshotData, work, proveSnapshot, proveNative, provePreview,
  proveOffsetPair, nativeBodyHash, allBodiesHash, signedData, sha256, exactData, deepFrozen, errorData } from './modeling-offset-fixture.mjs';

// Frozen #1724 source campaign only: six public calls, one retained-result prism
// validator and 46 raw Surface tessellations. Cold owns the other two calls.
// Source/fixture review and a separate serial process-group grant must precede execution.
assert.equal(Number(process.versions.node.split('.')[0]), 22); assert.ok(process.execArgv.includes('--no-opt'));
assert.match([...process.execArgv, process.env.NODE_OPTIONS ?? ''].join(' '), /--max[-_]old[-_]space[-_]size(?:=|\s+)1536(?:\s|$)/);
assert.equal(process.argv.length, 2); assert.ok(process.env.CAD_MODEL_TEST_MODULE);
assert.ok(process.env.CAD_MODEL_OFFSET_HISTORICAL_TRANSFER, 'Retained #1649 baseline, never a fresh geometry reconstruction, is required');
const entry = resolve(process.env.CAD_MODEL_TEST_MODULE), directory = resolve(process.env.CAD_MODEL_EVIDENCE_DIR ?? new URL('./modeling-offset-evidence', import.meta.url).pathname);
const historicalBytes = readFileSync(resolve(process.env.CAD_MODEL_OFFSET_HISTORICAL_TRANSFER));
const historicalReceipt = JSON.parse(readFileSync(new URL('./modeling-box-cut-evidence/source-flow.json', import.meta.url), 'utf8'));
assert.equal(sha256(historicalBytes), historicalReceipt.transfer.sha256); assert.equal(historicalBytes.length, historicalReceipt.transfer.bytes);
const historical = JSON.parse(historicalBytes), historicalText = readFileSync(new URL('./modeling-box-cut-evidence/initial.cad-model.json', import.meta.url), 'utf8');
assert.equal(historical.text, historicalText);
mkdirSync(directory, { recursive: true });
const receipt = resolve(directory, 'source-flow.json'), started = performance.now();
const flow = { status: 'running', issue: 1724, processId: process.pid, processInstanceId: randomUUID(), nodeVersion: process.version,
  startedAt: new Date().toISOString(), entrySHA256: sha256(readFileSync(entry)), modelCalls: 0, prismValidators: 0, tessellations: 0,
  nativeElapsedMS: 0, stages: [], artifacts: {}, transport: {}, returnedLedgers: { prisms: [], differences: [], validator: [] },
  expectedWholeCampaign: EXPECTED_CAMPAIGN, sourceDerivedExpectedWorkIsNotInstrumented: true,
  fullTransitiveNativeCoverage: 'NOT_MEASURED', externalSerialProcessGroupTimeoutRequired: true,
  limits: { nodeMajor: 22, heapMiB: 1536, freeDiskMiB: 500, processGroupSeconds: 600 },
  historicalInput: { issue: 1649, sha256: sha256(historicalBytes), bytes: historicalBytes.length } };
writeFileSync(receipt, signedData(flow) + '\n', { flag: 'wx' });
const write = () => writeFileSync(receipt, signedData(flow) + '\n');
function artifact(filename, bytes, scope, continuingOwnPreview = false) {
  assert.ok(Buffer.byteLength(bytes) <= 32 * 1024 * 1024);
  writeFileSync(resolve(directory, filename), bytes, { flag: continuingOwnPreview ? 'w' : 'wx' });
  flow.artifacts[filename] = { bytes: Buffer.byteLength(bytes), sha256: sha256(bytes), scope }; write();
}
const dataArtifact = (filename, data, scope, continuing = false) => artifact(filename, signedData(data) + '\n', scope, continuing);
function stage(kind, label, action, filename, capture = snapshotData) {
  const disk = statfsSync(directory); assert.ok(disk.bavail * disk.bsize >= 500 * 1024 * 1024);
  assert.ok(performance.now() - started < 600000 && flow.nativeElapsedMS < 600000);
  assert.ok(flow[kind] < ({ modelCalls: 6, prismValidators: 1, tessellations: 46 })[kind]);
  flow[kind]++; flow.pending = { kind, label }; write(); const begin = performance.now(); let outcome = 'threw', failure;
  try {
    const result = action(); outcome = 'returned';
    if (filename) dataArtifact(filename, capture(result), 'actual returned data captured before fixture oracle');
    if (kind === 'modelCalls') {
      for (const index of result.recomputation.evaluatedFeatures) {
        const e = result.evidence[index];
        if (e.kind === 'extrude') flow.returnedLedgers.prisms.push({ label, index, report: e.native.report.childNativeWork });
        if (e.kind === 'difference') flow.returnedLedgers.differences.push({ label, report: e.native.report.directCounts });
      }
    }
    if (kind === 'prismValidators') flow.returnedLedgers.validator.push({ label, report: result.childNativeWork });
    return result;
  } catch (error) { failure = errorData(error); throw error; }
  finally { const elapsedMS = performance.now() - begin; flow.nativeElapsedMS += elapsedMS;
    flow.stages.push({ kind, label, outcome, elapsedMS, ...(failure ? { failure } : {}) }); flow.pending = null; write(); }
}
try {
  const { cad, CadModelError, tessellateSurface, validateXYAffineSketchPrism } = await import(pathToFileURL(entry).href);
  const initial = stage('modelCalls', '1 baseline top-entry pocket from4 height4', topPocket(cad).build, '01-baseline.snapshot.json');
  const initialText = initial.save(), initialHash = nativeBodyHash(initial), initialBodiesHash = allBodiesHash(initial), initialBody = initial.bodies.part;
  artifact('initial.cad-model.json', initialText, 'actual baseline authored intent');
  dataArtifact('baseline.native.json', initialBody.native, 'complete genuine two-box top-pocket result');
  work(initial, [], [0, 1, 2, 3, 4]); flow.baseline = proveSnapshot(initial, 5632); flow.initialBodySHA256 = initialHash; flow.initialBodiesSHA256 = initialBodiesHash;
  // The historical transport used JSON.stringify. Compare that exact complete
  // encoding, plus its unmodified Source0 strings and signed authored nodes.
  // Do not pretend the old numeric JSON transport retained negative-zero bits.
  assert.equal(JSON.stringify(initial.bodies.plate.native), JSON.stringify(historical.bodies.plate.native));
  exactData(initial.bodies.plate.native.request.assets.map(a => a.face.source), historical.bodies.plate.native.request.assets.map(a => a.face.source));
  exactData(JSON.parse(initialText).nodes.slice(0, 2), JSON.parse(historicalText).nodes.slice(0, 2));
  exactData(initial.evidence[1].native.report.childNativeWork, historicalReceipt.baseline.prismReportsForEvaluatedFeatures.find(p => p.index === 1).report);
  flow.omittedOptionCompatibility = { completeNativeHistoricalEncodingEqual: true, exactSourceBytesEqual: true, signedAuthoredPlateNodesEqual: true,
    historicalNumericTransport: 'JSON.stringify normalized signed zero; original Source0 and saved intent remain authoritative' };
  dataArtifact('baseline.summary.json', flow.baseline, 'actual accepted baseline feature and parameter summary');
  const previews = [];
  for (const panel of initialBody.native.panels) {
    const surface = panel.bundle.geometry.objects[0], options = { countU: 2, countV: 2, revision: 0 };
    const result = stage('tessellations', 'baseline native panel ' + panel.id, () => tessellateSurface(surface, options));
    previews.push({ panelId: panel.id, sourceId: panel.sourceId, surfaceId: surface.id, options, result });
    dataArtifact('baseline.preview.json', previews, 'ordered genuine raw Surface packets, parameters and authored XYZ', previews.length > 1);
  }
  flow.preview = provePreview(initialBody.native, previews);
  const transfer = signedData({ ...snapshotData(initial), summary: flow.baseline, preview: previews, bodySHA256: initialHash,
    basis: 'authored XYZ; no coordinate conversion', scope: 'complete native baseline and46 genuine Surface tessellations; no CPU helper or editor recertification' }) + '\n';
  artifact('baseline-transfer.json', transfer, 'complete reusable genuine native and raw preview transfer');
  if (process.env.CAD_MODEL_TRANSPORT_DIR) {
    const out = resolve(process.env.CAD_MODEL_TRANSPORT_DIR); mkdirSync(out, { recursive: true });
    const path = resolve(out, 'modeling-offset-baseline-native.json'); writeFileSync(path, transfer, { flag: 'wx' });
    assert.equal(sha256(readFileSync(path)), sha256(transfer)); flow.transport.baseline = { path, bytes: Buffer.byteLength(transfer), sha256: sha256(transfer) }; write();
  }
  const noop = stage('modelCalls', '2 explicit depth4 no-op', () => initial.withParameters({ depth: 4 }), '02-noop.snapshot.json');
  work(noop, [0, 1, 2, 3, 4], [], initial); proveSnapshot(noop, 5632);
  assert.equal(noop.save(), initialText); assert.equal(noop.bodies.part, initialBody); assert.equal(allBodiesHash(noop), initialBodiesHash);
  const deeper = stage('modelCalls', '3 baseline depth6 from2', () => initial.withParameters({ depth: 6 }), '03-deeper.snapshot.json');
  artifact('edited.cad-model.json', deeper.save(), 'accepted depth6 authored intent for exact cold-edit parity');
  dataArtifact('edited.native.json', deeper.bodies.part.native, 'complete depth6 native result for cold parity');
  work(deeper, [0, 1, 2], [3, 4], initial); flow.deeper = proveSnapshot(deeper, 5376); flow.editedBodySHA256 = nativeBodyHash(deeper); flow.editedBodiesSHA256 = allBodiesHash(deeper);
  const deeperText = deeper.save(), deeperHash = allBodiesHash(deeper);
  let caught;
  try { stage('modelCalls', '4 original baseline depth8 toolY0 toolSpanY24 disconnected', () => initial.withParameters({ depth: 8, toolY: 0, toolSpanY: 24 }), '04-unexpected.snapshot.json'); } catch (error) { caught = error; }
  if (caught) dataArtifact('disconnected.refusal.json', errorData(caught), 'complete actual refusal and frozen native cause, before assertions');
  assert.ok(caught instanceof CadModelError); assert.equal(caught.code, 'SELECTION'); assert.equal(caught.operation, 'cut');
  flow.returnedLedgers.differences.push({ label: '4 disconnected actual frozen native cause', report: caught.cause.report.directCounts }); write();
  deepFrozen(caught.cause); flow.disconnected = proveNative(caught.cause, 3072, 12, 2);
  assert.deepEqual(caught.cause.bodies.map(b => b.volumeMM3).sort((a, b) => a - b), [1536, 1536]);
  assert.equal(initial.save(), initialText); assert.equal(allBodiesHash(initial), initialBodiesHash); assert.equal(initial.bodies.part, initialBody);
  const window = stage('modelCalls', '5 same original baseline depth8 through-window recovery', () => initial.withParameters({ depth: 8 }), '05-window.snapshot.json');
  dataArtifact('window.native.json', window.bodies.part.native, 'native-only through-window result; zero additional tessellations');
  work(window, [0, 1, 2], [3, 4], initial); flow.window = proveSnapshot(window, 5120, 32);
  const pair = stage('modelCalls', '6 one CW sketch with from-2 and explicit from-0 extrusions', offsetPair(cad).build, '06-offset-pair.snapshot.json');
  artifact('offset-pair.cad-model.json', pair.save(), 'actual negative and signed-zero authored branches');
  dataArtifact('negative.native.json', pair.evidence[1].native, 'complete retained negative-offset prism result');
  dataArtifact('signed-zero.native.json', pair.evidence[2].native, 'complete retained explicit signed-zero prism result');
  flow.offsetPair = proveOffsetPair(pair);
  const validation = stage('prismValidators', 'single complete retained negative-offset prism reconstruction',
    () => validateXYAffineSketchPrism(pair.evidence[1].native), 'negative.validation.json', value => value);
  exactData(validation, pair.evidence[1].native.report);
  for (const [snapshot, text, hash] of [[initial, initialText, initialBodiesHash], [noop, initialText, initialBodiesHash], [deeper, deeperText, deeperHash]]) {
    assert.equal(snapshot.save(), text); assert.equal(allBodiesHash(snapshot), hash); deepFrozen(snapshot);
  }
  assert.equal(flow.modelCalls, 6); assert.equal(flow.tessellations, 46); assert.equal(flow.prismValidators, 1);
  assert.equal(flow.returnedLedgers.prisms.length, 6); assert.equal(flow.returnedLedgers.differences.length, 4);
  flow.unreturnedPrismWork = { call: 4, sourceDerivedPrismFeatures: 1, reason: 'public refusal exposes native difference cause, not its evaluated prism evidence' };
  flow.status = 'passed'; flow.completedAt = new Date().toISOString(); flow.wallElapsedMS = performance.now() - started; write();
  console.log(signedData({ status: flow.status, modelCalls: 6, prismValidators: 1, tessellations: 46, nativeElapsedMS: flow.nativeElapsedMS, transfer: flow.transport }));
} catch (error) { flow.status = 'failed'; flow.failure = errorData(error); flow.failedAt = new Date().toISOString(); write(); throw error; }
