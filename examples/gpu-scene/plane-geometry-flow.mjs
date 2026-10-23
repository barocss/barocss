/** #1376: bounded original indexed Plane parameters, geometry and EngineScene.
 * node examples/gpu-scene/plane-geometry-flow.mjs --output <fresh-directory>
 * Root runs this one qualifier. No browser, DOM, GL or parent campaigns.
 */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2), at = args.indexOf('--output');
assert(at >= 0 && args[at + 1] && !args[at + 1].startsWith('--'), '--output <fresh-directory> required');
const output = resolve(args[at + 1]); await mkdir(output, { recursive: false });
const pkg = resolve(repo, 'packages/barocss-gpu'), manifest = JSON.parse(await readFile(resolve(pkg, 'package.json'), 'utf8'));
const published = manifest.publishConfig.exports['.'];
assert.equal(published.import, './dist/index.js'); assert.equal(published.types, './dist/index.d.ts');
const ordinary = resolve(output, 'ordinary-source.mjs');
const bundle = await build({ entryPoints: [resolve(pkg, manifest.exports['.'].import)], bundle: true,
  format: 'esm', platform: 'node', target: 'node22', outfile: ordinary, metafile: true });
const graph = Object.keys(bundle.metafile.inputs);
for (const name of ['plane-geometry.ts', 'plane-geometry-build-internal.ts', 'triangle-geometry.ts', 'engine-scene.ts', 'engine-raycast.ts'])
  assert(graph.some(path => (path.includes('/src/') && path.endsWith('/' + name))), 'Actual public source dependency ' + name);
