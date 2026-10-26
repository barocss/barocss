import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

// Actual Viewer admission and CAD parsing, with a recording presenter. This is CPU evidence.
const root = new URL('../../../', import.meta.url);
const built = await build({ stdin: { contents: `export { Viewer } from './packages/barocss-viewer/src/index.ts';
export { Presenter } from './packages/barocss-viewer/src/presenter.ts';
export { compileMeshMaterial } from '@barocss/gpu';
export { parseBaroCadDocument } from './packages/barocss-cad-interop/src/document.ts';
export { parseBaroCadAssembly } from './packages/barocss-cad-interop/src/assembly.ts';`,
  resolveDir: root.pathname }, bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{ name: 'own-source', setup(builder) {
    builder.onResolve({ filter: /^@barocss\// }, async ({ path }) => {
      const parts = path.split('/'), name = parts[1];
      const directory = new URL('packages/barocss-' + name + '/', root);
      const manifest = JSON.parse(await readFile(new URL('package.json', directory), 'utf8'));
      const entry = manifest.exports[parts.length === 2 ? '.' : './' + parts.slice(2).join('/')];
      return { path: new URL(typeof entry === 'string' ? entry : entry.import, directory).pathname };
    });
  } }] });
const temp = await mkdtemp(tmpdir() + '/viewer-review-test-');
let api;
try {
  await writeFile(temp + '/viewer.mjs', built.outputFiles[0].contents);
  api = await import(pathToFileURL(temp + '/viewer.mjs').href);
} finally { await rm(temp, { recursive: true }); }
const original = JSON.parse(await readFile(new URL('packages/barocss-cad-interop/examples/document-gpu-v2.cad-document.json', root), 'utf8'));
const assembly = await readFile(new URL('examples/gpu-scene/fixtures/assembly-revision0.json', root), 'utf8');
const options = { native: { sourceVersion: 0, countU: 3, countV: 3,
  curveDisplay: { version: 1, chordToleranceMM: .02, maxSegments: 512, maxDepth: 16 } },
  basis: 'authored-xyz-matches-rhyup', bodyIds: ['body_0_surface', 'body_0_curve'] };
