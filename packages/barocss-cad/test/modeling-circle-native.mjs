import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { EXPECTED_CAMPAIGN, RESIDUAL, roundPost, snapshotData, work, provePost, provePreview,
  nativeBodyHash, signedData, sha256, dataHash, exactData, deepFrozen, errorData } from './modeling-circle-fixture.mjs';

// Six source model calls and exactly one baseline preview. The separate direct
// emitted consumer owns the only two cold calls. Run both in one serial process
// group with an external 600-second aggregate timeout and cleanup; no retries.
assert.equal(Number(process.versions.node.split('.')[0]), 22);
assert.ok(process.execArgv.includes('--no-opt'));
assert.match([...process.execArgv, process.env.NODE_OPTIONS ?? ''].join(' '), /--max[-_]old[-_]space[-_]size(?:=|\s+)1536(?:\s|$)/);
assert.equal(process.argv.length, 2);
assert.ok(process.env.CAD_MODEL_TEST_MODULE, 'source half requires an explicit own-source public bundle');
const entry = resolve(process.env.CAD_MODEL_TEST_MODULE);
const directory = resolve(process.env.CAD_MODEL_EVIDENCE_DIR ?? new URL('./modeling-circle-evidence', import.meta.url).pathname);
mkdirSync(directory, { recursive: true });
const marker = Symbol.for('barocss.modeling-circle.source-process');
assert.equal(globalThis[marker], undefined); globalThis[marker] = randomUUID();
const receipt = resolve(directory, 'source-flow.json'), started = performance.now();
const flow = { status: 'running', issue: 1677, processId: process.pid, processInstanceId: globalThis[marker],
  nodeVersion: process.version, startedAt: new Date().toISOString(), entrySHA256: sha256(readFileSync(entry)),
  modelCalls: 0, previews: 0, nativeElapsedMS: 0, stages: [], artifacts: {}, transport: {},
  expectedWholeCampaign: EXPECTED_CAMPAIGN, sourceDerivedExpectedWorkIsNotInstrumented: true,
  fullTransitiveNativeCoverage: 'NOT_MEASURED', externalSerialProcessGroupTimeoutRequired: true };
