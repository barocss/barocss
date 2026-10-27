import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

// Actual public assembly parsing and parameter domains. This creates no renderer.
const root = new URL('../../../', import.meta.url);
const built = await build({ stdin: { contents: `export { parseAssembly, assemblyLoadOptions } from './apps/cad-viewer/assembly.js';`,
  resolveDir: root.pathname }, bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{ name: 'own-source', setup(builder) {
    builder.onResolve({ filter: /^@barocss\// }, async ({ path }) => {
      const parts = path.split('/'), directory = new URL('packages/barocss-' + parts[1] + '/', root);
      const manifest = JSON.parse(await readFile(new URL('package.json', directory), 'utf8'));
      const entry = manifest.exports[parts.length === 2 ? '.' : './' + parts.slice(2).join('/')];
      return { path: new URL(typeof entry === 'string' ? entry : entry.import, directory).pathname };
    });
  } }] });
const temp = await mkdtemp(tmpdir() + '/cad-viewer-assembly-test-');
let api;
try {
  await writeFile(temp + '/assembly.mjs', built.outputFiles[0].contents);
  api = await import(pathToFileURL(temp + '/assembly.mjs').href);
} finally { await rm(temp, { recursive: true }); }
const wire = await readFile(new URL('examples/gpu-scene/fixtures/assembly-revision0.json', root), 'utf8');
const original = () => JSON.parse(wire);

test('assembly parser retains complete source identity, original occurrence order and hierarchy', () => {
  const parsed = api.parseAssembly(wire, 'Original assembly.json'), authored = original();
  assert.equal(parsed.kind, 'assembly'); assert.equal(parsed.label, 'Original assembly.json');
  assert.equal(parsed.id, authored.assemblyId); assert.equal(parsed.revision, authored.revision);
  assert.equal(parsed.source, parsed.result.assembly);
  assert.deepEqual(parsed.source, authored);
  assert.deepEqual(parsed.catalog.map(row => row.id), authored.instances.map(row => row.id));
  assert.deepEqual(parsed.defaultBodyIds, ['child', 'surface_grandchild', 'shared_root', 'asset_b_instance']);
  assert.ok(parsed.catalog.every(row => row.supported));
  assert.equal(Object.is(parsed.source.instances[0].placement.translationMM[1], -0), true);
  for (const row of parsed.catalog) {
    const evaluated = parsed.result.instances.find(instance => instance.instanceId === row.id);
    assert.equal(row.name, row.id);
    assert.deepEqual(row.reference, evaluated.reference);
    assert.deepEqual(row.localMatrix, evaluated.localMatrix);
    assert.deepEqual(row.worldMatrix, evaluated.worldMatrix);
    assert.deepEqual(row.ancestors, evaluated.ancestors);
    assert.equal(row.parentId, evaluated.parentId);
  }
  assert.deepEqual(parsed.catalog.find(row => row.id === 'surface_grandchild').ancestors, ['parent', 'child']);
  parsed.catalog[0].reference.assetId = 'changed'; parsed.catalog[0].worldMatrix[3] = 123;
  assert.deepEqual(parsed.source, authored);
  assert.notEqual(parsed.result.instances[0].reference.assetId, 'changed');
  assert.notEqual(parsed.result.instances[0].worldMatrix[3], 123);
});

test('repeated original geometry remains separate occurrences with original native query domains', () => {
  const parsed = api.parseAssembly(wire);
  const child = parsed.catalog.find(row => row.id === 'child');
  const shared = parsed.catalog.find(row => row.id === 'shared_root');
  const other = parsed.catalog.find(row => row.id === 'asset_b_instance');
  assert.equal(child.geometryId, shared.geometryId); assert.equal(child.geometryId, other.geometryId);
  assert.notEqual(child.id, shared.id); assert.notEqual(child.assetId, other.assetId);
  assert.notDeepEqual(child.worldMatrix, shared.worldMatrix);
  assert.deepEqual(child.nativeDomain, { kind: 'curve', parameter: [-3, 7] });
  assert.deepEqual(child.nativeQuery, { kind: 'curve', parameter: 2 });
  const surface = parsed.catalog.find(row => row.id === 'surface_grandchild');
  assert.deepEqual(surface.nativeDomain, { kind: 'surface', u: [0, 1], v: [0, 1] });
  assert.deepEqual(surface.nativeQuery, { kind: 'surface', u: .5, v: .5 });
  assert.equal(parsed.result.documents[0].document.assets[0].source, original().parts[0].assets[0].source);
});

