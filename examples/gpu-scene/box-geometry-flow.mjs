/** #1359: original size parameters to generic indexed Box geometry.
 * node examples/gpu-scene/box-geometry-flow.mjs --output <fresh-directory>
 * One CPU/source/emitted/declaration/EngineScene/original-file flow. No GL.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2), at = args.indexOf('--output');
assert(at >= 0 && args[at + 1] && !args[at + 1].startsWith('--'), '--output <fresh-directory> required');
const output = resolve(args[at + 1]); await mkdir(output, { recursive: false });
const pkg = resolve(repo, 'packages/barocss-gpu');
const manifest = JSON.parse(await readFile(resolve(pkg, 'package.json'), 'utf8'));
const published = manifest.publishConfig.exports['.'];
assert.equal(published.import, './dist/index.js'); assert.equal(published.types, './dist/index.d.ts');
const ordinary = resolve(output, 'ordinary-source.mjs');
const bundled = await build({ entryPoints: [resolve(pkg, manifest.exports['.'].import)], bundle: true,
  format: 'esm', platform: 'node', target: 'node22', outfile: ordinary, metafile: true });
const graph = Object.keys(bundled.metafile.inputs);
for (const name of ['box-geometry.ts', 'box-geometry-build-internal.ts', 'triangle-geometry.ts', 'engine-scene.ts'])
  assert(graph.some(path => (path.includes('/src/') && path.endsWith('/' + name))), 'Actual public source dependency ' + name);
assert(!graph.some(path => /barocss-(gpu|cad)\/dist\//.test(path)), 'No own emitted fallback in ordinary source');
const providers = [['ordinary-source', await import(pathToFileURL(ordinary).href)],
  ['emitted-public', await import(pathToFileURL(resolve(pkg, published.import)).href)]];
assert.deepEqual(Object.keys(providers[0][1]).sort(), Object.keys(providers[1][1]).sort());
const declarationPath = resolve(pkg, published.types), declaration = await readFile(declarationPath, 'utf8');
for (const name of ['prepareBoxGeometry', 'BoxGeometrySourceV0', 'PreparedBoxGeometry'])
  assert(new RegExp('\\b' + name + '\\b').test(declaration), 'Actual public declaration ' + name);
const leafDeclaration = await readFile(resolve(pkg, 'dist/geometry/box-geometry.d.ts'), 'utf8');
assert(/prepareBoxGeometry\(input:\s*unknown\):\s*PreparedBoxGeometry/.test(leafDeclaration));
assert(/sizeXYZ:\s*\[number, number, number\]/.test(leafDeclaration));

const hash = value => createHash('sha256').update(value).digest('hex');
function originalJSON(value) {
  if (typeof value === 'number') { assert(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(originalJSON).join(',') + ']';
  return '{' + Object.entries(value).map(([name, child]) => JSON.stringify(name) + ':' + originalJSON(child)).join(',') + '}';
}
const clone = value => JSON.parse(originalJSON(value));
const source = (sizeXYZ = [2, 4, 6], id = 'box_authored') => ({ format: 'barocss-gpu-box-geometry', version: 0,
  id, coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', sizeXYZ });
const positions = [
  1, -2, -3, 1, 2, -3, 1, 2, 3, 1, -2, 3,
  -1, -2, 3, -1, 2, 3, -1, 2, -3, -1, -2, -3,
  -1, 2, 3, 1, 2, 3, 1, 2, -3, -1, 2, -3,
  -1, -2, -3, 1, -2, -3, 1, -2, 3, -1, -2, 3,
  -1, -2, 3, 1, -2, 3, 1, 2, 3, -1, 2, 3,
  1, -2, -3, -1, -2, -3, -1, 2, -3, 1, 2, -3,
];
const normals = [
  1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
  -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
  0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
  0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
  0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
  0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
];
const faceUV = [0, 0, 1, 0, 1, 1, 0, 1];
const uvs = [...faceUV, ...faceUV, ...faceUV, ...faceUV, ...faceUV, ...faceUV];
const indices = [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11,
  12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23];
const nonRoundPositions = [
  .15, -.35, -.55, .15, .35, -.55, .15, .35, .55, .15, -.35, .55,
  -.15, -.35, .55, -.15, .35, .55, -.15, .35, -.55, -.15, -.35, -.55,
  -.15, .35, .55, .15, .35, .55, .15, .35, -.55, -.15, .35, -.55,
  -.15, -.35, -.55, .15, -.35, -.55, .15, -.35, .55, -.15, -.35, .55,
  -.15, -.35, .55, .15, -.35, .55, .15, .35, .55, -.15, .35, .55,
  .15, -.35, -.55, -.15, -.35, -.55, -.15, .35, -.55, .15, .35, -.55,
];
function frozen(value) {
  if (value && typeof value === 'object') {
    if (ArrayBuffer.isView(value)) return;
    assert(Object.isFrozen(value)); for (const child of Object.values(value)) frozen(child);
  }
}
function preparedData(value) {
  return { geometry: value.geometry, indexType: value.indexType, vertexCount: value.vertexCount,
    triangleCount: value.triangleCount, bounds: value.bounds, bufferBytes: value.bufferBytes,
    positions: Array.from(value.positions), normals: Array.from(value.normals), uvs: Array.from(value.uvs), indices: Array.from(value.indices) };
}
const bytesHash = array => hash(Buffer.from(array.buffer, array.byteOffset, array.byteLength));
function bufferHashes(value) { return Object.fromEntries(['positions', 'normals', 'uvs', 'indices'].map(name => [name, bytesHash(value[name])])); }
function verify(result, input, expectedPositions, expectedBounds) {
  assert.deepEqual(Object.keys(result).sort(), ['prepared', 'source']);
  assert.deepEqual(Object.keys(result.source).sort(), ['format', 'version', 'id', 'coordinateSystem', 'positionUnit', 'sizeXYZ'].sort());
  assert.deepEqual(result.source, input); input.sizeXYZ.forEach((value, index) => assert(Object.is(result.source.sizeXYZ[index], value)));
  assert.notStrictEqual(result.source, input); assert.notStrictEqual(result.source.sizeXYZ, input.sizeXYZ);
  assert.equal(result.prepared.geometry.format, 'barocss-gpu-triangle-geometry');
  assert.equal(result.prepared.geometry.version, 0); assert.equal(result.prepared.geometry.id, input.id);
  assert.equal(result.prepared.geometry.coordinateSystem, 'right-handed-y-up');
  assert.equal(result.prepared.geometry.positionUnit, 'scene'); assert.equal(result.prepared.geometry.winding, 'ccw');
  assert.deepEqual(result.prepared.geometry.positions, expectedPositions);
  assert.deepEqual(result.prepared.geometry.normals, normals); assert.deepEqual(result.prepared.geometry.uvs, uvs);
  assert.deepEqual(result.prepared.geometry.indices, indices); assert.deepEqual(result.prepared.bounds, expectedBounds);
  assert.equal(result.prepared.vertexCount, 24); assert.equal(result.prepared.triangleCount, 12);
  assert.equal(result.prepared.indexType, 'uint16'); assert.equal(result.prepared.bufferBytes, 840);
  assert(result.prepared.positions instanceof Float32Array && result.prepared.normals instanceof Float32Array && result.prepared.uvs instanceof Float32Array);
  assert(result.prepared.indices instanceof Uint16Array);
  assert.deepEqual(Array.from(result.prepared.positions), expectedPositions.map(Math.fround));
  assert.deepEqual(Array.from(result.prepared.normals), normals); assert.deepEqual(Array.from(result.prepared.uvs), uvs);
  assert.deepEqual(Array.from(result.prepared.indices), indices);
  assert.equal(expectedPositions.length + normals.length + uvs.length + indices.length, 228);
  frozen(result);
}
function nearBounds(actual, expected) {
  for (const key of ['min', 'max']) actual[key].forEach((value, axis) => assert(Math.abs(value - expected[key][axis]) <= 1e-12));
}
const inputCases = [
  { name: 'all_literal_corners_faces_uv_indices', input: source(), expectedPositions: positions, expectedBounds: { min: [-1, -2, -3], max: [1, 2, 3] } },
  { name: 'original_non_round_sizes_before_float32', input: source([.3, .7, 1.1], 'box_nonround'), expectedPositions: nonRoundPositions, expectedBounds: { min: [-.15, -.35, -.55], max: [.15, .35, .55] } },
];
let accepted = 0, refused = 0, getters = 0, reflections = 0, oversizeEnumeration = 0;
const results = [], failures = [];
try {
  for (const [provider, gpu] of providers) {
    assert.equal(typeof gpu.prepareBoxGeometry, 'function'); assert.equal(typeof gpu.prepareEngineScene, 'function');
    assert.equal(typeof gpu.TriangleGeometryError, 'function');
    const records = []; let previous;
    for (const fixture of inputCases) {
      const input = clone(fixture.input), before = originalJSON(input), result = gpu.prepareBoxGeometry(input);
      verify(result, input, fixture.expectedPositions, fixture.expectedBounds); assert.equal(originalJSON(input), before);
      if (fixture.name === 'original_non_round_sizes_before_float32') {
        assert(Object.is(result.prepared.geometry.positions[0], .15));
        assert.notEqual(result.prepared.positions[0], .15, 'Original non-round half must not be replaced by executed Float32');
      }
      const repeated = gpu.prepareBoxGeometry(input); verify(repeated, input, fixture.expectedPositions, fixture.expectedBounds);
      assert.notStrictEqual(repeated.source.sizeXYZ, result.source.sizeXYZ);
      assert.notStrictEqual(repeated.prepared.geometry.positions, result.prepared.geometry.positions);
      assert.notStrictEqual(repeated.prepared.positions, result.prepared.positions);
      const stem = provider + '.' + fixture.name;
      const sourcePath = resolve(output, stem + '.source.json'), geometryPath = resolve(output, stem + '.geometry.json'), preparedPath = resolve(output, stem + '.prepared.json');
      await writeFile(sourcePath, originalJSON(input) + '\n'); await writeFile(geometryPath, originalJSON(result.prepared.geometry) + '\n');
      await writeFile(preparedPath, originalJSON(preparedData(result.prepared)) + '\n');
      const coldSource = JSON.parse(await readFile(sourcePath, 'utf8')), cold = gpu.prepareBoxGeometry(coldSource);
      verify(cold, coldSource, fixture.expectedPositions, fixture.expectedBounds);
      assert.deepEqual(JSON.parse(await readFile(geometryPath, 'utf8')), cold.prepared.geometry);
      assert.deepEqual(JSON.parse(await readFile(preparedPath, 'utf8')), preparedData(cold.prepared));
      assert.deepEqual(bufferHashes(cold.prepared), bufferHashes(result.prepared));
      const savedSource = originalJSON(result.source), savedGeometry = originalJSON(result.prepared.geometry), repeatedBuffers = bufferHashes(repeated.prepared);
      input.sizeXYZ[0] = 999; input.id = 'caller_changed';
      assert.equal(originalJSON(result.source), savedSource); assert.equal(originalJSON(result.prepared.geometry), savedGeometry);
      for (const [name, replacement] of [['positions', 123], ['normals', .125], ['uvs', .75], ['indices', 7]]) {
        const value = result.prepared[name][0]; result.prepared[name][0] = replacement;
        assert.equal(result.prepared[name][0], replacement, 'Execution buffer must be independently mutable');
        assert.equal(originalJSON(result.prepared.geometry), savedGeometry); assert.deepEqual(bufferHashes(repeated.prepared), repeatedBuffers);
        result.prepared[name][0] = value;
      }
      records.push({ name: fixture.name, source: result.source, geometry: result.prepared.geometry, bounds: result.prepared.bounds,
        counts: { vertices: 24, triangles: 12, numericValues: 228, bytes: result.prepared.bufferBytes }, buffers: bufferHashes(result.prepared), files: [sourcePath, geometryPath, preparedPath] });
      if (!previous) previous = { result, sourceText: savedSource, geometryText: savedGeometry, buffers: bufferHashes(result.prepared), files: [sourcePath, geometryPath, preparedPath] };
      accepted++;
    }
    const first = previous.result;
    const editedSource = source([4, 2, 8]), edited = gpu.prepareBoxGeometry(editedSource);
    assert.deepEqual(edited.source.sizeXYZ, [4, 2, 8]); assert.deepEqual(edited.prepared.bounds, { min: [-2, -1, -4], max: [2, 1, 4] });
    assert.equal(edited.prepared.geometry.id, first.prepared.geometry.id); assert.notDeepEqual(edited.prepared.geometry.positions, first.prepared.geometry.positions);
    assert.equal(originalJSON(first.source), previous.sourceText); accepted++;
    const maximum = gpu.prepareBoxGeometry(source([2000, 2000, 2000], 'box_maximum'));
    assert.deepEqual(maximum.prepared.bounds, { min: [-1000, -1000, -1000], max: [1000, 1000, 1000] });
    assert.equal(maximum.prepared.bufferBytes, 840); assert.equal(Math.max(...maximum.prepared.positions), 1000); accepted++;
    const nullableRoot = Object.assign(Object.create(null), source([2, 4, 6], 'box_null_record'));
    const nullResult = gpu.prepareBoxGeometry(nullableRoot); assert.deepEqual(nullResult.source.sizeXYZ, [2, 4, 6]); accepted++;

    const sceneInput = { format: 'barocss-gpu-engine-scene', version: 0, id: 'two_box_instances', coordinateSystem: 'right-handed-y-up', positionUnit: 'scene',
      background: [.02, .04, .06], camera: { eye: [9, 8, 16], target: [0, 0, 0], up: [0, 1, 0], fovY: 45, near: .1, far: 100 },
      geometries: [first.prepared.geometry], materials: [{ id: 'box_material', type: 'unlit', colorSpace: 'linear', color: [.25, .5, .75] }],
      nodes: [
        { id: 'left_box', type: 'mesh', parentId: null, geometryId: 'box_authored', materialId: 'box_material', translation: [-5, 0, 0], rotationXYZW: [0, 0, 0, 1], scale: [1, 1, 1], visible: true },
        { id: 'right_box', type: 'mesh', parentId: null, geometryId: 'box_authored', materialId: 'box_material', translation: [5, 1, -2], rotationXYZW: [0, 0, Math.SQRT1_2, Math.SQRT1_2], scale: [2, .5, 1], visible: true },
      ] };
    const originalSceneText = originalJSON(sceneInput), scene = gpu.prepareEngineScene(sceneInput);
    assert.equal(originalJSON(sceneInput), originalSceneText); assert.equal(scene.geometries.length, 1); assert.equal(scene.draws.length, 2);
    assert.equal(scene.bufferBytes, 840); assert.equal(scene.vertexWork, 48);
    assert.strictEqual(scene.draws[0].geometry, scene.draws[1].geometry);
    assert.notStrictEqual(scene.geometries[0].positions, first.prepared.positions);
    nearBounds(scene.nodes.find(node => node.id === 'left_box').bounds, { min: [-6, -2, -3], max: [-4, 2, 3] });
    // Scale gives half extents [2,1,3]; Z90 swaps X/Y before T=[5,1,-2].
    nearBounds(scene.nodes.find(node => node.id === 'right_box').bounds, { min: [4, -1, -5], max: [6, 3, 1] });
    const scenePath = resolve(output, provider + '.two-box.original-scene.json'); await writeFile(scenePath, originalSceneText + '\n');
    const coldScene = gpu.prepareEngineScene(JSON.parse(await readFile(scenePath, 'utf8')));
    assert.deepEqual(coldScene.scene, scene.scene); assert.deepEqual(coldScene.nodes.map(node => node.bounds), scene.nodes.map(node => node.bounds));
    assert.deepEqual(bufferHashes(coldScene.geometries[0]), bufferHashes(scene.geometries[0]));
    assert.notStrictEqual(coldScene.geometries[0].positions, scene.geometries[0].positions); accepted++;

    const refusals = [], oldFileHashes = await Promise.all(previous.files.map(async path => ({ path, sha256: hash(await readFile(path)) })));
    function reject(name, input, code, inspect) {
      let error; try { gpu.prepareBoxGeometry(input); } catch (cause) { error = cause; }
      assert(error instanceof gpu.TriangleGeometryError, name + ': existing public error'); assert.equal(error.code, code, name);
      inspect?.(error); assert.equal(originalJSON(first.source), previous.sourceText);
      assert.equal(originalJSON(first.prepared.geometry), previous.geometryText); assert.deepEqual(bufferHashes(first.prepared), previous.buffers);
      assert.equal(originalJSON(sceneInput), originalSceneText);
      refused++; refusals.push({ name, code: error.code, message: error.message, cause: error.cause instanceof Error ? { name: error.cause.name, message: error.cause.message } : null });
    }
    reject('wrong geometry discriminator', { ...source(), format: 'box' }, 'VERSION');
    reject('wrong version', { ...source(), version: 1 }, 'VERSION');
    reject('wrong coordinate frame', { ...source(), coordinateSystem: 'z-up' }, 'VERSION');
    reject('wrong position unit', { ...source(), positionUnit: 'mm' }, 'VERSION');
    reject('extra center field', { ...source(), center: [0, 0, 0] }, 'INPUT');
    const missing = source(); delete missing.sizeXYZ; reject('missing size field', missing, 'INPUT');
    reject('invalid ID', source([2, 4, 6], '9bad'), 'INPUT');
    reject('overlong ID', source([2, 4, 6], 'b'.repeat(65)), 'INPUT');
    reject('size is not array', { ...source(), sizeXYZ: '2 4 6' }, 'INPUT');
    reject('short size array', source([2, 4]), 'GEOMETRY');
    reject('oversized size array', source([2, 4, 6, 8]), 'BUDGET');
    const oversized = new Proxy([2, 4, 6, 8], { ownKeys() { oversizeEnumeration++; throw new Error('Oversized size array must not be enumerated'); } });
    reject('array budget before enumeration', source(oversized), 'BUDGET'); assert.equal(oversizeEnumeration, 0);
    const sparse = [2, 4, 6]; delete sparse[1]; reject('sparse size array', source(sparse), 'INPUT');
    const extraArray = [2, 4, 6]; extraArray.extra = 1; reject('extra size array property', source(extraArray), 'INPUT');
    const foreignArray = [2, 4, 6]; Object.setPrototypeOf(foreignArray, null); reject('foreign size array prototype', source(foreignArray), 'INPUT');
    reject('non-number size', source([2, '4', 6]), 'INPUT');
    reject('nonfinite size', source([2, Infinity, 6]), 'INPUT');
    reject('zero size', source([0, 4, 6]), 'GEOMETRY');
    reject('negative zero size', source([-0, 4, 6]), 'GEOMETRY');
    reject('negative size', source([-2, 4, 6]), 'GEOMETRY');
    reject('above maximum size', source([2000.00001, 4, 6]), 'GEOMETRY');
    reject('actual original half-size underflow', source([Number.MIN_VALUE, 4, 6]), 'GEOMETRY', error => assert(error.cause instanceof RangeError));
    reject('actual nonzero Float32 underflow', source([1e-50, 4, 6]), 'REPRESENTATION');
    const rootGetter = source(); Object.defineProperty(rootGetter, 'sizeXYZ', { enumerable: true, get() { getters++; return [2, 4, 6]; } });
    reject('root getter never invoked', rootGetter, 'INPUT');
    const elementGetter = [2, 4, 6]; Object.defineProperty(elementGetter, '1', { enumerable: true, get() { getters++; return 4; } });
    reject('array getter never invoked', source(elementGetter), 'INPUT');
    const hidden = source(); Object.defineProperty(hidden, 'id', { enumerable: false, value: 'box_hidden' }); reject('hidden root field', hidden, 'INPUT');
    const symbol = source(); symbol[Symbol('unexpected')] = 1; reject('symbol root field', symbol, 'INPUT');
    reject('foreign root prototype', Object.assign(Object.create({ inherited: true }), source()), 'INPUT');
    const rootMarker = new Error('Actual Box root reflection exception');
    reject('actual root reflection cause', new Proxy(source(), { getPrototypeOf() { reflections++; throw rootMarker; } }), 'INPUT', error => assert.strictEqual(error.cause, rootMarker));
    const arrayMarker = new Error('Actual Box size reflection exception');
    const reflectedArray = new Proxy([2, 4, 6], { getOwnPropertyDescriptor() { reflections++; throw arrayMarker; } });
    reject('actual array reflection cause', source(reflectedArray), 'INPUT', error => assert.strictEqual(error.cause, arrayMarker));
    assert.equal(getters, 0);
    for (const old of oldFileHashes) assert.equal(hash(await readFile(old.path)), old.sha256);
    results.push({ provider, publicRuntimeCount: Object.keys(gpu).length, records,
      edited: { source: edited.source, bounds: edited.prepared.bounds }, maximum: { source: maximum.source, bounds: maximum.prepared.bounds },
      scene: { originalFile: scenePath, geometries: 1, meshInstances: 2, vertexWork: scene.vertexWork, bytes: scene.bufferBytes, worldBounds: scene.nodes.map(node => ({ id: node.id, bounds: node.bounds })), bufferHashes: bufferHashes(scene.geometries[0]) }, refusals, retainedFiles: oldFileHashes });
  }
  assert.deepEqual(results[0].records.map(record => ({ name: record.name, source: record.source, geometry: record.geometry, bounds: record.bounds, buffers: record.buffers })), results[1].records.map(record => ({ name: record.name, source: record.source, geometry: record.geometry, bounds: record.bounds, buffers: record.buffers })));
  assert.deepEqual(results[0].scene.worldBounds, results[1].scene.worldBounds);
} catch (error) { failures.push(String(error.stack ?? error)); throw error; }
finally {
  const report = { issue: 1359, parent: 'de93ee6e8747fe21a43bafed4ac0eea625484a1f', head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
    accepted, refused, getters, reflections, oversizeEnumeration, results, failures, ordinarySourceGraph: graph,
    emitted: { path: resolve(pkg, published.import), sha256: hash(await readFile(resolve(pkg, published.import))), declarationPath, declarationSHA256: hash(declaration), leafDeclarationSHA256: hash(leafDeclaration) },
    actualGL: false, nativeCAD: false, source1Picking: false, publicCodec: false,
    limits: ['Generic authored origin-centred indexed Box geometry only; no CAD topology/source or implicit SDF authority.', 'Original Number parameters and generated attributes stay separate from mutable Float32/Uint16 execution buffers.', 'Two EngineScene instances are CPU source/world bounds and shared-resource admission, not rendering or pixels.', 'Private original JSON is evidence only; no public serializer or file schema is added.', 'No old normal-generator/geometry campaign, performance, currentRoot or publication qualification.'] };
  await writeFile(resolve(output, 'actual-result.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ issue: 1359, accepted, refused, getters, reflections, oversizeEnumeration, runtimeExports: Object.keys(providers[0][1]).length, actualGL: false, failures }));
}
