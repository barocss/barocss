/** node --test packages/barocss-render-editor/tests/native-directional-light-session.test.mjs
 * Real codec/request; private import substitution controls only the actual Viewer boundary. No GPU claim.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from 'esbuild';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const workspace = resolve(root, '..');
const output = await mkdtemp(join(tmpdir(), 'directional-session-'));
const mode = process.env.BAROCSS_SESSION_MODE ?? 'source';
const packageEntry = join(root, 'barocss-render-editor', mode === 'emitted' ? 'dist/index.js' : 'src/index.ts');
const actualViewer = fileURLToPath(import.meta.resolve('@barocss/viewer'));
await build({stdin: {contents: `export * from ${JSON.stringify(packageEntry)};
export {createNativeDirectionalLightController} from ${JSON.stringify(join(workspace, 'apps/render-editor/src/native-directional-light-controller.ts'))};
export {runNativeDirectionalLightSessionFlow} from ${JSON.stringify(join(workspace, 'apps/render-editor/src/native-directional-light-session-flow.ts'))};`,resolveDir: workspace},
  bundle: true, platform: 'node', format: 'esm', outfile: join(output, 'test.mjs'),
  alias: {'@barocss/render-editor': packageEntry}, plugins: [{name: 'private-controlled-viewer', setup(builder) {
    builder.onResolve({filter: /^@barocss\/viewer$/}, () => ({path: 'controlled-viewer', namespace: 'private-test'}));
    builder.onLoad({filter: /.*/, namespace: 'private-test'}, () => ({contents: `export * from ${JSON.stringify(actualViewer)};
export const createNativeDirectionalLightWebGPUViewer = (...args) => globalThis.__directionalLightTestFactory(...args);`,resolveDir: workspace}));
  }}]});
const api = await import(pathToFileURL(join(output, 'test.mjs')).href);
const seed = api.upgradeRenderNativeSceneToDirectionalLights(JSON.parse(await readFile(join(root, 'barocss-render-editor/fixtures/native-scene-document-v0.json'), 'utf8')));
const fixture = api.prepareRenderNativeDirectionalLightDocument({...seed, revision: -0,
  lights: {...seed.lights, revision: -0, ambientStrength: -0, lights: [
    {...seed.lights.lights[0], directionScene: [2, -0, -4], intensity: -0},
    {...seed.lights.lights[0], nodeId: 'fill', label: 'Disabled fill', enabled: false, directionScene: [-3, 5, -0], intensity: .7},
  ]}}).document;
function deferred() {let resolve, reject; const promise = new Promise((a, b) => {resolve = a; reject = b;}); return {promise, resolve, reject};}
function control() {
  const value = {calls: [], disposed: 0, state: 'ready', generation: 1, initial: null, result: null, cleanup: null, factoryGate: null};
  value.factory = async (canvas, request) => {
    value.initial = request;
    const viewer = {accepted: {generation: 1, owner: request.owner},
      get status() {return Object.freeze({backend: 'webgpu', profile: 'qualified-surface-authored-directional-webgpu-v0', state: value.state,
        generation: value.generation, width: 32, height: 32, limits: {}, resources: {}});},
      async replace(next) {
        value.calls.push(next);
        const result = value.result ? await value.result(next) : {ok: true};
        if (result?.ok) {value.generation++; viewer.accepted = {generation: value.generation, owner: next.owner};}
        return result;
      },
      dispose() {value.disposed++; value.state = 'disposed'; if (value.cleanup) throw value.cleanup;},
    };
    value.viewer = viewer;
    if (value.factoryGate) await value.factoryGate.promise;
    return viewer;
  };
  globalThis.__directionalLightTestFactory = value.factory; return value;
}
async function mount(initial = fixture) {const backend = control(); const session = await api.createRenderNativeDirectionalLightSession({}, initial, {width: 32, height: 32}); return {backend, session};}
function version(session) {return session.getSnapshot().version;}
function draft(session, ambientStrength = .3) {
  const accepted = session.getSnapshot().accepted;
  session.setDraftText(api.serializeRenderNativeDirectionalLightDocument({...accepted, lights: {...accepted.lights, ambientStrength}}), version(session));
  return session.prepareDraft(version(session));
}
const code = value => error => error instanceof api.RenderEditorError && error.code === value;

