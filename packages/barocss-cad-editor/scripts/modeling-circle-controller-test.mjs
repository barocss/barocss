// Actual serializer/controller/CPU scene with recorded providers and mocked Worker. No native execution.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { api, baseline, native, root, output, sha256 } from './modeling-circle-scene-test.mjs';
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const authored = JSON.parse(baseline.text);
const signedJSON = data => JSON.stringify(data, (_key, value) => Object.is(value, -0) ? '__NEG_ZERO__' : value).replaceAll('"__NEG_ZERO__"', '-0') + '\n';
let refused = false, previewFailure = false, badPreflight = false, previewCalls = 0;
const snapshots = [], edits = [], loads = [];
function snapshot(data) {
  const result = { parameters: structuredClone(data.parameters), suppression: {}, features: structuredClone(baseline.features),
    bodies: Object.fromEntries(Object.keys(data.outputs).map(name => [name, structuredClone(baseline.bodies.post)])),
    save: () => signedJSON(data),
    withParameters(changes) {
      edits.push({ snapshot: result, changes: structuredClone(changes) });
      if (refused) throw Error('Recorded exact cap-composition refusal');
      return snapshot({ ...data, parameters: { ...data.parameters, ...changes } });
    }, withSuppression() { throw Error('No named finishes'); } };
  if (badPreflight) result.bodies[Object.keys(result.bodies).at(-1)].native.certificate.faceCount = 4;
  snapshots.push(result); return result;
}
globalThis.__circleCad = {
  cad: { load(text) { const result = snapshot(JSON.parse(text)); loads.push(result); return result; },
    model() { const parameters = {}; return {
      parameter(name, value) { parameters[name] = value; return { parameter: name }; },
      dimension: { scale(value, factor) { return { op: 'scale', value, factor }; } },
      sketch: { circle() { return { extrude() { return {}; } }; } },
      build() { return snapshot({ ...structuredClone(authored), parameters }); },
    }; } },
  tessellateXYCirclePrismShell(bundle, options) {
    previewCalls++; if (previewFailure) throw Error('Recorded circle preview refusal');
    assert.deepEqual(bundle, native.parent.bundle); assert.equal(options.segmentsPerQuarter, 4);
    const preview = structuredClone(baseline.preview);
    // Only request-scoped display identity changes. All measured geometry/UV/ranges remain original.
    preview.packet.surfaceId = options.meshId; preview.packet.revision = options.revision;
    preview.report.meshId = options.meshId; preview.report.revision = options.revision;
    return preview;
  }, tessellateSurface() { throw Error('No panel campaign'); },
  tessellateConvexPlanarSolid() { throw Error('No convex campaign'); },
  tessellateOwnPlateCircularHole() { throw Error('No hole campaign'); },
};
const bundle = await require('esbuild').build({ entryPoints: [resolve(root, 'packages/barocss-cad-editor/src/modeling-engine.ts')],
  bundle: true, platform: 'node', format: 'esm', write: false, plugins: [{ name: 'recorded-provider', setup(build) {
    build.onResolve({ filter: /^@barocss\/cad$/ }, () => ({ path: 'cad', namespace: 'stub' }));
    build.onResolve({ filter: /^\.\/prism-feature-engine\.js$/ }, () => ({ path: 'legacy', namespace: 'stub' }));
    build.onLoad({ filter: /.*/, namespace: 'stub' }, args => ({ contents: args.path === 'cad'
      ? 'export const {cad,tessellateSurface,tessellateConvexPlanarSolid,tessellateOwnPlateCircularHole,tessellateXYCirclePrismShell}=globalThis.__circleCad;'
      : 'export function createPrismFeatureEngine(){return()=>{throw Error("No legacy native execution");};}' }));
  } }] });
