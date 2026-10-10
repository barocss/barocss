import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..');
assert(process.argv.length === 4 && process.argv[2] === '--output', 'Use --output <new-evidence-directory>.');
const output = resolve(process.argv[3]);
await mkdir(dirname(output), {recursive: true}); await mkdir(output);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const receipt = {issue: 1323, head: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(),
  node: process.version, scope: 'Ordinary source public bounds/camera/framing and real session/controller/Node files. Injected presenter is a CPU protocol model; no GL, browser, pixels, culling or Float32 rounding certificate.',
  declaredFitMargin: 1.2, startedAt: new Date().toISOString(), ok: false, actualGL: false, cases: [], refusals: 0};
let stage = 'ordinary source graph';
try {
  assert.equal(Number(process.versions.node.split('.')[0]), 22);
  const bundle = await build({absWorkingDir: root, stdin: {resolveDir: here, sourcefile: 'scene-framing-consumer.mjs',
    contents: "import * as api from '@barocss/render-editor'; import {prepareCamera,prepareSourceSceneBounds,validateMeshCamera,SourceSceneBoundsError} from '@barocss/gpu'; export {api,prepareCamera,prepareSourceSceneBounds,validateMeshCamera,SourceSceneBoundsError};"},
    bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2022', metafile: true});
  const inputs = Object.keys(bundle.metafile.inputs);
  for (const suffix of ['barocss-render-editor/src/scene-framing.ts', 'barocss-gpu/src/source-scene-bounds.ts', 'barocss-gpu/src/camera.ts']) assert(inputs.some(path => path.endsWith(suffix)));
  assert(!inputs.some(path => /packages\/barocss-[^/]+\/dist\//.test(path) || /node_modules\/react\//.test(path)));
  receipt.sourceInputs = inputs.filter(path => /packages\/barocss-[^/]+\/src\//.test(path)).length; receipt.ownDistInputs = 0;
  receipt.sourceSha256 = {};
  for (const path of ['src/scene-framing.ts', 'src/index.ts', 'scene-framing-flow.mjs']) receipt.sourceSha256[path] = hash(await readFile(resolve(here, path)));
  await writeFile(resolve(output, 'source-metafile.json'), JSON.stringify(bundle.metafile, null, 2) + '\n');
  await writeFile(resolve(output, 'ordinary-source.mjs'), bundle.outputFiles[0].text);
  const {api, prepareCamera, prepareSourceSceneBounds, validateMeshCamera, SourceSceneBoundsError} = await import(pathToFileURL(resolve(output, 'ordinary-source.mjs')).href);
  const source = '/* Original source, comments and -0 tokens stay. */\r\n@scene framing { version: 1; background: #123; sphere #orb; box #block; cylinder #post; capsule #link; rounded-box #round; torus #ring; }\r\n'
    + '#orb { radius: .65; translate: -3 2 1; }\r\n'
    + '#block { size: 1.1 .7 1.4; translate: 2 -1 -.3; rotate-x: 12deg; rotate-y: 18deg; rotate-z: 24deg; }\r\n'
    + '#post { radius: .3; height: 1.5; translate: 0 2 -1; rotate-z: 20deg; }\r\n'
    + '#link { radius: .22; start: -1 -1.2 0; end: .7 1.8 .3; translate: -2 -1 1; rotate-y: 30deg; }\r\n'
    + '#round { radius: .2; size: 2 3 4; translate: 1 1 2; rotate-x: 20deg; rotate-z: -15deg; }\r\n'
    + '#ring { major-radius: 1.4; minor-radius: .3; translate: 4 .3 -2; rotate-x: 45deg; rotate-y: 10deg; }\r\n';
  const camera = {eye: [5, 4, 7], target: [0, 0, 0], up: [0, 1, 0], fovYDegrees: 45, near: .01, far: 100};
  const viewport = {width: 978, height: 540, backingWidth: 1956, backingHeight: 1080};
  const corners = box => Array.from({length: 8}, (_, mask) => [0, 1, 2].map(axis => (mask & (1 << axis)) ? box.max[axis] : box.min[axis]));
  const multiply = (matrix, vector) => [0, 1, 2, 3].map(row => matrix[row] * vector[0] + matrix[row + 4] * vector[1] + matrix[row + 8] * vector[2] + matrix[row + 12] * vector[3]);
  const unit = vector => {const length = Math.hypot(...vector); return vector.map(value => value / length);};
  const close = (a, b, tolerance = 1e-10) => assert(Math.abs(a - b) <= tolerance, `${a} != ${b} within ${tolerance}`);
  const verifyFit = (originalCamera, fitted, bounds, port) => {
    assert(fitted); validateMeshCamera(fitted);
    const beforeDirection = unit(originalCamera.eye.map((value, axis) => value - originalCamera.target[axis]));
    const afterDirection = unit(fitted.eye.map((value, axis) => value - fitted.target[axis]));
    beforeDirection.forEach((value, axis) => close(value, afterDirection[axis]));
    assert.deepEqual(fitted.up, originalCamera.up); assert.equal(fitted.fovYDegrees, originalCamera.fovYDegrees);
    const matrices = prepareCamera(fitted, port.backingWidth / port.backingHeight), observations = [];
    for (const point of corners(bounds)) {
      const viewed = multiply(matrices.view, [...point, 1]), clip = multiply(matrices.projection, viewed);
      assert(clip[3] > 0); const ndc = clip.slice(0, 3).map(value => value / clip[3]);
      for (const value of ndc.slice(0, 2)) assert(Math.abs(value) <= 1 / receipt.declaredFitMargin + 1e-5, `Corner escaped margin: ${value}`);
      assert(ndc[2] >= -1 - 1e-5 && ndc[2] <= 1 + 1e-5);
      const radial = Math.hypot(...point.map((value, axis) => value - fitted.eye[axis]));
      assert(radial < Math.min(100, fitted.far)); observations.push({point, ndc, radial});
    }
    return observations;
  };

  stage = 'all and six selected real bounds corners';
  const publicBounds = prepareSourceSceneBounds({sourceVersion: 1, source}), beforeInputs = JSON.stringify({source, camera, viewport});
  const all = api.deriveRenderSceneFramingCamera(source, camera, viewport);
  const cornerEvidence = [{selection: null, camera: all, corners: verifyFit(camera, all, publicBounds.bounds, viewport)}];
  for (const object of publicBounds.objects) {
    const fitted = api.deriveRenderSceneFramingCamera(source, camera, viewport, object.objectId);
    cornerEvidence.push({selection: object.objectId, camera: fitted, corners: verifyFit(camera, fitted, object.worldBounds, viewport)});
  }
  assert.equal(JSON.stringify({source, camera, viewport}), beforeInputs);
  assert.equal(publicBounds.source, source); assert.equal(publicBounds.selection, null);
  await writeFile(resolve(output, 'projected-corners.json'), JSON.stringify(cornerEvidence, null, 2) + '\n');
  receipt.cases.push('real Source1 six-kind rotated/translated bounds, all and each selected eight-corner public-matrix projection within declared1.2 margin/clip/radial bounds; unchanged input/source/FOV/up/orientation');

  stage = 'long original ID, empty and actual backing aspect';
  const longId = 'original_' + 'x'.repeat(60), longSource = source.replaceAll('#block', '#' + longId);
  const longBounds = prepareSourceSceneBounds({sourceVersion: 1, source: longSource});
  const longFit = api.deriveRenderSceneFramingCamera(longSource, camera, viewport, longId);
  verifyFit(camera, longFit, longBounds.objects.find(object => object.objectId === longId).worldBounds, viewport);
  assert.throws(() => prepareSourceSceneBounds({sourceVersion: 1, source: longSource, objectIds: [longId]}), error => error.code === 'SELECTION');
  assert.equal(api.deriveRenderSceneFramingCamera('@scene empty { version: 1; }', camera, viewport), null);
  const shortClip = {...camera, near: .0001, far: .001}, differentBacking = {...viewport, backingWidth: 1500, backingHeight: 1200};
  const clipFit = api.deriveRenderSceneFramingCamera(source, shortClip, differentBacking);
  verifyFit(shortClip, clipFit, publicBounds.bounds, differentBacking); assert(clipFit.far > shortClip.far);
  receipt.cases.push('long original selection via admitted all-object bounds without provider-selector substitution; empty all null; actual backing aspect rather than CSS aspect and legal clip extension');

  stage = 'unsafe fits, data, reflection and actual provider refusals';
  const refuse = action => {
    let error; try {action();} catch (cause) {error = cause;}
    assert(error instanceof api.RenderEditorError); receipt.refusals++; return error;
  };
  for (const bad of [null, {...viewport, width: 0}, {...viewport, height: Infinity}, {...viewport, backingWidth: 10.5}, {...viewport, backingWidth: 4097}, {...viewport, backingWidth: 4096, backingHeight: 4096}, {...viewport, extra: 1}]) refuse(() => api.deriveRenderSceneFramingCamera(source, camera, bad));
  let getters = 0, reflections = 0;
  const accessor = {...viewport}; Object.defineProperty(accessor, 'width', {enumerable: true, get() {getters++; return 978;}});
  refuse(() => api.deriveRenderSceneFramingCamera(source, camera, accessor));
  const cameraAccessor = {...camera}; Object.defineProperty(cameraAccessor, 'eye', {enumerable: true, get() {getters++; return camera.eye;}});
  refuse(() => api.deriveRenderSceneFramingCamera(source, cameraAccessor, viewport)); assert.equal(getters, 0);
  for (const trap of ['getPrototypeOf', 'ownKeys']) {
    const marker = Error('Injected reflection refusal: ' + trap), proxy = new Proxy({...viewport}, {[trap]() {reflections++; throw marker;}});
    const error = refuse(() => api.deriveRenderSceneFramingCamera(source, camera, proxy)); assert.equal(error.cause, marker);
  }
  for (const badCamera of [{...camera, eye: [...camera.target]}, {...camera, near: .00001}, {...camera, far: 10001}]) {
    const error = refuse(() => api.deriveRenderSceneFramingCamera(source, badCamera, viewport)); assert(error.cause instanceof Error);
  }
  refuse(() => api.deriveRenderSceneFramingCamera(source, camera, viewport, 'missing'));
  refuse(() => api.deriveRenderSceneFramingCamera(source, camera, viewport, ''));
  refuse(() => api.deriveRenderSceneFramingCamera('@scene radial { version: 1; box #one; } #one { size: 70 70 70; }', camera, viewport));
  refuse(() => api.deriveRenderSceneFramingCamera('@scene eye { version: 1; sphere #one; } #one { translate: 1000 0 0; }', {...camera, eye: [7, 0, 0]}, viewport));
  refuse(() => api.deriveRenderSceneFramingCamera('@scene target { version: 1; capsule #one; } #one { translate: 1000 0 0; start: 999 0 0; end: 1000 0 0; }', camera, viewport));
  for (const invalid of ['@scene incomplete { version: 1; sphere #one;', '@scene future { version: 2; sphere #one; }', '@scene size { version: 1; sphere #one; } #one { radius: -1; }']) {
    const error = refuse(() => api.deriveRenderSceneFramingCamera(invalid, camera, viewport));
    assert(error.cause instanceof SourceSceneBoundsError); assert.equal(error.cause.code, 'SOURCE');
  }
  receipt.getterCalls = getters; receipt.reflectionTraps = reflections;
  assert.equal(JSON.stringify({source, camera, viewport}), beforeInputs);
  receipt.cases.push('bounded malformed viewport/camera, descriptor getters0, reflection cause retention, unknown/emptyID, radial100/eye1000/target1000 unsafe fits, actual Source malformed/Source2/shape provider causes without input mutation');

  const clip = {format: 'barocss-render-editor-translation-clip', version: 0, id: 'original_clip', timeUnit: 'seconds', interpolation: 'linear', tracks: [{objectId: 'block', keys: [{timeSeconds: 0, translation: [2, -1, -.3]}, {timeSeconds: 1, translation: [2.5, -.5, 0]}]}]};
  const document = {format: 'barocss-render-editor', version: 0, kind: 'gpu-scene', documentId: 'framing', title: 'Original framing document', revision: 0, sourceVersion: 1, sceneSource: source, camera};
  const ok = result => assert(result.ok, result.error?.message), notOk = result => {assert(!result.ok); return result.error;};
  function harness(input = document) {
    const session = api.createRenderEditorSession(input), model = {shown: null, calls: [], failure: null, hook: null, disposed: 0};
    const presenter = {present(candidate, previous) {
      assert.deepEqual(previous, model.shown, 'Rollback must name the actual displayed document and camera.'); model.calls.push(candidate);
      assert.equal(candidate.mode, 'camera'); assert.equal(candidate.document.sceneSource, previous.sceneSource);
      if (model.failure) {const failure = model.failure; model.failure = null; if (!failure.recovered) model.shown = null; return {ok: false, ...failure};}
      model.shown = candidate.document; const hook = model.hook; model.hook = null; hook?.(); return {ok: true};
    }, recover(accepted) {model.shown = accepted; return {ok: true};}, dispose() {model.shown = null; model.disposed++;}};
    const controller = api.createRenderEditorController(session, presenter);
    return {session, controller, model, close() {controller.dispose(); controller.dispose(); session.dispose(); assert.equal(model.disposed, 1);}};
  }

  stage = 'local-only V0/V1 framing and exact original Node files';
  for (const version of [0, 1]) {
    const input = version === 0 ? document : {...document, version: 1, animation: clip}, h = harness(input);
    h.session.setActiveObject('block'); const accepted = h.session.getSnapshot().accepted, originalBytes = api.serializeRenderEditorDocument(accepted);
    h.session.setDraftSource('/* incomplete raw source draft */'); h.session.setDraftObjectSource(null);
    if (version === 1) h.session.setAnimationInputInvalid(true);
    h.session.setDraftCamera({...camera, eye: [6, 3, 8]}); const raw = h.session.getSnapshot();
    for (const id of [undefined, 'block']) {
      const fitted = api.deriveRenderSceneFramingCamera(raw.accepted.sceneSource, h.controller.getSnapshot().viewportCamera ?? raw.accepted.camera, viewport, id);
      ok(h.controller.navigateViewportCamera(fitted)); assert.equal(h.session.getSnapshot(), raw);
      assert.equal(h.controller.getSnapshot().cameraPreview, null); assert.equal(h.controller.getSnapshot().presentedRevision, 0);
      assert.equal(h.model.shown.sceneSource, source); assert.equal(h.model.calls.at(-1).mode, 'camera');
      assert.equal(api.serializeRenderEditorDocument(h.session.getSnapshot().accepted), originalBytes);
    }
    assert(!raw.canUndo && !raw.canRedo); assert(raw.objectInputInvalid && raw.cameraDirty);
    if (version === 1) assert(raw.animationInputInvalid && raw.draftAnimation === accepted.animation);
    const path = resolve(output, `framed-v${version}.render-scene.json`); await writeFile(path, api.serializeRenderEditorDocument(accepted));
    assert.equal(await readFile(path, 'utf8'), originalBytes);
    const reopened = api.parseRenderEditorDocument(await readFile(path, 'utf8')); assert.deepEqual(reopened, accepted);
    const fresh = api.createRenderEditorSession(reopened); assert(!fresh.getSnapshot().canUndo && !fresh.getSnapshot().canRedo); fresh.dispose();
    h.close();
  }
  receipt.cases.push('real local Frame all/selected with raw source/object/key/camera drafts retained; V0/V1 accepted/source/camera/clip/revision/history exact; actual accepted-only Node bytes/fresh parse/session, no saved viewport state');

  stage = 'retained and lost presentation protocol';
  let h = harness(); const base = h.session.getSnapshot(), selected = api.deriveRenderSceneFramingCamera(source, camera, viewport, 'block');
  ok(h.controller.navigateViewportCamera(all)); const goodView = h.controller.getSnapshot().viewportCamera, goodFrame = h.model.shown;
  const retained = Error('Injected retained frame refusal'); h.model.failure = {error: retained, recovered: true};
  assert.equal(notOk(h.controller.navigateViewportCamera(selected)).cause, retained);
  assert.equal(h.controller.getSnapshot().viewportCamera, goodView); assert.equal(h.model.shown, goodFrame); assert.equal(h.session.getSnapshot(), base);
  const lost = Error('Injected actual protocol frame loss'); h.model.failure = {error: lost, recovered: false};
  assert.equal(notOk(h.controller.navigateViewportCamera(selected)).cause, lost);
  assert.equal(h.controller.getSnapshot().viewportCamera, null); assert.equal(h.controller.getSnapshot().presentedRevision, null); assert.equal(h.model.shown, null);
  notOk(h.controller.navigateViewportCamera(all)); ok(h.controller.recover()); assert.deepEqual(h.model.shown.camera, camera); assert.equal(h.session.getSnapshot(), base); h.close();
  receipt.cases.push('honest injected presenter retained failure keeps exact old frame/localcamera/raw authority; unrecovered loss clears availability/localview, prevents navigation and restores original authored camera on recover');

  stage = 'stale, reentry and observer epoch fences';
  h = harness(); const accepted = h.session.getSnapshot().accepted;
  h.model.hook = () => {assert.equal(notOk(h.controller.navigateViewportCamera(selected)).code, 'STALE_CANDIDATE'); notOk(h.controller.resetViewportCamera());};
  ok(h.controller.navigateViewportCamera(all)); assert.equal(h.session.getSnapshot().accepted, accepted);
  h.model.hook = () => h.session.setActiveObject('orb');
  assert.equal(notOk(h.controller.navigateViewportCamera(selected)).code, 'STALE_CANDIDATE');
  assert.deepEqual(h.model.shown.camera, selected); assert.deepEqual(h.controller.getSnapshot().viewportCamera, selected);
  h.model.hook = () => {h.model.shown = null; h.controller.presentationUnavailable(Error('Synchronous frame loss'));};
  notOk(h.controller.navigateViewportCamera(all)); assert.equal(h.controller.getSnapshot().viewportCamera, null); ok(h.controller.recover());
  let lose = true; const stop = h.controller.subscribe(() => {if (lose && h.controller.getSnapshot().viewportCamera) {lose = false; h.model.shown = null; h.controller.presentationUnavailable(Error('Observer frame loss'));}});
  notOk(h.controller.navigateViewportCamera(all)); assert.equal(h.controller.getSnapshot().viewportCamera, null); assert.equal(h.controller.getSnapshot().presentedRevision, null); stop();
  assert.equal(h.session.getSnapshot().accepted, accepted); ok(h.controller.recover()); h.close();
  receipt.cases.push('real controller denies presentation reentry; changed raw/selection returns stale while reporting actual last displayed pose; synchronous/observer loss never resurrects viewport state or changes authored document');
  receipt.ok = true;
} catch (error) {
  receipt.firstFailure = {stage, message: error.message ?? String(error), stack: error.stack ?? String(error)}; process.exitCode = 1;
  await writeFile(resolve(output, 'first-failure.json'), JSON.stringify(receipt.firstFailure, null, 2) + '\n');
}
receipt.finishedAt = new Date().toISOString();
await writeFile(resolve(output, 'scene-framing-flow.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
