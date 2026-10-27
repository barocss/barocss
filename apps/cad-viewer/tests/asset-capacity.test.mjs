import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = new URL('../../../', import.meta.url);
const built = await build({ stdin: { contents: `export { Viewer } from './packages/barocss-viewer/src/index.ts';
export { parseSource, admitSource } from './apps/cad-viewer/source.js';
export { inspectDocumentPoint } from './apps/cad-viewer/native-inspection.js';
export { loadOptions } from './apps/cad-viewer/document.js';
export { assemblyLoadOptions } from './apps/cad-viewer/assembly.js';`, resolveDir: root.pathname },
bundle: true, platform: 'node', format: 'esm', write: false, plugins: [{ name: 'own-source', setup(builder) {
  builder.onResolve({ filter: /^@barocss\// }, async ({ path }) => {
    const parts = path.split('/'), directory = new URL('packages/barocss-' + parts[1] + '/', root);
    const manifest = JSON.parse(await readFile(new URL('package.json', directory), 'utf8'));
    const entry = manifest.exports[parts.length === 2 ? '.' : './' + parts.slice(2).join('/')];
    return { path: new URL(typeof entry === 'string' ? entry : entry.import, directory).pathname };
  });
} }] });
const temp = await mkdtemp(tmpdir() + '/cad-viewer-asset-capacity-');
let api;
try { await writeFile(temp + '/test.mjs', built.outputFiles[0].contents); api = await import(pathToFileURL(temp + '/test.mjs').href); }
finally { await rm(temp, { recursive: true }); }
const sources = {
  assembly: JSON.parse(await readFile(new URL('examples/gpu-scene/fixtures/assembly-revision0.json', root), 'utf8')),
  document: JSON.parse(await readFile(new URL('packages/barocss-cad-interop/examples/document-gpu-v2.cad-document.json', root), 'utf8')),
};
globalThis.HTMLCanvasElement = class {
  width = 800; height = 480;
  getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 480 }; }
};
function sourceWithCount(kind, count, linkExtra = false) {
  const value = structuredClone(sources[kind]);
  const asset = kind === 'assembly' ? value.parts[0].assets[0] : value.assets[0];
  const base = kind === 'assembly' ? 2 : 3;
  const extra = Array.from({ length: count - base }, (_, i) =>
    ` @curve #extra_${i} { type:nurbs; degree:1; knots:[0,0,1,1]; control-points:[[0,0,0],[1,0,0]]; weights:[1,1]; }`).join('\n');
  asset.source = asset.source.replace(/\n}\n$/, '\n' + extra + '\n}\n');
  if (linkExtra) {
    const geometryId = `extra_${count - base - 1}`;
    const body = { id: 'added_body', name: 'Added body', kind: 'direct-geometry-object', assetId: asset.id, geometryId };
    if (kind === 'document') value.bodies.push(body);
    else {
      value.parts[0].bodies.push(body);
      const instance = structuredClone(value.instances.find(row => row.id === 'child'));
      instance.id = 'added_instance'; instance.reference.bodyId = body.id; instance.reference.geometryId = geometryId;
      value.instances.push(instance);
    }
  }
  return JSON.stringify(value);
}
function viewer() {
  const presenter = { drawings: [], show(drawing) { this.drawings.push(drawing); } };
  return { viewer: new api.Viewer(new HTMLCanvasElement(), { mmToSceneUnit: .15, background: [0, 0, 0] }, presenter), presenter };
}

test('app options opt in to the 16-object profile while keeping the four-item display limit', () => {
  const doc = api.loadOptions(['body_0_curve']), assembly = api.assemblyLoadOptions(['child']);
  assert.deepEqual(doc.native.nativeCapacity, { version: 1, maximumObjects: 16 });
  assert.deepEqual(assembly.native.nativeCapacity, { version: 1, maximumObjects: 16 });
  for (const get of [api.loadOptions, api.assemblyLoadOptions]) {
    assert.throws(() => get(['a', 'b', 'c', 'd', 'e']), /1 to 4/);
  }
});

for (const kind of ['document', 'assembly']) {
  test(`${kind} original assets of 4, 5, 8 and 16 objects admit selected native objects`, () => {
    for (const count of [4, 5, 8, 16]) {
      const source = api.parseSource(sourceWithCount(kind, count));
      const id = kind === 'assembly' ? 'child' : 'body_0_curve';
      assert.equal(source.catalog.find(row => row.id === id).supported, true);
      const { viewer: instance } = viewer();
      const selection = kind === 'assembly' ? ['child', 'surface_grandchild', 'shared_root', 'asset_b_instance']
        : ['body_0_curve', 'body_0_surface', 'body_0_skip', 'body_1_surface'];
      api.admitSource(instance, source, selection);
      const state = instance.getState();
      assert.equal(kind === 'assembly' ? state.assemblyInstances.length : state.documentBodies.length, 4);
    }
  });

  test(`${kind} selects and queries an added original Curve at 5, 8 and 16 objects`, () => {
    for (const count of [5, 8, 16]) {
      const source = api.parseSource(sourceWithCount(kind, count, true));
      const id = kind === 'document' ? 'added_body' : 'added_instance';
      const expectedGeometry = `extra_${count - (kind === 'document' ? 3 : 2) - 1}`;
      const catalog = source.catalog.find(row => row.id === id);
      assert.equal(catalog.supported, true); assert.equal(catalog.geometryId, expectedGeometry);
      const { viewer: instance } = viewer();
      api.admitSource(instance, source, [id]);
      const state = instance.getState();
      const binding = kind === 'document' ? state.documentBodies[0] : state.assemblyInstances[0];
      assert.equal(binding.ref.curveId, expectedGeometry);
      instance.selectGeometry(binding.ref);
      const result = kind === 'document'
        ? api.inspectDocumentPoint(source, instance.getState(), { kind: 'curve', parameter: 0.5 }).pointMM
        : instance.queryAssemblyInstancePoint({ assemblyId: binding.assemblyId, assemblyRevision: binding.assemblyRevision,
          instanceId: binding.instanceId, reference: binding.reference, query: { kind: 'curve', parameter: 0.5 } }).originalLocalPointMM;
      assert.deepEqual(result, [0.5, 0, 0]);
    }
  });

  test(`${kind} over-capacity or over-selection refuses without replacing the accepted scene`, () => {
    const { viewer: instance, presenter } = viewer();
    const valid = api.parseSource(sourceWithCount(kind, kind === 'assembly' ? 2 : 3));
    const ids = kind === 'assembly' ? ['child'] : ['body_0_curve'];
    api.admitSource(instance, valid, ids);
    const before = instance.getState(), review = instance.captureReviewState(), draws = presenter.drawings.length;
    // The source codec rejects 17 objects before catalog or Viewer admission.
    assert.throws(() => api.parseSource(sourceWithCount(kind, 17)), /source0 compilation refused/);
    assert.throws(() => api.admitSource(instance, valid, ['a', 'b', 'c', 'd', 'e']), /1 to 4/);
    assert.deepEqual(instance.getState(), before);
    assert.deepEqual(instance.captureReviewState(), review);
    assert.equal(presenter.drawings.length, draws);
  });
}
