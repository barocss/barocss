import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

// Real Viewer, CAD and Loader code. The presenter records CPU-only drawings.
const root = new URL('../../../', import.meta.url);
const built = await build({ stdin: { contents: `export { Viewer } from './packages/barocss-viewer/src/index.ts';
export { parseBaroCadAssembly } from './packages/barocss-cad-interop/src/assembly.ts';`,
  resolveDir: root.pathname }, bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{ name: 'own-source', setup(builder) {
    builder.onResolve({ filter: /^@barocss\// }, async ({ path }) => {
      const parts = path.split('/'), directory = new URL('packages/barocss-' + parts[1] + '/', root);
      const manifest = JSON.parse(await readFile(new URL('package.json', directory), 'utf8'));
      const entry = manifest.exports[parts.length === 2 ? '.' : './' + parts.slice(2).join('/')];
      return { path: new URL(typeof entry === 'string' ? entry : entry.import, directory).pathname };
    });
  } }] });
const temp = await mkdtemp(tmpdir() + '/viewer-assembly-capacity-');
let api;
try {
  await writeFile(temp + '/viewer.mjs', built.outputFiles[0].contents);
  api = await import(pathToFileURL(temp + '/viewer.mjs').href);
} finally { await rm(temp, { recursive: true }); }
const wire = await readFile(new URL('examples/gpu-scene/fixtures/assembly-revision0.json', root), 'utf8');
const quarter = await readFile(new URL('packages/barocss-cad-interop/examples/curve-only.barocad', root), 'utf8');
globalThis.HTMLCanvasElement = class { width = 800; height = 480; };
const capacity = { version: 1, maximumObjects: 16 };
const native = () => ({ sourceVersion: 0, countU: 8, countV: 8,
  curveDisplay: { version: 1, chordToleranceMM: .02, maxSegments: 512, maxDepth: 16 } });
const ids = ['child', 'surface_grandchild', 'shared_root', 'asset_b_instance'];
const options = (nativeOptions = native(), instanceIds = ids) => ({ native: nativeOptions,
  basis: 'authored-xyz-matches-rhyup', instanceIds });
function setup() {
  const presenter = { drawings: [], show(value) { this.drawings.push(structuredClone(value)); } };
  const viewer = new api.Viewer(new HTMLCanvasElement(), { mmToSceneUnit: .15, background: [0, 0, 0] }, presenter);
  viewer.loadAssembly(api.parseBaroCadAssembly(wire), options());
  return { viewer, presenter };
}
function expandedAssembly(count) {
  const assembly = JSON.parse(wire), document = assembly.parts[0], asset = document.assets.find(row => row.id === 'asset_a');
  const extra = Array.from({ length: count - 2 }, (_, i) =>
    `@curve #extra_${i} {type:nurbs;degree:1;knots:[0,0,1,1];control-points:[[${i},0,0],[${i + 1},1,0]];weights:[1,1];}`).join('\n');
  asset.source = asset.source.replace(/}\s*$/, `${extra}\n}`);
  document.bodies.push({ id: 'extra_body', name: 'extra_body', kind: 'direct-geometry-object',
    assetId: 'asset_a', geometryId: 'extra_0' });
  const occurrence = structuredClone(assembly.instances.find(row => row.id === 'shared_root'));
  occurrence.id = 'extra_instance'; occurrence.reference.bodyId = 'extra_body';
  occurrence.reference.geometryId = 'extra_0';
  assembly.instances.push(occurrence);
  return JSON.stringify(assembly);
}
function denseCurvesAssembly() {
  const assembly = JSON.parse(wire), document = assembly.parts[0];
  const declaration = quarter.match(/@curve[\s\S]*?\n  }/)[0];
  document.assets.find(row => row.id === 'asset_a').source = '@model source_a {version:0;length-unit:mm;\n'
    + Array.from({ length: 16 }, (_, i) => declaration.replace('#weighted_quarter',
      i === 0 ? '#shared_curve' : `#dense_${i}`)).join('\n') + '\n}';
  document.bodies = document.bodies.filter(row => row.id !== 'surface_body');
  assembly.instances = assembly.instances.filter(row => row.reference.bodyId !== 'surface_body');
  assembly.instances.find(row => row.id === 'child').parentId = null;
  return JSON.stringify(assembly);
}

