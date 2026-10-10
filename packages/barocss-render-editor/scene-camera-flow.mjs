import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..');
assert(process.argv.length === 4 && process.argv[2] === '--output', 'Use --output <new-evidence-directory>.');
const output = resolve(process.argv[3]);
await mkdir(dirname(output), {recursive: true}); await mkdir(output);
const receipt = {issue: 1228, node: process.version, head: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(),
  scope: 'Ordinary source CPU/controller protocol with a declared injected presentation model. No real renderer, browser, or pixel claim.',
  startedAt: new Date().toISOString(), ok: false, cases: []};
let stage = 'headless ordinary source graph';
try {
  assert.equal(Number(process.versions.node.split('.')[0]), 22);
  const bundle = await build({absWorkingDir: root, stdin: {contents: "export * from '@barocss/render-editor';", resolveDir: here, sourcefile: 'scene-camera-consumer.mjs'},
    bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2022', metafile: true});
  const inputs = Object.keys(bundle.metafile.inputs);
  assert(inputs.some(path => path.endsWith('barocss-render-editor/src/controller.ts')));
  assert(inputs.some(path => path.endsWith('barocss-gpu/src/camera.ts')));
  assert(!inputs.some(path => /packages\/barocss-[^/]+\/dist\//.test(path) || /node_modules\/react\//.test(path)));
  receipt.sourceInputs = inputs.filter(path => /packages\/barocss-[^/]+\/src\//.test(path)).length; receipt.ownDistInputs = 0;
  await writeFile(resolve(output, 'source-metafile.json'), JSON.stringify(bundle.metafile, null, 2) + '\n');
  const globals = new Map(); let api;
  try {
    for (const key of ['window', 'document', 'requestAnimationFrame', 'setTimeout', 'setInterval', 'addEventListener']) {
      globals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
      Object.defineProperty(globalThis, key, {configurable: true, get() { throw Error(`Pure source root accessed ${key}`); }});
    }
    api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
  } finally {
    for (const [key, descriptor] of globals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
  const source = '/* Original scene and IDs stay authored. */\r\n@scene camera_tools { version: 1; background: #123; sphere #orb; box #block; cylinder #post; }\r\n'
    + '#orb { radius: .65; translate: -1 0 0; }\r\n#block { size: 1 1 1; translate: 1 0 0; }\r\n#post { radius: .3; height: 1.5; translate: 0 1 -0; }\r\n';
  const camera = {eye: [0, 0, 6], target: [0, 0, 0], up: [0, 1, 0], fovYDegrees: 45, near: .01, far: 100};
  const document = {format: 'barocss-render-editor', version: 0, kind: 'gpu-scene', documentId: 'camera_tools', title: 'Camera tools', revision: 0, sourceVersion: 1, sceneSource: source, camera};
  const move = api.deriveRenderCameraInteraction(camera, {kind: 'orbit', deltaX: 45, deltaY: -16, width: 1000, height: 760});
  const panned = api.deriveRenderCameraInteraction(move, {kind: 'pan', deltaX: 20, deltaY: 8, width: 1000, height: 760});
  const zoomed = api.deriveRenderCameraInteraction(panned, {kind: 'zoom', factor: 1.1});
  const checkOK = result => { assert(result.ok, result.error?.message); };
  function harness() {
    const session = api.createRenderEditorSession(document);
    const model = {shown: null, calls: [], nextFailure: null, presentHook: null, recoverHook: null, disposed: 0};
    const presenter = {
      present(candidate, previous) {
        model.calls.push({method: 'present', mode: candidate.mode, document: candidate.document});
        assert(Object.isFrozen(candidate.document)); assert.deepEqual(previous, model.shown, 'Controller compensation baseline is not the last shown document.');
        if (candidate.mode === 'camera') assert.equal(candidate.document.sceneSource, model.shown.sceneSource, 'Camera-only mode attempted a source replacement.');
        if (model.nextFailure) {
          const failure = model.nextFailure; model.nextFailure = null;
          if (failure.throw) throw failure.error;
          if (!failure.recovered) model.shown = null;
          return {ok: false, error: failure.error, recovered: failure.recovered};
        }
        model.shown = candidate.mode === 'source' ? {...candidate.document, camera: model.shown.camera} : candidate.document;
        const hook = model.presentHook; model.presentHook = null; hook?.(candidate);
        return {ok: true};
      },
      recover(accepted) { model.calls.push({method: 'recover', document: accepted}); model.shown = accepted; const hook = model.recoverHook; model.recoverHook = null; hook?.(); return {ok: true}; },
      dispose() { model.disposed++; model.shown = null; },
    };
    const controller = api.createRenderEditorController(session, presenter);
    assert.equal(controller.getSnapshot().presentedRevision, 0);
    return {session, controller, model, presenter, close() {controller.dispose(); controller.dispose(); session.dispose(); assert.equal(model.disposed, 1);} };
  }

  stage = 'preview Use Cancel history and qualified camera';
  const first = harness(), initial = first.session.getSnapshot(), originalBytes = api.serializeRenderEditorDocument(initial.accepted);
  checkOK(first.controller.previewCamera(move)); assert.equal(first.session.getSnapshot(), initial);
  assert(first.controller.getSnapshot().cameraPreview); assert.equal(first.controller.getSnapshot().presentedRevision, 0);
  assert.equal(first.model.calls.at(-1).mode, 'camera');
  assert.equal(api.serializeRenderEditorDocument(first.session.getSnapshot().accepted), originalBytes);
  checkOK(first.controller.previewCamera(panned)); checkOK(first.controller.previewCamera(zoomed));
  for (const action of [() => first.controller.apply(), () => first.controller.open(originalBytes), () => first.controller.undo(), () => first.controller.redo()]) assert(!action().ok);
  checkOK(first.controller.cancelCameraPreview()); assert.equal(first.controller.getSnapshot().cameraPreview, null);
  assert.equal(first.session.getSnapshot(), initial); assert.deepEqual(first.model.shown.camera, initial.accepted.camera);
  checkOK(first.controller.previewCamera(zoomed)); const beforeUse = first.model.calls.length;
  checkOK(first.controller.applyCameraPreview());
  assert.deepEqual(first.model.calls.slice(beforeUse).map(call => call.mode), ['camera', 'both']);
  assert.equal(first.session.getSnapshot().accepted.revision, 1); assert.equal(first.session.getSnapshot().accepted.sceneSource, source);
  assert.deepEqual(first.session.getSnapshot().accepted.camera, zoomed); assert.equal(first.controller.getSnapshot().cameraPreview, null);
  checkOK(first.controller.undo()); assert.equal(first.session.getSnapshot().accepted.revision, 2); assert.deepEqual(first.model.shown.camera, camera);
  checkOK(first.controller.redo()); assert.equal(first.session.getSnapshot().accepted.revision, 3); assert.deepEqual(first.model.shown.camera, zoomed);
  let getterCalls = 0; const accessor = {...camera}; Object.defineProperty(accessor, 'eye', {enumerable: true, get() {getterCalls++; return [0, 0, 6];}});
  const beforeInvalid = first.controller.getSnapshot(); assert(!first.controller.previewCamera(accessor).ok); assert.equal(getterCalls, 0); assert.equal(first.controller.getSnapshot(), beforeInvalid);
  const invalidCamera = first.controller.previewCamera({...camera, eye: [0, 0, 0]}); assert(!invalidCamera.ok); assert(invalidCamera.error.cause instanceof RangeError);
  first.close(); receipt.cases.push('actual camera derivation; immutable camera-only preview; blocked actions; restore then whole Use; single history; native camera cause/getter0');

  stage = 'unrelated hidden raw/source drafts';
  for (const mode of ['object', 'source']) {
    const h = harness(), accepted = h.session.getSnapshot().accepted;
    if (mode === 'object') h.session.setDraftObjectSource(null); else h.session.setDraftSource('invalid original source draft');
    h.session.setDraftCamera({...camera, near: -1});
    const draftBefore = h.session.getSnapshot(), nativeSource = draftBefore.draftSource;
    checkOK(h.controller.previewCamera(move)); assert.equal(h.session.getSnapshot(), draftBefore);
    assert(!h.controller.applyCameraPreview().ok);
    assert.equal(h.session.getSnapshot().accepted, accepted); assert.equal(h.session.getSnapshot().draftSource, nativeSource);
    assert.equal(h.session.getSnapshot().objectInputInvalid, mode === 'object'); assert.deepEqual(h.session.getSnapshot().draftCamera, move);
    assert.deepEqual(h.model.shown.camera, accepted.camera); assert.equal(h.controller.getSnapshot().cameraPreview, null);
    assert(!h.session.getSnapshot().canUndo); h.close();
  }
  receipt.cases.push('preview accepted geometry only; hidden object/manual source refusal preserves raw data and staged camera without history');

  stage = 'retained/lost/cancel/throw';
  const retained = harness(); retained.model.nextFailure = {error: Error('first retained refusal'), recovered: true};
  assert(!retained.controller.previewCamera(move).ok); assert.equal(retained.controller.getSnapshot().cameraPreview, null);
  checkOK(retained.controller.previewCamera(move)); const good = retained.controller.getSnapshot().cameraPreview;
  retained.model.nextFailure = {error: Error('late retained refusal'), recovered: true}; assert(!retained.controller.previewCamera(panned).ok);
  assert.equal(retained.controller.getSnapshot().cameraPreview, good); assert.deepEqual(retained.model.shown.camera, good);
  retained.model.nextFailure = {error: Error('cancel retained refusal'), recovered: true}; assert(!retained.controller.cancelCameraPreview().ok);
  assert.equal(retained.controller.getSnapshot().cameraPreview, good); checkOK(retained.controller.cancelCameraPreview());
  checkOK(retained.controller.previewCamera(move)); retained.model.nextFailure = {error: Error('lost presentation'), recovered: false};
  assert(!retained.controller.previewCamera(panned).ok); assert.equal(retained.controller.getSnapshot().presentedRevision, null); assert.equal(retained.controller.getSnapshot().cameraPreview, null);
  checkOK(retained.controller.recover()); retained.model.nextFailure = {error: Error('presenter throw'), throw: true};
  assert(!retained.controller.previewCamera(move).ok); assert.equal(retained.controller.getSnapshot().presentedRevision, null); assert.equal(retained.controller.getSnapshot().cameraPreview, null);
  checkOK(retained.controller.recover()); retained.close(); receipt.cases.push('first retained null; last-good camera identity; failed cancel remains pending; lost/throw discard preview; explicit accepted recovery');

  stage = 'stale external source and full restoration';
  const stale = harness(); checkOK(stale.controller.previewCamera(move)); stale.session.setActiveObject('block');
  assert(!stale.controller.previewCamera(panned).ok); assert(!stale.controller.applyCameraPreview().ok); checkOK(stale.controller.cancelCameraPreview());
  checkOK(stale.controller.previewCamera(move)); const changedSource = source + '\n/* external accepted source */\n';
  stale.session.setDraftSource(changedSource); stale.session.commitPrepared(stale.session.prepareDraft('source'));
  assert(!stale.controller.previewCamera(panned).ok); assert(!stale.controller.applyCameraPreview().ok);
  checkOK(stale.controller.cancelCameraPreview()); assert.equal(stale.model.calls.at(-1).mode, 'both'); assert.equal(stale.model.shown.sceneSource, changedSource);
  assert.equal(stale.controller.getSnapshot().presentedRevision, stale.session.getSnapshot().accepted.revision); stale.close();
  receipt.cases.push('snapshot stale guards; direct accepted source replacement requires complete restore rather than camera-only fiction');

  stage = 'reentrancy/session mutation/loss epoch';
  const reentrant = harness(); let reentry = 0;
  const stop = reentrant.controller.subscribe(() => { if (reentrant.controller.getSnapshot().cameraPreview) {
    assert(!reentrant.controller.recover().ok); assert(!reentrant.controller.apply().ok); reentry++;
  } });
  checkOK(reentrant.controller.previewCamera(move)); assert(reentry > 0); stop();
  const acceptedBefore = reentrant.session.getSnapshot().accepted;
  reentrant.session.discardDraft(); checkOK(reentrant.controller.cancelCameraPreview());
  reentrant.model.presentHook = () => reentrant.session.setDraftSource(source + '\n/* callback draft */');
  assert(!reentrant.controller.previewCamera(move).ok); assert.equal(reentrant.session.getSnapshot().accepted, acceptedBefore);
  assert(reentrant.controller.getSnapshot().cameraPreview); checkOK(reentrant.controller.cancelCameraPreview());
  reentrant.session.discardDraft(); reentrant.model.presentHook = () => {
    reentrant.model.shown = null; reentrant.controller.presentationUnavailable(Error('synchronous loss'));
  };
  assert(!reentrant.controller.previewCamera(move).ok); assert.equal(reentrant.controller.getSnapshot().presentedRevision, null); assert.equal(reentrant.controller.getSnapshot().cameraPreview, null);
  reentrant.model.recoverHook = () => { reentrant.model.shown = null; reentrant.controller.presentationUnavailable(Error('loss during recover')); };
  assert(!reentrant.controller.recover().ok); assert.equal(reentrant.controller.getSnapshot().presentedRevision, null);
  checkOK(reentrant.controller.recover());
  reentrant.model.presentHook = () => { reentrant.session.setDraftSource(source + '\n/* actual accepted replacement */'); reentrant.session.commitPrepared(reentrant.session.prepareDraft()); };
  assert(!reentrant.controller.previewCamera(move).ok); assert.equal(reentrant.controller.getSnapshot().presentedRevision, null); assert.equal(reentrant.controller.getSnapshot().cameraPreview, null);
  checkOK(reentrant.controller.recover()); reentrant.close();

  const staged = harness(); checkOK(staged.controller.previewCamera(move)); let observed = false;
  const stopStage = staged.session.subscribe(() => { if (!observed && staged.controller.getSnapshot().cameraPreview === null) {
    observed = true; staged.session.setDraftSource(source + '\n/* observer altered draft */');
  } });
  assert(!staged.controller.applyCameraPreview().ok); assert(observed); assert.equal(staged.session.getSnapshot().accepted.revision, 0);
  assert.deepEqual(staged.model.shown.camera, camera); assert(staged.session.getSnapshot().draftSource.includes('observer altered draft'));
  stopStage(); staged.close(); receipt.cases.push('busy reentry refusal; direct draft/accepted mutation fencing; synchronous loss/recovery epoch; observer staging invariant refuses unintended Apply');

  stage = 'detach/dispose/serialization';
  const life = harness(); checkOK(life.controller.previewCamera(move)); life.controller.detachPresenter(life.presenter);
  assert.equal(life.controller.getSnapshot().cameraPreview, null); assert.equal(life.controller.getSnapshot().presentedRevision, null);
  assert.equal(life.session.getSnapshot().accepted.revision, 0); assert.equal(life.model.disposed, 1);
  life.controller.dispose(); life.session.dispose(); assert(!life.controller.previewCamera(move).ok);
  const serialized = api.serializeRenderEditorDocument(document); assert.equal(api.parseRenderEditorDocument(serialized).sceneSource, source);
  assert(!Object.hasOwn(JSON.parse(serialized), 'cameraPreview'));
  await writeFile(resolve(output, 'qualified-camera.render-scene.json'), serialized);

  stage = 'shared Source/mixed transport static seams';
  const shared = await readFile(resolve(here, 'src/camera-input.ts'), 'utf8');
  const mixed = await readFile(resolve(here, 'src/mixed-camera-input.ts'), 'utf8');
  const scene = await readFile(resolve(here, 'src/scene-camera-input.ts'), 'utf8');
  const realPresenter = await readFile(resolve(here, 'src/scene-viewport.ts'), 'utf8');
  assert(shared.includes('deriveRenderCameraInteraction') && shared.includes('requestAnimationFrame') && shared.includes('pointercancel') && shared.includes('webglcontextlost'));
  assert(mixed.includes("'./camera-input.js'") && scene.includes("'./camera-input.js'"));
  assert(mixed.includes('createCameraInput') && scene.includes('createCameraInput'));
  assert(realPresenter.includes('renderer.setCamera') && realPresenter.includes('Camera-only presentation cannot replace'));
  receipt.transport = {scope: 'Static Source/mixed shared transport seam only; no synthetic DOM events/browser claim.', wrappers: ['mixed-camera-input.ts', 'scene-camera-input.ts'], realSetCameraPath: true};
  receipt.cases.push('detach/dispose clears temporary authority; authored serialization excludes preview; static shared transport and actual setCamera seam');
  receipt.ok = true;
} catch (error) {
  receipt.firstFailure = {stage, message: error.message ?? String(error), stack: error.stack ?? String(error)};
  process.exitCode = 1;
  await writeFile(resolve(output, 'first-failure.json'), JSON.stringify(receipt.firstFailure, null, 2) + '\n');
}
receipt.finishedAt = new Date().toISOString();
await writeFile(resolve(output, 'scene-camera-flow.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