test('ordinary files select the first four supported occurrences without deduplicating shared parts', () => {
  const authored = original(), ids = new Map(authored.instances.map((row, index) => [row.id, 'node_' + index]));
  for (const row of authored.instances) { row.id = ids.get(row.id); if (row.parentId) row.parentId = ids.get(row.parentId); }
  const parsed = api.parseAssembly(JSON.stringify(authored), '  ');
  assert.equal(parsed.label, 'CAD assembly');
  assert.deepEqual(parsed.defaultBodyIds, ['node_0', 'node_1', 'node_2', 'node_3']);
});

test('out-of-display world translations remain metadata and do not enter the default selection', () => {
  const authored = original();
  const parent = authored.instances.find(row => row.id === 'parent');
  parent.placement.translationMM = [9000, 0, 0]; parent.placement.rotationDegreesXYZ = [0, 0, 0];
  authored.instances.find(row => row.id === 'child').placement.translationMM = [3000, 0, 0];
  const parsed = api.parseAssembly(JSON.stringify(authored));
  assert.equal(parsed.catalog.length, authored.instances.length);
  for (const id of ['child', 'surface_grandchild']) {
    const row = parsed.catalog.find(row => row.id === id);
    assert.equal(row.worldMatrix[3], 12000); assert.equal(row.supported, false);
    assert.match(row.reason, /10000 mm display limit/);
    assert.equal(parsed.defaultBodyIds.includes(id), false);
  }
  assert.equal(parsed.catalog.find(row => row.id === 'parent').supported, true);
});

test('source assets above the 16 object budget are refused by the source codec', () => {
  const authored = original(), asset = authored.parts[0].assets[0];
  const extras = Array.from({ length: 15 }, (_, index) => ` @curve #extra_${index} { type:nurbs; degree:1; knots:[0,0,1,1]; control-points:[[0,0,0],[1,0,0]]; weights:[1,1]; }`).join('\n');
  asset.source = asset.source.replace(/\n}\n$/, '\n' + extras + '\n}\n');
  assert.throws(() => api.parseAssembly(JSON.stringify(authored)), /source0 compilation refused/);
});

test('input size, duplicate JSON fields and invalid assembly authority refuse before any app state exists', () => {
  const limit = 2 * 1024 * 1024;
  for (const input of [null, {}, 5]) assert.throws(() => api.parseAssembly(input), /text is required/);
  assert.throws(() => api.parseAssembly(' '.repeat(limit + 1)), /2 MiB/);
  assert.throws(() => api.parseAssembly('한'.repeat(Math.ceil(limit / 3))), /2 MiB/);
  assert.throws(() => api.parseAssembly('{broken'));
  assert.throws(() => api.parseAssembly(wire.replace('"assemblyId":"native_assembly"',
    '"assemblyId":"native_assembly","assemblyId":"other"')));
  const stale = original(); stale.instances[0].reference.assetRevision++;
  assert.throws(() => api.parseAssembly(JSON.stringify(stale)));
  const cyclic = original(); cyclic.instances.find(row => row.id === 'parent').parentId = 'child';
  assert.throws(() => api.parseAssembly(JSON.stringify(cyclic)));
});

test('assembly load options have exact public fields and copy a dense unique 1–4 instance choice', () => {
  const ids = ['child', 'surface_grandchild'], options = api.assemblyLoadOptions(ids);
  assert.deepEqual(options, { native: { sourceVersion: 0, countU: 8, countV: 8,
    nativeCapacity: { version: 1, maximumObjects: 16 },
    curveDisplay: { version: 1, chordToleranceMM: .02, maxSegments: 512, maxDepth: 16 } },
  basis: 'authored-xyz-matches-rhyup', instanceIds: ids });
  assert.equal(Object.hasOwn(options.native, 'unitsPerMillimeter'), false);
  ids[0] = 'changed'; assert.equal(options.instanceIds[0], 'child');
  options.native.curveDisplay.maxDepth = 1;
  assert.equal(api.assemblyLoadOptions(['child']).native.curveDisplay.maxDepth, 16);
  let getters = 0;
  const getter = Object.defineProperty(['child'], '0', { enumerable: true,
    get() { getters++; throw Error('getter must not run'); } });
  const invalid = [null, {}, [], new Array(1), ['child', 'child'], ['bad/id'], ['1bad'], ['x'.repeat(49)],
    ['a', 'b', 'c', 'd', 'e'], [1], Object.assign(['child'], { extra: true }), getter,
    Object.assign(['child'], { [Symbol('extra')]: true }), new Proxy(['child'], {})];
  for (const input of invalid) assert.throws(() => api.assemblyLoadOptions(input));
  assert.equal(getters, 0);
});