test('explicit capacity keeps the existing four-object assembly result identical', () => {
  const { viewer, presenter } = setup(), before = viewer.getState(), drawing = presenter.drawings.at(-1);
  viewer.loadAssembly(api.parseBaroCadAssembly(wire), options({ ...native(), nativeCapacity: capacity }));
  assert.deepEqual(viewer.getState(), before);
  assert.deepEqual(presenter.drawings.at(-1), drawing);
});

for (const count of [5, 8, 16]) test(`${count} original objects admit up to four assembly instances`, () => {
  const { viewer } = setup(), source = expandedAssembly(count), parsed = api.parseBaroCadAssembly(source);
  const selected = ['child', 'surface_grandchild', 'shared_root', 'extra_instance'];
  assert.equal(parsed.documents[0].compiledAssets.find(asset => asset.assetId === 'asset_a').model.objects.length, count);
  assert.throws(() => viewer.loadAssembly(parsed, options(native(), selected)), /1\.\.4 total native objects/);
  viewer.loadAssembly(parsed, options({ ...native(), nativeCapacity: capacity }, selected));
  const state = viewer.getState();
  assert.deepEqual(state.assemblyInstances.map(row => row.instanceId), selected);
  assert.equal(state.surfaces.length + state.curves.length, 4);
  const binding = state.assemblyInstances.find(row => row.instanceId === 'extra_instance');
  assert.equal(binding.reference.bodyId, 'extra_body');
  const point = viewer.queryAssemblyInstancePoint({ assemblyId: binding.assemblyId,
    assemblyRevision: binding.assemblyRevision, instanceId: binding.instanceId,
    reference: binding.reference, query: { kind: 'curve', parameter: .5 } });
  assert.deepEqual(point.originalLocalPointMM, [.5, .5, 0]);
  const before = viewer.getState();
  assert.throws(() => viewer.loadAssembly(parsed, options({ ...native(), nativeCapacity: capacity },
    [...selected, 'asset_b_instance'])), /1\.\.4/);
  assert.deepEqual(viewer.getState(), before);
});

test('invalid capacity profiles and accessors refuse without changing the accepted scene', () => {
  const { viewer, presenter } = setup(), before = viewer.getState(), calls = presenter.drawings.length;
  let callsToGetter = 0;
  const getter = { maximumObjects: 16, get version() { callsToGetter++; return 1; } };
  const bad = [null, {}, { version: 1 }, { version: 0, maximumObjects: 16 },
    { version: 1, maximumObjects: 4 }, { version: 1, maximumObjects: 16, extra: true }, getter];
  for (const value of bad) {
    assert.throws(() => viewer.loadAssembly(api.parseBaroCadAssembly(wire), options({ ...native(), nativeCapacity: value })));
    assert.deepEqual(viewer.getState(), before);
  }
  const accessor = { ...native() };
  Object.defineProperty(accessor, 'nativeCapacity', { enumerable: true, get() { callsToGetter++; return capacity; } });
  assert.throws(() => viewer.loadAssembly(api.parseBaroCadAssembly(wire), options(accessor)));
  assert.equal(callsToGetter, 0); assert.equal(presenter.drawings.length, calls);
});

test('whole-source Curve sampling budget refusal retains previous assembly and drawing', () => {
  const { viewer, presenter } = setup(), before = viewer.getState(), calls = presenter.drawings.length;
  const source = api.parseBaroCadAssembly(denseCurvesAssembly());
  const request = { ...native(), nativeCapacity: capacity,
    curveDisplay: { version: 1, chordToleranceMM: .0001, maxSegments: 4092, maxDepth: 16 } };
  assert.throws(() => viewer.loadAssembly(source, options(request, ['child'])), /exceeds total sample capacity/);
  assert.deepEqual(viewer.getState(), before); assert.equal(presenter.drawings.length, calls);
});
