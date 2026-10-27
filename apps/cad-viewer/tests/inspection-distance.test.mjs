import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

// Exercise the public Viewer with the app source guard and original CAD point query.
const root = new URL('../../../', import.meta.url);
const built = await build({ stdin: { contents: `export { Viewer } from './packages/barocss-viewer/src/index.ts';
export { parseSource, admitSource } from './apps/cad-viewer/source.js';
export { inspectDocumentPoint } from './apps/cad-viewer/native-inspection.js';
export { prepareInspectedDistancePoint, measureInspectedDistance } from './apps/cad-viewer/inspection-distance.js';`, resolveDir: root.pathname },
bundle: true, platform: 'node', format: 'esm', write: false,
plugins: [{ name: 'own-source', setup(builder) {
  builder.onResolve({ filter: /^@barocss\// }, async ({ path }) => {
    const parts = path.split('/'), directory = new URL('packages/barocss-' + parts[1] + '/', root);
    const manifest = JSON.parse(await readFile(new URL('package.json', directory), 'utf8'));
    const entry = manifest.exports[parts.length === 2 ? '.' : './' + parts.slice(2).join('/')];
    return { path: new URL(typeof entry === 'string' ? entry : entry.import, directory).pathname };
  });
} }] });
const temp = await mkdtemp(tmpdir() + '/cad-viewer-inspection-distance-');
let api;
try {
  await writeFile(temp + '/inspection.mjs', built.outputFiles[0].contents);
  api = await import(pathToFileURL(temp + '/inspection.mjs').href);
} finally { await rm(temp, { recursive: true }); }
const wire = await readFile(new URL('packages/barocss-cad-interop/examples/document-gpu-v2.cad-document.json', root), 'utf8');
globalThis.HTMLCanvasElement = class {
  width = 800; height = 480;
  getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 480 }; }
};
function setup() {
  const source = api.parseSource(wire, 'Original document.json');
  const presenter = { drawings: [], show(drawing) { this.drawings.push(drawing); } };
  const viewer = new api.Viewer(new HTMLCanvasElement(), { mmToSceneUnit: .15, background: [0, 0, 0] }, presenter);
  api.admitSource(viewer, source, ['body_0_curve', 'body_0_surface', 'body_0_skip', 'body_1_surface']);
  const bodies = viewer.getState().documentBodies;
  const ref = id => bodies.find(body => body.binding.bodyId === id).ref;
  return { source, viewer, presenter, ref };
}
function inspect(context, bodyId, query) {
  context.viewer.selectGeometry(context.ref(bodyId));
  return { bodyId, label: bodyId, query: { ...query },
    result: api.inspectDocumentPoint(context.source, context.viewer.getState(), query), error: '' };
}

test('accepted Surface and Curve points become exact current Viewer inputs while draft queries are ignored', () => {
  const context = setup();
  for (const [bodyId, query, expected] of [
    ['body_0_surface', { kind: 'surface', u: 5, v: 3 }, { kind: 'surface', u: 5, v: 3 }],
    ['body_0_curve', { kind: 'curve', parameter: 7 }, { kind: 'curve', t: 7 }],
  ]) {
    const inspection = inspect(context, bodyId, query), state = context.viewer.getState();
    inspection.query = { kind: 'surface', u: NaN, v: Infinity };
    inspection.result.pointMM = [999, 999, 999];
    const before = structuredClone(inspection), sourceBefore = structuredClone(context.source);
    const calls = context.presenter.drawings.length;
    const prepared = api.prepareInspectedDistancePoint(context.source, state, inspection);
    assert.deepEqual(prepared.input, { ...context.ref(bodyId), ...expected });
    assert.deepEqual(prepared.point.pointMM, bodyId === 'body_0_surface' ? [4, 3, 3] : [6, 1, 5]);
    assert.deepEqual(inspection, before); assert.deepEqual(context.source, sourceBefore);
    assert.deepEqual(context.viewer.getState(), state); assert.equal(context.presenter.drawings.length, calls);
    prepared.point.pointMM[0] = 100; prepared.input.modelId = 'changed';
    assert.deepEqual(inspection, before); assert.deepEqual(context.viewer.getState(), state);
  }
});

test('an inspected point outside the camera frustum prepares point A without projection or cache changes', () => {
  const context = setup(), inspection = inspect(context, 'body_0_skip', { kind: 'curve', parameter: 1 });
  const input = { ...context.ref('body_0_skip'), t: 1 };
  context.viewer.measureNativePoints({ ...input, t: 0 }, input);
  context.viewer.pan(50, 50);
  assert.equal(context.viewer.projectNativePoint(input), null);
  const state = context.viewer.getState(), calls = context.presenter.drawings.length;
  const sourceBefore = structuredClone(context.source), before = structuredClone(inspection);
  context.viewer.projectNativePoint = () => { throw new Error('Point A must not request screen projection.'); };
  context.viewer.measureNativePoints = () => { throw new Error('Point A must not write the measurement cache.'); };
  const prepared = api.prepareInspectedDistancePoint(context.source, state, inspection);
  assert.deepEqual(prepared.input, input); assert.deepEqual(prepared.point.pointMM, [6, 5, 0]);
  assert.deepEqual(context.viewer.getState(), state); assert.equal(context.presenter.drawings.length, calls);
  assert.deepEqual(context.source, sourceBefore); assert.deepEqual(inspection, before);
});