test('branded candidates, exact version, pending owner lock, recoverable refusal and listener isolation', async () => {
  const {backend, session} = await mount(); const candidate = draft(session), gate = deferred();
  backend.result = () => gate.promise;
  let notices = 0; const unsubscribe = session.subscribe(() => {notices++; throw Error('observer');});
  const accepted = session.getSnapshot().accepted, saved = session.getSavePayload();
  const pending = session.commitPrepared(candidate);
  assert.equal(session.getSnapshot().pending, 'apply'); assert.equal(backend.calls.length, 1);
  for (const action of [() => session.setDraftText('x', version(session)), () => session.prepareUndo(version(session)),
    () => session.prepareOpen(saved.text, version(session)), () => session.markSaved(saved), () => session.subscribe(() => {}), unsubscribe]) assert.throws(action, code('STALE_CANDIDATE'));
  await assert.rejects(session.commitPrepared(candidate), code('STALE_CANDIDATE'));
  assert.equal(session.getSnapshot().pending, 'apply');
  const cause = {name: 'controlled refusal'}; gate.resolve({ok: false, error: cause});
  await assert.rejects(pending, error => code('PRESENTATION_REFUSED')(error) && error.cause === cause);
  assert.equal(session.getSnapshot().accepted, accepted); assert.equal(session.getSnapshot().pending, null); assert.equal(session.getSnapshot().dirty, true);
  assert.equal(notices, 2); await assert.rejects(session.commitPrepared(candidate), code('STALE_CANDIDATE'));
  const fresh = session.prepareDraft(version(session));
  for (const forged of [{...fresh}, Object.create(fresh), {}, null]) await assert.rejects(session.commitPrepared(forged), code('STALE_CANDIDATE'));
  const other = await mount(); await assert.rejects(other.session.commitPrepared(fresh), code('STALE_CANDIDATE')); other.session.dispose();
  backend.result = null; await session.commitPrepared(fresh); assert.equal(session.getSnapshot().accepted.revision, 1);
  const stale = session.prepareDraft(version(session)); session.setDraftText('bad', version(session));
  await assert.rejects(session.commitPrepared(stale), code('STALE_CANDIDATE'));
  assert.throws(() => session.prepareDraft(version(session)), code('DOCUMENT_INPUT'));
  session.dispose(); assert.equal(backend.disposed, 1);
});

test('history, owner Open, accepted Save identity and focused signed roundtrip', async () => {
  const {backend, session} = await mount(); const initialNative = session.getSnapshot().accepted.nativeDocument;
  await session.commitPrepared(draft(session, .2)); const first = session.getSavePayload(); session.markSaved(first);
  await session.commitPrepared(draft(session, .4));
  await session.commitPrepared(session.prepareUndo(version(session))); assert.equal(session.getSnapshot().accepted.lights.ambientStrength, .2);
  await session.commitPrepared(session.prepareRedo(version(session))); assert.equal(session.getSnapshot().accepted.lights.ambientStrength, .4);
  await session.commitPrepared(session.prepareUndo(version(session))); await session.commitPrepared(draft(session, .6));
  assert.equal(session.prepareRedo(version(session)), null);
  const save = session.getSavePayload(); session.setDraftText('invalid', version(session)); session.markSaved(save);
  assert.equal(session.getSnapshot().dirty, true); assert.equal(session.getSnapshot().unsaved, false);
  assert.throws(() => session.markSaved({...save}), code('STALE_CANDIDATE')); assert.throws(() => session.markSaved(first), code('STALE_CANDIDATE'));
  const different = {...session.getSnapshot().accepted, title: 'Same revision, new accepted identity'};
  await session.commitPrepared(session.prepareOpen(api.serializeRenderNativeDirectionalLightDocument(different), version(session)));
  assert.throws(() => session.markSaved(save), code('STALE_CANDIDATE')); assert.equal(session.getSnapshot().canUndo, false);
  const opened = {...fixture, documentId: 'another-scene', lights: {...fixture.lights, sourceId: 'another-scene'}};
  const before = session.getSnapshot(); backend.result = async () => ({ok: false, error: 'refused open'});
  await assert.rejects(session.commitPrepared(session.prepareOpen(api.serializeRenderNativeDirectionalLightDocument(opened), version(session))), code('PRESENTATION_REFUSED'));
  assert.equal(session.getSnapshot().accepted, before.accepted); assert.equal(session.getSnapshot().unsaved, before.unsaved);
  backend.result = null; await session.commitPrepared(session.prepareOpen(api.serializeRenderNativeDirectionalLightDocument(opened), version(session)));
  assert.equal(session.getSnapshot().accepted.documentId, 'another-scene'); assert.equal(session.getSnapshot().unsaved, false);
  await session.commitPrepared(draft(session, .8)); const second = session.getSavePayload(); session.markSaved(second);
  const parsed = api.parseRenderNativeDirectionalLightDocument(second.text);
  assert.deepEqual(parsed.nativeDocument, initialNative); assert.deepEqual(parsed.lights.lights, fixture.lights.lights);
  assert.deepEqual(parsed.surfaceMaterials, fixture.surfaceMaterials); assert.deepEqual(parsed.display, fixture.display);
  assert.ok(Object.is(parsed.lights.lights[0].directionScene[1], -0)); assert.equal(parsed.lights.revision, parsed.revision);
  for (const request of backend.calls) {
    assert.deepEqual(request.source.result.document, initialNative); assert.equal(request.owner.revision, request.lights.revision);
    assert.deepEqual(request.source.bindings, backend.initial.source.bindings);
  }
  session.dispose();
});