globalThis.HTMLCanvasElement = class { width = 800; height = 480; };
function setup(creationLighting) {
  const presenter = { drawings: [], lightingUpdates: [], fail: false, show(drawing) {
    if (this.fail) { this.fail = false; throw new Error('presenter fault'); }
    this.drawings.push(structuredClone(drawing));
  }, setLighting(lighting) {
    if (this.fail) { this.fail = false; throw new Error('presenter fault'); }
    this.lightingUpdates.push(structuredClone(lighting));
  } };
  const viewer = new api.Viewer(new HTMLCanvasElement(), { mmToSceneUnit: .15, background: [0, 0, 0],
    ...(creationLighting ? { lighting: creationLighting } : {}) }, presenter);
  const load = (document = original, settings = options) => viewer.loadDocument(api.parseBaroCadDocument(JSON.stringify(document)),
    { ...settings, native: { ...settings.native, unitsPerMillimeter: 1 } });
  load(); return { viewer, presenter, load };
}
test('JSON review restores camera, visible geometry and selection without changing CAD', () => {
  const { viewer } = setup();
  const refs = viewer.getState().visibleGeometry;
  viewer.selectGeometry(refs[0]);
  viewer.setVisibleGeometry([refs[0]]);
  const state = viewer.getState(), saved = JSON.parse(JSON.stringify(viewer.captureReviewState()));
  assert.deepEqual(Object.keys(saved), ['schema', 'version', 'scene', 'camera', 'visibleGeometry', 'selectedGeometry']);
  assert.ok(JSON.stringify(saved).length < 4096);
  viewer.setVisibleGeometry(refs); viewer.selectGeometry(refs[1]); viewer.orbit(.4, .2); viewer.pan(.1, 0); viewer.zoom(1.2);
  viewer.applyReviewState(saved);
  assert.deepEqual(viewer.getState(), state);
  saved.camera.eye[0] = 99; saved.visibleGeometry.length = 0;
  assert.deepEqual(viewer.getState(), state);
  const detached = viewer.captureReviewState(); detached.selectedGeometry.modelId = 'changed';
  assert.deepEqual(viewer.getState(), state);
  viewer.applyReviewState({ ...viewer.captureReviewState(), visibleGeometry: [], selectedGeometry: null });
  assert.deepEqual(viewer.getState().visibleGeometry, []);
});
test('invalid review data is refused before any presenter call and preserves full state', () => {
  const { viewer, presenter } = setup();
  const saved = viewer.captureReviewState(), state = viewer.getState(), calls = presenter.drawings.length;
  const invalid = [null, { ...saved, version: 2 }, { ...saved, packets: [] },
    { ...saved, camera: { ...saved.camera, eye: [NaN, 0, 1] } },
    { ...saved, camera: { ...saved.camera, eye: saved.camera.target } },
    { ...saved, camera: { ...saved.camera, near: saved.camera.far } },
    { ...saved, visibleGeometry: [saved.visibleGeometry[0], saved.visibleGeometry[0]] },
    { ...saved, visibleGeometry: [{ ...saved.visibleGeometry[0], modelId: 'unknown' }] },
    { ...saved, visibleGeometry: [], selectedGeometry: saved.visibleGeometry[0] },
    { ...saved, scene: { ...saved.scene, members: [] } },
    { ...saved, scene: { ...saved.scene, mmToSceneUnit: 1 } },
    { ...saved, visibleGeometry: new Array(1) }];
  let getters = 0;
  invalid.push(Object.defineProperty({ ...saved }, 'camera', { enumerable: true, get() { getters++; throw Error('getter'); } }));
  invalid.push({ ...saved, camera: { ...saved.camera, eye: Object.defineProperty([0, 0, 1], '0', {
    enumerable: true, get() { getters++; throw Error('vector getter'); } }) } });
  for (const candidate of invalid) {
    assert.throws(() => viewer.applyReviewState(candidate));
    assert.deepEqual(viewer.getState(), state);
  }
  assert.equal(getters, 0); assert.equal(presenter.drawings.length, calls);
});
test('foreign document, stale revision and replaced inventory refuse the saved review', () => {
  const { viewer, load } = setup(), saved = viewer.captureReviewState();
  for (const document of [{ ...original, documentId: 'other_document' }, { ...original, revision: 6 }]) {
    load(document); const before = viewer.getState();
    assert.throws(() => viewer.applyReviewState(saved), /identity, revision/);
    assert.deepEqual(viewer.getState(), before);
  }
  load(original, { ...options, bodyIds: ['body_1_surface'] });
  const before = viewer.getState();
  assert.throws(() => viewer.applyReviewState(saved), /inventory/); assert.deepEqual(viewer.getState(), before);
});
test('assembly review binds loaded instance identity and revision without changing hierarchy', () => {
  const { viewer } = setup();
  viewer.loadAssembly(api.parseBaroCadAssembly(assembly), { native: options.native, basis: options.basis,
    instanceIds: ['child', 'surface_grandchild', 'shared_root', 'asset_b_instance'] });
  viewer.selectGeometry(viewer.getState().visibleGeometry[0]);
  const saved = viewer.captureReviewState(), before = viewer.getState();
  assert.equal(saved.scene.kind, 'assembly');
  viewer.orbit(.2, .1); viewer.setVisibleGeometry([]); viewer.applyReviewState(saved);
  assert.deepEqual(viewer.getState(), before);
  assert.throws(() => viewer.applyReviewState({ ...saved, scene: { ...saved.scene, revision: 1 } }));
  assert.deepEqual(viewer.getState(), before);
});
test('presenter failure restores the prior drawing and accepted state; empty scene refuses review', () => {
  const { viewer, presenter } = setup(), before = viewer.getState();
  const drawing = presenter.drawings.at(-1), saved = viewer.captureReviewState();
  presenter.fail = true;
  assert.throws(() => viewer.applyReviewState({ ...saved, visibleGeometry: [], selectedGeometry: null }), /presenter fault/);
  assert.deepEqual(viewer.getState(), before); assert.deepEqual(presenter.drawings.at(-1), drawing);
  viewer.clear();
  assert.throws(() => viewer.captureReviewState()); assert.throws(() => viewer.applyReviewState(saved));
});

