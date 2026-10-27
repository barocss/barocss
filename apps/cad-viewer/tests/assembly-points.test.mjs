import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = new URL('../../../', import.meta.url);
const built = await build({ stdin: { contents: `export { Viewer } from './packages/barocss-viewer/src/index.ts';
export { parseSource, admitSource } from './apps/cad-viewer/source.js';
export { prepareAssemblyPoint, retainVisibleAssemblyPoints, measureAssemblyPointPair } from './apps/cad-viewer/assembly-points.js';`,
resolveDir: root.pathname }, bundle: true, platform: 'node', format: 'esm', write: false,
plugins: [{ name: 'own-source', setup(builder) {
  builder.onResolve({ filter: /^@barocss\// }, async ({ path }) => {
    const parts = path.split('/'), directory = new URL('packages/barocss-' + parts[1] + '/', root);
    const manifest = JSON.parse(await readFile(new URL('package.json', directory), 'utf8'));
    const entry = manifest.exports[parts.length === 2 ? '.' : './' + parts.slice(2).join('/')];
    return { path: new URL(typeof entry === 'string' ? entry : entry.import, directory).pathname };
  });
} }] });
const temp = await mkdtemp(tmpdir() + '/cad-viewer-assembly-points-');
let api;
try { await writeFile(temp + '/test.mjs', built.outputFiles[0].contents); api = await import(pathToFileURL(temp + '/test.mjs').href); }
finally { await rm(temp, { recursive: true }); }
const wire = await readFile(new URL('examples/gpu-scene/fixtures/assembly-revision0.json', root), 'utf8');
globalThis.HTMLCanvasElement = class {
  width = 800; height = 480;
  getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 480 }; }
};
function setup() {
  const source = api.parseSource(wire, 'Assembly');
  const viewer = new api.Viewer(new HTMLCanvasElement(), { mmToSceneUnit: .15, background: [0, 0, 0] }, { show() {} });
  api.admitSource(viewer, source, ['child', 'surface_grandchild', 'shared_root']);
  function inspect(id) {
    const binding = viewer.getState().assemblyInstances.find(row => row.instanceId === id);
    viewer.selectGeometry(binding.ref);
    const query = source.catalog.find(row => row.id === id).nativeQuery;
    const result = viewer.queryAssemblyInstancePoint({ assemblyId: binding.assemblyId,
      assemblyRevision: binding.assemblyRevision, instanceId: id, reference: binding.reference, query });
    return { instanceId: id, query, result, error: '' };
  }
  return { viewer, source, inspect };
}

test('two independent instances retain their original and placed points when selection changes', () => {
  const { viewer, inspect } = setup();
  const first = api.prepareAssemblyPoint(viewer, inspect('child'));
  const second = api.prepareAssemblyPoint(viewer, inspect('shared_root'));
  assert.equal(first.instanceId, 'child'); assert.equal(second.instanceId, 'shared_root');
  assert.deepEqual(first.originalLocalPointMM, second.originalLocalPointMM);
  assert.notDeepEqual(first.assemblyPointMM, second.assemblyPointMM);
  assert.deepEqual(api.retainVisibleAssemblyPoints([first, second], viewer.getState()), [first, second]);
  const state = viewer.getState();
  state.visibleGeometry = state.visibleGeometry.filter(ref => ref.modelId !== state.assemblyInstances.find(row => row.instanceId === 'child').ref.modelId);
  assert.deepEqual(api.retainVisibleAssemblyPoints([first, second], state), [null, second]);
  state.assemblyInstances = state.assemblyInstances.filter(row => row.instanceId !== 'shared_root');
  assert.deepEqual(api.retainVisibleAssemblyPoints([first, second], state), [null, null]);
});

test('failed or stale inspection cannot produce a point and the SDK is queried again', () => {
  const { viewer, inspect } = setup(), inspection = inspect('child');
  inspection.result.originalLocalPointMM[0] = 12345;
  const point = api.prepareAssemblyPoint(viewer, inspection);
  assert.notEqual(point.originalLocalPointMM[0], 12345);
  inspection.error = 'invalid query';
  assert.throws(() => api.prepareAssemblyPoint(viewer, inspection), /valid point/);
  inspection.error = ''; inspection.query = { kind: 'curve', parameter: Infinity };
  assert.throws(() => api.prepareAssemblyPoint(viewer, inspection));
  inspect('shared_root');
  assert.throws(() => api.prepareAssemblyPoint(viewer, inspection), /valid point/);
  assert.equal(point.instanceId, 'child');
});

