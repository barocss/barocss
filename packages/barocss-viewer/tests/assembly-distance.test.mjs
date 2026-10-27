import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

// Actual Viewer and CAD assembly source; the presenter is a CPU-only stand-in.
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
const temp = await mkdtemp(tmpdir() + '/viewer-assembly-distance-');
let api;
try {
  await writeFile(temp + '/viewer.mjs', built.outputFiles[0].contents);
  api = await import(pathToFileURL(temp + '/viewer.mjs').href);
} finally { await rm(temp, { recursive: true }); }
const source = await readFile(new URL('examples/gpu-scene/fixtures/assembly-revision0.json', root), 'utf8');
const nextSource = await readFile(new URL('examples/gpu-scene/fixtures/assembly-revision1.json', root), 'utf8');
globalThis.HTMLCanvasElement = class { width = 800; height = 480; };

function setup() {
  const presenter = { drawings: [], show(drawing) { this.drawings.push(structuredClone(drawing)); } };
  const viewer = new api.Viewer(new HTMLCanvasElement(), { mmToSceneUnit: .15, background: [0, 0, 0] }, presenter);
  const load = wire => viewer.loadAssembly(api.parseBaroCadAssembly(wire), { native: { sourceVersion: 0, countU: 3, countV: 3,
    curveDisplay: { version: 1, chordToleranceMM: .02, maxSegments: 512, maxDepth: 16 } },
  basis: 'authored-xyz-matches-rhyup', instanceIds: ['child', 'surface_grandchild', 'shared_root', 'asset_b_instance'] });
  load(source);
  const binding = id => viewer.getState().assemblyInstances.find(item => item.instanceId === id);
  const query = (id, point = { kind: 'curve', parameter: 2 }) => {
    const b = binding(id);
    return { assemblyId: b.assemblyId, assemblyRevision: b.assemblyRevision, instanceId: id,
      reference: b.reference, query: point };
  };
  return { viewer, presenter, query, binding, load };
}

function closeMatrix(actual, expected) {
  assert.equal(actual.length, 16);
  expected.forEach((value, index) => assert.ok(Math.abs(actual[index] - value) < 1e-12,
    `matrix[${index}]: ${actual[index]} differs from ${value}`));
}

const curveReference = { schema: 'barocss-cad-geometry-reference', version: 0,
  documentId: 'part_doc', documentRevision: 1, bodyId: 'curve_a_body', assetId: 'asset_a',
  assetRevision: 1, geometryId: 'shared_curve', geometryKind: 'curve', sourceVersion: 0,
  sourceFrame: 'authored-xyz-no-axis-conversion', lengthUnit: 'mm' };
const surfaceReference = { ...curveReference, bodyId: 'surface_body', geometryId: 'source_surface',
  geometryKind: 'surface' };
