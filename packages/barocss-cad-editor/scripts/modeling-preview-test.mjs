// #1959 finite transaction replay: actual engine, controller and scene receiver.
// Provider evaluation/save/sampling and Worker delivery are controlled doubles.
// Edited geometry is the unchanged genuine #1835 baseline, never native edit evidence.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve(import.meta.dirname, '../../..');
const out = resolve(process.env.EVIDENCE_DIR ?? '/tmp/cad-modeling-preview'); mkdirSync(out, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const hash = value => createHash('sha256').update(value).digest('hex');
const fixture = resolve(root, 'packages/barocss-cad/test/modeling-constraints-evidence/baseline-transfer.json');
const fixtureBytes = readFileSync(fixture), fixtureSHA256 = hash(fixtureBytes);
assert.equal(fixtureSHA256, '194b855ed3e862e76c2468cbbcb0d2f21f7b2eda0a217325fa95a32fee226721');
const baseline = JSON.parse(fixtureBytes), authored = JSON.parse(baseline.text);
const source = name => resolve(root, 'packages/barocss-cad-editor/src', name + '.ts');
const groups = [], sourceHashes = {};
async function group(name, run) {
  try { await run(); groups.push(name); console.log(JSON.stringify({ group: groups.length, name, result: 'PASS' })); }
  catch (cause) {
    const failure = { group: groups.length + 1, name, message: cause.message, stack: cause.stack };
    if (!existsSync(resolve(out, 'first-error.json'))) writeFileSync(resolve(out, 'first-error.json'), JSON.stringify(failure, null, 2));
    throw cause;
  }
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  return value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
}
const signedJSON = value => JSON.stringify(canonical(value), (_key, value) => Object.is(value, -0) ? '__NEG_ZERO__' : value).replaceAll('"__NEG_ZERO__"', '-0') + '\n';
assert.equal(signedJSON(authored), baseline.text);
let edits = 0, loads = 0, samples = 0, exports = 0, nextMutation = null, nextPacketMutation = null, nextError = null, lastExport = null;
const snapshots = [], editSources = [];
const forbidden = () => { throw Error('No new native or GPU execution is permitted.'); };
function snapshot(data) {
  const value = { parameters: structuredClone(data.parameters), suppression: {}, features: structuredClone(baseline.features),
    bodies: structuredClone(baseline.bodies), save: () => signedJSON(data),
    withParameters(changes) {
      edits++; editSources.push(value);
      if (nextError) { const failure = nextError; nextError = null; throw failure; }
      const nextData = structuredClone(data); Object.assign(nextData.parameters, changes);
      const result = snapshot(nextData);
      if (nextMutation) { const mutate = nextMutation; nextMutation = null; mutate(result, nextData); }
      return result;
    }, withSuppression: forbidden,
    exportStl() { exports++; lastExport = value; throw Error('Accepted snapshot export probe; no export geometry is generated.'); },
  }; snapshots.push(value); return value;
}
globalThis.__previewProvider = { cad: { model: forbidden, load(text) { loads++; return snapshot(JSON.parse(text)); } },
  tessellateConvexPlanarSolid(native, options) {
    assert.deepEqual(options, { maximumFanTriangles: 40 }); assert.deepEqual(native, baseline.bodies.part.native);
    samples++; const result = structuredClone(baseline.preview);
    if (nextPacketMutation) { const mutate = nextPacketMutation; nextPacketMutation = null; mutate(result); }
    return result;
  }, tessellateSurface: forbidden, tessellateOwnPlateCircularHole: forbidden, tessellateXYCirclePrismShell: forbidden };
let legacyReply = null;
globalThis.__previewLegacy = () => () => { assert.ok(legacyReply); return structuredClone(legacyReply); };
const gpu = resolve(out, 'gpu-entry.ts');
writeFileSync(gpu, ['engine-scene', 'engine-camera-ray', 'engine-raycast', 'kernel-face-preview']
  .map(name => `export * from ${JSON.stringify(resolve(root, 'packages/barocss-gpu/src', name + '.ts'))}`).join('\n'));
async function bundle(name, names, engine = false) {
  const built = await require('esbuild').build({ stdin: { contents: names.map(name => `export * from ${JSON.stringify(source(name))}`).join('\n'), resolveDir: root },
    absWorkingDir: root, bundle: true, platform: 'node', format: 'esm', write: false, metafile: true,
    alias: { '@barocss/gpu': gpu }, plugins: [{ name: 'no-native-preview', setup(build) {
      build.onResolve({ filter: /^@barocss\/cad$/ }, () => { assert.ok(engine, 'Controller must not load CAD runtime'); return { path: 'cad', namespace: 'stub' }; });
      build.onResolve({ filter: /^\.\/prism-feature-engine\.js$/ }, () => ({ path: 'legacy', namespace: 'stub' }));
      build.onLoad({ filter: /.*/, namespace: 'stub' }, a => ({ contents: a.path === 'cad'
        ? 'export const {cad,tessellateConvexPlanarSolid,tessellateSurface,tessellateOwnPlateCircularHole,tessellateXYCirclePrismShell}=globalThis.__previewProvider'
        : 'export const createPrismFeatureEngine=globalThis.__previewLegacy' }));
    } }] });
  for (const input of Object.keys(built.metafile.inputs)) if (input !== '<stdin>' && !input.startsWith('stub:')) {
    assert.ok(!input.includes('barocss-cad/src/'), 'No native provider dependency in replay'); sourceHashes[input] = hash(readFileSync(resolve(root, input)));
  }
  const path = resolve(out, name + '.mjs'); writeFileSync(path, built.outputFiles[0].text); return import(pathToFileURL(path));
}
const engineApi = await bundle('engine', ['modeling-engine', 'modeling-diagnostic'], true);
let sequence = 0;
const request = (kind, extra = {}) => ({ id: ++sequence, taskToken: 'request_' + sequence, kind, ...extra });
const seed = engine => { const reply = engine(request('open', { text: baseline.text, taskToken: 'accepted_model' })); assert.equal(reply.ok, true, reply.message); return reply; };
const prepare = (engine, extra = {}) => engine(request('prepare-preview', { workerToken: 'worker_one', acceptedTaskToken: 'accepted_model', expectedRevision: 0,
  candidateToken: 'candidate_' + sequence, parameters: { width: 40 }, ...extra }));
const accept = (engine, reply, parameters = { width: 40 }, binding = reply.binding) => engine(request('accept-preview', { binding, parameters }));
const discard = (engine, binding) => engine(request('discard-preview', { binding }));
const probe = (engine, token = 'accepted_model', revision = 0) => engine(request('export-stl', { acceptedTaskToken: token, expectedRevision: revision,
  outputName: 'part', solidId: baseline.bodies.part.native.report.solidId }));
await group('accepted snapshot and export authority stay immutable during exact candidate preparation', () => {
  const engine = engineApi.createModelingEngine(), opened = seed(engine), initial = snapshots.at(-1), before = [edits, samples];
  const preview = prepare(engine); assert.equal(preview.ok, true, preview.message); assert.equal(preview.kind, 'preview');
  assert.equal(preview.summary.revision, 1); assert.equal(preview.summary.parameters.width, 40);
  assert.deepEqual([edits - before[0], samples - before[1]], [1, 1]); assert.equal(editSources.at(-1), initial);
  assert.equal(initial.save(), baseline.text); assert.deepEqual(opened.summary.parameters, baseline.parameters);
  assert.match(probe(engine).message, /export probe/); assert.equal(lastExport, initial);
  assert.equal(Object.hasOwn(preview, 'snapshot'), false); assert.equal(Object.hasOwn(preview, 'parameters'), false);
});
await group('accept promotes the exact snapshot once with original producer and zero repeat work', () => {
  const engine = engineApi.createModelingEngine(); seed(engine); const preview = prepare(engine), candidate = snapshots.at(-1);
  const before = [edits, loads, samples], ack = accept(engine, preview);
  assert.equal(ack.kind, 'preview-accepted'); assert.deepEqual(ack.binding, preview.binding); assert.equal(ack.revision, 1);
  assert.deepEqual([edits, loads, samples], before); assert.equal(accept(engine, preview).ok, false);
  assert.equal(probe(engine).ok, false); assert.match(probe(engine, preview.binding.previewTaskToken, 1).message, /export probe/);
  assert.equal(lastExport, candidate); assert.equal(probe(engine, 'accept_message_token', 1).ok, false);
  assert.equal(discard(engine, preview.binding).kind, 'preview-discarded');
});
await group('replacement and scoped duplicate discard cannot clear a newer candidate', () => {
  const engine = engineApi.createModelingEngine(); seed(engine);
  const first = prepare(engine), second = prepare(engine, { parameters: { width: 48 } });
  for (const binding of [first.binding, first.binding, { ...second.binding, workerToken: 'different_worker' }, { ...second.binding, expectedRevision: 3 }])
    assert.equal(discard(engine, binding).kind, 'preview-discarded');
  assert.equal(accept(engine, first).ok, false); assert.equal(accept(engine, second, { width: 48 }).kind, 'preview-accepted');
  seed(engine); const current = prepare(engine); assert.equal(discard(engine, current.binding).kind, 'preview-discarded');
  assert.equal(discard(engine, current.binding).kind, 'preview-discarded'); assert.equal(accept(engine, current).ok, false);
  const superseded = prepare(engine); assert.equal(engine(request('apply', { expectedRevision: 0, parameters: { height: 28 } })).ok, true);
  assert.equal(accept(engine, superseded).ok, false);
});
await group('strict base binding and normalized maps refuse without invoking getters or native work', () => {
  const engine = engineApi.createModelingEngine(); seed(engine); const preview = prepare(engine), before = edits;
  for (const key of ['workerToken', 'acceptedTaskToken', 'candidateToken', 'previewTaskToken', 'expectedRevision'])
    assert.equal(accept(engine, preview, { width: 40 }, { ...preview.binding, [key]: key === 'expectedRevision' ? 1 : 'wrong' }).ok, false);
  for (const parameters of [{ width: 41 }, { width: 40, lockY: 0 }, { missing: 40 }, { width: Infinity }, { width: NaN }, { width: 10001 }, Object.create({ width: 40 })])
    assert.equal(accept(engine, preview, parameters).ok, false);
  let getters = 0; const accessor = {}; Object.defineProperty(accessor, 'width', { enumerable: true, get() { getters++; return 40; } });
  assert.equal(accept(engine, preview, accessor).ok, false); assert.equal(getters, 0);
  assert.equal(accept(engine, preview).ok, true); assert.equal(edits, before);
  seed(engine); const zero = prepare(engine, { parameters: { lockY: -0 } }); assert.equal(zero.ok, true, zero.message);
  assert.equal(accept(engine, zero, { lockY: 0 }).ok, false); assert.equal(accept(engine, zero, { lockY: -0 }).ok, true);
  seed(engine); const noOpBefore = edits;
  for (const parameters of [{ width: 32 }, {}]) assert.match(prepare(engine, { parameters }).message, /no geometric change/);
  for (const extra of [{ workerToken: 'wrong_worker' }, { expectedRevision: 1 }, { acceptedTaskToken: 'wrong' }]) assert.equal(prepare(engine, extra).ok, false);
  assert.equal(edits, noOpBefore);
});
await group('all outputs and transport budgets are checked before retaining a preview', () => {
  const engine = engineApi.createModelingEngine(); seed(engine); const before = samples; let nativeReads = 0;
  nextMutation = (value, data) => {
    data.outputs.other = { node: 1, side: 'solid' };
    value.bodies.other = { family: 'unsupported', get native() { nativeReads++; throw Error('must not read'); } };
  };
  const invalid = prepare(engine); assert.equal(invalid.ok, false); assert.equal(invalid.diagnostic.stage, 'transport');
  assert.equal(samples, before); assert.equal(nativeReads, 0); assert.match(probe(engine).message, /export probe/);
  nextMutation = value => { value.save = () => ' '.repeat(262145); };
  assert.match(prepare(engine).message, /source exceeds/);
  nextMutation = value => { value.features = [{ kind: 'x'.repeat(262145), index: 0, dependencies: [] }]; };
  assert.match(prepare(engine).message, /summary exceeds/);
  nextPacketMutation = value => { value.report.oversize = 'x'.repeat(2 * 1024 * 1024); };
  assert.match(prepare(engine).message, /display exceeds/);
});
await group('bounded input/native diagnostics and legacy refusal retain accepted authority', () => {
  const engine = engineApi.createModelingEngine(); seed(engine);
  nextError = Object.assign(new Error('Mock provider constraint refusal'), { name: 'CadModelError', code: 'NATIVE', operation: 'build', cause: { secret: true } });
  const native = prepare(engine); assert.deepEqual(native.diagnostic, { stage: 'native', message: 'Mock provider constraint refusal', code: 'NATIVE', operation: 'build' });
  const input = prepare(engine, { parameters: { width: Infinity } }); assert.equal(input.diagnostic.stage, 'input');
  assert.deepEqual(engineApi.modelingDiagnostic(Object.assign(new Error('plain'), { code: 'NATIVE', operation: 'fake' }), 'display'), { stage: 'display', message: 'plain' });
  assert.equal(engineApi.modelingDiagnostic(new Error('x'.repeat(3000)), 'display').message.length, 2048);
  const valid = engineApi.admitModelingDiagnostic(native.diagnostic); assert.deepEqual(valid, native.diagnostic);
  let gets = 0; const getter = { stage: 'native' }; Object.defineProperty(getter, 'message', { enumerable: true, get() { gets++; return 'bad'; } });
  for (const value of [getter, Object.create(native.diagnostic), { ...valid, cause: {} }, { ...valid, code: 'UNKNOWN' }, { ...valid, operation: 'x'.repeat(65) }, { ...valid, stage: 'secret' }])
    assert.throws(() => engineApi.admitModelingDiagnostic(value));
  assert.equal(gets, 0);
  const legacyDocument = { format: 'barocss-xy-affine-prism-feature-document', version: 0, id: 'legacy', revision: 0, parameters: [], nodes: [] };
  legacyReply = { ok: true, text: JSON.stringify(legacyDocument), summary: { document: legacyDocument, dependencies: [], components: [], volumes: {} }, display: {} };
  assert.equal(engine(request('open', { text: legacyReply.text })).ok, true);
  assert.match(prepare(engine).message, /legacy files remain Apply-only/);
});
const controllerApi = await bundle('controller', ['modeling-controller']);
const previous = { Worker: globalThis.Worker, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
const timers = new Set(), workers = [], commands = [], held = [], snapshotsEmitted = [];
let mode = null, replies = 0, commits = 0, shows = 0, prepares = 0, previewPrepares = 0, failCommit = false;
let acceptedHandle = null, visibleHandle = null, handleId = 0;
globalThis.setTimeout = callback => { const timer = { callback }; timers.add(timer); return timer; };
globalThis.clearTimeout = timer => timers.delete(timer);
globalThis.Worker = class {
  callbacks = {}; engine = engineApi.createModelingEngine(); terminated = false; requests = [];
  constructor() { workers.push(this); }
  addEventListener(kind, callback) { this.callbacks[kind] = callback; }
  terminate() { this.terminated = true; }
  postMessage(command) {
    const copied = structuredClone(command); this.requests.push(copied); commands.push(copied);
    const reply = this.engine(copied);
    const active = mode?.kind === command.kind ? mode : null;
    if (active) mode = null;
    if (typeof active?.action === 'function') active.action(reply);
    const deliver = () => { assert.ok(++replies <= 80, 'Finite controlled reply budget'); this.callbacks.message({ data: structuredClone(reply) }); };
    if (active?.action === 'hold') held.push({ kind: command.kind, deliver, reply }); else queueMicrotask(deliver);
  }
};
function handle(preview) {
  const value = { id: ++handleId, disposed: false, committed: false,
    show() { assert.ok(preview); assert.equal(value.disposed, false); visibleHandle = value; shows++; },
    commit() { if (failCommit) { failCommit = false; throw Error('Mock display promotion refused before swap'); }
      assert.equal(value.disposed, false); acceptedHandle = value; visibleHandle = value; value.committed = true; commits++; },
    dispose() { if (value.disposed || value.committed) return; value.disposed = true; if (visibleHandle === value) visibleHandle = acceptedHandle; },
  }; return value;
}
const session = controllerApi.createCadEditorModelingController({ async prepare() { prepares++; return handle(false); }, async preparePreview() { previewPrepares++; return handle(true); } });
session.subscribe(() => snapshotsEmitted.push(session.getSnapshot()));
const authority = () => { const state = session.getSnapshot(); return { accepted: state.accepted, authoredText: state.authoredText, display: state.display,
  generation: state.generation, history: state.history, selection: state.selection, faceSelection: state.faceSelection }; };
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
const reset = async () => { await session.open(baseline.text); assert.equal(session.getSnapshot().error, null); assert.equal(session.getSnapshot().preview, null); };
const readyPreview = async (raw = '40', recover = false) => { session.stage('width', raw); await session.preview(recover); assert.equal(session.getSnapshot().preview?.status, 'ready', session.getSnapshot().error); };
try {
  await group('controller preview keeps saved bytes history selection and public state accepted-only', async () => {
    await reset(); session.select(1, session.getSnapshot().generation); const before = authority(), oldHandle = acceptedHandle;
    const work = [edits, samples, loads]; await readyPreview();
    assert.deepEqual(authority(), before); assert.equal(acceptedHandle, oldHandle); assert.notEqual(visibleHandle, oldHandle);
    assert.deepEqual([edits - work[0], samples - work[1], loads - work[2]], [1, 1, 0]);
    assert.equal(session.getSnapshot().drafts.width, '40'); assert.equal(session.getSnapshot().authoredText, baseline.text);
    assert.throws(() => session.pick(100, 100, 50, 50, before.generation), /Apply or cancel/);
    for (const emitted of snapshotsEmitted) if (emitted.preview) {
      assert.ok(Object.keys(emitted.preview).every(key => ['status', 'parameters', 'outputs', 'diagnostic'].includes(key)));
      for (const forbiddenKey of ['binding', 'packet', 'display', 'text', 'snapshot', 'workerToken', 'candidateToken']) assert.equal(Object.hasOwn(emitted.preview, forbiddenKey), false);
    }
  });
  await group('controller Apply promotes cached preview once and Undo restores accepted intent', async () => {
    const before = [edits, samples, loads, commits], token = commands.findLast(command => command.kind === 'prepare-preview').taskToken;
    await session.apply(); assert.equal(session.getSnapshot().accepted.parameters.width, 40); assert.equal(session.getSnapshot().history.count, 2);
    assert.equal(session.getSnapshot().preview, null); assert.deepEqual(session.getSnapshot().drafts, {});
    assert.deepEqual([edits, samples, loads], before.slice(0, 3)); assert.equal(commits, before[3] + 1);
    const acceptedWorker = workers.at(-1); assert.match(probe(acceptedWorker.engine, token, 1).message, /export probe/);
    const count = commands.length; await session.apply(); assert.equal(commands.length, count); assert.equal(session.getSnapshot().history.count, 2);
    await session.undo(); assert.equal(session.getSnapshot().accepted.parameters.width, 32); assert.equal(session.getSnapshot().history.index, 0);
    assert.equal(session.getSnapshot().history.count, 2);
  });
  await group('cancel and discard restore accepted display and late pending preview is inert', async () => {
    await reset(); const before = authority(), oldHandle = acceptedHandle;
    await readyPreview(); const requests = commands.length; session.clearPreview(); assert.equal(visibleHandle, oldHandle);
    assert.equal(session.getSnapshot().drafts.width, '40'); assert.equal(commands.length, requests + 1);
    session.clearPreview(); assert.equal(commands.length, requests + 1, 'Discard coalesced once per candidate'); await flush();
    mode = { kind: 'prepare-preview', action: 'hold' }; const task = session.preview(); assert.equal(session.getSnapshot().busy, true);
    const lostWorker = workers.at(-1); session.cancel(); await task;
    assert.equal(lostWorker.terminated, true); assert.equal(session.getSnapshot().workerReady, false);
    held.shift().deliver(); await flush(); assert.deepEqual(authority(), before); assert.equal(visibleHandle, oldHandle);
    assert.equal(session.getSnapshot().drafts.width, '40');
    await session.preview(true); assert.equal(session.getSnapshot().preview.status, 'ready'); session.discard();
    assert.deepEqual(session.getSnapshot().drafts, {}); assert.equal(visibleHandle, oldHandle);
  });
  await group('raw same-value ABA invalidates preview and a discard reply cannot settle another request', async () => {
    await reset(); const before = authority(); await readyPreview();
    mode = { kind: 'discard-preview', action: 'hold' }; session.stage('width', '40.0'); session.stage('width', '40');
    assert.equal(session.getSnapshot().preview, null); assert.equal(visibleHandle, acceptedHandle);
    mode = { kind: 'prepare-preview', action: 'hold' }; const next = session.preview(); assert.equal(session.getSnapshot().busy, true);
    const staleDiscard = held.shift(); assert.equal(staleDiscard.kind, 'discard-preview'); staleDiscard.deliver(); await flush();
    assert.equal(session.getSnapshot().busy, true); assert.equal(session.getSnapshot().preview.status, 'computing');
    held.shift().deliver(); await next; assert.equal(session.getSnapshot().preview.status, 'ready');
    staleDiscard.deliver(); await flush(); assert.equal(session.getSnapshot().preview.status, 'ready'); assert.deepEqual(authority(), before);
    session.stage('width', '48'); assert.equal(session.getSnapshot().preview, null); await session.preview();
    assert.equal(session.getSnapshot().preview.parameters.width, 48); assert.deepEqual(authority(), before);
  });
  await group('malformed packets authored graph edits and unexpected normalized values never display', async () => {
    const mutations = [
      reply => { reply.display.components[0].mesh.positionsMM[0] += 100; },
      reply => { const data = JSON.parse(reply.text); data.nodes[1].height = 10; reply.text = signedJSON(data); },
      reply => { const data = JSON.parse(reply.text); data.parameters.width = 41; reply.text = signedJSON(data); reply.summary.parameters.width = 41; },
      reply => { reply.binding.candidateToken = 'wrong_candidate'; },
    ];
    for (const mutate of mutations) {
      await reset(); const before = authority(), shown = shows; session.stage('width', '40'); mode = { kind: 'prepare-preview', action: mutate };
      await session.preview(); assert.equal(session.getSnapshot().preview?.status, 'error'); assert.ok(session.getSnapshot().error);
      assert.equal(session.getSnapshot().preview.diagnostic.stage, 'transport', 'Malformed Worker replies are transport failures');
      assert.equal(shows, shown); assert.equal(visibleHandle, acceptedHandle); assert.deepEqual(authority(), before);
    }
  });
  await group('lost promotion acknowledgement expires worker and preserves accepted history and drafts', async () => {
    await reset(); const before = authority(), oldHandle = acceptedHandle; await readyPreview();
    mode = { kind: 'accept-preview', action: 'hold' }; const task = session.apply(); const dead = workers.at(-1);
    assert.equal(session.getSnapshot().busy, true); assert.deepEqual(authority(), before);
    assert.equal(timers.size, 1); [...timers][0].callback(); await task;
    assert.equal(dead.terminated, true); assert.equal(session.getSnapshot().workerReady, false); assert.equal(visibleHandle, oldHandle);
    assert.equal(session.getSnapshot().drafts.width, '40'); assert.deepEqual(authority(), before);
    held.shift().deliver(); await flush(); assert.deepEqual(authority(), before); assert.equal(visibleHandle, oldHandle);
  });
  await group('worker loss requires explicit reconstruction and recovery costs one load plus one edit', async () => {
    const before = authority(), count = commands.length; await assert.rejects(session.preview(), /explicitly/); assert.equal(commands.length, count);
    const work = [loads, edits]; mode = { kind: 'prepare-preview', action: 'hold' };
    const pendingRecovery = session.preview(true); await flush();
    assert.equal(session.getSnapshot().preview.status, 'computing'); assert.equal(held.at(-1).kind, 'prepare-preview');
    assert.deepEqual([loads - work[0], edits - work[1]], [1, 1]); assert.deepEqual(authority(), before);
    const dead = workers.at(-1); dead.callbacks.error(); await pendingRecovery; assert.equal(dead.terminated, true);
    assert.equal(session.getSnapshot().preview.status, 'error');
    assert.equal(session.getSnapshot().preview.diagnostic.stage, 'transport', 'Worker loss while awaiting a reply is a transport failure');
    held.shift().deliver(); await flush(); assert.equal(session.getSnapshot().preview.diagnostic.stage, 'transport');
    assert.equal(visibleHandle, acceptedHandle); assert.deepEqual(authority(), before);
    const denied = commands.length; await assert.rejects(session.preview(), /explicitly/); assert.equal(commands.length, denied);
    await session.preview(true); assert.equal(session.getSnapshot().preview.status, 'ready');
  });
  await group('display commit failure after native promotion terminates divergent worker without UI commit', async () => {
    const before = authority(), oldHandle = acceptedHandle, dead = workers.at(-1); failCommit = true; await session.apply();
    assert.match(session.getSnapshot().error, /promotion refused/); assert.equal(dead.terminated, true);
    assert.equal(session.getSnapshot().workerReady, false); assert.equal(visibleHandle, oldHandle); assert.equal(acceptedHandle, oldHandle);
    assert.deepEqual(authority(), before); assert.equal(session.getSnapshot().drafts.width, '40');
  });
  await group('actual controller legacy preview refusal performs no request and retains legacy authority', async () => {
    const document = JSON.parse(readFileSync(resolve(root, 'apps/cad-editor/src/fixtures/affine-prism.authored.json')));
    const display = JSON.parse(readFileSync(resolve(import.meta.dirname, 'fixtures/convex-display.packet.json')));
    const fraction = { numerator: '1', denominator: '1' };
    legacyReply = { ok: true, text: JSON.stringify(document), summary: { document,
      dependencies: document.nodes.map(node => ({ nodeId: node.id, dependsOn: [] })), components: display.outcomes, selectedWalls: [],
      volumes: { parent: fraction, first: fraction, second: fraction, remaining: fraction, removed: fraction } },
      display: { ...display, documentId: document.id, revision: document.revision } };
    await session.open(legacyReply.text); assert.equal(session.getSnapshot().accepted.source, 'legacy', session.getSnapshot().error);
    session.stage('upperX', '24'); const before = authority(), count = commands.length; await assert.rejects(session.preview(), /legacy/);
    assert.equal(commands.length, count); assert.deepEqual(authority(), before); assert.equal(session.getSnapshot().drafts.upperX, '24');
  });
  await group('input/native diagnostic distinction and normalized no-op Preview/Apply do zero work', async () => {
    await reset(); const before = authority(), count = commands.length, nativeBefore = [loads, edits, samples];
    session.stage('width', '32.0'); await session.preview(); assert.equal(session.getSnapshot().preview.status, 'unchanged');
    assert.equal(session.getSnapshot().drafts.width, '32.0'); assert.equal(visibleHandle, acceptedHandle); assert.deepEqual(authority(), before);
    await session.apply(); assert.deepEqual(session.getSnapshot().drafts, {}); assert.equal(session.getSnapshot().preview, null);
    assert.equal(commands.length, count); assert.deepEqual([loads, edits, samples], nativeBefore); assert.deepEqual(authority(), before);
    session.stage('width', 'bad'); await session.preview(); assert.equal(session.getSnapshot().preview.diagnostic.stage, 'input'); assert.equal(commands.length, count);
    session.stage('width', '40'); nextError = Object.assign(new Error('Mocked native dimension refusal'), { name: 'CadModelError', code: 'NATIVE', operation: 'extrude', cause: { private: true } });
    await session.preview(); assert.deepEqual(session.getSnapshot().preview.diagnostic, { stage: 'native', message: 'Mocked native dimension refusal', code: 'NATIVE', operation: 'extrude' });
    assert.deepEqual(authority(), before); assert.equal(session.getSnapshot().drafts.width, '40');
    const runtime = commands.length; session.discard(); session.stage('lockY', '-0'); await session.preview();
    assert.equal(session.getSnapshot().preview.status, 'ready'); assert.equal(commands.length, runtime + 1); assert.ok(Object.is(session.getSnapshot().preview.parameters.lockY, -0));
    session.clearPreview(); await flush();
  });
  assert.equal(groups.length, 16); assert.equal(hash(readFileSync(fixture)), fixtureSHA256); assert.equal(held.length, 0); assert.equal(timers.size, 0);
  const result = { result: 'PASS', groups, engineGroups: 6, controllerGroups: 10, controllerLifetimes: 1, replies, requests: commands.length,
    loads, edits, samples, exports, commits, shows, prepares, previewPrepares, newNativeCalls: 0, fixtureSHA256, sourceHashes,
    limits: ['Provider evaluation, save, tessellation and Worker are mocked; edited geometry is unchanged genuine #1835 geometry.',
      'Actual engine projection, controller admission, CPU scene receiver, and timeout/promotion/discard routing run.',
      'Diagnostic CadModelError fields are modeled provider-reported Error data, not a native Error instance claim.',
      'Export probe verifies the snapshot selected, then deliberately refuses; no STL bytes or geometry are generated.',
      'Display port is a lifecycle double. No GPU, browser, pixel, device, or physical geometry verification.'] };
  writeFileSync(resolve(out, 'result.json'), JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result));
} finally {
  session.dispose(); globalThis.Worker = previous.Worker; globalThis.setTimeout = previous.setTimeout; globalThis.clearTimeout = previous.clearTimeout;
  delete globalThis.__previewProvider; delete globalThis.__previewLegacy;
}