function nativeInputs(viewer, modelId = viewer.getState().surfaces[0].modelId) {
  const surface = viewer.getState().surfaces.find(ref => ref.modelId === modelId);
  const curve = viewer.getState().curves.find(ref => ref.modelId === modelId);
  return {
    surfaceA: { kind: 'surface', ...surface, u: -2, v: 0 },
    surfaceB: { kind: 'surface', ...surface, u: 5, v: 3 },
    curveA: { kind: 'curve', ...curve, t: -3 },
    curveB: { kind: 'curve', ...curve, t: 7 },
  };
}
function measuredReview(viewer, first, second) {
  const result = viewer.measureNativePoints(first, second);
  return { schema: 'barocss-viewer-measured-review', version: 1,
    review: viewer.captureReviewState(), measurement: {
      first: { ...first }, second: { ...second }, distanceMM: result.distanceMM,
      metric: result.metric, space: result.space, certification: result.certification,
    } };
}
test('measured reviews restore original Surface, Curve and mixed points with detached results', () => {
  const { viewer, presenter } = setup(), point = nativeInputs(viewer);
  for (const [first, second] of [[point.surfaceA, point.surfaceB], [point.curveA, point.curveB],
    [point.surfaceB, point.curveA], [point.curveB, point.surfaceA]]) {
    viewer.setVisibleGeometry([...viewer.getState().surfaces.map(ref => ({ kind: 'surface', ...ref })),
      ...viewer.getState().curves.map(ref => ({ kind: 'curve', ...ref }))]);
    viewer.selectGeometry(viewer.getState().visibleGeometry[1]);
    const saved = JSON.parse(JSON.stringify(measuredReview(viewer, first, second)));
    const before = viewer.getState();
    viewer.measureNativePoints(point.surfaceA, point.surfaceA);
    viewer.setVisibleGeometry([]); viewer.orbit(.12, -.05);
    const calls = presenter.drawings.length;
    const restored = viewer.applyMeasuredReviewState(saved);
    assert.equal(presenter.drawings.length, calls + 1);
    assert.deepEqual(restored, before.nativeMeasurement);
    assert.deepEqual(viewer.getState(), before);
    restored.first.pointMM[0] = 123; restored.first.ref.modelId = 'changed';
    saved.measurement.first.modelId = 'changed'; saved.review.camera.eye[0] = 99;
    assert.deepEqual(viewer.getState(), before);
  }
});
test('a null measured review clears only the latest native measurement after successful presentation', () => {
  const { viewer } = setup(), point = nativeInputs(viewer);
  const { kind: surfaceKind, ...surfaceA } = point.surfaceA;
  const { kind: otherSurfaceKind, ...surfaceB } = point.surfaceB;
  const { kind: curveKind, ...curveA } = point.curveA;
  const { kind: otherCurveKind, ...curveB } = point.curveB;
  viewer.measureNativeSurfacePoints(surfaceA, surfaceB);
  viewer.measureNativeCurvePoints(curveA, curveB);
  viewer.measureNativeSurfaceCurvePoints(surfaceA, curveA);
  const before = viewer.getState(), review = viewer.captureReviewState();
  assert.equal(viewer.applyMeasuredReviewState({ schema: 'barocss-viewer-measured-review', version: 1,
    review, measurement: null }), null);
  assert.deepEqual(viewer.getState(), { ...before, nativeMeasurement: null });
  assert.ok(viewer.getState().measurement && viewer.getState().curveMeasurement && viewer.getState().surfaceCurveMeasurement);
});
test('invalid measured reviews preserve every cache and refuse before presentation without executing getters', () => {
  const { viewer, presenter, load } = setup();
  load(original, { ...options, bodyIds: ['body_0_surface', 'body_0_curve', 'body_1_surface', 'body_1_curve'] });
  const point = nativeInputs(viewer), other = nativeInputs(viewer,
    viewer.getState().surfaces.find(ref => ref.modelId !== point.surfaceA.modelId).modelId);
  const saved = measuredReview(viewer, point.surfaceA, point.curveB);
  const before = viewer.getState(), calls = presenter.drawings.length;
  const altered = fields => ({ ...saved, measurement: { ...saved.measurement, ...fields } });
  const invalid = [null, { ...saved, version: 2 }, { ...saved, extra: true },
    altered({ distanceMM: saved.measurement.distanceMM + 1 }), altered({ distanceMM: NaN }),
    altered({ distanceMM: Infinity }), altered({ distanceMM: -1 }), altered({ metric: 'straight-chord' }),
    altered({ space: 'scene' }), altered({ certification: 'certified' }), altered({ units: 'mm' }),
    altered({ first: { ...point.surfaceA, u: -2.001 } }),
    altered({ second: { ...point.curveB, t: 7.001 } }),
    altered({ first: { ...point.surfaceA, modelId: 'unknown' } }),
    altered({ second: { ...point.curveB, curveId: 'skip_path_native', t: .5 } }),
    altered({ second: other.curveB }),
    { ...saved, review: { ...saved.review,
      visibleGeometry: [saved.review.visibleGeometry[0]], selectedGeometry: null } },
    { ...saved, review: { ...saved.review, camera: { ...saved.review.camera, near: saved.review.camera.far } } },
    { ...saved, review: { ...saved.review, scene: { ...saved.review.scene, revision: original.revision + 1 } } },
    { ...saved, review: { ...saved.review, scene: { ...saved.review.scene,
      members: saved.review.scene.members.map((pin, index) => index ? pin : pin + 'stale') } } },
  ];
  let getters = 0;
  const getter = input => Object.defineProperty(input, 'distanceMM', {
    enumerable: true, get() { getters++; throw Error('distance getter'); } });
  invalid.push({ ...saved, measurement: getter({ ...saved.measurement }) });
  invalid.push(altered({ first: Object.defineProperty({ ...point.surfaceA }, 'u', {
    enumerable: true, get() { getters++; throw Error('parameter getter'); } }) }));
  invalid.push(Object.defineProperty({ ...saved }, 'measurement', {
    enumerable: true, get() { getters++; throw Error('measurement getter'); } }));
  invalid.push({ ...saved, review: Object.defineProperty({ ...saved.review }, 'camera', {
    enumerable: true, get() { getters++; throw Error('camera getter'); } }) });
  invalid.push({ ...saved, review: { ...saved.review, visibleGeometry: Object.defineProperty(
    [...saved.review.visibleGeometry], '0', {
      enumerable: true, get() { getters++; throw Error('visible reference getter'); } }) } });
  for (const candidate of invalid) {
    assert.throws(() => viewer.applyMeasuredReviewState(candidate));
    assert.deepEqual(viewer.getState(), before);
    assert.equal(presenter.drawings.length, calls);
  }
  assert.equal(getters, 0);
});
test('measured review source pins and loaded subset bind to the current accepted document', () => {
  const { viewer, presenter, load } = setup(), point = nativeInputs(viewer);
  const saved = measuredReview(viewer, point.surfaceA, point.surfaceB);
  for (const [document, settings] of [[{ ...original, revision: 6 }, options],
    [{ ...original, documentId: 'foreign_document' }, options],
    [original, { ...options, bodyIds: ['body_0_surface'] }]]) {
    load(document, settings);
    const current = nativeInputs(viewer);
    viewer.measureNativePoints(current.surfaceA, current.surfaceB);
    const before = viewer.getState(), calls = presenter.drawings.length;
    assert.throws(() => viewer.applyMeasuredReviewState(saved), /identity, revision|inventory/);
    assert.deepEqual(viewer.getState(), before);
    assert.equal(presenter.drawings.length, calls);
  }
});
test('assembly accepts an unmeasured review and refuses native measurements without mutation', () => {
  const { viewer, presenter } = setup(), point = nativeInputs(viewer);
  const measurement = measuredReview(viewer, point.surfaceA, point.curveB).measurement;
  viewer.loadAssembly(api.parseBaroCadAssembly(assembly), { native: options.native, basis: options.basis,
    instanceIds: ['child', 'surface_grandchild', 'shared_root', 'asset_b_instance'] });
  const review = { schema: 'barocss-viewer-measured-review', version: 1,
    review: viewer.captureReviewState(), measurement };
  const before = viewer.getState(), calls = presenter.drawings.length;
  assert.throws(() => viewer.applyMeasuredReviewState(review), /native CAD document/);
  assert.deepEqual(viewer.getState(), before); assert.equal(presenter.drawings.length, calls);
  assert.equal(viewer.applyMeasuredReviewState({ ...review, measurement: null }), null);
  assert.deepEqual(viewer.getState(), before);
});
test('measured review presenter failure restores drawing and every previous measurement cache', () => {
  const { viewer, presenter } = setup(), point = nativeInputs(viewer);
  const saved = measuredReview(viewer, point.surfaceA, point.curveB);
  viewer.measureNativePoints(point.curveA, point.curveB);
  viewer.selectGeometry(viewer.getState().visibleGeometry[0]);
  viewer.orbit(.3, .1);
  const before = viewer.getState(), drawing = presenter.drawings.at(-1);
  for (const measurement of [saved.measurement, null]) {
    presenter.fail = true;
    assert.throws(() => viewer.applyMeasuredReviewState({ ...saved, measurement }), /presenter fault/);
    assert.deepEqual(viewer.getState(), before);
    assert.deepEqual(presenter.drawings.at(-1), drawing);
  }
});

