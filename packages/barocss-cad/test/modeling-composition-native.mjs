import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { EXPECTED_CAMPAIGN, bracketSlot, snapshotData, work, proveSnapshot, proveNative, provePreview,
  nativeBodyHash, signedData, sha256, deepFrozen, errorData } from './modeling-composition-fixture.mjs';

// Exactly six source model calls and44 raw panel tessellations. Cold owns two
// more model calls. No extra Boolean validator, CPU buffer helper or retry.
assert.equal(Number(process.versions.node.split('.')[0]), 22); assert.ok(process.execArgv.includes('--no-opt'));
assert.match([...process.execArgv, process.env.NODE_OPTIONS ?? ''].join(' '), /--max[-_]old[-_]space[-_]size(?:=|\s+)1536(?:\s|$)/);
assert.equal(process.argv.length, 2); assert.ok(process.env.CAD_MODEL_TEST_MODULE);
const entry = resolve(process.env.CAD_MODEL_TEST_MODULE), directory = resolve(process.env.CAD_MODEL_EVIDENCE_DIR ?? new URL('./modeling-composition-evidence', import.meta.url).pathname);
mkdirSync(directory, { recursive: true });
const receipt = resolve(directory, 'source-flow.json'), started = performance.now();
const flow = { status: 'running', issue: 1695, processId: process.pid, processInstanceId: randomUUID(), nodeVersion: process.version,
  startedAt: new Date().toISOString(), entrySHA256: sha256(readFileSync(entry)), modelCalls: 0, tessellations: 0,
  nativeElapsedMS: 0, stages: [], artifacts: {}, transport: {}, expectedWholeCampaign: EXPECTED_CAMPAIGN,
  sourceDerivedExpectedWorkIsNotInstrumented: true, fullTransitiveNativeCoverage: 'NOT_MEASURED', externalSerialProcessGroupTimeoutRequired: true };
