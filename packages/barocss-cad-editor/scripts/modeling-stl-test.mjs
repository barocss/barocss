// Retained genuine native bodies/files; provider execution and Worker are mocked.
// The current engine, serializer, controller and receiving scene run unchanged.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve(import.meta.dirname, '../../..');
const out = resolve(process.env.EVIDENCE_DIR ?? '/tmp/cad-editor-stl'); mkdirSync(out, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const esbuild = require('esbuild'), hash = b => createHash('sha256').update(b).digest('hex');
const fixture = resolve(root, 'packages/barocss-cad/test/modeling-stl-evidence/baseline-transfer.json');
const raw = readFileSync(fixture), baseline = JSON.parse(raw), originalHash = hash(raw);
assert.equal(originalHash, 'bedaa0789d86a310fe6ba25fc163f3063bdebceadc2f3223c8938663584ec92d');
let loads = 0, samples = 0, exports = 0, exportFailure = null, exportMutation = null, lastSnapshot;
const forbidden = () => { throw Error('No native execution in consumer replay.'); };
function snapshot(text) {
  const authored = JSON.parse(text);
  const value = { parameters: authored.parameters, suppression: {}, features: structuredClone(baseline.features),
    bodies: structuredClone(baseline.bodies), save: () => text,
    withParameters(parameters) { const next = JSON.parse(text); Object.assign(next.parameters, parameters); return snapshot(JSON.stringify(next)); },
    withSuppression: forbidden,
    exportStl(name) { exports++; if (exportFailure) throw Error(exportFailure);
      const result = structuredClone(baseline.exports[name]); if (exportMutation) exportMutation(result); return result; },
  }; lastSnapshot = value; return value;
}
globalThis.__stlProvider = { cad: { model: forbidden, load(text) { loads++; return snapshot(text); } },
  tessellateConvexPlanarSolid(native, options) {
    assert.deepEqual(options, { maximumFanTriangles: 40 });
    const name = Object.keys(baseline.bodies).find(k => baseline.bodies[k].native.report.solidId === native.report.solidId);
    assert.ok(name); assert.deepEqual(native, baseline.bodies[name].native); samples++;
    return structuredClone(baseline.exports[name].details.native);
  }, tessellateSurface: forbidden, tessellateOwnPlateCircularHole: forbidden, tessellateXYCirclePrismShell: forbidden };
const source = n => resolve(root, 'packages/barocss-cad-editor/src', n + '.ts');
const gpu = resolve(out, 'gpu-entry.ts');
writeFileSync(gpu, ['engine-scene', 'engine-camera-ray', 'engine-raycast', 'kernel-face-preview']
  .map(n => `export * from ${JSON.stringify(resolve(root, 'packages/barocss-gpu/src', n + '.ts'))}`).join('\n'));
const sourceHashes = {};
async function bundle(name, contents, plugins = [], alias = {}) {
  const built = await esbuild.build({ stdin: { contents, resolveDir: root }, absWorkingDir: root,
    bundle: true, platform: 'node', format: 'esm', write: false, metafile: true, plugins, alias });
  for (const input of Object.keys(built.metafile.inputs)) if (input !== '<stdin>' && !input.startsWith('stub:')) {
    assert.ok(!input.includes('barocss-cad/src/')); sourceHashes[input] = hash(readFileSync(resolve(root, input)));
  }
  const path = resolve(out, name + '.mjs'); writeFileSync(path, built.outputFiles[0].text); return import(pathToFileURL(path));
}
const engineApi = await bundle('engine', `export * from ${JSON.stringify(source('modeling-engine'))}`, [{ name: 'retained-provider', setup(b) {
  b.onResolve({ filter: /^@barocss\/cad$/ }, () => ({ path: 'cad', namespace: 'stub' }));
  b.onResolve({ filter: /^\.\/prism-feature-engine\.js$/ }, () => ({ path: 'legacy', namespace: 'stub' }));
  b.onLoad({ filter: /.*/, namespace: 'stub' }, a => ({ contents: a.path === 'cad'
    ? 'export const {cad,tessellateConvexPlanarSolid,tessellateSurface,tessellateOwnPlateCircularHole,tessellateXYCirclePrismShell}=globalThis.__stlProvider'
    : 'export function createPrismFeatureEngine(){return()=>{throw Error("Legacy execution forbidden")}}' }));
} }]);
const api = await bundle('controller', `export * from ${JSON.stringify(source('modeling-controller'))}`, [{ name: 'no-native', setup(b) {
  b.onResolve({ filter: /^@barocss\/cad$/ }, forbidden);
} }], { '@barocss/gpu': gpu });
const engineGroups = [], controllerGroups = [];
function group(list, name, run) { return Promise.resolve().then(run).then(() => { list.push(name); console.log(JSON.stringify({ group: name, result: 'PASS' })); }); }
let requestId = 0;
const command = (extra = {}) => ({ id: ++requestId, taskToken: 'export_request', kind: 'export-stl',
  expectedRevision: 0, acceptedTaskToken: 'accepted_model', outputName: 'right', solidId: baseline.outputIdentities.right.solidId, ...extra });
const engine = engineApi.createModelingEngine();
await group(engineGroups, 'no accepted snapshot refuses export', () => assert.equal(engine(command()).ok, false));
await group(engineGroups, 'ready right export exact bytes without load or display tessellation', () => {
  assert.equal(engine({ id: ++requestId, taskToken: 'accepted_model', kind: 'open', text: baseline.text }).ok, true);
  const before = [loads, samples], reply = engine(command()); assert.equal(reply.ok, true, reply.message);
  assert.deepEqual(reply.export.bytes, baseline.exports.right.bytes); assert.deepEqual([loads, samples], before);
  assert.equal(reply.export.acceptedTaskToken, 'accepted_model'); assert.equal(reply.export.requestTaskToken, 'export_request');
});
await group(engineGroups, 'left independently selects accepted output', () => {
  const reply = engine(command({ outputName: 'left', solidId: baseline.outputIdentities.left.solidId }));
  assert.equal(reply.ok, true, reply.message); assert.deepEqual(reply.export.bytes, baseline.exports.left.bytes);
});
await group(engineGroups, 'stale identity and command shape refuse before provider', () => {
  const before = exports;
  for (const extra of [{ expectedRevision: 1 }, { acceptedTaskToken: 'wrong' }, { solidId: 'wrong' },
    { outputName: 'missing' }, { extra: true }, { taskToken: undefined }]) assert.equal(engine(command(extra)).ok, false);
  const getter = command(); let reads = 0; Object.defineProperty(getter, 'outputName', { enumerable: true, get() { reads++; return 'right'; } });
  assert.equal(engine(getter).ok, false); assert.equal(reads, 0); assert.equal(exports, before);
});
await group(engineGroups, 'unsupported family refuses before native payload access', () => {
  const body = lastSnapshot.bodies.right, before = exports;
  lastSnapshot.bodies.right = { family: 'orthogonal-cell', get native() { throw Error('Payload accessed'); } };
  assert.match(engine(command()).message, /convex-planar/); assert.equal(exports, before); lastSnapshot.bodies.right = body;
});
await group(engineGroups, 'native collapse propagates without partial bytes or lost accepted model', () => {
  exportFailure = 'COLLAPSE at facet'; const failed = engine(command()); exportFailure = null;
  assert.equal(failed.ok, false); assert.match(failed.message, /COLLAPSE/); assert.equal(Object.hasOwn(failed, 'export'), false);
  assert.equal(engine(command()).ok, true);
});
await group(engineGroups, 'provider projection mismatch refuses and retains snapshot', () => {
  exportMutation = result => { result.details.report.solidId = 'wrong'; };
  assert.equal(engine(command()).ok, false); exportMutation = null; assert.equal(engine(command()).ok, true);
});
await group(engineGroups, 'edited revision and worker token replace earlier export authority', () => {
  // Mocked edited display uses baseline geometry; this tests authority, not changed geometry.
  const reply = engine({ id: ++requestId, taskToken: 'edited_model', kind: 'apply', expectedRevision: 0, parameters: { spacing: 64 } });
  assert.equal(reply.ok, true, reply.message); assert.equal(engine(command()).ok, false);
  assert.equal(engine(command({ expectedRevision: 1, acceptedTaskToken: 'edited_model' })).ok, true);
});
let replies = 0, commits = 0, prepares = 0, held = null, mode = null;
const workers = [];
const previousWorker = globalThis.Worker;
globalThis.Worker = class {
  callbacks = {}; engine = engineApi.createModelingEngine(); terminated = false;
  constructor() { workers.push(this); }
  addEventListener(type, callback) { this.callbacks[type] = callback; }
  terminate() { this.terminated = true; }
  postMessage(command) {
    const reply = this.engine(structuredClone(command));
    const deliver = value => { assert.ok(++replies <= 32); this.callbacks.message({ data: structuredClone(value) }); };
    const active = mode; mode = null;
    if (active === 'hold') { held = () => deliver(reply); return; }
    if (active === 'wrong-id') { queueMicrotask(() => { deliver({ ...reply, id: reply.id + 1000 }); deliver(reply); }); return; }
    if (typeof active === 'function') active(reply);
    queueMicrotask(() => deliver(reply));
  }
};
const session = api.createCadEditorModelingController({ async prepare() { prepares++; return { commit() { commits++; }, dispose() {} }; } });
const stable = () => { const value = session.getSnapshot(); delete value.busy; delete value.error; delete value.workerReady; return value; };
let baselineState;
try {
  await group(controllerGroups, 'actual open establishes one accepted display', async () => {
    await session.open(baseline.text); assert.equal(session.getSnapshot().error, null); assert.equal(commits, 1); baselineState = stable();
  });
  await group(controllerGroups, 'right export preserves model history selection display', async () => {
    const before = [loads, samples, commits, prepares]; const result = await session.exportStl('right', session.getSnapshot().generation);
    assert.deepEqual(result.bytes, baseline.exports.right.bytes); assert.deepEqual(stable(), baselineState); assert.deepEqual([loads, samples, commits, prepares], before);
  });
  await group(controllerGroups, 'left export does not reuse right bytes', async () => {
    const result = await session.exportStl('left', session.getSnapshot().generation); assert.deepEqual(result.bytes, baseline.exports.left.bytes); assert.deepEqual(stable(), baselineState);
  });
  await group(controllerGroups, 'draft generation unknown output preflight sends no request', async () => {
    const before = replies; session.stage('spacing', '64'); await assert.rejects(session.exportStl('right', session.getSnapshot().generation), /discard/); session.discard();
    await assert.rejects(session.exportStl('right', -1), /current/); await assert.rejects(session.exportStl('unknown', session.getSnapshot().generation), /current/);
    assert.equal(replies, before); assert.deepEqual(stable(), baselineState);
  });
  await group(controllerGroups, 'busy cancel and late reply yield no export', async () => {
    mode = 'hold'; const result = session.exportStl('right', session.getSnapshot().generation);
    await assert.rejects(session.exportStl('left', session.getSnapshot().generation), /progress/);
    session.cancel(); assert.equal(await result, null); held(); held = null; assert.deepEqual(stable(), baselineState); assert.equal(session.getSnapshot().workerReady, false);
  });
  await group(controllerGroups, 'lost worker requires explicit recovery before any request', async () => {
    const before = replies; await assert.rejects(session.exportStl('right', session.getSnapshot().generation), /explicitly/); assert.equal(replies, before);
  });
  await group(controllerGroups, 'reconstruction parity failure preserves original state', async () => {
    mode = r => { r.summary.documentId += '_different'; r.display.documentId = r.summary.documentId; };
    assert.equal(await session.exportStl('right', session.getSnapshot().generation, true), null);
    assert.match(session.getSnapshot().error, /Reconstruction differs/); assert.deepEqual(stable(), baselineState); assert.equal(commits, 1); assert.equal(session.getSnapshot().workerReady, false);
  });
  await group(controllerGroups, 'explicit recovery admits scene without display or history commit', async () => {
    const before = [commits, prepares]; const result = await session.exportStl('right', session.getSnapshot().generation, true);
    assert.deepEqual(result.bytes, baseline.exports.right.bytes); assert.deepEqual([commits, prepares], before); assert.deepEqual(stable(), baselineState);
  });
  await group(controllerGroups, 'stale task revision output and solid replies are refused', async () => {
    for (const [field, value] of [['acceptedTaskToken', 'stale'], ['requestTaskToken', 'stale'], ['revision', 2], ['outputName', 'left'], ['solidId', 'wrong']]) {
      mode = r => { r.export[field] = value; };
      assert.equal(await session.exportStl('right', session.getSnapshot().generation), null); assert.deepEqual(stable(), baselineState);
      assert.equal(session.getSnapshot().workerReady, false);
      assert.ok(await session.exportStl('right', session.getSnapshot().generation, true));
    }
  });
  await group(controllerGroups, 'native refusal and unrelated reply id retain current authority', async () => {
    exportFailure = 'COLLAPSE at facet'; assert.equal(await session.exportStl('right', session.getSnapshot().generation), null); exportFailure = null;
    assert.match(session.getSnapshot().error, /COLLAPSE/); assert.equal(session.getSnapshot().workerReady, true);
    mode = 'wrong-id'; assert.ok(await session.exportStl('right', session.getSnapshot().generation)); assert.deepEqual(stable(), baselineState);
    const unsubscribe = session.subscribe(() => { if (!session.getSnapshot().busy) { unsubscribe(); session.cancel(); } });
    assert.equal(await session.exportStl('right', session.getSnapshot().generation), null, 'subscriber cancellation before promise delivery');
    assert.ok(await session.exportStl('right', session.getSnapshot().generation, true));
  });
  await group(controllerGroups, 'idle worker error announces explicit recovery', async () => {
    let emitted = 0; const unsub = session.subscribe(() => emitted++); workers.at(-1).callbacks.error(); unsub();
    assert.equal(emitted, 1); assert.equal(session.getSnapshot().workerReady, false); assert.match(session.getSnapshot().error, /Recover/);
    assert.deepEqual(stable(), baselineState);
  });
  await group(controllerGroups, 'dispose during pending recovery ignores late bytes', async () => {
    mode = 'hold'; const result = session.exportStl('right', session.getSnapshot().generation, true); session.dispose();
    assert.equal(await result, null); held(); held = null; assert.equal(session.getSnapshot().disposed, true); assert.equal(commits, 1);
  });
  assert.equal(engineGroups.length, 8); assert.equal(controllerGroups.length, 12); assert.equal(hash(readFileSync(fixture)), originalHash);
  const result = { result: 'PASS', engineGroups, controllerGroups, controllerSessions: 1, replies,
    newNativeCalls: 0, provider: '5c6dc223a9b9e6b88bc8134651366b23147bc7c4', fixtureSHA256: originalHash, sourceHashes,
    limitations: ['Provider load/export/sampling and Worker are mocked; real retained bytes and actual serializer/controller/receiver run.',
      'Edited display uses baseline geometry for authority tests only.', 'No browser disk, GPU, slicer or manufacturing verification.'] };
  writeFileSync(resolve(out, 'result.json'), JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result));
} finally { session.dispose(); globalThis.Worker = previousWorker; delete globalThis.__stlProvider; }