test('caller isolation, exact signed expected revision, and no fallible copies after ACK', async () => {
  const input = structuredClone(fixture), {session, backend} = await mount(input);
  input.title = 'caller mutation'; input.lights.lights[0].directionScene[0] = 99;
  assert.equal(session.getSnapshot().accepted.title, fixture.title);
  assert.deepEqual(session.getSnapshot().accepted.lights, fixture.lights);
  assert.throws(() => session.prepareUndo({revision: 0, generation: 0}), code('STALE_CANDIDATE'));
  const candidate = draft(session), native = candidate.document.nativeDocument;
  assert.equal(Object.isFrozen(candidate), true); assert.equal(Object.isFrozen(candidate.document.lights.lights[0]), true);
  const freeze = Object.freeze;
  backend.result = async () => {Object.freeze = () => {throw Error('post-ACK freeze');}; return {ok: true};};
  try {await session.commitPrepared(candidate);} finally {Object.freeze = freeze;}
  assert.equal(session.getSnapshot().accepted, candidate.document); assert.equal(session.getSnapshot().accepted.nativeDocument, native);
  session.dispose();
});

test('ACK then loss adopts; lost refusal, rejected and inconsistent backend states remain unavailable', async () => {
  const a = await mount(); a.backend.result = async () => {a.backend.state = 'lost'; return {ok: true};};
  await a.session.commitPrepared(draft(a.session)); assert.equal(a.session.getSnapshot().accepted.revision, 1); assert.equal(a.session.getStatus().state, 'lost');
  assert.throws(() => a.session.prepareUndo(version(a.session)), code('PRESENTATION_REFUSED')); a.session.dispose();
  const b = await mount(), old = b.session.getSnapshot().accepted; b.backend.result = async () => {b.backend.state = 'lost'; return {ok: false, error: 'lost'};};
  await assert.rejects(b.session.commitPrepared(draft(b.session)), code('PRESENTATION_REFUSED')); assert.equal(b.session.getSnapshot().accepted, old); assert.equal(b.session.getStatus().state, 'lost'); b.session.dispose();
  const c = await mount(), thrown = new Proxy({}, {getPrototypeOf() {throw Error('must not inspect');}}); c.backend.result = async () => {throw thrown;};
  await assert.rejects(c.session.commitPrepared(draft(c.session)), error => code('PRESENTATION_REFUSED')(error) && error.cause === thrown);
  assert.equal(c.session.getStatus().state, 'failed'); assert.throws(() => c.session.prepareDraft(version(c.session)), code('PRESENTATION_REFUSED')); c.session.dispose();
  const d = await mount(); d.backend.viewer.replace = async () => ({ok: true});
  await assert.rejects(d.session.commitPrepared(draft(d.session)), code('PRESENTATION_REFUSED')); assert.equal(d.session.getStatus().state, 'failed'); d.session.dispose();
});

test('dispose pending, late results, cleanup failures and hostile version reflection never resurrect', async () => {
  for (const result of [{ok: true}, {ok: false, error: 'late refusal'}]) {
    const {backend, session} = await mount(), gate = deferred(); backend.result = () => gate.promise;
    const accepted = session.getSnapshot().accepted, promise = session.commitPrepared(draft(session)); session.dispose(); gate.resolve(result);
    await assert.rejects(promise, code('DISPOSED')); assert.equal(session.getSnapshot().accepted, accepted); assert.equal(session.getSnapshot().disposed, true); assert.equal(session.getSnapshot().pending, null);
    session.dispose(); assert.equal(backend.disposed, 1);
  }
  const {backend, session} = await mount(), cause = Error('cleanup'); backend.cleanup = cause;
  assert.throws(() => session.dispose(), error => code('PRESENTATION_REFUSED')(error) && error.cause === cause); session.dispose(); assert.equal(session.getStatus().state, 'disposed');
  const fresh = await mount();
  const proxy = new Proxy({}, {ownKeys() {fresh.session.dispose(); return ['revision', 'generation'];},
    getOwnPropertyDescriptor(_, key) {return {value: version(fresh.session)[key], configurable: true, enumerable: true};}});
  assert.throws(() => fresh.session.setDraftText('no resurrection', proxy), code('DISPOSED'));
  assert.equal(fresh.session.getSnapshot().disposed, true);
  for (const cause of [undefined, new api.RenderEditorError('DOCUMENT_BYTES', 'foreign'), new Proxy({}, {getPrototypeOf() {throw Error('no inspection');}})]) {
    const item = await mount(); const bad = new Proxy({}, {ownKeys() {throw cause;}});
    assert.throws(() => item.session.prepareUndo(bad), error => code('STALE_CANDIDATE')(error) && error.cause === cause); item.session.dispose();
  }
});