writeFileSync(receipt, signedData(flow) + '\n', { flag: 'wx' });
const write = () => writeFileSync(receipt, signedData(flow) + '\n');
function disk() { const s = statfsSync(directory); assert.ok(s.bavail * s.bsize >= 500 * 1024 * 1024); }
function artifact(filename, bytes, scope, continuingOwnPreview = false) {
  assert.ok(Buffer.byteLength(bytes) <= 32 * 1024 * 1024);
  writeFileSync(resolve(directory, filename), bytes, { flag: continuingOwnPreview ? 'w' : 'wx' });
  flow.artifacts[filename] = { bytes: Buffer.byteLength(bytes), sha256: sha256(bytes), scope }; write();
}
const dataArtifact = (filename, data, scope, continuing = false) => artifact(filename, signedData(data) + '\n', scope, continuing);
function stage(kind, label, action, filename) {
  disk(); assert.ok(flow.nativeElapsedMS < 600000); assert.ok(flow[kind] < (kind === 'modelCalls' ? 6 : 44));
  flow[kind]++; flow.pending = { kind, label }; write(); const begin = performance.now(); let outcome = 'threw', failure;
  try { const result = action(); outcome = 'returned';
    if (filename) dataArtifact(filename, snapshotData(result), 'actual returned model data captured before fixture oracle');
    return result;
  } catch (error) { failure = errorData(error); throw error; }
  finally { const elapsedMS = performance.now() - begin; flow.nativeElapsedMS += elapsedMS;
    flow.stages.push({ kind, label, outcome, elapsedMS, ...(failure ? { failure } : {}) }); flow.pending = null; write(); }
}
try {
  const { cad, CadModelError, tessellateSurface } = await import(pathToFileURL(entry).href);
  const initial = stage('modelCalls', '1 baseline union bracket and through-slot', bracketSlot(cad).build, '01-baseline.snapshot.json');
  const initialText = initial.save(), initialHash = nativeBodyHash(initial), initialBody = initial.bodies.slotted;
  artifact('initial.cad-model.json', initialText, 'actual baseline authored intent');
  dataArtifact('baseline.native.json', initialBody.native, 'complete genuine composed native result with all ancestors');
  work(initial, [], [0, 1, 2, 3, 4, 5, 6, 7]); flow.baseline = proveSnapshot(initial, 2816, 3072); flow.initialBodySHA256 = initialHash;
  dataArtifact('baseline.summary.json', flow.baseline, 'actual accepted baseline summary');
  const previews = [];
  for (const panel of initialBody.native.panels) {
    const surface = panel.bundle.geometry.objects[0], options = { countU: 2, countV: 2, revision: 0 };
    const result = stage('tessellations', 'baseline native panel ' + panel.id, () => tessellateSurface(surface, options));
    previews.push({ panelId: panel.id, sourceId: panel.sourceId, surfaceId: surface.id, options, result });
    // This run owns this accumulating file. First write is exclusive; partial
    // genuine packets survive any later error. No previous-run file is replaced.
    dataArtifact('baseline.preview.json', previews, 'ordered genuine raw Surface packets including actual parameters; authored XYZ', previews.length > 1);
  }
  flow.preview = provePreview(initialBody.native, previews);
  const transfer = signedData({ ...snapshotData(initial), summary: flow.baseline, preview: previews, bodySHA256: initialHash,
    basis: 'authored XYZ; no coordinate conversion', scope: 'actual retained native chain and44 genuine panel tessellations; not editor transport' }) + '\n';
  artifact('baseline-transfer.json', transfer, 'complete reusable native/preview transfer');
  if (process.env.CAD_MODEL_TRANSPORT_DIR) {
    const out = resolve(process.env.CAD_MODEL_TRANSPORT_DIR); mkdirSync(out, { recursive: true });
    const path = resolve(out, 'modeling-composition-baseline-native.json'); writeFileSync(path, transfer, { flag: 'wx' });
    assert.equal(sha256(readFileSync(path)), sha256(transfer)); flow.transport.baseline = { path, bytes: Buffer.byteLength(transfer), sha256: sha256(transfer) };
  }
  const noop = stage('modelCalls', '2 explicit unchanged slotWidth8', () => initial.withParameters({ slotWidth: 8 }), '02-noop.snapshot.json');
  work(noop, [0, 1, 2, 3, 4, 5, 6, 7], [], initial); proveSnapshot(noop, 2816, 3072);
  assert.equal(noop.save(), initialText); assert.equal(noop.bodies.slotted, initialBody); assert.equal(nativeBodyHash(noop), initialHash);
  const wider = stage('modelCalls', '3 slotWidth12', () => initial.withParameters({ slotWidth: 12 }), '03-wider.snapshot.json');
  work(wider, [0, 1, 2, 3, 4], [5, 6, 7], initial); flow.wider = proveSnapshot(wider, 2688, 3072);
  const widerText = wider.save(), widerHash = nativeBodyHash(wider);
  for (const c of [{ label: '4 disconnected full-span slot', edits: { slotY: 0, slotSpanY: 8 }, volume: 2560, panels: 20, bodies: 2, file: 'disconnected' },
    { label: '5 empty covering tool', edits: { slotX: 0, slotY: 0, slotWidth: 32, slotSpanY: 24 }, volume: 0, panels: 0, bodies: 0, file: 'empty' }]) {
    let caught;
    try { stage('modelCalls', c.label, () => initial.withParameters(c.edits), c.file + '.unexpected-snapshot.json'); } catch (error) { caught = error; }
    if (caught) dataArtifact(c.file + '.refusal.json', errorData(caught), 'complete actual model error and frozen native-result cause');
    assert.ok(caught instanceof CadModelError); assert.equal(caught.code, 'SELECTION'); assert.equal(caught.operation, 'cut');
    deepFrozen(caught.cause); flow[c.file] = proveNative(caught.cause, c.volume, c.panels, c.bodies);
    if (c.bodies === 2) assert.deepEqual(caught.cause.bodies.map(b => b.volumeMM3).sort((a, b) => a - b), [512, 2048]);
    assert.equal(initial.save(), initialText); assert.equal(nativeBodyHash(initial), initialHash); assert.equal(initial.bodies.slotted, initialBody); write();
  }
  const recovered = stage('modelCalls', '6 recover same original with legWidth12', () => initial.withParameters({ legWidth: 12 }), '06-recovered.snapshot.json');
  artifact('edited.cad-model.json', recovered.save(), 'accepted recovery for cold reopen');
  dataArtifact('edited.native.json', recovered.bodies.slotted.native, 'complete recovery native for cold bit/hash equality only');
  work(recovered, [0, 1], [2, 3, 4, 5, 6, 7], initial); flow.recovered = proveSnapshot(recovered, 3328, 3584); flow.editedBodySHA256 = nativeBodyHash(recovered);
  for (const [snapshot, text, hash] of [[initial, initialText, initialHash], [noop, initialText, initialHash], [wider, widerText, widerHash]]) {
    assert.equal(snapshot.save(), text); assert.equal(nativeBodyHash(snapshot), hash); deepFrozen(snapshot);
  }
  assert.equal(flow.modelCalls, 6); assert.equal(flow.tessellations, 44);
  flow.status = 'passed'; flow.completedAt = new Date().toISOString(); flow.wallElapsedMS = performance.now() - started; write();
  console.log(signedData({ status: flow.status, modelCalls: 6, tessellations: 44, nativeElapsedMS: flow.nativeElapsedMS, transfer: flow.transport }));
} catch (error) { flow.status = 'failed'; flow.failure = errorData(error); flow.failedAt = new Date().toISOString(); write(); throw error; }
