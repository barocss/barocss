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
const receipt = {issue: 1242, head: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(), node: process.version,
  scope: 'Ordinary source CPU projection/pose/ray/source-writer/controller qualification. Injected presenter is a declared protocol model, not WebGL or browser evidence.',
  startedAt: new Date().toISOString(), ok: false, cases: []};
let stage = 'ordinary source graph';
try {
  assert.equal(Number(process.versions.node.split('.')[0]), 22);
  const compiled = await build({absWorkingDir: root, stdin: {resolveDir: here, sourcefile: 'gizmo-source-consumer.mjs',
    contents: "import * as api from '@barocss/render-editor'; import {prepareCamera,prepareEngineCameraRay} from '@barocss/gpu'; export {api,prepareCamera,prepareEngineCameraRay};"},
    bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2022', metafile: true});
  const inputs = Object.keys(compiled.metafile.inputs);
  assert(inputs.some(path => path.endsWith('barocss-render-editor/src/scene-gizmo-projection.ts')));
  assert(!inputs.some(path => /packages\/barocss-[^/]+\/dist\//.test(path) || /node_modules\/react\//.test(path)));
  receipt.sourceInputs = inputs.filter(path => /packages\/barocss-[^/]+\/src\//.test(path)).length; receipt.ownDistInputs = 0;
  await writeFile(resolve(output, 'source-metafile.json'), JSON.stringify(compiled.metafile, null, 2) + '\n');
  const {api, prepareCamera, prepareEngineCameraRay} = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'));
  const source = '/* Original scene bytes and unselected IDs stay. */\r\n@scene gizmo_scene { version: 1; background: #123; sphere #orb; box #block; cylinder #post; }\r\n'
    + '#orb { radius: .65; translate: -1.5 0 0; color: #e08040; }\r\n'
    + '#block { size: 1.1 .7 1.4; translate: .15 -.12 .1; rotate-x: 12deg; rotate-y: 18deg; rotate-z: 24deg; color: #69c; }\r\n'
    + '#post { radius: .3; height: 1.5; translate: 1.6 .7 -0; }\r\n';
  const camera = {eye: [5, 4, 7], target: [0, 0, 0], up: [0, 1, 0], fovYDegrees: 45, near: .01, far: 100};
  const viewport = {width: 900, height: 600, backingWidth: 1024, backingHeight: 768};
  const properties = api.inspectRenderSceneObjects(source), selected = properties.find(object => object.objectId === 'block');
  const {view, projection} = prepareCamera(camera, viewport.backingWidth / viewport.backingHeight);
  const close = (a, b, tolerance = 1e-9) => assert(Math.abs(a - b) <= tolerance, `${a} != ${b} within ${tolerance}`);
  const forward = (point) => {
    const world = [...point, 1], viewed = [], clip = [];
    for (let row = 0; row < 4; row++) viewed.push(view[row] * world[0] + view[row + 4] * world[1] + view[row + 8] * world[2] + view[row + 12]);
    for (let row = 0; row < 4; row++) clip.push(projection[row] * viewed[0] + projection[row + 4] * viewed[1] + projection[row + 8] * viewed[2] + projection[row + 12] * viewed[3]);
    return [(1 + clip[0] / clip[3]) * viewport.width / 2, (1 - clip[1] / clip[3]) * viewport.height / 2];
  };
  const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit = values => {const length = Math.hypot(...values); return values.map(value => value / length);};
  const axes = ['x', 'y', 'z'];
  const worldPoint = (axis, distance) => selected.translate.map((value, index) => value + (index === axis ? distance : 0));

  stage = 'independent public projection and translate inverse';
  const move = api.prepareRenderSceneGizmo(source, 'block', camera, viewport, 'translate');
  assert.deepEqual(move.handles.map(handle => handle.key), axes); assert.equal(move.unavailable, null);
  forward(selected.translate).forEach((value, index) => close(move.pivot[index], value));
  for (const [index, axis] of axes.entries()) {
    const from = forward(worldPoint(index, .15)), to = forward(worldPoint(index, .52));
    const patch = api.deriveRenderSceneGizmoPatch(source, 'block', camera, viewport, 'translate', axis, from, to);
    patch.translate.forEach((value, component) => close(value, selected.translate[component] + (component === index ? .37 : 0), 1e-10));
    const edited = api.editRenderSceneObjectSource(source, 'block', patch);
    assert.deepEqual(api.inspectRenderSceneObjects(edited).filter(object => object.objectId !== 'block'), properties.filter(object => object.objectId !== 'block'));
    const zero = api.deriveRenderSceneGizmoPatch(source, 'block', camera, viewport, 'translate', axis, from, from);
    assert.equal(api.editRenderSceneObjectSource(source, 'block', zero), source);
  }
  assert(Object.isFrozen(move) && Object.isFrozen(move.pivot) && Object.isFrozen(move.handles));
  for (const handle of move.handles) {assert(Object.isFrozen(handle)); assert(Object.isFrozen(handle.points)); assert(Object.isFrozen(handle.anchor));}
  receipt.cases.push('three world axes: independent public-matrix forward and rational inverse, exact no motion, copied immutable CSS geometry');

  stage = 'independent Euler axes and actual pixel-center ring planes';
  const rotation = api.prepareRenderSceneGizmo(source, 'block', camera, viewport, 'rotate');
  assert.deepEqual(rotation.handles.map(handle => handle.key), axes);
  const radians = selected.rotateDegrees.map(value => value * Math.PI / 180), cy = Math.cos(radians[1]), sy = Math.sin(radians[1]), cz = Math.cos(radians[2]), sz = Math.sin(radians[2]);
  const normals = [[cz * cy, sz * cy, -sy], [-sz, cz, 0], [0, 0, 1]];
  const rayVector = (point, normal) => {
    const ray = prepareEngineCameraRay(camera, {format: 'barocss-gpu-engine-camera-ray-request', version: 0, pixelOrigin: 'bottom-left', sampling: 'pixel-center',
      viewportWidth: viewport.backingWidth, viewportHeight: viewport.backingHeight,
      pixelX: Math.floor(point[0] * viewport.backingWidth / viewport.width), pixelY: viewport.backingHeight - 1 - Math.floor(point[1] * viewport.backingHeight / viewport.height)}).ray;
    const t = dot(selected.translate.map((value, index) => value - ray.origin[index]), normal) / dot(ray.direction, normal);
    assert(t >= ray.near && t <= ray.far);
    return unit(ray.origin.map((value, index) => value + ray.direction[index] * t - selected.translate[index]));
  };
  for (const [index, axis] of axes.entries()) {
    const normal = normals[index], reference = Math.abs(normal[2]) < .8 ? [0, 0, 1] : [0, 1, 0];
    const a = unit(cross(reference, normal)), b = unit(cross(normal, a)), angle = 25 * Math.PI / 180;
    const from = forward(selected.translate.map((value, component) => value + a[component] * .6));
    const to = forward(selected.translate.map((value, component) => value + .6 * (a[component] * Math.cos(angle) + b[component] * Math.sin(angle))));
    const first = rayVector(from, normal), last = rayVector(to, normal);
    const expected = Math.atan2(dot(normal, cross(first, last)), dot(first, last)) * 180 / Math.PI;
    // The admitted sample is an actual backing-pixel centre, not the continuous
    // projected CSS point. Its independent plane angle is the exact oracle.
    assert(Number.isFinite(expected) && expected > 0 && expected < 45);
    const patch = api.deriveRenderSceneGizmoPatch(source, 'block', camera, viewport, 'rotate', axis, from, to);
    patch.rotateDegrees.forEach((value, component) => close(value, selected.rotateDegrees[component] + (component === index ? expected : 0), 1e-10));
    const zero = api.deriveRenderSceneGizmoPatch(source, 'block', camera, viewport, 'rotate', axis, from, from);
    assert.equal(api.editRenderSceneObjectSource(source, 'block', zero), source);
  }
  receipt.cases.push('three effective Euler rings: RzRyX/RzY/worldZ independent axes plus public backing-pixel rays and signed plane angle');

  stage = 'uniform scale on all primitive dimensions';
  const scale = api.prepareRenderSceneGizmo(source, 'block', camera, viewport, 'scale');
  assert.equal(scale.handles.length, 1); assert.equal(scale.handles[0].key, 'uniform');
  const from = [scale.pivot[0] + 50, scale.pivot[1] - 50], to = [scale.pivot[0] + 62.5, scale.pivot[1] - 62.5];
  const scaled = api.deriveRenderSceneGizmoPatch(source, 'block', camera, viewport, 'scale', 'uniform', from, to);
  selected.size.forEach((value, index) => close(scaled.size[index], value * 1.25)); assert.equal(scaled.translate, undefined);
  const kinds = ['sphere', 'box', 'cylinder', 'capsule', 'rounded-box', 'torus'];
  for (const kind of kinds) {
    const text = api.addRenderSceneObjectSource('@scene one { version: 1; }', kind, 'one'), object = api.inspectRenderSceneObjects(text)[0];
    const prep = api.prepareRenderSceneGizmo(text, 'one', camera, viewport, 'scale');
    const start = [prep.pivot[0] + 40, prep.pivot[1] - 40], end = [prep.pivot[0] + 60, prep.pivot[1] - 60];
    const patch = api.deriveRenderSceneGizmoPatch(text, 'one', camera, viewport, 'scale', 'uniform', start, end);
    for (const [key, value] of Object.entries(patch)) {
      if (Array.isArray(value)) value.forEach((number, index) => close(number, object[key][index] * 1.5)); else close(value, object[key] * 1.5);
    }
    const updated = api.inspectRenderSceneObjects(api.editRenderSceneObjectSource(text, 'one', patch))[0];
    assert.deepEqual(updated.translate, object.translate); assert.deepEqual(updated.rotateDegrees, object.rotateDegrees); assert.equal(updated.color, object.color);
    const zero = api.deriveRenderSceneGizmoPatch(text, 'one', camera, viewport, 'scale', 'uniform', start, start);
    assert.equal(api.editRenderSceneObjectSource(text, 'one', zero), text);
  }
  receipt.cases.push('uniform primitive-only scale for all six kinds including local capsule endpoints; source-origin position/rotation/color invariant');

  stage = 'projection/shape/data/viewport refusals';
  let getterCalls = 0, refusals = 0;
  const badViewport = {...viewport}; Object.defineProperty(badViewport, 'width', {enumerable: true, get() {getterCalls++; return 900;}});
  const badPoint = [1, 2]; Object.defineProperty(badPoint, '0', {enumerable: true, get() {getterCalls++; return 1;}});
  for (const action of [
    () => api.prepareRenderSceneGizmo(source, 'block', camera, badViewport, 'translate'),
    () => api.prepareRenderSceneGizmo(source, 'foreign', camera, viewport, 'translate'),
    () => api.prepareRenderSceneGizmo(source, 'block', camera, {...viewport, extra: 1}, 'translate'),
    () => api.prepareRenderSceneGizmo(source, 'block', camera, {...viewport, backingWidth: 4097}, 'translate'),
    () => api.deriveRenderSceneGizmoPatch(source, 'block', camera, viewport, 'translate', 'x', badPoint, [10, 10]),
    () => api.deriveRenderSceneGizmoPatch(source, 'block', camera, viewport, 'scale', 'uniform', scale.pivot, [10, 10]),
    () => api.deriveRenderSceneGizmoPatch(source, 'block', camera, viewport, 'scale', 'uniform', from, scale.pivot),
    () => api.deriveRenderSceneGizmoPatch(source, 'block', camera, viewport, 'scale', 'uniform', from, [scale.pivot[0] + 1e8, scale.pivot[1]]),
  ]) {assert.throws(action); refusals++;}
  assert.equal(getterCalls, 0);
  const large = {...viewport, backingWidth: 3000, backingHeight: 1000};
  assert(api.prepareRenderSceneGizmo(source, 'block', camera, large, 'rotate').unavailable.includes('2048'));
  assert(api.prepareRenderSceneGizmo(source, 'block', camera, large, 'translate').handles.length > 0);
  const centered = api.editRenderSceneObjectSource(source, 'block', {translate: [0, 0, 0]});
  const frontCamera = {...camera, eye: [0, 0, 7]};
  const endOn = api.prepareRenderSceneGizmo(centered, 'block', frontCamera, viewport, 'translate'); assert(!endOn.handles.some(handle => handle.key === 'z'));
  assert.throws(() => api.deriveRenderSceneGizmoPatch(centered, 'block', frontCamera, viewport, 'translate', 'z', [450, 300], [450, 290])); refusals++;
  const horizonSource = api.editRenderSceneObjectSource(source, 'block', {translate: camera.eye});
  assert.throws(() => api.prepareRenderSceneGizmo(horizonSource, 'block', camera, viewport, 'translate')); refusals++;
  const countSource = '@scene count { version: 1; ' + Array.from({length: 32}, (_, index) => `sphere #s${index};`).join(' ') + ' }';
  assert(api.prepareRenderSceneGizmo(countSource, 's0', camera, viewport, 'translate').handles.length > 0);
  const tooMany = countSource.replace(' }', ' sphere #extra; }');
  assert.throws(() => api.prepareRenderSceneGizmo(tooMany, 's0', camera, viewport, 'translate')); refusals++;
  receipt.refusals = refusals; receipt.getterCalls = getterCalls;
  receipt.cases.push('getter0/data/count budgets, end-on and horizon refusal, actual2048 ray limit without changing4096 source projection policy, positive scale/dimension limits');

  stage = 'honest controller transform protocol';
  const document = {format: 'barocss-render-editor', version: 0, kind: 'gpu-scene', documentId: 'gizmo_scene', title: 'Gizmo scene', revision: 0, sourceVersion: 1, sceneSource: source, camera};
  const updatedSource = api.editRenderSceneObjectSource(source, 'block', {translate: [.4, -.12, .1]});
  function harness() {
    const session = api.createRenderEditorSession(document); session.setActiveObject('block');
    const model = {shown: null, calls: [], failure: null, hook: null, disposed: 0};
    const presenter = {
      present(candidate, previous) {
        model.calls.push({mode: candidate.mode, document: candidate.document}); assert.deepEqual(previous, model.shown);
        if (model.failure) {const failure = model.failure; model.failure = null; if (!failure.recovered) model.shown = null; return {ok: false, ...failure};}
        model.shown = candidate.mode === 'source' ? {...candidate.document, camera: model.shown.camera} : candidate.document;
        const hook = model.hook; model.hook = null; hook?.(); return {ok: true};
      },
      recover(accepted) {model.shown = accepted; return {ok: true};}, dispose() {model.disposed++; model.shown = null;},
    };
    const controller = api.createRenderEditorController(session, presenter);
    return {session, controller, model, close() {controller.dispose(); controller.dispose(); session.dispose(); assert.equal(model.disposed, 1);}};
  }
  const ok = result => assert(result.ok, result.error?.message);
  const h = harness(), baseline = h.session.getSnapshot(), bytes = api.serializeRenderEditorDocument(baseline.accepted);
  ok(h.controller.previewObjectSource('block', updatedSource)); assert.equal(h.session.getSnapshot(), baseline); assert.equal(h.model.calls.at(-1).mode, 'source');
  assert.equal(h.controller.getSnapshot().transformPreview.source, updatedSource); assert.equal(api.serializeRenderEditorDocument(h.session.getSnapshot().accepted), bytes);
  for (const action of [() => h.controller.apply(), () => h.controller.open(bytes), () => h.controller.undo(), () => h.controller.redo(),
    () => h.controller.previewCamera(camera), () => h.controller.cancelCameraPreview(), () => h.controller.applyCameraPreview()]) assert(!action().ok);
  ok(h.controller.cancelObjectPreview()); assert.equal(h.session.getSnapshot(), baseline); assert.equal(h.model.shown.sceneSource, source);
  const calls = h.model.calls.length; ok(h.controller.previewObjectSource('block', source)); ok(h.controller.applyObjectPreview()); assert.equal(h.model.calls.length, calls); assert.equal(h.session.getSnapshot().accepted.revision, 0);
  ok(h.controller.previewObjectSource('block', updatedSource)); ok(h.controller.previewObjectSource('block', source)); assert.equal(h.controller.getSnapshot().transformPreview, null);
  ok(h.controller.previewObjectSource('block', updatedSource)); ok(h.controller.applyObjectPreview()); assert.equal(h.session.getSnapshot().accepted.revision, 1);
  assert.equal(h.session.getSnapshot().accepted.sceneSource, updatedSource); assert.deepEqual(h.session.getSnapshot().accepted.camera, camera);
  ok(h.controller.undo()); assert.equal(h.session.getSnapshot().accepted.sceneSource, source); assert.equal(h.session.getSnapshot().accepted.revision, 2);
  ok(h.controller.redo()); assert.equal(h.session.getSnapshot().accepted.sceneSource, updatedSource); assert.equal(h.session.getSnapshot().accepted.revision, 3); h.close();

  const guards = harness(); guards.session.setDraftObjectSource(null); assert(!guards.controller.previewObjectSource('block', updatedSource).ok); guards.session.discardDraft();
  guards.session.setDraftCamera({...camera, near: -1}); assert(!guards.controller.previewObjectSource('block', updatedSource).ok); guards.session.discardDraft();
  ok(guards.controller.previewCamera(camera)); assert(!guards.controller.previewObjectSource('block', updatedSource).ok); ok(guards.controller.cancelCameraPreview());
  assert(!guards.controller.previewObjectSource('orb', updatedSource).ok);
  for (const proposed of [api.editRenderSceneObjectSource(source, 'orb', {radius: .8}), api.editRenderSceneObjectSource(source, 'block', {color: '#fff'}), source.replace('@scene gizmo_scene', '@scene renamed')]) assert(!guards.controller.previewObjectSource('block', proposed).ok);
  guards.close();
  receipt.cases.push('live source-only accepted-selected preview with no CPU/history/file changes; no-op restore; actual Use protocol single entry; Undo/Redo; raw/camera/selection and semantic qualification guards');

  stage = 'retained/lost/stale/observer/reentrant fences';
  const f = harness(); f.model.failure = {error: Error('first retained'), recovered: true}; assert(!f.controller.previewObjectSource('block', updatedSource).ok); assert.equal(f.controller.getSnapshot().transformPreview, null);
  ok(f.controller.previewObjectSource('block', updatedSource)); const good = f.controller.getSnapshot().transformPreview;
  f.model.failure = {error: Error('late retained'), recovered: true}; assert(!f.controller.previewObjectSource('block', api.editRenderSceneObjectSource(source, 'block', {size: [1.2, .8, 1.5]})).ok); assert.equal(f.controller.getSnapshot().transformPreview, good);
  f.model.failure = {error: Error('cancel retained'), recovered: true}; assert(!f.controller.cancelObjectPreview().ok); assert.equal(f.controller.getSnapshot().transformPreview, good); ok(f.controller.cancelObjectPreview());
  ok(f.controller.previewObjectSource('block', updatedSource)); f.model.failure = {error: Error('lost'), recovered: false}; assert(!f.controller.cancelObjectPreview().ok); assert.equal(f.controller.getSnapshot().transformPreview, null); assert.equal(f.controller.getSnapshot().presentedRevision, null); ok(f.controller.recover());
  ok(f.controller.previewObjectSource('block', updatedSource)); f.session.setActiveObject('orb'); assert(!f.controller.applyObjectPreview().ok); ok(f.controller.cancelObjectPreview()); f.session.setActiveObject('block');
  let reentry = 0; const stop = f.controller.subscribe(() => {if (f.controller.getSnapshot().transformPreview) {assert(!f.controller.recover().ok); assert(!f.controller.cancelObjectPreview().ok); reentry++;}});
  ok(f.controller.previewObjectSource('block', updatedSource)); assert(reentry > 0); stop(); ok(f.controller.cancelObjectPreview());
  f.model.hook = () => {f.model.shown = null; f.controller.presentationUnavailable(Error('synchronous loss'));};
  assert(!f.controller.previewObjectSource('block', updatedSource).ok); assert.equal(f.controller.getSnapshot().transformPreview, null); assert.equal(f.controller.getSnapshot().presentedRevision, null); ok(f.controller.recover());
  ok(f.controller.previewObjectSource('block', updatedSource)); let stageChanged = false;
  const stopStage = f.session.subscribe(() => {if (!stageChanged && !f.controller.getSnapshot().transformPreview) {stageChanged = true; f.session.setDraftCamera({...camera, near: -1});}});
  assert(!f.controller.applyObjectPreview().ok); assert.equal(f.session.getSnapshot().accepted.revision, 0); assert.equal(f.session.getSnapshot().draftSource, updatedSource); assert.equal(f.session.getSnapshot().draftCamera.near, -1);
  stopStage(); f.close(); receipt.cases.push('last-good identity and failed cancel pending, lost/stale/reentrant/synchronous epoch fencing, observer-staged unrelated camera refusal retaining corrective source');

  stage = 'source/camera serialization and static UI transport seam';
  const final = {...document, sceneSource: updatedSource, revision: 1};
  const serialized = api.serializeRenderEditorDocument(final), cold = api.parseRenderEditorDocument(serialized);
  assert.equal(cold.sceneSource, updatedSource); assert.deepEqual(cold.camera, camera); assert(!Object.hasOwn(JSON.parse(serialized), 'transformPreview'));
  await writeFile(resolve(output, 'qualified-gizmo.render-scene.json'), serialized);
  const ui = await readFile(resolve(here, 'src/scene-gizmo.tsx'), 'utf8');
  for (const name of ['prepareRenderSceneGizmo', 'deriveRenderSceneGizmoPatch', 'editRenderSceneObjectSource', 'previewObjectSource', 'applyObjectPreview', 'cancelObjectPreview', 'setPointerCapture', 'requestAnimationFrame', 'pointercancel']) {
    assert(ui.includes(name), `Static gizmo seam missing ${name}`);
  }
  receipt.transport = 'Static DOM transport seam only; no synthetic browser events or pixels.';
  receipt.ok = true;
} catch (error) {
  receipt.firstFailure = {stage, message: error.message ?? String(error), stack: error.stack ?? String(error)};
  process.exitCode = 1;
  await writeFile(resolve(output, 'first-failure.json'), JSON.stringify(receipt.firstFailure, null, 2) + '\n');
}
receipt.finishedAt = new Date().toISOString();
await writeFile(resolve(output, 'scene-gizmo-flow.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
