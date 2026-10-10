import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..');
assert(process.argv.length === 4 && process.argv[2] === '--output', 'Use --output <new-evidence-directory>.');
const output = resolve(process.argv[3]);
await mkdir(dirname(output), {recursive: true}); await mkdir(output);
const receipt = {issue: 1306, inheritedIssues: [1242, 1276, 1290], head: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(), node: process.version,
  scope: 'Ordinary source CPU projection/pose/source-writer/controller qualification. Injected presenter is a declared protocol model, not WebGL or browser evidence.',
  startedAt: new Date().toISOString(), ok: false, cases: []};
let stage = 'ordinary source graph';
try {
  assert.equal(Number(process.versions.node.split('.')[0]), 22);
  const compiled = await build({absWorkingDir: root, stdin: {resolveDir: here, sourcefile: 'gizmo-source-consumer.mjs',
    contents: "import * as api from '@barocss/render-editor'; import {prepareCamera,prepareEngineScene} from '@barocss/gpu'; export {api,prepareCamera,prepareEngineScene};"},
    bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2022', metafile: true});
  const inputs = Object.keys(compiled.metafile.inputs);
  assert(inputs.some(path => path.endsWith('barocss-render-editor/src/scene-gizmo-projection.ts')));
  assert(!inputs.some(path => /packages\/barocss-[^/]+\/dist\//.test(path) || /node_modules\/react\//.test(path)));
  receipt.sourceInputs = inputs.filter(path => /packages\/barocss-[^/]+\/src\//.test(path)).length; receipt.ownDistInputs = 0;
  await writeFile(resolve(output, 'source-metafile.json'), JSON.stringify(compiled.metafile, null, 2) + '\n');
  await writeFile(resolve(output, 'ordinary-source.mjs'), compiled.outputFiles[0].text);
  const {api, prepareCamera, prepareEngineScene} = await import(pathToFileURL(resolve(output, 'ordinary-source.mjs')).href);
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

  stage = 'independent Euler axes and grabbed projected tangents';
  const rotation = api.prepareRenderSceneGizmo(source, 'block', camera, viewport, 'rotate');
  assert.deepEqual(rotation.handles.map(handle => handle.key), axes);
  const radians = selected.rotateDegrees.map(value => value * Math.PI / 180), cy = Math.cos(radians[1]), sy = Math.sin(radians[1]), cz = Math.cos(radians[2]), sz = Math.sin(radians[2]);
  const normals = [[cz * cy, sz * cy, -sy], [-sz, cz, 0], [0, 0, 1]];
  const bases = [{a: [-sz, cz, 0], b: [cz * sy, sz * sy, cy]}, {a: [0, 0, 1], b: [cz, sz, 0]}, {a: [1, 0, 0], b: [0, 1, 0]}];
  const viewDepth = -(view[2] * selected.translate[0] + view[6] * selected.translate[1] + view[10] * selected.translate[2] + view[14]);
  const widgetLength = 160 * viewDepth / (projection[5] * viewport.height);
  for (const [index, axis] of axes.entries()) {
    const basis = bases[index], phase = 8 * Math.PI / 32, h = 1e-5;
    const pointAt = angle => forward(selected.translate.map((value, component) => value + widgetLength * (basis.a[component] * Math.cos(angle) + basis.b[component] * Math.sin(angle))));
    const first = pointAt(phase - h), last = pointAt(phase + h), direction = unit([last[0] - first[0], last[1] - first[1]]);
    const from = rotation.handles[index].points[8], to = [from[0] + direction[0] * 20, from[1] + direction[1] * 20];
    pointAt(phase).forEach((value, component) => close(value, from[component], 1e-10));
    const expected = 20 / 80 * 180 / Math.PI;
    const patch = api.deriveRenderSceneGizmoPatch(source, 'block', camera, viewport, 'rotate', axis, from, to);
    patch.rotateDegrees.forEach((value, component) => close(value, selected.rotateDegrees[component] + (component === index ? expected : 0), 1e-7));
    const zero = api.deriveRenderSceneGizmoPatch(source, 'block', camera, viewport, 'rotate', axis, from, from);
    assert.equal(api.editRenderSceneObjectSource(source, 'block', zero), source);
  }
  receipt.cases.push('three Euler-gimbal rings: RzRyX/RzY/worldZ axes, independent public-camera finite-difference grabbed tangents, fixed80 CSS pixels per radian, exact no motion');

  stage = 'uniform scale on all primitive dimensions';
  const scale = api.prepareRenderSceneGizmo(source, 'block', camera, viewport, 'scale');
  assert.deepEqual(scale.handles.map(handle => handle.key), [...axes, 'uniform']);
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

  stage = 'independent full local pose and XYZ size inverse';
  const radiansXYZ = selected.rotateDegrees.map(value => value * Math.PI / 180);
  const rotateXYZ = vector => {
    const [x, y, z] = radiansXYZ, a = [vector[0], Math.cos(x) * vector[1] - Math.sin(x) * vector[2], Math.sin(x) * vector[1] + Math.cos(x) * vector[2]];
    const b = [Math.cos(y) * a[0] + Math.sin(y) * a[2], a[1], -Math.sin(y) * a[0] + Math.cos(y) * a[2]];
    return [Math.cos(z) * b[0] - Math.sin(z) * b[1], Math.sin(z) * b[0] + Math.cos(z) * b[1], b[2]];
  };
  const localAxes = axes.map((_, axis) => rotateXYZ(axes.map((_, index) => index === axis ? 1 : 0)));
  const quaternion = (axis, angle) => {const value = [0, 0, 0, Math.cos(angle / 2)]; value[axis] = Math.sin(angle / 2); return value;};
  const poseRig = prepareEngineScene({format: 'barocss-gpu-engine-scene', version: 0, id: 'oracle_pose', coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', background: [0, 0, 0], camera, geometries: [], materials: [], nodes: [
    {id: 'z', type: 'group', parentId: null, translation: [...selected.translate], rotationXYZW: quaternion(2, radiansXYZ[2]), scale: [1, 1, 1], visible: true},
    {id: 'y', type: 'group', parentId: 'z', translation: [0, 0, 0], rotationXYZW: quaternion(1, radiansXYZ[1]), scale: [1, 1, 1], visible: true},
    {id: 'x', type: 'group', parentId: 'y', translation: [0, 0, 0], rotationXYZW: quaternion(0, radiansXYZ[0]), scale: [1, 1, 1], visible: true},
  ]});
  for (const [axis, direction] of localAxes.entries()) direction.forEach((value, row) => close(value, poseRig.nodes[2].worldMatrix[axis * 4 + row], 1e-12));
  // Local Y and Z differ from Euler-rotation derivative Y/world-Z at this asymmetric pose.
  assert(Math.hypot(...localAxes[1].map((value, index) => value - normals[1][index])) > .1);
  assert(Math.hypot(...localAxes[2].map((value, index) => value - normals[2][index])) > .1);
  const sceneLength = origin => {
    const depth = -(view[2] * origin[0] + view[6] * origin[1] + view[10] * origin[2] + view[14]);
    return 160 * depth / (projection[5] * viewport.height);
  };
  const length = sceneLength(selected.translate);
  for (const [index, axis] of axes.entries()) {
    const direction = localAxes[index], pointAt = t => forward(selected.translate.map((value, component) => value + direction[component] * t));
    const handle = scale.handles.find(handle => handle.key === axis);
    pointAt(length).forEach((value, component) => close(value, handle.anchor[component], 1e-10));
    assert.equal(handle.label, 'Scale ' + axis.toUpperCase());
    const start = pointAt(length * .15), end = pointAt(length * .55);
    const patch = api.deriveRenderSceneGizmoPatch(source, 'block', camera, viewport, 'scale', axis, start, end);
    assert.deepEqual(Object.keys(patch), ['size']);
    patch.size.forEach((value, component) => close(value, selected.size[component] * (component === index ? 1.4 : 1), 1e-10));
    const changed = api.inspectRenderSceneObjects(api.editRenderSceneObjectSource(source, 'block', patch));
    assert.deepEqual(changed.filter(object => object.objectId !== 'block'), properties.filter(object => object.objectId !== 'block'));
    assert.deepEqual({...changed.find(object => object.objectId === 'block'), size: selected.size}, selected);
    const zero = api.deriveRenderSceneGizmoPatch(source, 'block', camera, viewport, 'scale', axis, start, start);
    assert.deepEqual(zero.size, selected.size); assert.equal(api.editRenderSceneObjectSource(source, 'block', zero), source);
    assert.throws(() => api.deriveRenderSceneGizmoPatch(source, 'block', camera, viewport, 'scale', axis, pointAt(length * .5), pointAt(-length)));
  }
  const roundedBase = api.addRenderSceneObjectSource('@scene rounded { version: 1; }', 'rounded-box', 'round');
  const roundedSource = api.editRenderSceneObjectSource(roundedBase, 'round', {translate: selected.translate, rotateDegrees: selected.rotateDegrees, size: [2, 3, 4], radius: .2});
  const rounded = api.inspectRenderSceneObjects(roundedSource)[0], roundedPrep = api.prepareRenderSceneGizmo(roundedSource, 'round', camera, viewport, 'scale');
  assert.deepEqual(roundedPrep.handles.map(handle => handle.key), [...axes, 'uniform']);
  for (const [index, axis] of axes.entries()) {
    const pointAt = t => forward(rounded.translate.map((value, component) => value + localAxes[index][component] * t));
    const patch = api.deriveRenderSceneGizmoPatch(roundedSource, 'round', camera, viewport, 'scale', axis, pointAt(length * .2), pointAt(length * .5));
    assert.deepEqual(Object.keys(patch), ['size']);
    patch.size.forEach((value, component) => close(value, rounded.size[component] * (component === index ? 1.3 : 1), 1e-10));
    const changed = api.inspectRenderSceneObjects(api.editRenderSceneObjectSource(roundedSource, 'round', patch))[0];
    assert.equal(changed.radius, rounded.radius); assert.deepEqual({...changed, size: rounded.size}, rounded);
    assert.equal(roundedPrep.handles.find(handle => handle.key === axis).label, 'Size ' + axis.toUpperCase());
  }
  for (const kind of ['sphere', 'cylinder', 'capsule', 'torus']) {
    const text = api.addRenderSceneObjectSource('@scene unsupported { version: 1; }', kind, 'one');
    assert.deepEqual(api.prepareRenderSceneGizmo(text, 'one', camera, viewport, 'scale').handles.map(handle => handle.key), ['uniform']);
    for (const axis of axes) assert.throws(() => api.deriveRenderSceneGizmoPatch(text, 'one', camera, viewport, 'scale', axis, [450, 300], [460, 300]));
  }
  const unrotated = api.editRenderSceneObjectSource(source, 'block', {translate: [0, 0, 0], rotateDegrees: [0, 0, 0]});
  const axialCamera = {...camera, eye: [0, 0, 7]};
  assert(!api.prepareRenderSceneGizmo(unrotated, 'block', axialCamera, viewport, 'scale').handles.some(handle => handle.key === 'z'));
  assert.throws(() => api.deriveRenderSceneGizmoPatch(unrotated, 'block', axialCamera, viewport, 'scale', 'z', [450, 300], [450, 290]));
  const axialMatrices = prepareCamera(axialCamera, viewport.backingWidth / viewport.backingHeight), largeBox = api.editRenderSceneObjectSource(unrotated, 'block', {size: [999, 1, 1]});
  const axisLength = 160 * 7 / (axialMatrices.projection[5] * viewport.height);
  const screenAt = t => [450 + axialMatrices.projection[0] * t / 7 * viewport.width / 2, 300];
  assert.throws(() => api.deriveRenderSceneGizmoPatch(largeBox, 'block', axialCamera, viewport, 'scale', 'x', screenAt(0), screenAt(axisLength * .1)));
  receipt.cases.push('full RzRyRx local XYZ via independent Euler and public group worldMatrix; projected rational inverse positive factor; each Box size component only; RoundedBox radius unchanged; all-four unsupported axes refused; end-on and actual dimension limits; byte-exact zero');

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
  receipt.cases.push('getter0/data/count budgets, end-on and horizon refusal, retained2048 rotation-widget profile limit without changing4096 source projection policy, positive scale/dimension limits');

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
