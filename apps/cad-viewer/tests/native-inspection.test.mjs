import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

// Actual app admission, public CAD queries and Viewer state, with a recording presenter.
const root = new URL('../../../', import.meta.url);
const built = await build({ stdin: { contents: `export { Viewer } from './packages/barocss-viewer/src/index.ts';
export { parseSource, admitSource } from './apps/cad-viewer/source.js';
export { inspectDocumentPoint } from './apps/cad-viewer/native-inspection.js';`, resolveDir: root.pathname },
bundle: true, platform: 'node', format: 'esm', write: false,
plugins: [{ name: 'own-source', setup(builder) {
  builder.onResolve({ filter: /^@barocss\// }, async ({ path }) => {
    const parts = path.split('/'), directory = new URL('packages/barocss-' + parts[1] + '/', root);
    const manifest = JSON.parse(await readFile(new URL('package.json', directory), 'utf8'));
    const entry = manifest.exports[parts.length === 2 ? '.' : './' + parts.slice(2).join('/')];
    return { path: new URL(typeof entry === 'string' ? entry : entry.import, directory).pathname };
  });
} }] });
const temp = await mkdtemp(tmpdir() + '/cad-viewer-native-inspection-');
let api;
try {
  await writeFile(temp + '/inspection.mjs', built.outputFiles[0].contents);
  api = await import(pathToFileURL(temp + '/inspection.mjs').href);
} finally { await rm(temp, { recursive: true }); }
const wire = await readFile(new URL('packages/barocss-cad-interop/examples/document-gpu-v2.cad-document.json', root), 'utf8');
const original = api.parseSource(wire, 'Original document.json');
globalThis.HTMLCanvasElement = class {
  width = 800; height = 480;
  getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 480 }; }
};
function setup(kind = 'surface') {
  const source = structuredClone(original);
  const presenter = { drawings: [], show(drawing) { this.drawings.push(drawing); } };
  const viewer = new api.Viewer(new HTMLCanvasElement(), { mmToSceneUnit: .15, background: [0, 0, 0] }, presenter);
  api.admitSource(viewer, source, ['body_0_curve', 'body_0_surface']);
  const ref = viewer.getState().documentBodies.find(body => body.ref.kind === kind).ref;
  viewer.selectGeometry(ref);
  return { source, presenter, viewer, ref };
}

test('document metadata retains original native domains, parameter defaults and qualified references', () => {
  const source = structuredClone(original), before = structuredClone(source.result);
  const curve = source.catalog.find(body => body.id === 'body_0_curve');
  const surface = source.catalog.find(body => body.id === 'body_0_surface');
  assert.deepEqual(curve.nativeDomain, { kind: 'curve', parameter: [-3, 7] });
  assert.deepEqual(curve.nativeQuery, { kind: 'curve', parameter: 2 });
  assert.deepEqual(surface.nativeDomain, { kind: 'surface', u: [-2, 5], v: [-0, 3] });
  assert.deepEqual(surface.nativeQuery, { kind: 'surface', u: 1.5, v: 1.5 });
  assert.deepEqual(surface.reference, { schema: 'barocss-cad-geometry-reference', version: 0,
    documentId: 'document_gpu_v2', documentRevision: 5, bodyId: 'body_0_surface', assetId: 'asset-a',
    assetRevision: 2, geometryId: 'support_patch_native', geometryKind: 'surface', sourceVersion: 0,
    sourceFrame: 'authored-xyz-no-axis-conversion', lengthUnit: 'mm' });
  surface.reference.assetRevision = 99; surface.nativeDomain.u[0] = 0;
  assert.deepEqual(source.result, before);
});

test('visible admitted Surface and Curve inspection returns original points without changing the Viewer or inputs', () => {
  for (const [kind, query, point] of [
    ['surface', { kind: 'surface', u: 5, v: 3 }, [4, 3, 3]],
    ['curve', { kind: 'curve', parameter: 7 }, [6, 1, 5]],
  ]) {
    const { viewer, presenter, source, ref } = setup(kind);
    viewer.measureNativePoints({ kind: 'surface', modelId: ref.modelId, surfaceId: 'support_patch_native', u: -2, v: 0 },
      { kind: 'curve', modelId: ref.modelId, curveId: 'guide_path_native', t: 7 });
    const state = viewer.getState(), before = structuredClone(state), sourceBefore = structuredClone(source), calls = presenter.drawings.length;
    const queryBefore = structuredClone(query);
    const result = api.inspectDocumentPoint(source, state, query);
    assert.deepEqual(Object.keys(result), ['reference', 'query', 'pointMM', 'report']);
    assert.deepEqual(result.pointMM, point); assert.deepEqual(result.query, queryBefore);
    assert.equal(result.reference.documentRevision, 5); assert.equal(result.reference.assetRevision, 2);
    assert.equal(result.reference.assetId, 'asset-a'); assert.equal(result.reference.geometryKind, kind);
    assert.equal(result.report.geometricValidity, 'not-certified');
    assert.equal(result.report.quality.querySemantics, 'original-native-closed-parameter-domain');
    assert.deepEqual(state, before); assert.deepEqual(viewer.getState(), before);
    assert.deepEqual(source, sourceBefore); assert.deepEqual(query, queryBefore);
    assert.equal(presenter.drawings.length, calls);
    result.pointMM[0] = 100; result.reference.assetId = 'changed'; result.query.kind = 'changed';
    assert.deepEqual(viewer.getState(), before); assert.deepEqual(source, sourceBefore); assert.deepEqual(query, queryBefore);
  }
});