test('pending notification reentry cannot unlock or present after disposal', async () => {
  const {session, backend} = await mount(); const candidate = draft(session);
  session.subscribe(() => {if (session.getSnapshot().pending) session.dispose();});
  await assert.rejects(session.commitPrepared(candidate), code('DISPOSED'));
  assert.equal(backend.calls.length, 0); assert.equal(backend.disposed, 1); assert.equal(session.getSnapshot().disposed, true);
  const malformed = await mount(); malformed.backend.result = async () => null;
  await assert.rejects(malformed.session.commitPrepared(draft(malformed.session)), code('PRESENTATION_REFUSED'));
  assert.equal(malformed.session.getStatus().state, 'failed'); malformed.session.dispose();
});

test('history count and revision caps refuse before Viewer', async () => {
  const {session, backend} = await mount();
  for (let n = 1; n < 64; n++) await session.commitPrepared(draft(session, (n % 10) / 10));
  assert.throws(() => draft(session), code('HISTORY_LIMIT')); assert.equal(backend.calls.length, 63); session.dispose();
  const max = {...fixture, revision: 2147483647, lights: {...fixture.lights, revision: 2147483647}};
  const capped = await mount(max); assert.throws(() => capped.session.prepareDraft(version(capped.session)), code('DOCUMENT_INPUT')); assert.equal(capped.backend.calls.length, 0); capped.session.dispose();
});

test('canonical UTF8 history budget refuses before presentation', async () => {
  const padded = {...fixture, nativeDocument: {...fixture.nativeDocument, assets: fixture.nativeDocument.assets.map(asset => ({...asset, source: ' '.repeat(140000) + asset.source}))}};
  const {session, backend} = await mount(padded);
  const bytes = new TextEncoder().encode(session.getSavePayload().text).length;
  assert.ok(bytes > 262144 && bytes < 2097152);
  const maximum = Math.floor(16777216 / bytes);
  assert.ok(maximum < 64);
  for (let n = 1; n < maximum; n++) await session.commitPrepared(draft(session, (n % 10) / 10));
  assert.throws(() => draft(session), code('HISTORY_LIMIT'));
  assert.equal(backend.calls.length, maximum - 1); session.dispose();
});

test('controller initial failure, supersession and closure clean late factory results', async () => {
  const backend = control(), gate = deferred(); backend.factoryGate = gate;
  const controller = api.createNativeDirectionalLightController(), mounting = controller.mount({}, fixture, {width: 32, height: 32});
  controller.dispose(); gate.resolve(); assert.equal(await mounting, null); assert.equal(backend.disposed, 1); assert.equal(controller.getSession(), null);
  await assert.rejects(controller.mount({}, fixture, {width: 32, height: 32}), code('DISPOSED'));
  const first = control(), firstGate = deferred(); first.factoryGate = firstGate;
  const nextController = api.createNativeDirectionalLightController(), firstMount = nextController.mount({}, fixture, {width: 32, height: 32});
  const second = control(), secondSession = await nextController.mount({}, fixture, {width: 32, height: 32});
  firstGate.resolve(); assert.equal(await firstMount, null); assert.equal(first.disposed, 1); assert.equal(nextController.getSession(), secondSession);
  nextController.dispose(); nextController.dispose(); assert.equal(second.disposed, 1);
  const failure = Error('initial mount refusal'); globalThis.__directionalLightTestFactory = async () => {throw failure;};
  const failed = api.createNativeDirectionalLightController(); await assert.rejects(failed.mount({}, fixture, {width: 32, height: 32}), error => code('PRESENTATION_REFUSED')(error) && error.cause === failure); failed.dispose();
});

test('actual source/emitted headless application flow and public factory export', async () => {
  const backend = control(); assert.equal(typeof api.createRenderNativeDirectionalLightSession, 'function');
  const result = await api.runNativeDirectionalLightSessionFlow({}, fixture); assert.equal(result.revision, 5); assert.equal(backend.disposed, 1);
  assert.equal(api.prepareDirectionalDocument, undefined); assert.equal(api.createNativeDirectionalLightWebGPUViewer, undefined);
});
process.on('exit', () => {delete globalThis.__directionalLightTestFactory;});
// The temporary bundle has no persistent product state.
await rm(output, {recursive: true, force: true});