assert(!graph.some(path => /barocss-(gpu|cad)\/dist\//.test(path)), 'No own emitted fallback in ordinary source');
const providers = [['ordinary-source', ordinary, await import(pathToFileURL(ordinary).href)],
  ['emitted-public', resolve(pkg, published.import), await import(pathToFileURL(resolve(pkg, published.import)).href)]];
assert.deepEqual(Object.keys(providers[0][2]).sort(), Object.keys(providers[1][2]).sort());
const declarationsPath = resolve(pkg, published.types), declarations = await readFile(declarationsPath, 'utf8');
for (const name of ['preparePlaneGeometry', 'PlaneGeometrySourceV0', 'PreparedPlaneGeometry']) assert(new RegExp('\\b' + name + '\\b').test(declarations));
const leafDeclarations = await readFile(resolve(pkg, 'dist/plane-geometry.d.ts'), 'utf8');
assert(/preparePlaneGeometry\(input:\s*unknown\):\s*PreparedPlaneGeometry/.test(leafDeclarations));
assert(/sizeXY:\s*\[number, number\]/.test(leafDeclarations));
assert(/segmentsXY:\s*\[number, number\]/.test(leafDeclarations));
const hash = value => createHash('sha256').update(value).digest('hex');
function originalJSON(value) {
  if (typeof value === 'number') { assert(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(originalJSON).join(',') + ']';
  return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + originalJSON(child)).join(',') + '}';
}
const clone = value => JSON.parse(originalJSON(value));
const source = (sizeXY = [4, 2], segmentsXY = [2, 1], id = 'plane_authored') => ({
  format: 'barocss-gpu-plane-geometry', version: 0, id, coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', sizeXY, segmentsXY,
});
const literalPositions = [-2, -1, 0, 0, -1, 0, 2, -1, 0, -2, 1, 0, 0, 1, 0, 2, 1, 0];
const literalNormals = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1];
const literalUV = [0, 0, .5, 0, 1, 0, 0, 1, .5, 1, 1, 1];
const literalIndices = [0, 1, 4, 0, 4, 3, 1, 2, 5, 1, 5, 4];
// These literal Number slots distinguish width*(i/nx-.5) from reordered math.
const nonRoundPositions = [
  -.15, -.35, 0, -.05, -.35, 0, .04999999999999999, -.35, 0, .15, -.35, 0,
  -.15, 0, 0, -.05, 0, 0, .04999999999999999, 0, 0, .15, 0, 0,
  -.15, .35, 0, -.05, .35, 0, .04999999999999999, .35, 0, .15, .35, 0,
];
const nonRoundUV = [0, 0, 1 / 3, 0, 2 / 3, 0, 1, 0, 0, .5, 1 / 3, .5, 2 / 3, .5, 1, .5, 0, 1, 1 / 3, 1, 2 / 3, 1, 1, 1];
const nonRoundIndices = [0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 4, 5, 9, 4, 9, 8, 5, 6, 10, 5, 10, 9, 6, 7, 11, 6, 11, 10];
function data(prepared) {
  return { geometry: prepared.geometry, bounds: prepared.bounds, vertexCount: prepared.vertexCount, triangleCount: prepared.triangleCount,
    indexType: prepared.indexType, bufferBytes: prepared.bufferBytes, positions: Array.from(prepared.positions), normals: Array.from(prepared.normals),
    uvs: Array.from(prepared.uvs), indices: Array.from(prepared.indices) };
}
function frozen(value) { if (value && typeof value === 'object' && !ArrayBuffer.isView(value)) { assert(Object.isFrozen(value)); Object.values(value).forEach(frozen); } }
function hashes(prepared) { return Object.fromEntries(['positions', 'normals', 'uvs', 'indices'].map(key => {
  const array = prepared[key]; return [key, hash(Buffer.from(array.buffer, array.byteOffset, array.byteLength))];
})); }
function near(actual, expected) { assert(Math.abs(actual - expected) <= 1e-12, 'Actual ' + actual + '; expected ' + expected); }
function vector(actual, expected) { assert.equal(actual.length, expected.length); actual.forEach((value, index) => near(value, expected[index])); }
function verify(result, input, expected) {
  assert.deepEqual(Object.keys(result).sort(), ['prepared', 'source']);
  assert.deepEqual(Object.keys(result.source).sort(), ['format', 'version', 'id', 'coordinateSystem', 'positionUnit', 'sizeXY', 'segmentsXY'].sort());
  assert.deepEqual(result.source, input); assert.notStrictEqual(result.source, input);
  for (const field of ['sizeXY', 'segmentsXY']) { assert.notStrictEqual(result.source[field], input[field]); input[field].forEach((value, index) => assert(Object.is(result.source[field][index], value))); }
  const prepared = result.prepared, geometry = prepared.geometry;
  assert.equal(geometry.format, 'barocss-gpu-triangle-geometry'); assert.equal(geometry.version, 0); assert.equal(geometry.id, input.id);
  assert.equal(geometry.coordinateSystem, 'right-handed-y-up'); assert.equal(geometry.positionUnit, 'scene'); assert.equal(geometry.winding, 'ccw');
  assert.deepEqual(geometry.positions, expected.positions); assert.deepEqual(geometry.normals, expected.normals);
  assert.deepEqual(geometry.uvs, expected.uvs); assert.deepEqual(geometry.indices, expected.indices); assert.deepEqual(prepared.bounds, expected.bounds);
  assert.equal(prepared.vertexCount, expected.vertices); assert.equal(prepared.triangleCount, expected.triangles); assert.equal(prepared.bufferBytes, expected.bytes);
  assert.equal(prepared.indexType, 'uint16'); assert(prepared.indices instanceof Uint16Array);
  for (const key of ['positions', 'normals', 'uvs']) { assert(prepared[key] instanceof Float32Array); assert.deepEqual(Array.from(prepared[key]), geometry[key].map(Math.fround)); }
  assert.deepEqual(Array.from(prepared.indices), expected.indices); frozen(result);
}
const fixtures = [
  { name: 'literal_two_by_one', input: source(), expected: { positions: literalPositions, normals: literalNormals, uvs: literalUV, indices: literalIndices,
    bounds: { min: [-2, -1, 0], max: [2, 1, 0] }, vertices: 6, triangles: 4, bytes: 216 } },
  { name: 'original_non_round_three_by_two', input: source([.3, .7], [3, 2], 'plane_nonround'), expected: { positions: nonRoundPositions,
    normals: Array.from({ length: 12 }, () => [0, 0, 1]).flat(), uvs: nonRoundUV, indices: nonRoundIndices,
    bounds: { min: [-.15, -.35, 0], max: [.15, .35, 0] }, vertices: 12, triangles: 12, bytes: 456 } },
];
let accepted = 0, refused = 0, getters = 0, reflections = 0, earlyEnumeration = 0;
const results = [], coldPlan = [], failures = [];
try {
  for (const [provider, providerPath, gpu] of providers) {
    assert.equal(typeof gpu.preparePlaneGeometry, 'function'); assert.equal(typeof gpu.prepareEngineScene, 'function'); assert.equal(typeof gpu.raycastEngineScene, 'function');
    const records = [], coldFiles = []; let previous;
    for (const fixture of fixtures) {
      const input = clone(fixture.input), before = originalJSON(input), result = gpu.preparePlaneGeometry(input);
      verify(result, input, fixture.expected); assert.equal(originalJSON(input), before);
      const repeated = gpu.preparePlaneGeometry(input); verify(repeated, input, fixture.expected);
      assert.notStrictEqual(result.source.sizeXY, repeated.source.sizeXY); assert.notStrictEqual(result.source.segmentsXY, repeated.source.segmentsXY);
      assert.notStrictEqual(result.prepared.geometry.positions, repeated.prepared.geometry.positions);
      assert.notStrictEqual(result.prepared.positions, repeated.prepared.positions);
      const sourcePath = resolve(output, provider + '.' + fixture.name + '.source.json');
      const preparedPath = resolve(output, provider + '.' + fixture.name + '.prepared.json');
      await writeFile(sourcePath, originalJSON(input) + '\n'); await writeFile(preparedPath, originalJSON(data(result.prepared)) + '\n');
      const coldSource = JSON.parse(await readFile(sourcePath, 'utf8')), cold = gpu.preparePlaneGeometry(coldSource);
      verify(cold, coldSource, fixture.expected); assert.deepEqual(JSON.parse(await readFile(preparedPath, 'utf8')), data(cold.prepared));
      const originalSource = originalJSON(result.source), originalGeometry = originalJSON(result.prepared.geometry), repeatedBuffers = hashes(repeated.prepared);
      input.id = 'caller_changed'; input.sizeXY[0] = 1999; input.segmentsXY[0] = 127;
      assert.equal(originalJSON(result.source), originalSource); assert.equal(originalJSON(result.prepared.geometry), originalGeometry);
      for (const [key, replacement] of [['positions', 123], ['normals', .125], ['uvs', .75], ['indices', 7]]) {
        const old = result.prepared[key][0]; result.prepared[key][0] = replacement;
        assert.equal(result.prepared[key][0], replacement); assert.equal(originalJSON(result.prepared.geometry), originalGeometry);
        assert.deepEqual(hashes(repeated.prepared), repeatedBuffers); result.prepared[key][0] = old;
      }
      if (fixture.name.includes('non_round')) { assert(Object.is(result.prepared.geometry.positions[3], -.05)); assert.notEqual(result.prepared.positions[3], result.prepared.geometry.positions[3]); }
      records.push({ name: fixture.name, source: result.source, geometry: result.prepared.geometry, bounds: result.prepared.bounds, bytes: result.prepared.bufferBytes, buffers: hashes(result.prepared), sourcePath, preparedPath });
      coldFiles.push({ sourcePath, preparedPath });
      previous ??= { result, source: originalSource, geometry: originalGeometry, buffers: hashes(result.prepared), files: [sourcePath, preparedPath] }; accepted++;
    }
    const first = previous.result;
    const edit = gpu.preparePlaneGeometry(source([6, 3], [3, 2]));
    assert.equal(edit.source.id, first.source.id); assert.deepEqual(edit.prepared.bounds, { min: [-3, -1.5, 0], max: [3, 1.5, 0] });
    assert.equal(edit.prepared.vertexCount, 12); assert.equal(edit.prepared.triangleCount, 12); assert.equal(originalJSON(first.source), previous.source); accepted++;
    const nullable = gpu.preparePlaneGeometry(Object.assign(Object.create(null), source([2, 2], [1, 1], 'plane_null_record')));
    assert.equal(nullable.prepared.vertexCount, 4); assert.equal(nullable.prepared.triangleCount, 2); assert.equal(nullable.prepared.bufferBytes, 140); accepted++;
    const maximumInput = source([2, 2], [128, 128], 'plane_maximum'), maximum = gpu.preparePlaneGeometry(maximumInput), p = maximum.prepared;
    assert.equal(p.vertexCount, 16641); assert.equal(p.triangleCount, 32768); assert.equal(p.indices.length, 98304);
    assert.equal(p.bufferBytes, 729120); assert.equal(p.indexType, 'uint16');
    let largestIndex = 0; for (const index of p.indices) largestIndex = Math.max(largestIndex, index);
    assert.equal(largestIndex, 16640);
    assert.equal(p.geometry.positions.length + p.geometry.normals.length + p.geometry.uvs.length + p.geometry.indices.length, 231432);
    assert.deepEqual(Array.from(p.indices.slice(0, 6)), [0, 1, 130, 0, 130, 129]);
    assert.deepEqual(Array.from(p.indices.slice(-6)), [16510, 16511, 16640, 16510, 16640, 16639]);
    for (let i = 0; i < p.vertexCount; i++) {
      assert.deepEqual(p.geometry.normals.slice(3 * i, 3 * i + 3), [0, 0, 1]); assert(Object.is(p.geometry.positions[3 * i + 2], 0));
      assert.equal(p.geometry.uvs[2 * i], (p.geometry.positions[3 * i] + 1) / 2);
      assert.equal(p.geometry.uvs[2 * i + 1], (p.geometry.positions[3 * i + 1] + 1) / 2);
    }
    for (let i = 0; i < p.indices.length; i += 3) {
      const [a, b, c] = Array.from(p.indices.slice(i, i + 3));
      const ax = p.positions[3 * a], ay = p.positions[3 * a + 1], bx = p.positions[3 * b], by = p.positions[3 * b + 1], cx = p.positions[3 * c], cy = p.positions[3 * c + 1];
      assert((bx - ax) * (cy - ay) - (by - ay) * (cx - ax) > 0, 'Every maximum-grid triangle must face +Z');
    }
    const maxSourcePath = resolve(output, provider + '.maximum.source.json'), maxPreparedPath = resolve(output, provider + '.maximum.prepared.json');
    await writeFile(maxSourcePath, originalJSON(maximumInput) + '\n'); await writeFile(maxPreparedPath, originalJSON(data(p)) + '\n');
    coldFiles.push({ sourcePath: maxSourcePath, preparedPath: maxPreparedPath }); accepted++;
    const dimensionsMaximum = gpu.preparePlaneGeometry(source([2000, 2000], [1, 1], 'plane_size_limit'));
    assert.deepEqual(dimensionsMaximum.prepared.bounds, { min: [-1000, -1000, 0], max: [1000, 1000, 0] }); accepted++;

    const sceneInput = { format: 'barocss-gpu-engine-scene', version: 0, id: 'plane_instances', coordinateSystem: 'right-handed-y-up', positionUnit: 'scene',
      background: [.02, .04, .06], camera: { eye: [8, 6, 12], target: [0, 0, 0], up: [0, 1, 0], fovYDegrees: 45, near: .1, far: 100 },
      geometries: [first.prepared.geometry], materials: [{ id: 'plane_material', type: 'unlit', colorSpace: 'linear', color: [.2, .4, .6] }],
      nodes: [
        { id: 'front_plane', type: 'mesh', parentId: null, geometryId: 'plane_authored', materialId: 'plane_material', translation: [0, 0, 0], rotationXYZW: [0, 0, 0, 1], scale: [1, 1, 1], visible: true },
        { id: 'ground_plane', type: 'mesh', parentId: null, geometryId: 'plane_authored', materialId: 'plane_material', translation: [5, 0, -2], rotationXYZW: [-Math.SQRT1_2, 0, 0, Math.SQRT1_2], scale: [.5, 2, 1], visible: true },
      ] };
    const sceneText = originalJSON(sceneInput), scene = gpu.prepareEngineScene(sceneInput);
    assert.equal(originalJSON(sceneInput), sceneText); assert.equal(scene.geometries.length, 1); assert.equal(scene.draws.length, 2); assert.equal(scene.bufferBytes, 216); assert.equal(scene.vertexWork, 12);
    assert.strictEqual(scene.draws[0].geometry, scene.draws[1].geometry); assert.notStrictEqual(scene.geometries[0].positions, first.prepared.positions);
    const groundBounds = scene.nodes.find(node => node.id === 'ground_plane').bounds; vector(groundBounds.min, [4, 0, -4]); vector(groundBounds.max, [6, 0, 0]);
    const ray = { format: 'barocss-gpu-engine-ray', version: 0, coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', origin: [.25, -.5, 3], direction: [0, 0, -1], near: .01, far: 10 };
    const hit = gpu.raycastEngineScene(sceneInput, ray); assert(hit); assert.equal(hit.nodeId, 'front_plane'); assert.equal(hit.geometryId, 'plane_authored'); assert.equal(hit.triangleIndex, 3);
    near(hit.distance, 3); vector(hit.point, [.25, -.5, 0]); vector(hit.barycentric, [.75, .125, .125]); vector(hit.uv, [.5625, .25]); vector(hit.normal, [0, 0, 1]); frozen(hit);
    const scenePath = resolve(output, provider + '.original-scene.json'), rayPath = resolve(output, provider + '.original-ray.json');
    await writeFile(scenePath, sceneText + '\n'); await writeFile(rayPath, originalJSON(ray) + '\n'); accepted++;
    coldPlan.push({ provider, providerPath, coldFiles, scenePath, rayPath, expectedHit: hit, expectedGroundBounds: groundBounds });

    const retainedFiles = await Promise.all(previous.files.map(async path => ({ path, sha256: hash(await readFile(path)) })));
    const refusals = [];
    function reject(name, input, code, inspect) {
      let error; try { gpu.preparePlaneGeometry(input); } catch (cause) { error = cause; }
      assert(error instanceof gpu.TriangleGeometryError); assert.equal(error.code, code, name); inspect?.(error);
      assert.equal(originalJSON(first.source), previous.source); assert.equal(originalJSON(first.prepared.geometry), previous.geometry); assert.deepEqual(hashes(first.prepared), previous.buffers);
      assert.equal(originalJSON(sceneInput), sceneText); refused++;
      refusals.push({ name, code: error.code, message: error.message, cause: error.cause instanceof Error ? { name: error.cause.name, message: error.cause.message } : null });
    }
    reject('metadata version', { ...source(), version: 1 }, 'VERSION');
    reject('metadata discriminator', { ...source(), format: 'plane' }, 'VERSION');
    reject('metadata unit', { ...source(), positionUnit: 'mm' }, 'VERSION');
    reject('metadata frame', { ...source(), coordinateSystem: 'z-up' }, 'VERSION');
    reject('extra origin field', { ...source(), origin: [0, 0, 0] }, 'INPUT');
    const missing = source(); delete missing.segmentsXY; reject('missing segments', missing, 'INPUT');
    reject('invalid ID', source([4, 2], [2, 1], '9invalid'), 'INPUT');
    reject('overlong ID', source([4, 2], [2, 1], 'p'.repeat(65)), 'INPUT');
    reject('non-array sizes', { ...source(), sizeXY: '4 2' }, 'INPUT');
    reject('short size tuple', source([4]), 'GEOMETRY');
    reject('short segment tuple', source([4, 2], [2]), 'GEOMETRY');
    for (const field of ['sizeXY', 'segmentsXY']) {
      const oversized = new Proxy([2, 2, 2], { ownKeys() { earlyEnumeration++; throw Error('Oversized tuple must not be enumerated'); } });
      reject(field + ' length before enumeration', { ...source(), [field]: oversized }, 'BUDGET'); assert.equal(earlyEnumeration, 0);
    }
    reject('segment above work cap', source([4, 2], [129, 1]), 'BUDGET');
    reject('fractional segments', source([4, 2], [1.5, 1]), 'GEOMETRY');
    reject('zero segments', source([4, 2], [0, 1]), 'GEOMETRY');
    reject('negative segments', source([4, 2], [-1, 1]), 'GEOMETRY');
    reject('nonfinite segments', source([4, 2], [Infinity, 1]), 'INPUT');
    reject('non-number segments', source([4, 2], ['2', 1]), 'INPUT');
    reject('nonfinite size', source([NaN, 2]), 'INPUT');
    reject('non-number size', source(['4', 2]), 'INPUT');
    reject('zero size', source([0, 2]), 'GEOMETRY');
    reject('negative-zero size', source([-0, 2]), 'GEOMETRY');
    reject('negative size', source([-4, 2]), 'GEOMETRY');
    reject('size over cap', source([2000.01, 2]), 'GEOMETRY');
    reject('original tiny width zero area', source([Number.MIN_VALUE, 2], [1, 1]), 'GEOMETRY', error => assert(error.cause instanceof RangeError));
    reject('nonzero tiny width Float32 underflow', source([1e-50, 2], [1, 1]), 'REPRESENTATION');
    const getterRoot = source(); Object.defineProperty(getterRoot, 'sizeXY', { enumerable: true, get() { getters++; return [4, 2]; } });
    reject('root getter never invoked', getterRoot, 'INPUT');
    for (const field of ['sizeXY', 'segmentsXY']) {
      const array = [2, 2]; Object.defineProperty(array, '0', { enumerable: true, get() { getters++; return 2; } });
      reject(field + ' getter never invoked', { ...source(), [field]: array }, 'INPUT');
    }
    const sparse = [4, 2]; delete sparse[1]; reject('sparse sizes', source(sparse), 'INPUT');
    const extra = [2, 1]; extra.extra = true; reject('extra array field', source([4, 2], extra), 'INPUT');
    const foreign = [2, 1]; Object.setPrototypeOf(foreign, null); reject('foreign array prototype', source([4, 2], foreign), 'INPUT');
    const hidden = source(); Object.defineProperty(hidden, 'id', { enumerable: false, value: 'hidden' }); reject('hidden root field', hidden, 'INPUT');
    const symbol = source(); symbol[Symbol('unsupported')] = true; reject('symbol root field', symbol, 'INPUT');
    reject('foreign root prototype', Object.assign(Object.create({ inherited: true }), source()), 'INPUT');
    const rootMarker = new Error('Actual Plane root reflection exception');
    reject('actual root reflection cause', new Proxy(source(), { getPrototypeOf() { reflections++; throw rootMarker; } }), 'INPUT', error => assert.strictEqual(error.cause, rootMarker));
    const arrayMarker = new Error('Actual Plane array reflection exception');
    reject('actual array reflection cause', source(new Proxy([4, 2], { getOwnPropertyDescriptor() { reflections++; throw arrayMarker; } })), 'INPUT', error => assert.strictEqual(error.cause, arrayMarker));
    assert.equal(getters, 0); for (const file of retainedFiles) assert.equal(hash(await readFile(file.path)), file.sha256);
    results.push({ provider, runtimeExports: Object.keys(gpu).length, records, edit: { source: edit.source, bounds: edit.prepared.bounds },
      maximum: { source: maximum.source, vertices: p.vertexCount, triangles: p.triangleCount, bytes: p.bufferBytes, buffers: hashes(p) },
      scene: { geometries: 1, instances: 2, bytes: scene.bufferBytes, vertexWork: scene.vertexWork, groundBounds, scenePath, rayPath, hit }, refusals, retainedFiles });
  }
  const planPath = resolve(output, 'cold-plan.json'), coldScript = resolve(output, 'cold-process.mjs');
  await writeFile(planPath, originalJSON(coldPlan) + '\n');
  await writeFile(coldScript, `import assert from 'node:assert/strict';\nimport {readFile,writeFile} from 'node:fs/promises';\nimport {pathToFileURL} from 'node:url';\nconst plan=JSON.parse(await readFile(process.argv[2],'utf8')),out=[];\nfunction data(p){return{geometry:p.geometry,bounds:p.bounds,vertexCount:p.vertexCount,triangleCount:p.triangleCount,indexType:p.indexType,bufferBytes:p.bufferBytes,positions:Array.from(p.positions),normals:Array.from(p.normals),uvs:Array.from(p.uvs),indices:Array.from(p.indices)};}\nfor(const item of plan){const gpu=await import(pathToFileURL(item.providerPath).href);for(const file of item.coldFiles){const input=JSON.parse(await readFile(file.sourcePath,'utf8')),actual=gpu.preparePlaneGeometry(input),expected=JSON.parse(await readFile(file.preparedPath,'utf8'));assert.deepEqual(actual.source,input);assert.deepEqual(data(actual.prepared),expected);}const sceneInput=JSON.parse(await readFile(item.scenePath,'utf8')),ray=JSON.parse(await readFile(item.rayPath,'utf8'));const prepared=gpu.prepareEngineScene(sceneInput);assert.equal(prepared.geometries.length,1);assert.equal(prepared.draws.length,2);assert.deepEqual(prepared.nodes.find(n=>n.id==='ground_plane').bounds,item.expectedGroundBounds);assert.deepEqual(gpu.raycastEngineScene(sceneInput,ray),item.expectedHit);out.push({provider:item.provider,coldPlanes:item.coldFiles.length,runtimeExports:Object.keys(gpu).length,sharedScene:true,ray:true});}\nawait writeFile(process.argv[3],JSON.stringify({node:process.version,actualGL:false,results:out},null,2)+'\\n');\nconsole.log(JSON.stringify(out));\n`);
  const coldResultPath = resolve(output, 'cold-result.json');
  const coldStdout = execFileSync(process.execPath, [coldScript, planPath, coldResultPath], { cwd: repo, encoding: 'utf8' });
  await writeFile(resolve(output, 'cold.stdout.log'), coldStdout);
  const coldResult = JSON.parse(await readFile(coldResultPath, 'utf8')); assert(/^v22\./.test(coldResult.node)); assert.equal(coldResult.results.length, 2);
  assert.deepEqual(results[0].records.map(record => ({ source: record.source, geometry: record.geometry, bounds: record.bounds, buffers: record.buffers })), results[1].records.map(record => ({ source: record.source, geometry: record.geometry, bounds: record.bounds, buffers: record.buffers })));
  assert.deepEqual(results[0].scene.hit, results[1].scene.hit);
} catch (error) { failures.push(String(error.stack ?? error)); throw error; }
finally {
  const report = { issue: 1376, parent: '618d9dca3ce5b87df6f3ca57ff33a37f3bbee9fb', head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
    accepted, refused, getters, reflections, earlyEnumeration, results, failures, ordinarySourceGraph: graph,
    emitted: { path: resolve(pkg, published.import), sha256: hash(await readFile(resolve(pkg, published.import))), declarationsPath, declarationSHA256: hash(declarations), leafDeclarationSHA256: hash(leafDeclarations) },
    actualGL: false, nativeCAD: false, pixelPicking: false, publicCodec: false,
    limits: ['Original subdivided XY Plane/+Z, source Number parameters and generated attributes, independently mutable Float32/U16 buffers.', 'One source-coordinate ray is an EngineScene CPU consumer, not pixel/native-CAD identity.', 'Maximum winding/count/bytes are bounded correctness observations, not performance or physical memory certification.', 'Cold subprocess reconstructs original saved parameters/scene/ray through actual source and emitted APIs.', 'No DOM/GL, old generator campaign, currentRoot, renderer or publication acceptance.'] };
  await writeFile(resolve(output, 'actual-result.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ issue: 1376, accepted, refused, getters, reflections, earlyEnumeration, runtimeExports: Object.keys(providers[0][2]).length, actualGL: false, failures }));
}