writeFileSync(resolve(output, 'engine.mjs'), bundle.outputFiles[0].text);
const { createModelingEngine } = await import(pathToFileURL(resolve(output, 'engine.mjs')));
const workers = [], sessions = []; let checks = 0;
globalThis.Worker = class {
  callbacks = new Map(); requests = []; answered = new Set(); engine = createModelingEngine(); terminated = false;
  constructor() { workers.push(this); }
  addEventListener(kind, listener) { this.callbacks.set(kind, listener); }
  postMessage(command) { this.requests.push(command); }
  terminate() { this.terminated = true; }
  send(reply, id = this.requests.at(-1).id) { this.callbacks.get('message')({ data: { ...structuredClone(reply), id } }); }
  accept(mutate, command = this.requests.at(-1)) {
    this.answered.add(command.id); const reply = this.engine(command); if (mutate) mutate(reply); this.send(reply, command.id); return reply;
  }
};
const tick = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
const stable = session => { const data = session.getSnapshot(); delete data.busy; delete data.error; return data; };
async function pump(promise) {
  let done = false; promise.finally(() => done = true);
  for (let i = 0; i < 12 && !done; i++) { const worker = workers.at(-1), command = worker?.requests.at(-1); if (command && !worker.answered.has(command.id)) worker.accept(); await tick(); }
  assert.ok(done, 'bounded mocked worker flow'); await promise;
}
async function open(port) {
  const session = api.createCadEditorModelingController(port); sessions.push(session); await pump(session.example('round-post'));
  assert.equal(session.getSnapshot().error, null); return session;
}
try {
  const session = await open(), first = session.getSnapshot(), worker = workers.at(-1);
  assert.equal(first.authoredText, baseline.text); assert.equal(first.display.selectedOutput, 'post');
  assert.equal(first.accepted.outputs[0].family, 'stored-rational-circle-prism'); assert.equal(first.accepted.outputs[0].volumeMM3, null); checks++;
  assert.equal(previewCalls, 1); assert.deepEqual(first.display.packet.components[0].preview.packet.positions, baseline.preview.packet.positions);
  assert.deepEqual(first.display.packet.components[0].preview.packet.parameters, baseline.preview.packet.parameters); checks++;
  const same = stable(session), requestCount = worker.requests.length; session.stage('height', '6'); await session.apply();
  assert.deepEqual(stable(session), same); assert.equal(worker.requests.length, requestCount); checks++;
  for (const [name, value] of [['height', 9], ['diameter', 4]]) {
    session.stage(name, String(value)); await pump(session.apply()); assert.equal(session.getSnapshot().accepted.parameters[name], value); checks++;
  }
  session.stage('centerX', '-0'); session.stage('centerY', '.25'); await pump(session.apply());
  const batch = session.getSnapshot(); assert.ok(Object.is(batch.accepted.parameters.centerX, -0)); assert.equal(batch.accepted.parameters.centerY, .25); checks++;
  await pump(session.undo()); assert.equal(session.getSnapshot().accepted.parameters.centerX, 2); await pump(session.redo());
  assert.deepEqual(session.getSnapshot().accepted.parameters, batch.accepted.parameters); checks++;
  session.stage('diameter', '.2'); const pending = stable(session); refused = true; await pump(session.apply()); refused = false;
  assert.deepEqual(stable(session), pending); assert.match(session.getSnapshot().error, /cap-composition/); const priorNative = edits.at(-1).snapshot; checks++;
  session.discard(); session.stage('height', '12'); await pump(session.apply()); assert.equal(edits.at(-1).snapshot, priorNative); checks++;
  const saved = session.getSnapshot().authoredText, reopened = api.createCadEditorModelingController(); sessions.push(reopened);
  await pump(reopened.open(saved)); assert.equal(reopened.getSnapshot().authoredText, saved); assert.equal(reopened.getSnapshot().display.selectedOutput, 'post'); checks++;

  for (const mode of ['provider', 'preview', 'preflight']) {
    const item = await open(); item.stage('diameter', '6'); const before = stable(item), count = previewCalls;
    refused = mode === 'provider'; previewFailure = mode === 'preview'; badPreflight = mode === 'preflight';
    await pump(item.apply()); refused = previewFailure = badPreflight = false;
    assert.deepEqual(stable(item), before); assert.ok(item.getSnapshot().error); if (mode !== 'preview') assert.equal(previewCalls, count); checks++;
  }
  const canceled = await open(); canceled.stage('height', '9'); const beforeCancel = stable(canceled), request = canceled.apply();
  const oldWorker = workers.at(-1), command = oldWorker.requests.at(-1); canceled.cancel(); oldWorker.accept(undefined, command); await request;
  assert.deepEqual(stable(canceled), beforeCancel); checks++;
  await pump(canceled.apply()); assert.equal(canceled.getSnapshot().accepted.parameters.height, 9); assert.ok(loads.length > 0); checks++;

  const mutations = [reply => reply.summary.outputs[0].volumeMM3 = { numerator: '1', denominator: '1' },
    reply => reply.summary.outputs[0].family = 'convex-planar', reply => reply.display.taskToken = 'stale',
    reply => reply.display.components[0].mesh.context.taskToken = 'stale', reply => reply.display.components[0].preview.faceRanges.pop(),
    reply => reply.display.components[0].preview.packet.parameters[0] = .125,
    reply => reply.display.components[0].preview.packet.indices.reverse(),
    reply => reply.display.components[0].qualification.solid = false,
    reply => { const data = JSON.parse(reply.text); data.nodes[0].profile = 'rectangle'; reply.text = signedJSON(data); }];
  for (const mutate of mutations) {
    const item = await open(); item.stage('height', '9'); const before = stable(item), request = item.apply();
    workers.at(-1).accept(mutate); await request; assert.deepEqual(stable(item), before); assert.ok(item.getSnapshot().error); checks++;
  }
  // Two output IDs referencing the same measured body exercise generic Open and hidden admission without new geometry.
  const two = { ...structuredClone(authored), outputs: { a_round: { node: 1, side: 'solid' }, z_round: { node: 1, side: 'solid' } } };
  const mixed = api.createCadEditorModelingController(); sessions.push(mixed); await pump(mixed.open(signedJSON(two)));
  assert.equal(mixed.getSnapshot().error, null); assert.equal(mixed.getSnapshot().display.selectedOutput, 'z_round'); checks++;
  mixed.stage('diameter', '5'); const drafted = mixed.getSnapshot(), count = workers.at(-1).requests.length;
  await mixed.viewOutput('a_round', drafted.generation); assert.deepEqual(mixed.getSnapshot().drafts, drafted.drafts);
  assert.deepEqual(mixed.getSnapshot().history, drafted.history); assert.equal(mixed.getSnapshot().authoredText, drafted.authoredText);
  assert.equal(workers.at(-1).requests.length, count); checks++;
  const hiddenBefore = stable(mixed), hiddenRequest = mixed.apply();
  workers.at(-1).accept(reply => reply.display.components[1].mesh.parametersUV = []); await hiddenRequest;
  assert.deepEqual(stable(mixed), hiddenBefore); assert.ok(mixed.getSnapshot().error); checks++;

  let reject = false, commitReject = false, defer = false, finish; const commits = [], disposed = [];
  const port = { async prepare(display) {
    if (reject) throw Error('Display prepare refusal');
    const candidate = { commit() { if (commitReject) throw Error('Display commit refusal'); commits.push(display.selectedOutput); }, dispose() { disposed.push(display.selectedOutput); } };
    return defer ? new Promise(resolve => finish = () => resolve(candidate)) : candidate;
  } };
  const displaySession = await open(port); displaySession.stage('height', '9');
  for (const mode of ['prepare', 'commit']) {
    const before = stable(displaySession); reject = mode === 'prepare'; commitReject = mode === 'commit';
    await pump(displaySession.apply()); reject = commitReject = false; assert.deepEqual(stable(displaySession), before); checks++;
  }
  const beforeDisplayCancel = stable(displaySession); defer = true; const displayPending = displaySession.apply();
  const dw = workers.at(-1); dw.accept(); await tick(); if (!finish) { dw.accept(); await tick(); }
  assert.equal(typeof finish, 'function'); displaySession.cancel(); finish(); await displayPending; defer = false;
  assert.deepEqual(stable(displaySession), beforeDisplayCancel); assert.ok(disposed.length > 0); checks++;

  let picked; const picker = await open(), generation = picker.getSnapshot().generation;
  for (let y = 8; y < 160 && !picked; y += 8) for (let x = 8; x < 160 && !picked; x += 8) { picker.pick(160, 160, x, y, generation); picked = picker.getSnapshot().faceSelection; }
  assert.equal(picked.family, 'stored-rational-circle-prism'); assert.ok(native.parent.bundle.topology.faces.some(face => face.id === picked.provenance.faceId)); checks++;
  picker.stage('height', '9'); await pump(picker.apply()); assert.equal(picker.getSnapshot().faceSelection, null);
  assert.throws(() => picker.pick(160, 160, 40, 40, generation), /stale/); checks++;
  const result = { ok: true, checks, previewReplayCalls: previewCalls, nativeCalls: 0, nativeTransferSHA256: sha256,
    sourceSHA256: createHash('sha256').update(readFileSync(resolve(root, 'packages/barocss-cad-editor/src/modeling-controller.ts'))).digest('hex'),
    evidence: 'actual worker serializer/controller/CPU scene with mocked Worker; genuine baseline preview arrays and UV; only display IDs/revision rebound; changed-state geometry is explicitly the baseline mock; no native/GPU/browser/physical file run' };
  writeFileSync(resolve(output, 'controller-result.json'), JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result));
} finally { for (const session of sessions) session.dispose(); }