test('inspection is independent of camera frustum and does not replace native measurements', () => {
  const { viewer, presenter, source, ref } = setup();
  const input = { kind: 'surface', modelId: ref.modelId, surfaceId: ref.surfaceId, u: 5, v: 3 };
  viewer.measureNativePoints(input, { ...input, u: -2, v: 0 });
  viewer.pan(50, 50);
  assert.equal(viewer.projectNativePoint(input), null);
  const before = viewer.getState(), calls = presenter.drawings.length;
  assert.deepEqual(api.inspectDocumentPoint(source, before, { kind: 'surface', u: 5, v: 3 }).pointMM, [4, 3, 3]);
  assert.deepEqual(viewer.getState(), before); assert.equal(presenter.drawings.length, calls);
});

test('foreign source, stale pins, wrong display/model binding, hidden and unadmitted bodies refuse without mutation', () => {
  const { viewer, presenter, source } = setup(), current = viewer.getState(), calls = presenter.drawings.length;
  const query = { kind: 'surface', u: 0, v: 1 };
  const changedWire = JSON.parse(wire); changedWire.assets[0].source += '\n';
  const changedSource = api.parseSource(JSON.stringify(changedWire));
  assert.throws(() => api.inspectDocumentPoint(changedSource, current, query), /source differs/);
  assert.throws(() => api.inspectDocumentPoint({ ...source, kind: 'assembly' }, current, query), /CAD document/);
  assert.throws(() => api.inspectDocumentPoint({ ...source, revision: source.revision + 1 }, current, query), /identity or revision/);
  const invalidState = [
    state => { state.document.document.revision++; },
    state => { state.documentBodies.find(body => body.ref.kind === 'surface').binding.assetRevision++; },
    state => { state.documentBodies.find(body => body.ref.kind === 'surface').binding.modelId = 'wrong_native_model'; },
    state => { state.selectedGeometry = { ...state.selectedGeometry, modelId: 'wrong_display' };
      state.visibleGeometry = [state.selectedGeometry];
      state.documentBodies.find(body => body.ref.kind === 'surface').ref = state.selectedGeometry; },
    state => { state.selectedGeometry = null; },
    state => { state.visibleGeometry = []; },
    state => { state.documentBodies = []; },
    state => { state.assembly = {}; },
  ];
  for (const change of invalidState) {
    const state = structuredClone(current); change(state); const before = structuredClone(state);
    assert.throws(() => api.inspectDocumentPoint(source, state, query));
    assert.deepEqual(state, before); assert.deepEqual(viewer.getState(), current);
    assert.equal(presenter.drawings.length, calls);
  }
});

test('native query kind/domain/finite/getter failures retain the source, Viewer and last successful result', () => {
  const { viewer, presenter, source } = setup(), state = viewer.getState(), before = structuredClone(source);
  const previous = api.inspectDocumentPoint(source, state, { kind: 'surface', u: 5, v: 3 });
  const accepted = structuredClone(previous), calls = presenter.drawings.length;
  let getters = 0;
  const getter = Object.defineProperty({ kind: 'surface', u: 0, v: 1 }, 'u', { enumerable: true,
    get() { getters++; throw Error('getter must not execute'); } });
  for (const query of [
    { kind: 'curve', parameter: 2 }, { kind: 'surface', u: -2.001, v: 0 },
    { kind: 'surface', u: 0, v: 3.001 }, { kind: 'surface', u: NaN, v: 0 },
    { kind: 'surface', u: 0, v: Infinity }, { kind: 'surface', u: 0, v: 0, extra: true }, getter,
  ]) {
    assert.throws(() => api.inspectDocumentPoint(source, state, query));
    assert.deepEqual(source, before); assert.deepEqual(viewer.getState(), state);
    assert.deepEqual(previous, accepted); assert.equal(presenter.drawings.length, calls);
  }
  assert.equal(getters, 0);
});