// A previous successful OR failed receipt is immutable. This script never
// continues/replays spent calls or overwrites an old campaign to turn it green.
writeFileSync(receipt, signedData(flow) + '\n', { flag: 'wx' });
const write = () => writeFileSync(receipt, signedData(flow) + '\n');
const disk = () => { const d = statfsSync(directory); assert.ok(d.bavail * d.bsize >= 500 * 1024 * 1024, 'at least 500MiB free disk required'); };
function artifact(filename, bytes, scope) {
  assert.ok(Buffer.byteLength(bytes) <= 3 * 1024 * 1024, 'bounded artifact required');
  writeFileSync(resolve(directory, filename), bytes, { flag: 'wx' });
  flow.artifacts[filename] = { bytes: Buffer.byteLength(bytes), sha256: sha256(bytes), scope }; write();
}
const dataArtifact = (filename, data, scope) => artifact(filename, signedData(data) + '\n', scope);
function stage(kind, label, action, filename) {
  disk(); assert.ok(flow.nativeElapsedMS < 600000, 'aggregate native cap reached; no retry');
  const maximum = kind === 'modelCalls' ? 6 : 1; assert.ok(flow[kind] < maximum, 'frozen call budget exhausted');
  flow[kind]++; flow.pending = { kind, label }; write();
  const start = performance.now(); let outcome = 'threw', failure;
  try {
    const result = action(); outcome = 'returned';
    // Keep actual returned bytes BEFORE any expectation can fail. A stage5
    // unexpected success is retained as such; no replacement decimal case.
    if (filename) dataArtifact(filename, kind === 'modelCalls' ? snapshotData(result) : result,
      kind === 'modelCalls' ? 'complete actual model snapshot data and authored save; no imported cache authority' : 'the one genuine baseline k4 preview; unconverted authored XYZ');
    return result;
  } catch (error) { failure = errorData(error); throw error; }
  finally {
    const elapsedMS = performance.now() - start; flow.nativeElapsedMS += elapsedMS;
    flow.stages.push({ kind, label, outcome, elapsedMS, ...(failure ? { failure } : {}) }); flow.pending = null; write();
  }
}
function transfer(snapshot, preview, summary) {
  if (!process.env.CAD_MODEL_TRANSPORT_DIR) return;
  const output = resolve(process.env.CAD_MODEL_TRANSPORT_DIR); mkdirSync(output, { recursive: true });
  const filename = 'modeling-circle-baseline-native.json', bytes = signedData({ ...snapshotData(snapshot), summary, preview,
    bodySHA256: nativeBodyHash(snapshot), scope: 'actual retained baseline native result and genuine k4 preview; not editor transport',
    basis: 'authored XYZ; existing right-handed-z-up packet label is not a coordinate conversion' }) + '\n';
  assert.ok(Buffer.byteLength(bytes) <= 3 * 1024 * 1024);
  writeFileSync(resolve(output, filename), bytes, { flag: 'wx' });
  assert.equal(sha256(readFileSync(resolve(output, filename))), sha256(bytes));
  flow.transport.baseline = { filename, bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) }; write();
}
try {
  disk();
  const { cad, CadModelError, StoredCirclePrismSolidError, tessellateXYCirclePrismShell } = await import(pathToFileURL(entry).href);
  const initial = stage('modelCalls', '1 baseline center[2,-3] diameter8 height6', roundPost(cad).build, '01-baseline.snapshot.json');
  const initialText = initial.save(), initialHash = nativeBodyHash(initial), initialBody = initial.bodies.post;
  artifact('initial.cad-model.json', initialText, 'original baseline authored save');
  dataArtifact('baseline.native.json', initialBody.native, 'complete actual baseline native result; original parent, certificate and whole Source0');
  artifact('baseline.profile.source0', initial.evidence[0].native.source, 'original evaluated circle Source0');
  artifact('baseline.world.source0', initialBody.native.world.source, 'newly compiled whole-model Source0');
  work(initial, [], [0, 1]); flow.baseline = provePost(initial, 'initial'); flow.initialBodySHA256 = initialHash;
  dataArtifact('baseline.summary.json', flow.baseline, 'actual accepted baseline summary and source/body hashes');
  const preview = stage('previews', 'one baseline genuine k4 shell preview', () => tessellateXYCirclePrismShell(initialBody.native.parent.bundle,
    { meshId: 'modeling1677_baseline_preview_k4', revision: 0, segmentsPerQuarter: 4 }), 'baseline.preview.json');
  flow.preview = provePreview(preview, initialBody.native.parent);
  transfer(initial, preview, flow.baseline); write();

  const noop = stage('modelCalls', '2 explicit height6 no-op from original1', () => initial.withParameters({ height: 6 }), '02-noop.snapshot.json');
  work(noop, [0, 1], [], initial); flow.noop = provePost(noop, 'initial'); assert.equal(noop.save(), initialText);
  assert.equal(noop.bodies.post, initialBody); assert.equal(noop.bodies.post.native, initialBody.native);
  assert.equal(nativeBodyHash(noop), initialHash);

  const taller = stage('modelCalls', '3 height9 from original1', () => initial.withParameters({ height: 9 }), '03-taller.snapshot.json');
  work(taller, [0], [1], initial); flow.taller = provePost(taller, 'taller');
  const tallerText = taller.save(), tallerHash = nativeBodyHash(taller);
  assert.equal(taller.evidence[0], initial.evidence[0]);
  assert.equal(taller.evidence[0].native, initial.evidence[0].native);

  const narrower = stage('modelCalls', '4 diameter4 from taller3', () => taller.withParameters({ diameter: 4 }), '04-narrower.snapshot.json');
  work(narrower, [], [0, 1], taller); flow.narrower = provePost(narrower, 'narrower');
  const narrowerText = narrower.save(), narrowerHash = nativeBodyHash(narrower);

  let caught;
  try {
    stage('modelCalls', '5 atomic decimal edit from original1 exact cap refusal',
      () => initial.withParameters({ centerX: .2, centerY: .2, diameter: .2, height: .3 }), '05-decimal.unexpected-snapshot.json');
  } catch (error) { caught = error; }
  if (caught) {
    flow.decimalRefusal = errorData(caught);
    dataArtifact('decimal.refusal.json', flow.decimalRefusal, 'complete original outer model error and nested native exact residual witness');
  }
  assert.ok(caught instanceof CadModelError); assert.equal(caught.code, 'NATIVE'); assert.equal(caught.operation, 'extrude');
  assert.ok(caught.cause instanceof StoredCirclePrismSolidError); assert.equal(caught.cause.code, 'GEOMETRY');
  assert.match(caught.cause.message, /cap.*composition/i); exactData(caught.cause.cause.residual, RESIDUAL); deepFrozen(caught.cause.cause);
  assert.equal(flow.stages.filter(s => s.kind === 'modelCalls').at(-1).outcome, 'threw');
  assert.equal(initial.save(), initialText); assert.equal(nativeBodyHash(initial), initialHash); assert.equal(initial.bodies.post, initialBody);
  flow.originalUnchangedAfterRefusal = true; write();

  const recovered = stage('modelCalls', '6 signed-zero dyadic recovery from same original1',
    () => initial.withParameters({ centerX: -0, centerY: .25, diameter: 1, height: 1.5 }), '06-recovered.snapshot.json');
  artifact('edited.cad-model.json', recovered.save(), 'accepted recovery state for the fresh direct emitted consumer');
  dataArtifact('edited.native.json', recovered.bodies.post.native, 'complete accepted recovery native result for pure cold parity only');
  work(recovered, [], [0, 1], initial); flow.recovered = provePost(recovered, 'recovered');
  flow.editedBodySHA256 = nativeBodyHash(recovered); flow.editedProfileSourceSHA256 = sha256(recovered.evidence[0].native.source);
  flow.editedWorldSourceSHA256 = sha256(recovered.bodies.post.native.world.source);
  dataArtifact('edited.summary.json', flow.recovered, 'actual accepted recovery summary and exact source/body hashes');
  for (const [snapshot, text, hash] of [[initial, initialText, initialHash], [noop, initialText, initialHash],
    [taller, tallerText, tallerHash], [narrower, narrowerText, narrowerHash]]) {
    assert.equal(snapshot.save(), text); assert.equal(nativeBodyHash(snapshot), hash); deepFrozen(snapshot);
  }
  assert.equal(dataHash(initial.bodies.post.native), initialHash);
  assert.equal(flow.modelCalls, 6); assert.equal(flow.previews, 1); assert.ok(flow.nativeElapsedMS < 600000);
  assert.equal(sha256(readFileSync(entry)), flow.entrySHA256);
  for (const [filename, original] of Object.entries(flow.artifacts)) { const bytes = readFileSync(resolve(directory, filename)); assert.equal(bytes.length, original.bytes); assert.equal(sha256(bytes), original.sha256); }
  flow.futureReuseAfterRefusal = true; flow.oldAndNewSnapshotsIndependent = true;
  flow.awaitedColdModelCalls = 2; flow.actualEditorGPU = 'UNRUN_CIRCLE_PREVIEW_UNAVAILABLE';
  flow.status = 'passed'; flow.elapsedMS = performance.now() - started; flow.finishedAt = new Date().toISOString(); write();
} catch (error) { flow.status = 'failed'; flow.failure = errorData(error); flow.finishedAt = new Date().toISOString(); write(); throw error; }