test('inspected point B completes same-asset native distance and failures preserve the accepted cache and scene', () => {
  const context = setup();
  const firstInspection = inspect(context, 'body_0_surface', { kind: 'surface', u: -2, v: 0 });
  const first = api.prepareInspectedDistancePoint(context.source, context.viewer.getState(), firstInspection);
  const second = inspect(context, 'body_0_curve', { kind: 'curve', parameter: 7 });
  const before = context.viewer.getState(), sourceBefore = structuredClone(context.source), calls = context.presenter.drawings.length;
  const completed = api.measureInspectedDistance(context.viewer, context.source, second, first.input);
  assert.deepEqual(completed.point.input, { ...context.ref('body_0_curve'), t: 7 });
  assert.deepEqual(completed.point.point.pointMM, [6, 1, 5]);
  assert.ok(Math.abs(completed.result.distanceMM - Math.sqrt(62)) < 1e-12);
  assert.equal(completed.result.metric, 'straight-line'); assert.equal(completed.result.space, 'native-authored');
  const accepted = context.viewer.getState(), expected = { ...before, nativeMeasurement: completed.result };
  assert.deepEqual(accepted, expected); assert.equal(context.presenter.drawings.length, calls);
  const previous = structuredClone(completed), secondBefore = structuredClone(second);
  for (const invalid of [undefined, { ...first.input, u: -2.001 }, { ...first.input, v: NaN },
    { ...first.input, modelId: 'stale_model' }, { ...first.input, surfaceId: 'unknown' }]) {
    assert.throws(() => api.measureInspectedDistance(context.viewer, context.source, second, invalid));
    assert.deepEqual(context.viewer.getState(), accepted); assert.deepEqual(completed, previous);
    assert.deepEqual(context.source, sourceBefore); assert.deepEqual(second, secondBefore);
    assert.equal(context.presenter.drawings.length, calls);
  }
  const foreign = inspect(context, 'body_1_surface', { kind: 'surface', u: 0, v: 1 });
  const foreignState = context.viewer.getState(), foreignCalls = context.presenter.drawings.length;
  assert.throws(() => api.measureInspectedDistance(context.viewer, context.source, foreign, first.input), /same asset/);
  assert.deepEqual(context.viewer.getState(), foreignState); assert.equal(context.presenter.drawings.length, foreignCalls);
});

test('stale inspection pins, another current body, hidden or unadmitted endpoints refuse without state changes', () => {
  const context = setup(), inspection = inspect(context, 'body_0_skip', { kind: 'curve', parameter: 0 });
  const state = context.viewer.getState(), calls = context.presenter.drawings.length;
  const mutations = [
    value => { value.bodyId = 'body_0_curve'; },
    value => { value.result = null; },
    value => { value.result.reference.documentRevision++; },
    value => { value.result.reference.assetRevision++; },
    value => { value.result.reference.bodyId = 'body_0_curve'; },
    value => { value.result.reference.geometryId = 'wrong_geometry'; },
  ];
  for (const change of mutations) {
    const invalid = structuredClone(inspection); change(invalid); const before = structuredClone(invalid);
    assert.throws(() => api.prepareInspectedDistancePoint(context.source, state, invalid));
    assert.deepEqual(invalid, before); assert.deepEqual(context.viewer.getState(), state);
    assert.equal(context.presenter.drawings.length, calls);
  }
  context.viewer.selectGeometry(context.ref('body_0_curve'));
  const otherState = context.viewer.getState();
  assert.throws(() => api.prepareInspectedDistancePoint(context.source, otherState, inspection), /current document body or revision/);
  assert.deepEqual(context.viewer.getState(), otherState);

  const first = { ...context.ref('body_0_surface'), u: -2, v: 0 };
  const second = inspect(context, 'body_0_curve', { kind: 'curve', parameter: 7 });
  context.viewer.setVisibleGeometry(context.viewer.getState().visibleGeometry.filter(ref => ref.kind !== 'surface'));
  const hiddenState = context.viewer.getState(), hiddenCalls = context.presenter.drawings.length;
  assert.throws(() => api.measureInspectedDistance(context.viewer, context.source, second, first), /Show/);
  assert.deepEqual(context.viewer.getState(), hiddenState); assert.equal(context.presenter.drawings.length, hiddenCalls);
  const unadmitted = { ...first, surfaceId: 'not_admitted' };
  assert.throws(() => api.measureInspectedDistance(context.viewer, context.source, second, unadmitted), /admitted/);
  assert.deepEqual(context.viewer.getState(), hiddenState);
  context.viewer.setVisibleGeometry([]);
  const noVisible = context.viewer.getState();
  assert.throws(() => api.prepareInspectedDistancePoint(context.source, noVisible, second));
  assert.deepEqual(context.viewer.getState(), noVisible);
});
