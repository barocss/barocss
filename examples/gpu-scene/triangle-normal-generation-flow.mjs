/** #1272: original indexed Number triangles to generated normals and real scene0.
 * node examples/gpu-scene/triangle-normal-generation-flow.mjs --output <fresh-directory>
 * No browser, GL, native CAD, maximum-index or performance campaign.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const at = process.argv.indexOf('--output');
assert(at >= 0 && process.argv[at + 1], '--output <fresh-directory> required');
const output = resolve(process.argv[at + 1]);
await mkdir(output, { recursive: false });
const pkg = resolve(repo, 'packages/barocss-gpu');
const manifest = JSON.parse(await readFile(resolve(pkg, 'package.json'), 'utf8'));
const published = manifest.publishConfig.exports['.'];
const ordinary = resolve(output, 'ordinary-source.mjs');
const bundled = await build({ entryPoints: [resolve(pkg, manifest.exports['.'].import)],
  bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile: ordinary, metafile: true });
const graph = Object.keys(bundled.metafile.inputs);
assert(graph.some(p => p.endsWith('/src/geometry/triangle-normal-generation.ts')));
assert(graph.some(p => p.endsWith('/src/geometry/triangle-geometry.ts')));
assert(!graph.some(p => /barocss-(gpu|cad)\/dist\//.test(p)));
const hash = value => createHash('sha256').update(value).digest('hex');
async function receipt(path) {
  const bytes = await readFile(path);
  return { path, bytes: bytes.length, sha256: hash(bytes) };
}
// Full original JSON with an explicit signed-zero representation, only in this example.
function json(value) {
  if (typeof value === 'number') {
    assert(Number.isFinite(value));
    return Object.is(value, -0) ? '-0' : JSON.stringify(value);
  }
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(json).join(',') + ']';
  return '{' + Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, child]) => JSON.stringify(key) + ':' + json(child)).join(',') + '}';
}
const clone = value => JSON.parse(json(value));
function nearArray(actual, expected, tolerance = 1e-12) {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => assert(Math.abs(value - expected[index]) <= tolerance,
    'actual ' + value + '; expected ' + expected[index]));
}
const triangle = () => ({ format: 'barocss-gpu-triangle-normal-source', version: 0,
  id: 'triangle', coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', winding: 'ccw',
  positions: [-0, -0, 0, 1, 0, 0, 0, 1, 0], uvs: [-0, 0, 1, 0, 0, 1], indices: [-0, 1, 2] });
const bent = () => ({ ...triangle(), id: 'bent_quad', positions: [-0, 0, 0, 2, 0, 0, 2, 1, 1, 0, 1, 0],
  uvs: [-0, 0, 1, 0, 1, 1, 0, 1], indices: [-0, 1, 2, 0, 2, 3] });
const split = () => ({ ...triangle(), id: 'split_crease',
  positions: [-0, 0, 0, 1, 0, 0, 0, 1, 0, -0, 0, 0, 0, 0, 1, 1, 0, 0],
  uvs: [-0, 0, 1, 0, 0, 1, -0, 0, 0, 1, 1, 0], indices: [-0, 1, 2, 3, 4, 5] });
// Independently known unnormalized face vectors are [0,-2,2] and [-1,0,2].
// Shared A/C sums are [-1,-2,4], not a mean of the two unit face normals.
const shared = [-1, -2, 4].map(n => n / Math.sqrt(21));
const second = [0, -1, 1].map(n => n / Math.sqrt(2));
const fourth = [-1, 0, 2].map(n => n / Math.sqrt(5));
const quadNormals = [...shared, ...second, ...shared, ...fourth];
const precise = bent(); precise.id = 'original_number_weight'; precise.positions[3] = 2 + 2 ** -25;
const weight = 2 + 2 ** -25;
const preciseShared = [-1, -weight, weight + 2].map(n => n / Math.hypot(1, weight, weight + 2));
const reverse = triangle(); reverse.id = 'reversed_index_order'; reverse.indices = [-0, 2, 1];
const nullRoot = Object.assign(Object.create(null), triangle()); nullRoot.id = 'null_root';
const fixtures = [
  ['triangle_signed_zero', triangle(), [0, 0, 1, 0, 0, 1, 0, 0, 1]],
  ['original_area_weighted_bent_quad', bent(), quadNormals],
  ['original_number_before_f32', precise, [...preciseShared, ...second, ...preciseShared, ...fourth]],
  ['split_source_index_crease', split(), [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0]],
  ['reversed_order_generates_reversed_normals', reverse, [0, 0, -1, 0, 0, -1, 0, 0, -1]],
  ['null_prototype_original_root', nullRoot, [0, 0, 1, 0, 0, 1, 0, 0, 1]],
];
function scene(geometry) {
  return { format: 'barocss-gpu-engine-scene', version: 0, id: 'generated_normal_scene',
    coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', background: [.02, .04, .08],
    camera: { eye: [0, 0, 6], target: [0, 0, 0], up: [0, 1, 0], fovYDegrees: 60, near: .1, far: 100 },
    geometries: [geometry], materials: [{ id: 'white', type: 'unlit', colorSpace: 'linear', color: [1, 1, 1] }],
    nodes: [{ id: 'generated_mesh', type: 'mesh', parentId: null, translation: [0, 0, 0],
      rotationXYZW: [0, 0, 0, 1], scale: [1, 1, 1], visible: true,
      geometryId: geometry.id, materialId: 'white' }] };
}
const providers = [['ordinary-source', await import(pathToFileURL(ordinary).href)],
  ['emitted-public', await import(pathToFileURL(resolve(pkg, published.import)).href)]];
assert.deepEqual(Object.keys(providers[0][1]).sort(), Object.keys(providers[1][1]).sort());

const declarationPath = resolve(pkg, published.types);
const declarations = await readFile(declarationPath, 'utf8');
for (const name of ['TriangleNormalSourceV0', 'PreparedTriangleGeometryWithNormals', 'prepareTriangleGeometryWithNormals']) {
  assert(new RegExp('\\b' + name + '\\b').test(declarations), name + ' actual public declaration');
}
let accepted = 0, refused = 0, getters = 0, proxyReflections = 0, oversizeEnumerations = 0;
const results = [];
for (const [name, gpu] of providers) {
  assert.equal(typeof gpu.prepareTriangleGeometryWithNormals, 'function');
  assert.equal(typeof gpu.prepareTriangleGeometry, 'function');
  assert.equal(typeof gpu.prepareEngineScene, 'function');
  assert.equal(typeof gpu.TriangleGeometryError, 'function');
  const acceptance = [], refusals = [], controls = [];
  // Actual existing provider still requires explicit caller normals.
  const missingNormals = { ...triangle(), format: 'barocss-gpu-triangle-geometry' };
  let capabilityError;
  try { gpu.prepareTriangleGeometry(missingNormals); } catch (error) { capabilityError = error; }
  assert(capabilityError instanceof gpu.TriangleGeometryError);
  assert.equal(capabilityError.code, 'INPUT');
  assert.equal(capabilityError.cause.message, 'input has missing or unsupported data fields');
  controls.push({ label: 'legacy_missing_normals', code: capabilityError.code, cause: capabilityError.cause.message });
  const unused = triangle(); unused.positions.push(2, 2, 0); unused.uvs.push(0, 0);
  const explicitUnused = { ...unused, format: 'barocss-gpu-triangle-geometry', normals: Array(4).fill([0, 0, 1]).flat() };
  const legacy = gpu.prepareTriangleGeometry(explicitUnused);
  assert.equal(legacy.vertexCount, 4);
  assert.deepEqual(legacy.bounds.max, [2, 2, 0]);
  controls.push({ label: 'legacy_explicit_normals_allow_unused_vertex', vertexCount: legacy.vertexCount });
  let current;
  function verify(request, prepared, expected) {
    assert.deepEqual(Object.keys(prepared).sort(), ['normalMethod', 'prepared', 'source']);
    assert(Object.isFrozen(prepared));
    assert.equal(prepared.normalMethod, 'area-weighted-original-triangle');
    assert.equal(json(prepared.source), json(request));
    assert.notStrictEqual(prepared.source, request);
    assert(Object.isFrozen(prepared.source));
    assert.equal(Object.keys(prepared.source).length, 9);
    assert(!Object.hasOwn(prepared.source, 'normals'));
    const geometry = prepared.prepared.geometry;
    assert.equal(geometry.format, 'barocss-gpu-triangle-geometry');
    assert.equal(geometry.id, request.id);
    assert(Object.isFrozen(geometry));
    assert(Object.isFrozen(geometry.normals));
    nearArray(geometry.normals, expected);
    for (const field of ['positions', 'uvs', 'indices']) {
      assert.equal(json(prepared.source[field]), json(request[field]));
      assert.equal(json(geometry[field]), json(request[field]));
      assert(Object.isFrozen(prepared.source[field])); assert(Object.isFrozen(geometry[field]));
      assert.notStrictEqual(prepared.source[field], request[field]);
      assert.notStrictEqual(geometry[field], prepared.source[field]);
    }
    for (let offset = 0; offset < geometry.normals.length; offset += 3) {
      nearArray([Math.hypot(...geometry.normals.slice(offset, offset + 3))], [1]);
    }
    for (const n of geometry.normals) if (n === 0) assert(!Object.is(n, -0));
    assert.equal(prepared.prepared.indexType, 'uint16');
    assert.equal(prepared.prepared.vertexCount, request.positions.length / 3);
    assert.equal(prepared.prepared.triangleCount, request.indices.length / 3);
    for (const field of ['positions', 'normals', 'uvs']) {
      assert(prepared.prepared[field] instanceof Float32Array);
      assert.deepEqual(Array.from(prepared.prepared[field]), geometry[field].map(Math.fround));
    }
    assert(prepared.prepared.indices instanceof Uint16Array);
    assert.deepEqual(Array.from(prepared.prepared.indices), request.indices.map(n => n || 0));
    assert.equal(prepared.prepared.bufferBytes, prepared.prepared.positions.byteLength
      + prepared.prepared.normals.byteLength + prepared.prepared.uvs.byteLength + prepared.prepared.indices.byteLength);
  }
  const savedPath = resolve(output, name + '.accepted-original.json');
  for (const [label, request, expected] of fixtures) {
    const sourceBits = json(request);
    const prepared = gpu.prepareTriangleGeometryWithNormals(request);
    assert.equal(json(request), sourceBits);
    verify(request, prepared, expected);
    if (label === 'original_number_before_f32') {
      assert.equal(prepared.prepared.positions[3], 2);
      assert.notEqual(prepared.prepared.geometry.positions[3], 2);
      assert(Math.abs(prepared.prepared.geometry.normals[1] - shared[1]) > 1e-10,
        'Original area weighting differs from rounded-input weighting');
    }
    if (label === 'split_source_index_crease') {
      assert.equal(json(prepared.source.positions.slice(0, 3)), json(prepared.source.positions.slice(9, 12)));
      assert.deepEqual(prepared.prepared.geometry.normals.slice(0, 3), [0, 0, 1]);
      assert.deepEqual(prepared.prepared.geometry.normals.slice(9, 12), [0, 1, 0]);
    }
    const sceneSource = scene(prepared.prepared.geometry);
    const sceneBits = json(sceneSource);
    const admittedScene = gpu.prepareEngineScene(sceneSource);
    assert.equal(admittedScene.draws.length, 1);
    assert.equal(admittedScene.draws[0].geometryId, request.id);
    assert.equal(admittedScene.draws[0].materialId, 'white');
    nearArray(admittedScene.draws[0].geometry.geometry.normals, expected);
    assert.equal(json(sceneSource), sceneBits);
    assert.notStrictEqual(admittedScene.geometries[0].normals.buffer, prepared.prepared.normals.buffer);
    const file = resolve(output, name + '.' + label + '.original.json');
    const sceneFile = resolve(output, name + '.' + label + '.scene.json');
    await writeFile(file, sourceBits + '\n');
    await writeFile(sceneFile, sceneBits + '\n');
    const coldInput = JSON.parse(await readFile(file, 'utf8'));
    const cold = gpu.prepareTriangleGeometryWithNormals(coldInput);
    verify(coldInput, cold, expected);
    assert.deepEqual(cold.prepared.normals, prepared.prepared.normals);
    for (const field of ['positions', 'normals', 'uvs', 'indices']) {
      assert.notStrictEqual(cold.prepared[field].buffer, prepared.prepared[field].buffer);
    }
    const coldScene = gpu.prepareEngineScene(JSON.parse(await readFile(sceneFile, 'utf8')));
    nearArray(coldScene.draws[0].geometry.geometry.normals, expected);
    const frozenBits = json(prepared.source), generatedBits = json(prepared.prepared.geometry);
    coldInput.positions[0] = 999;
    prepared.prepared.positions[0] = 998; prepared.prepared.normals[0] = 997;
    assert.equal(json(prepared.source), frozenBits);
    assert.equal(json(prepared.prepared.geometry), generatedBits);
    assert.notEqual(cold.prepared.positions[0], 998);
    assert.notEqual(cold.prepared.normals[0], 997);
    assert.notEqual(admittedScene.geometries[0].positions[0], 998);
    assert(Object.is(cold.source.positions[0], -0));
    assert(Object.is(cold.source.uvs[0], -0));
    assert(Object.is(cold.source.indices[0], -0));
    await writeFile(savedPath, sourceBits + '\n');
    current = cold; accepted++;
    acceptance.push({ label, vertexCount: cold.prepared.vertexCount, triangleCount: cold.prepared.triangleCount,
      normalMethod: cold.normalMethod, normals: cold.prepared.geometry.normals, original: await receipt(file),
      scene: await receipt(sceneFile), callerAndTypedMutationsRetainOriginals: true });
  }
  const previous = current, previousSource = json(previous.source), previousGeometry = json(previous.prepared.geometry);
  const previousBuffers = Object.fromEntries(['positions', 'normals', 'uvs', 'indices'].map(field => [field, Array.from(previous.prepared[field])]));
  const previousFile = await readFile(savedPath);
  async function reject(label, value, code, cause = undefined, text = undefined) {
    let error;
    try { gpu.prepareTriangleGeometryWithNormals(value); } catch (actual) { error = actual; }
    assert(error instanceof gpu.TriangleGeometryError, label + ': actual public error');
    assert.equal(error.code, code, label);
    assert.equal(error.name, 'TriangleGeometryError');
    assert(error.message.startsWith('Triangle geometry: ')); assert(error.message.length <= 1024);
    if (cause !== undefined) assert.strictEqual(error.cause, cause, label + ': original cause');
    if (text !== undefined) assert(error.message.includes(text), label + ': diagnostic detail');
    if (label === 'incident_face_disagreement') assert(error.cause instanceof RangeError);
    assert.strictEqual(current, previous);
    assert.equal(json(current.source), previousSource); assert.equal(json(current.prepared.geometry), previousGeometry);
    for (const field of Object.keys(previousBuffers)) assert.deepEqual(Array.from(current.prepared[field]), previousBuffers[field]);
    assert.deepEqual(await readFile(savedPath), previousFile);
    refused++; refusals.push({ label, code: error.code, message: error.message,
      cause: error.cause instanceof Error ? { name: error.cause.name, message: error.cause.message } : null,
      priorSourceGeneratedBuffersAndFileRetained: true });
  }
  const cases = [];
  const changed = (label, field, value, code) => cases.push([label, { ...triangle(), [field]: value }, code]);
  changed('old_geometry_format_is_distinct', 'format', 'barocss-gpu-triangle-geometry', 'VERSION');
  changed('version1', 'version', 1, 'VERSION');
  changed('foreign_frame', 'coordinateSystem', 'left-handed-z-up', 'VERSION');
  changed('native_mm_is_not_scene', 'positionUnit', 'mm', 'VERSION');
  changed('clockwise_metadata', 'winding', 'cw', 'VERSION');
  changed('invalid_id', 'id', 'invalid id', 'INPUT');
  changed('too_long_id', 'id', 'A'.repeat(65), 'INPUT');
  changed('incomplete_positions', 'positions', [0, 0, 0, 1, 0, 0, 0, 1], 'GEOMETRY');
  changed('fewer_than_three_vertices', 'positions', [0, 0, 0, 1, 0, 0], 'GEOMETRY');
  changed('uv_count', 'uvs', [0, 0], 'GEOMETRY');
  changed('incomplete_triangle', 'indices', [0, 1], 'GEOMETRY');
  changed('position_range', 'positions', [0, 0, 0, 1001, 0, 0, 0, 1, 0], 'GEOMETRY');
  changed('uv_range', 'uvs', [1001, 0, 1, 0, 0, 1], 'GEOMETRY');
  changed('index_outside', 'indices', [0, 1, 3], 'GEOMETRY');
  changed('index_negative', 'indices', [-1, 1, 2], 'GEOMETRY');
  changed('index_fractional', 'indices', [0, .5, 2], 'GEOMETRY');
  changed('repeated_index', 'indices', [0, 1, 1], 'GEOMETRY');
  changed('zero_area', 'positions', [0, 0, 0, 1, 0, 0, 2, 0, 0], 'GEOMETRY');
  changed('nonfinite_position', 'positions', [0, 0, 0, Infinity, 0, 0, 0, 1, 0], 'INPUT');
  changed('nonfinite_uv', 'uvs', [NaN, 0, 1, 0, 0, 1], 'INPUT');
  changed('nonfinite_index', 'indices', [0, 1, Infinity], 'INPUT');
  changed('typed_input', 'positions', Float64Array.from(triangle().positions), 'INPUT');
  changed('supplied_normals_are_extra', 'normals', [0, 0, 1, 0, 0, 1, 0, 0, 1], 'INPUT');
  cases.push(['unused_vertex_has_no_fallback', unused, 'GEOMETRY']);
  const cancel = triangle(); cancel.indices.push(0, 2, 1);
  cases.push(['opposed_incident_vectors_cancel', cancel, 'GEOMETRY']);
  const disagreement = triangle(); disagreement.positions = [0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 1, 0];
  disagreement.uvs = [0, 0, 1, 0, 0, 1, 0, .5]; disagreement.indices = [0, 1, 2, 0, 3, 1];
  cases.push(['incident_face_disagreement', disagreement, 'GEOMETRY']);
  const uvUnderflow = triangle(); uvUnderflow.uvs[0] = Number.MIN_VALUE;
  cases.push(['uv_f32_underflow', uvUnderflow, 'REPRESENTATION']);
  const normalUnderflow = triangle(); normalUnderflow.positions = [0, 0, 0, 1000, 0, 0, 0, 1000, 1e-44];
  cases.push(['generated_normal_f32_underflow', normalUnderflow, 'REPRESENTATION', undefined, 'normals']);
  const collapse = triangle(); collapse.positions = [1, 0, 0, 1 + 2 ** -25, 0, 0, 1, 1, 0];
  cases.push(['original_valid_f32_collapse', collapse, 'REPRESENTATION']);
  const sparse = triangle(); delete sparse.positions[0]; cases.push(['sparse', sparse, 'INPUT']);
  const extra = triangle(); extra.positions.extra = 1; cases.push(['extra_array_key', extra, 'INPUT']);
  const hidden = triangle(); Object.defineProperty(hidden.positions, '0', { value: 0, enumerable: false });
  cases.push(['hidden_array_element', hidden, 'INPUT']);
  const symbol = triangle(); symbol[Symbol('foreign')] = 0; cases.push(['root_symbol', symbol, 'INPUT']);
  const hiddenRoot = triangle(); Object.defineProperty(hiddenRoot, 'foreign', { value: 0 });
  cases.push(['hidden_root_key', hiddenRoot, 'INPUT']);
  cases.push(['foreign_root_prototype', Object.assign(Object.create({}), triangle()), 'INPUT']);
  const foreignArray = triangle(); Object.setPrototypeOf(foreignArray.positions, Object.create(Array.prototype));
  cases.push(['foreign_array_prototype', foreignArray, 'INPUT']);
  const getterRoot = triangle(); Object.defineProperty(getterRoot, 'positions', { enumerable: true,
    get() { getters++; return triangle().positions; } });
  cases.push(['root_getter', getterRoot, 'INPUT']);
  const getterElement = triangle(); Object.defineProperty(getterElement.positions, '0', { enumerable: true,
    get() { getters++; return 0; } });
  cases.push(['element_getter', getterElement, 'INPUT']);
  const reflection = new Error('actual original root reflection failure');
  cases.push(['root_reflection_cause', new Proxy(triangle(), {
    ownKeys() { proxyReflections++; throw reflection; } }), 'INPUT', reflection]);
  const arrayReflection = new Error('actual original array descriptor failure');
  const reflectedArray = triangle(); reflectedArray.positions = new Proxy(reflectedArray.positions, {
    getOwnPropertyDescriptor(target, key) {
      if (key === '0') { proxyReflections++; throw arrayReflection; }
      return Reflect.getOwnPropertyDescriptor(target, key);
    } });
  cases.push(['array_reflection_cause', reflectedArray, 'INPUT', arrayReflection]);
  for (const [field, length] of [['positions', 393219], ['uvs', 262146], ['indices', 393219]]) {
    const value = triangle(); value[field] = new Proxy(Array(length), {
      ownKeys(target) { oversizeEnumerations++; return Reflect.ownKeys(target); } });
    cases.push(['oversize_' + field + '_before_enumeration', value, 'BUDGET']);
  }
  const lengthsFirst = triangle(); lengthsFirst.positions = new Proxy(lengthsFirst.positions, {
    ownKeys(target) { oversizeEnumerations++; return Reflect.ownKeys(target); } });
  lengthsFirst.indices = Array(393219);
  cases.push(['all_lengths_before_first_attribute_enumeration', lengthsFirst, 'BUDGET']);
  for (const [label, value, code, cause, text] of cases) await reject(label, value, code, cause, text);
  assert.equal(getters, 0); assert.equal(oversizeEnumerations, 0);
  results.push({ provider: name, accepted: acceptance, refusals, controls, exports: Object.keys(gpu).sort() });
}
const report = { issue: 1272, accepted, refused, getters, proxyReflections, oversizeEnumerations,
  actualGL: false, sourceGraph: graph, source: await receipt(resolve(pkg, 'src/geometry/triangle-normal-generation.ts')),
  declarations: await receipt(declarationPath), ordinary: await receipt(ordinary),
  emitted: await receipt(resolve(pkg, published.import)), results,
  support: 'Bounded original indexed Number area-weighted normals by source vertex identity; all vertices referenced. Actual existing geometry and scene0 providers, independent frozen originals/generated Number normals and mutable F32 buffers. CPU/source/emitted/file/cold proof only; no native CAD, browser/GL/pixel, old U32/max-geometry campaign, performance, whole engine/Three.js parity or publication.' };
await writeFile(resolve(output, 'actual-result.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ issue: 1272, accepted, refused, getters, proxyReflections,
  oversizeEnumerations, exports: results[0].exports.length, actualGL: false }));
