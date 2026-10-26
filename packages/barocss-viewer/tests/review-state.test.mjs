import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

// Actual Viewer admission and CAD parsing, with a recording presenter. This is CPU evidence.
const root = new URL('../../../', import.meta.url);
const built = await build({ stdin: { contents: `export { Viewer } from './packages/barocss-viewer/src/index.ts';
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
function setup() {
  const presenter = { drawings: [], fail: false, show(drawing) {
    if (this.fail) { this.fail = false; throw new Error('presenter fault'); }
    this.drawings.push(structuredClone(drawing));
  } };
  const viewer = new api.Viewer(new HTMLCanvasElement(), { mmToSceneUnit: .15, background: [0, 0, 0] }, presenter);
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