test('distance is evaluated by the Viewer for the current visible instance pair', () => {
  const { viewer, inspect } = setup();
  const first = api.prepareAssemblyPoint(viewer, inspect('child'));
  const second = api.prepareAssemblyPoint(viewer, inspect('shared_root'));
  const expected = Math.hypot(...first.assemblyPointMM.map((value, index) => value - second.assemblyPointMM[index]));
  const savedFirst = [...first.assemblyPointMM], state = viewer.getState();
  first.assemblyPointMM[0] = 100000;
  assert.equal(api.measureAssemblyPointPair(viewer, [first, second]), expected);
  first.assemblyPointMM = savedFirst;
  assert.deepEqual(viewer.getState(), state);
  assert.equal(api.measureAssemblyPointPair(viewer, [first, first]), 0);
  assert.throws(() => api.measureAssemblyPointPair(viewer, [first, null]), /two visible/);
  const binding = state.assemblyInstances.find(row => row.instanceId === 'child');
  viewer.setVisibleGeometry(state.visibleGeometry.filter(ref => ref.modelId !== binding.ref.modelId));
  assert.throws(() => api.measureAssemblyPointPair(viewer, [first, second]), /two visible/);
});

test('SDK distance failures are propagated instead of returning an earlier value', () => {
  const { viewer, inspect } = setup();
  const first = api.prepareAssemblyPoint(viewer, inspect('child'));
  const second = api.prepareAssemblyPoint(viewer, inspect('shared_root'));
  assert.ok(Number.isFinite(api.measureAssemblyPointPair(viewer, [first, second])));
  second.query = { kind: 'curve', parameter: Infinity };
  assert.throws(() => api.measureAssemblyPointPair(viewer, [first, second]));
  second.query = { kind: 'curve', parameter: 2 };
  viewer.measureAssemblyPoints = () => { throw new Error('distance failed'); };
  assert.throws(() => api.measureAssemblyPointPair(viewer, [first, second]), /distance failed/);
});

test('removing and readmitting an occurrence does not restore its invalidated endpoint', () => {
  const { viewer, source, inspect } = setup();
  const first = api.prepareAssemblyPoint(viewer, inspect('child'));
  const second = api.prepareAssemblyPoint(viewer, inspect('shared_root'));
  assert.ok(Number.isFinite(api.measureAssemblyPointPair(viewer, [first, second])));

  api.admitSource(viewer, source, ['surface_grandchild', 'shared_root']);
  const retained = api.retainVisibleAssemblyPoints([first, second], viewer.getState());
  assert.deepEqual(retained, [null, second]);
  assert.throws(() => api.measureAssemblyPointPair(viewer, retained), /two visible/);

  api.admitSource(viewer, source, ['child', 'surface_grandchild', 'shared_root']);
  const readmitted = api.retainVisibleAssemblyPoints(retained, viewer.getState());
  assert.deepEqual(readmitted, [null, second]);
  assert.throws(() => api.measureAssemblyPointPair(viewer, readmitted), /two visible/);
  const replacement = api.prepareAssemblyPoint(viewer, inspect('child'));
  assert.ok(Number.isFinite(api.measureAssemblyPointPair(viewer, [replacement, second])));
});

test('a changed reference, world matrix, or assembly revision invalidates the affected endpoint', () => {
  const { viewer, inspect } = setup();
  const first = api.prepareAssemblyPoint(viewer, inspect('child'));
  const second = api.prepareAssemblyPoint(viewer, inspect('shared_root'));
  const baseState = viewer.getState();
  const originalGetState = viewer.getState.bind(viewer);
  for (const [id, mutate] of [
    ['child', binding => { binding.reference.assetRevision++; }],
    ['shared_root', binding => { binding.worldMatrix[3] += 1; }],
    ['child', binding => { binding.assemblyRevision++; }],
  ]) {
    const state = structuredClone(baseState);
    mutate(state.assemblyInstances.find(binding => binding.instanceId === id));
    const retained = api.retainVisibleAssemblyPoints([first, second], state);
    assert.deepEqual(retained, id === 'child' ? [null, second] : [first, null]);
    viewer.getState = () => state;
    assert.throws(() => api.measureAssemblyPointPair(viewer, [first, second]), /two visible/);
    assert.throws(() => api.measureAssemblyPointPair(viewer, retained), /two visible/);
  }
  viewer.getState = originalGetState;
  assert.ok(Number.isFinite(api.measureAssemblyPointPair(viewer, [first, second])));
});