const parentMatrix = [0, -1, 0, 10, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const childLocal = [1, 0, 0, 3, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const childWorld = [0, -1, 0, 10, 1, 0, 0, 3, 0, 0, 1, 0, 0, 0, 0, 1];
const sharedMatrix = [1, 0, 0, -5, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

test('point lineage pins independently expected references and placement matrices', () => {
  const { viewer, query } = setup();
  const result = viewer.measureAssemblyPoints(query('child'), query('shared_root'));
  const first = result.first, second = result.second;
  assert.equal(first.assemblyId, 'native_assembly'); assert.equal(first.assemblyRevision, 0);
  assert.equal(first.instanceId, 'child'); assert.deepEqual(first.reference, curveReference);
  assert.equal(second.instanceId, 'shared_root'); assert.deepEqual(second.reference, curveReference);
  assert.deepEqual(first.report.lineage.map(({ instanceId, parentId }) => ({ instanceId, parentId })),
    [{ instanceId: 'parent', parentId: null }, { instanceId: 'child', parentId: 'parent' }]);
  assert.deepEqual(second.report.lineage.map(({ instanceId, parentId }) => ({ instanceId, parentId })),
    [{ instanceId: 'shared_root', parentId: null }]);
  const [parent, child] = first.report.lineage, [root] = second.report.lineage;
  assert.deepEqual(parent.reference, surfaceReference);
  assert.deepEqual(child.reference, curveReference);
  assert.deepEqual(root.reference, curveReference);
  assert.deepEqual(parent.placement, { translationMM: [10, -0, -0], rotationDegreesXYZ: [-0, -0, 90] });
  assert.deepEqual(child.placement, { translationMM: [3, -0, -0], rotationDegreesXYZ: [-0, -0, -0] });
  assert.deepEqual(root.placement, { translationMM: [-5, -0, -0], rotationDegreesXYZ: [-0, -0, -0] });
  closeMatrix(parent.localMatrix, parentMatrix); closeMatrix(parent.worldMatrix, parentMatrix);
  closeMatrix(child.localMatrix, childLocal); closeMatrix(child.worldMatrix, childWorld);
  closeMatrix(first.localMatrix, childLocal); closeMatrix(first.worldMatrix, childWorld);
  closeMatrix(root.localMatrix, sharedMatrix); closeMatrix(root.worldMatrix, sharedMatrix);
  closeMatrix(second.worldMatrix, sharedMatrix);
  const nested = viewer.measureAssemblyPoints(query('surface_grandchild', { kind: 'surface', u: .5, v: .5 }),
    query('child')).first;
  assert.deepEqual(nested.ancestors, ['parent', 'child']);
  assert.deepEqual(nested.report.lineage.map(({ instanceId, parentId }) => ({ instanceId, parentId })),
    [{ instanceId: 'parent', parentId: null }, { instanceId: 'child', parentId: 'parent' },
      { instanceId: 'surface_grandchild', parentId: 'child' }]);
  assert.deepEqual(nested.reference, surfaceReference);
  closeMatrix(nested.worldMatrix, childWorld);
  // Both instances use the same qualified part, but each is pinned to its own placement.
  assert.notDeepEqual(first.worldMatrix, second.worldMatrix);
});

test('actual revision replacement refuses old point queries and retains the new accepted scene', () => {
  const { viewer, presenter, query, load } = setup();
  const oldChild = query('child'), oldShared = query('shared_root');
  const prior = viewer.measureAssemblyPoints(oldChild, oldShared);
  load(nextSource);
  const currentChild = query('child'), currentShared = query('shared_root');
  assert.equal(oldChild.assemblyRevision, 0); assert.equal(currentChild.assemblyRevision, 1);
  assert.deepEqual(oldChild.reference, currentChild.reference);
  const before = viewer.getState(), calls = presenter.drawings.length;
  for (const [first, second] of [[oldChild, currentShared], [currentChild, oldShared], [oldChild, oldShared]]) {
    assert.throws(() => viewer.measureAssemblyPoints(first, second), /revision|STALE/i);
    assert.deepEqual(viewer.getState(), before);
    assert.equal(presenter.drawings.length, calls);
  }
  const next = viewer.measureAssemblyPoints(currentChild, currentShared);
  assert.equal(next.first.assemblyRevision, 1);
  assert.equal(next.second.assemblyRevision, 1);
  assert.ok(Math.abs(prior.first.assemblyPointMM[0] - 10) < 1e-12);
  assert.ok(Math.abs(next.first.assemblyPointMM[0] - 20) < 1e-12);
  assert.ok(Math.abs(next.first.assemblyPointMM[1] - 4) < 1e-12);
  assert.ok(Math.abs(next.distanceMM - Math.sqrt(592)) < 1e-12);
  assert.deepEqual(viewer.getState(), before);
  assert.equal(presenter.drawings.length, calls);
});

test('assembly distance uses original points and parent placement, including shared geometry', () => {
  const { viewer, presenter, query } = setup(), before = viewer.getState(), calls = presenter.drawings.length;
  const a = query('child'), b = query('shared_root');
  const result = viewer.measureAssemblyPoints(a, b);
  assert.equal(result.metric, 'straight-line');
  assert.equal(result.space, 'assembly-space-xyz');
  assert.equal(result.certification, 'not-certified');
  assert.deepEqual(result.first.reference, result.second.reference);
  assert.deepEqual(result.first.ancestors, ['parent']);
  assert.deepEqual(result.second.ancestors, []);
  for (const point of [result.first.originalLocalPointMM, result.second.originalLocalPointMM]) {
    assert.ok(Math.abs(point[0] - 1) < 1e-12);
    assert.ok(Math.abs(point[1]) < 1e-12 && Math.abs(point[2]) < 1e-12);
  }
  for (const [actual, expected] of [[result.first.assemblyPointMM, [10, 4, 0]],
    [result.second.assemblyPointMM, [-4, 0, 0]]]) {
    expected.forEach((value, index) => assert.ok(Math.abs(actual[index] - value) < 1e-12));
  }
  assert.ok(Math.abs(result.distanceMM - Math.sqrt(212)) < 1e-12);
  const swapped = viewer.measureAssemblyPoints(b, a);
  assert.equal(swapped.distanceMM, result.distanceMM);
  assert.equal(swapped.first.instanceId, 'shared_root');
  assert.equal(viewer.measureAssemblyPoints(a, a).distanceMM, 0);
  assert.deepEqual(viewer.getState(), before);
  assert.equal(presenter.drawings.length, calls);
  result.first.assemblyPointMM[0] = 999;
  result.first.reference.geometryId = 'changed';
  assert.deepEqual(viewer.getState(), before);
  assert.ok(Math.abs(viewer.measureAssemblyPoints(a, b).first.assemblyPointMM[0] - 10) < 1e-12);
});

test('assembly distance does not depend on selection or visibility', () => {
  const { viewer, query, binding, presenter } = setup(), a = query('child'), b = query('shared_root');
  const expected = viewer.measureAssemblyPoints(a, b);
  viewer.selectGeometry(binding('child').ref);
  viewer.setVisibleGeometry([binding('surface_grandchild').ref]);
  const before = viewer.getState(), calls = presenter.drawings.length;
  assert.deepEqual(viewer.measureAssemblyPoints(a, b), expected);
  assert.deepEqual(viewer.getState(), before);
  assert.equal(presenter.drawings.length, calls);
});

test('invalid assembly point queries refuse without changing accepted state', () => {
  const { viewer, query, presenter } = setup(), a = query('child'), b = query('shared_root');
  const before = viewer.getState(), calls = presenter.drawings.length;
  const invalid = [
    { ...b, assemblyId: 'other' }, { ...b, assemblyRevision: b.assemblyRevision + 1 },
    { ...b, instanceId: 'parent' }, { ...b, instanceId: 'missing' },
    { ...b, reference: { ...b.reference, assetRevision: b.reference.assetRevision + 1 } },
    { ...b, reference: { ...b.reference, bodyId: 'surface_body' } },
    // Same geometry ID in another real source asset must not substitute for this instance's reference.
    { ...b, reference: query('asset_b_instance').reference },
    { ...b, query: { kind: 'curve', parameter: 99 } },
    { ...b, query: { kind: 'curve', parameter: NaN } },
    { ...b, query: { kind: 'surface', u: .5, v: .5 } },
    { ...b, extra: true }, null,
  ];
  for (const bad of invalid) {
    assert.throws(() => viewer.measureAssemblyPoints(a, bad));
    assert.throws(() => viewer.measureAssemblyPoints(bad, a));
    assert.deepEqual(viewer.getState(), before);
  }
  assert.equal(presenter.drawings.length, calls);
});