const authoredLighting = { ambientStrength: .2, directionalStrength: .7, direction: [-2, 3, 4] };
const defaultLighting = { ambientStrength: .35, directionalStrength: .65, direction: [-.6, .8, 1] };
test('lighting changes only accepted light and uses a detached capability with creation/default reset', () => {
  for (const creation of [undefined, { ambientStrength: .1, directionalStrength: .8, direction: [1, 2, 3] }]) {
    const { viewer, presenter } = setup(creation), point = nativeInputs(viewer);
    viewer.measureNativePoints(point.surfaceA, point.curveB);
    viewer.selectGeometry(viewer.getState().visibleGeometry[1]);
    viewer.orbit(.1, .05);
    const before = viewer.getState(), drawings = presenter.drawings.length;
    const input = structuredClone(authoredLighting);
    viewer.setLighting(input);
    assert.deepEqual(viewer.getState(), { ...before, lighting: authoredLighting });
    assert.equal(presenter.drawings.length, drawings);
    assert.deepEqual(presenter.lightingUpdates, [authoredLighting]);
    input.direction[0] = 100;
    const capabilities = viewer.getLightingCapabilities();
    assert.equal(capabilities.supported, true); assert.equal(capabilities.reason, null);
    assert.deepEqual(capabilities.lighting, authoredLighting);
    assert.deepEqual(capabilities.defaultLighting, creation ?? defaultLighting);
    assert.deepEqual(Object.keys(capabilities.unsupported), ['environmentMap', 'shadows', 'postProcessing']);
    capabilities.lighting.direction[0] = 100; capabilities.defaultLighting.direction[0] = 100;
    capabilities.unsupported.shadows = 'changed';
    assert.deepEqual(viewer.getState(), { ...before, lighting: authoredLighting });
    assert.notEqual(viewer.getLightingCapabilities().unsupported.shadows, 'changed');
    viewer.setLighting(null);
    assert.deepEqual(viewer.getState(), before);
    assert.deepEqual(presenter.lightingUpdates.at(-1), creation ?? null);
    assert.deepEqual(viewer.getLightingCapabilities().lighting, creation ?? defaultLighting);
  }
});
test('invalid lighting, accessor data and presenter failure preserve every accepted cache', () => {
  const { viewer, presenter } = setup(), point = nativeInputs(viewer);
  viewer.measureNativePoints(point.surfaceA, point.curveB);
  viewer.setLighting(authoredLighting);
  const before = viewer.getState(), updates = presenter.lightingUpdates.length, drawings = presenter.drawings.length;
  const invalid = [undefined, {}, { ...authoredLighting, extra: true },
    { ...authoredLighting, ambientStrength: NaN }, { ...authoredLighting, ambientStrength: -.1 },
    { ...authoredLighting, directionalStrength: 1.01 },
    { ...authoredLighting, ambientStrength: .4, directionalStrength: .7 },
    { ...authoredLighting, direction: [0, 0, 0] }, { ...authoredLighting, direction: [1000.01, 0, 1] },
    { ...authoredLighting, direction: [0, Infinity, 1] }, { ...authoredLighting, direction: new Array(3) }];
  let getters = 0;
  invalid.push(Object.defineProperty({ ...authoredLighting }, 'ambientStrength', {
    enumerable: true, get() { getters++; throw Error('lighting getter'); } }));
  invalid.push({ ...authoredLighting, direction: Object.defineProperty([1, 2, 3], '0', {
    enumerable: true, get() { getters++; throw Error('direction getter'); } }) });
  for (const candidate of invalid) {
    assert.throws(() => viewer.setLighting(candidate));
    assert.deepEqual(viewer.getState(), before);
    assert.equal(presenter.lightingUpdates.length, updates);
    assert.equal(presenter.drawings.length, drawings);
  }
  assert.equal(getters, 0);
  presenter.fail = true;
  assert.throws(() => viewer.setLighting(null), /presenter fault/);
  assert.deepEqual(viewer.getState(), before);
  assert.equal(presenter.lightingUpdates.length, updates);
});
test('lighting capability refuses an empty or curve-only Viewer without changing accepted state', () => {
  const { viewer, presenter, load } = setup();
  load(original, { ...options, bodyIds: ['body_0_curve'] });
  for (const clear of [false, true]) {
    if (clear) viewer.clear();
    const before = viewer.getState(), updates = presenter.lightingUpdates.length;
    assert.equal(viewer.getLightingCapabilities().supported, false);
    assert.match(viewer.getLightingCapabilities().reason, /loaded Surface/);
    assert.throws(() => viewer.setLighting(authoredLighting), /loaded Surface/);
    assert.deepEqual(viewer.getState(), before);
    assert.equal(presenter.lightingUpdates.length, updates);
  }
});
test('measured reviews apply lighting and display as one draw; legacy omission retains current light', () => {
  const { viewer, presenter } = setup(), point = nativeInputs(viewer);
  const saved = { ...measuredReview(viewer, point.surfaceA, point.curveB), lighting: structuredClone(authoredLighting) };
  const expected = { ...viewer.getState(), lighting: structuredClone(authoredLighting) };
  viewer.orbit(.3, .2); viewer.setVisibleGeometry([]);
  let calls = presenter.drawings.length;
  const restored = viewer.applyMeasuredReviewState(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(restored, expected.nativeMeasurement);
  assert.deepEqual(viewer.getState(), expected);
  assert.equal(presenter.drawings.length, calls + 1);
  assert.equal(presenter.lightingUpdates.length, 0);
  assert.deepEqual(presenter.drawings.at(-1).lighting, authoredLighting);
  saved.lighting.direction[0] = -100;
  assert.deepEqual(viewer.getState(), expected);
  const legacy = measuredReview(viewer, point.curveA, point.curveB);
  calls = presenter.drawings.length;
  viewer.applyMeasuredReviewState(legacy);
  assert.equal(presenter.drawings.length, calls + 1);
  assert.deepEqual(viewer.getState().lighting, expected.lighting);
  viewer.applyMeasuredReviewState({ ...legacy, lighting: null });
  assert.equal(viewer.getState().lighting, null);
  assert.equal(presenter.drawings.at(-1).lighting, null);
});
test('invalid combined review and failed presentation preserve lighting and every previous cache', () => {
  const { viewer, presenter } = setup(), point = nativeInputs(viewer);
  const saved = { ...measuredReview(viewer, point.surfaceA, point.curveB), lighting: structuredClone(authoredLighting) };
  viewer.setLighting({ ambientStrength: .4, directionalStrength: .5, direction: [0, 1, 0] });
  viewer.measureNativePoints(point.curveA, point.curveB); viewer.orbit(.1, .1);
  const before = viewer.getState(), calls = presenter.drawings.length, drawing = presenter.drawings.at(-1);
  let getters = 0;
  const invalid = [{ ...saved, lighting: { ...authoredLighting, direction: [0, 0, 0] } },
    { ...saved, measurement: { ...saved.measurement, distanceMM: saved.measurement.distanceMM + 1 } },
    { ...saved, review: { ...saved.review, visibleGeometry: [], selectedGeometry: null } },
    { ...saved, review: { ...saved.review, camera: { ...saved.review.camera, near: 100, far: 1 } } },
    Object.defineProperty({ ...saved }, 'lighting', { enumerable: true,
      get() { getters++; throw Error('review lighting getter'); } })];
  for (const candidate of invalid) {
    assert.throws(() => viewer.applyMeasuredReviewState(candidate));
    assert.deepEqual(viewer.getState(), before); assert.equal(presenter.drawings.length, calls);
  }
  assert.equal(getters, 0);
  presenter.fail = true;
  assert.throws(() => viewer.applyMeasuredReviewState(saved), /presenter fault/);
  assert.deepEqual(viewer.getState(), before);
  // Recovery uses the previous accepted light, even when the candidate supplied another one.
  assert.deepEqual(presenter.drawings.at(-1), { ...drawing, lighting: before.lighting });
  assert.equal(presenter.lightingUpdates.length, 1);
});
test('Presenter changes lights without touching meshes and restores original core references on faults', () => {
  for (const fault of ['lights', 'environment', 'requestRender', null]) {
    const previousLights = [{ kind: 'directional', direction: [0, -1, 0], intensity: .5 }];
    const previousEnvironment = { ambient: .2 };
    let lights = previousLights, environment = previousEnvironment, armed = fault, requests = 0;
    const core = {
      get lights() { return lights; }, set lights(value) {
        if (armed === 'lights') { armed = null; throw Error('lights fault'); } lights = value;
      },
      get environment() { return environment; }, set environment(value) {
        if (armed === 'environment') { armed = null; throw Error('environment fault'); } environment = value;
      },
      requestRender() { requests++; if (armed === 'requestRender') { armed = null; throw Error('render fault'); } },
      add() { throw Error('must not add meshes'); },
      camera: Object.freeze({ position: [0, 0, 6], target: [0, 0, 0] }),
    };
    const presenter = new api.Presenter(core), camera = core.camera;
    if (fault) {
      assert.throws(() => presenter.setLighting(authoredLighting), /fault/);
      assert.equal(lights, previousLights); assert.equal(environment, previousEnvironment);
    } else {
      presenter.setLighting(authoredLighting);
      assert.equal(environment.ambient, authoredLighting.ambientStrength);
      assert.equal(lights[0].intensity, authoredLighting.directionalStrength);
      const length = Math.hypot(...authoredLighting.direction);
      assert.deepEqual(lights[0].direction, authoredLighting.direction.map(value => -value / length));
    }
    assert.equal(core.camera, camera); assert.ok(requests >= 1);
  }
});

test('named review preflight', async t => {
  await t.test('valid document measurement and lighting do not present or change any accepted cache', () => {
    const { viewer, presenter } = setup(), point = nativeInputs(viewer);
    const untag = ({ kind, ...parameter }) => parameter;
    viewer.measureNativeSurfacePoints(untag(point.surfaceA), untag(point.surfaceB));
    viewer.measureNativeCurvePoints(untag(point.curveA), untag(point.curveB));
    viewer.measureNativeSurfaceCurvePoints(untag(point.surfaceA), untag(point.curveB));
    const candidate = { ...measuredReview(viewer, point.surfaceA, point.curveB),
      lighting: structuredClone(authoredLighting) };
    const input = structuredClone(candidate);
    viewer.measureNativePoints(point.curveA, point.curveB); viewer.orbit(.2, -.1);
    const before = viewer.getState(), calls = presenter.drawings.length, updates = presenter.lightingUpdates.length;
    presenter.fail = true;
    assert.equal(viewer.validateMeasuredReviewState(candidate), undefined);
    assert.deepEqual(viewer.getState(), before); assert.deepEqual(candidate, input);
    assert.equal(presenter.drawings.length, calls); assert.equal(presenter.lightingUpdates.length, updates);
    assert.equal(presenter.fail, true);
  });
  await t.test('camera relations, native domain and distance, scene pins and getters refuse without presentation', () => {
    const { viewer, presenter } = setup(), point = nativeInputs(viewer);
    const candidate = measuredReview(viewer, point.surfaceA, point.curveB);
    const before = viewer.getState(), calls = presenter.drawings.length;
    const alteredView = fields => ({ ...candidate, review: { ...candidate.review, ...fields } });
    const invalid = [
      alteredView({ camera: { ...candidate.review.camera, eye: candidate.review.camera.target } }),
      alteredView({ camera: { ...candidate.review.camera, near: 5, far: 1 } }),
      alteredView({ visibleGeometry: [], selectedGeometry: null }),
      alteredView({ selectedGeometry: { kind: 'curve', modelId: 'unknown', curveId: 'unknown' } }),
      alteredView({ scene: { ...candidate.review.scene, revision: candidate.review.scene.revision + 1 } }),
      alteredView({ scene: { ...candidate.review.scene, members: [...candidate.review.scene.members].reverse() } }),
      { ...candidate, lighting: { ...authoredLighting, direction: [0, 0, 0] } },
      { ...candidate, measurement: { ...candidate.measurement, distanceMM: candidate.measurement.distanceMM + 1 } },
      { ...candidate, measurement: { ...candidate.measurement, first: { ...point.surfaceA, u: -2.001 } } },
    ];
    let getters = 0;
    const descriptor = { enumerable: true, get() { getters++; throw Error('getter must not run'); } };
    invalid.push(Object.defineProperty({ ...candidate }, 'review', descriptor));
    invalid.push(alteredView({ camera: Object.defineProperty({ ...candidate.review.camera }, 'eye', descriptor) }));
    invalid.push({ ...candidate, measurement: { ...candidate.measurement,
      first: Object.defineProperty({ ...point.surfaceA }, 'u', descriptor) } });
    for (const input of invalid) {
      assert.throws(() => viewer.validateMeasuredReviewState(input));
      assert.deepEqual(viewer.getState(), before); assert.equal(presenter.drawings.length, calls);
      assert.equal(presenter.lightingUpdates.length, 0);
    }
    assert.equal(getters, 0);
  });
  await t.test('assembly display and lighting preflight succeeds, native measurements and stale subset pins refuse', () => {
    const { viewer, presenter } = setup(), point = nativeInputs(viewer);
    const measurement = measuredReview(viewer, point.surfaceA, point.curveB).measurement;
    viewer.loadAssembly(api.parseBaroCadAssembly(assembly), { native: options.native, basis: options.basis,
      instanceIds: ['child', 'surface_grandchild', 'shared_root', 'asset_b_instance'] });
    viewer.selectGeometry(viewer.getState().visibleGeometry[0]);
    const candidate = { schema: 'barocss-viewer-measured-review', version: 1,
      review: viewer.captureReviewState(), measurement: null, lighting: structuredClone(authoredLighting) };
    const before = viewer.getState(), calls = presenter.drawings.length;
    assert.equal(viewer.validateMeasuredReviewState(candidate), undefined);
    assert.throws(() => viewer.validateMeasuredReviewState({ ...candidate, measurement }), /native CAD document/);
    assert.throws(() => viewer.validateMeasuredReviewState({ ...candidate, review: { ...candidate.review,
      scene: { ...candidate.review.scene, members: candidate.review.scene.members.slice(1) } } }), /inventory/);
    assert.deepEqual(viewer.getState(), before); assert.equal(presenter.drawings.length, calls);
    assert.equal(presenter.lightingUpdates.length, 0);
  });
  await t.test('current material guards apply to preflight without binding or redrawing anything', () => {
    const { viewer, presenter } = setup();
    const surface = viewer.getState().surfaces[0];
    const compiled = api.compileMeshMaterial('@shader #preflight_blue { @fragment { color: #2867D8; } }');
    assert.equal(compiled.ok, true);
    viewer.setSurfaceMaterial(surface, { material: compiled.material, uniforms: {} });
    const candidate = { schema: 'barocss-viewer-measured-review', version: 1,
      review: viewer.captureReviewState(), measurement: null };
    const before = viewer.getState(), calls = presenter.drawings.length;
    assert.equal(viewer.validateMeasuredReviewState(candidate), undefined);
    for (const review of [
      { ...candidate.review, visibleGeometry: [], selectedGeometry: null },
      { ...candidate.review, selectedGeometry: { kind: 'surface', ...surface } },
    ]) {
      assert.throws(() => viewer.validateMeasuredReviewState({ ...candidate, review }), /Clear Surface material/);
      assert.deepEqual(viewer.getState(), before); assert.equal(presenter.drawings.length, calls);
    }
  });
});
