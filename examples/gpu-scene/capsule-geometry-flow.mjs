/** #1404: one closed Capsule/source/emitted/Scene/ray/file/cold CPU flow.
 * node examples/gpu-scene/capsule-geometry-flow.mjs --output <fresh-directory>
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';

assert.equal(Number(process.versions.node.split('.')[0]), 22, 'Actual Node22 required');
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), args = process.argv.slice(2), at = args.indexOf('--output');
assert(at >= 0 && args[at + 1] && !args[at + 1].startsWith('--'), '--output <fresh-directory> required');
const output = resolve(args[at + 1]); await mkdir(output, { recursive: false });
const pkg = resolve(repo, 'packages/barocss-gpu'), manifest = JSON.parse(await readFile(resolve(pkg, 'package.json'), 'utf8'));
const published = manifest.publishConfig.exports['.']; assert.equal(published.import, './dist/index.js'); assert.equal(published.types, './dist/index.d.ts');
const ordinary = resolve(output, 'ordinary-source.mjs'), emitted = resolve(pkg, published.import);
const bundled = await build({ entryPoints: [resolve(pkg, manifest.exports['.'].import)], bundle: true, platform: 'node', format: 'esm',
  target: 'node22', outfile: ordinary, metafile: true });
const graph = Object.keys(bundled.metafile.inputs);
for (const name of ['capsule-geometry.ts', 'capsule-geometry-build-internal.ts', 'triangle-geometry.ts', 'engine-scene.ts', 'engine-raycast.ts'])
  assert(graph.some(path => (path.includes('/src/') && path.endsWith('/' + name))), 'Actual own source dependency ' + name);
assert(graph.some(path => /barocss-cad\/src\//.test(path)), 'Actual transitive own CAD source graph');
assert(!graph.some(path => /barocss-(gpu|cad)\/dist\//.test(path)), 'No own emitted fallback in ordinary source');
const providers = [['ordinary-source', await import(pathToFileURL(ordinary).href)], ['emitted-public', await import(pathToFileURL(emitted).href)]];
const namespace = Object.keys(providers[0][1]).sort(); assert.deepEqual(namespace, Object.keys(providers[1][1]).sort());
const declarationPath = resolve(pkg, published.types), declaration = await readFile(declarationPath, 'utf8');
for (const name of ['prepareCapsuleGeometry', 'CapsuleGeometrySourceV0', 'PreparedCapsuleGeometry'])
  assert(new RegExp('\\b' + name + '\\b').test(declaration), 'Actual public DTS ' + name);
const leafDeclaration = await readFile(resolve(pkg, 'dist/geometry/capsule-geometry.d.ts'), 'utf8');
assert(/prepareCapsuleGeometry\(input:\s*unknown\):\s*PreparedCapsuleGeometry/.test(leafDeclaration));
for (const field of ['radius', 'halfLength', 'radialSegments', 'bodySegments', 'capSegments']) assert(new RegExp(field + ':\\s*number').test(leafDeclaration));
const hash = value => createHash('sha256').update(value).digest('hex');
function originalJSON(value) {
  if (typeof value === 'number') { assert(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(originalJSON).join(',') + ']';
  return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + originalJSON(child)).join(',') + '}';
}
const source = (radius = 1, halfLength = 2, radialSegments = 4, bodySegments = 1, capSegments = 2, id = 'capsule_authored') => ({
  format: 'barocss-gpu-capsule-geometry', version: 0, id, coordinateSystem: 'right-handed-y-up', positionUnit: 'scene',
  radius, halfLength, radialSegments, bodySegments, capSegments });
const near = (a, b, tolerance = 1e-14) => assert(Math.abs(a - b) <= tolerance, `${a} versus independent ${b}`);
const nearArray = (a, b, tolerance = 1e-14) => { assert.equal(a.length, b.length); a.forEach((n, i) => near(n, b[i], tolerance)); };
const vertex = (values, i) => values.slice(3 * i, 3 * i + 3);
const subtract = (a, b) => a.map((n, i) => n - b[i]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a.reduce((sum, n, i) => sum + n * b[i], 0);
const bufferHashes = prepared => Object.fromEntries(['positions', 'normals', 'uvs', 'indices'].map(name => {
  const view = prepared[name]; return [name, hash(Buffer.from(view.buffer, view.byteOffset, view.byteLength))];
}));
function frozen(value) {
  if (value && typeof value === 'object' && !ArrayBuffer.isView(value)) { assert(Object.isFrozen(value)); Object.values(value).forEach(frozen); }
}
function verify(result, input) {
  assert.deepEqual(Object.keys(result).sort(), ['prepared', 'source']); assert.deepEqual(result.source, { ...input });
  assert.notStrictEqual(result.source, input); assert.deepEqual(Object.keys(result.source).sort(), Object.keys(source()).sort());
  const p = result.prepared, g = p.geometry, s = input.radialSegments, b = input.bodySegments, c = input.capSegments;
  const k = b + 2 * c - 1, denominator = k + 1, count = k * (s + 1) + 2 * s, triangles = 2 * s * k;
  const bottom = k * (s + 1), top = bottom + s;
  assert.equal(g.format, 'barocss-gpu-triangle-geometry'); assert.equal(g.version, 0); assert.equal(g.id, input.id);
  assert.equal(g.coordinateSystem, 'right-handed-y-up'); assert.equal(g.positionUnit, 'scene'); assert.equal(g.winding, 'ccw');
  assert.equal(p.vertexCount, count); assert.equal(p.triangleCount, triangles); assert.equal(p.bufferBytes, 32 * count + 6 * triangles); assert.equal(p.indexType, 'uint16');
  assert(p.positions instanceof Float32Array && p.normals instanceof Float32Array && p.uvs instanceof Float32Array && p.indices instanceof Uint16Array);
  assert.equal(g.positions.length, 3 * count); assert.equal(g.normals.length, 3 * count); assert.equal(g.uvs.length, 2 * count); assert.equal(g.indices.length, 3 * triangles);
  for (const name of ['positions', 'normals', 'uvs']) assert.deepEqual(Array.from(p[name]), g[name].map(Math.fround));
  assert.deepEqual(Array.from(p.indices), g.indices);
  let previousY = -(input.halfLength + input.radius), previousF32 = p.positions[bottom * 3 + 1];
  for (let row = 0; row < k; row++) {
    const a = row * (s + 1), end = a + s, y = g.positions[a * 3 + 1];
    assert(y > previousY); previousY = y; assert(p.positions[a * 3 + 1] > previousF32); previousF32 = p.positions[a * 3 + 1];
    for (const values of [g.positions, g.normals]) for (let axis = 0; axis < 3; axis++) assert(Object.is(values[3 * a + axis], values[3 * end + axis]), 'Ring seam Number bits');
    assert.deepEqual(g.uvs.slice(2 * a, 2 * a + 2), [0, (row + 1) / denominator]);
    assert.deepEqual(g.uvs.slice(2 * end, 2 * end + 2), [1, (row + 1) / denominator]);
    for (let i = 0; i <= s; i++) {
      const index = a + i, [x, yy, z] = vertex(g.positions, index), normal = vertex(g.normals, index);
      near(Math.hypot(...normal), 1);
      if (row < c - 1) nearArray(normal, [x / input.radius, (yy + input.halfLength) / input.radius, z / input.radius]);
      else if (row > c + b - 1) nearArray(normal, [x / input.radius, (yy - input.halfLength) / input.radius, z / input.radius]);
      else { near(Math.hypot(x, z), input.radius, 1e-12 * Math.max(1, input.radius)); nearArray(normal, [x / input.radius, 0, z / input.radius]); }
      assert.deepEqual(g.uvs.slice(2 * index, 2 * index + 2), [i / s, (row + 1) / denominator]);
    }
  }
  assert(input.halfLength + input.radius > previousY); assert(p.positions[top * 3 + 1] > previousF32);
  const lowerEquator = (c - 1) * (s + 1), upperEquator = (c + b - 1) * (s + 1);
  for (let i = 0; i <= s; i++) {
    assert(Object.is(g.positions[3 * (lowerEquator + i) + 1], -input.halfLength), 'Literal lower equator');
    assert(Object.is(g.positions[3 * (upperEquator + i) + 1], input.halfLength), 'Literal upper equator');
    assert(Object.is(g.normals[3 * (lowerEquator + i) + 1], 0)); assert(Object.is(g.normals[3 * (upperEquator + i) + 1], 0));
  }
  for (let i = 0; i < s; i++) {
    assert.deepEqual(vertex(g.positions, bottom + i), [0, -(input.halfLength + input.radius), 0]);
    assert.deepEqual(vertex(g.positions, top + i), [0, input.halfLength + input.radius, 0]);
    assert.deepEqual(vertex(g.normals, bottom + i), [0, -1, 0]); assert.deepEqual(vertex(g.normals, top + i), [0, 1, 0]);
    assert.deepEqual(g.uvs.slice(2 * (bottom + i), 2 * (bottom + i) + 2), [(i + .5) / s, 0]);
    assert.deepEqual(g.uvs.slice(2 * (top + i), 2 * (top + i) + 2), [(i + .5) / s, 1]);
  }
  for (let offset = 0; offset < g.indices.length; offset += 3) {
    const ids = g.indices.slice(offset, offset + 3), [a, bb, cc] = ids.map(i => vertex(g.positions, i)), normal = cross(subtract(bb, a), subtract(cc, a));
    assert(Math.hypot(...normal) > 0); for (const i of ids) assert(dot(normal, vertex(g.normals, i)) > 0, 'Every original triangle outward CCW');
  }
  for (let axis = 0; axis < 3; axis++) {
    const values = g.positions.filter((_, i) => i % 3 === axis);
    assert.equal(p.bounds.min[axis], Math.min(...values)); assert.equal(p.bounds.max[axis], Math.max(...values));
  }
  frozen(result);
}
function literal(result) {
  const g = result.prepared.geometry, q = Math.sqrt(.5), rows = [
    [[q, -2-q, 0], [0, -2-q, q], [-q, -2-q, 0], [0, -2-q, -q], [q, -2-q, 0]],
    [[1,-2,0],[0,-2,1],[-1,-2,0],[0,-2,-1],[1,-2,0]],
    [[1,2,0],[0,2,1],[-1,2,0],[0,2,-1],[1,2,0]],
    [[q,2+q,0],[0,2+q,q],[-q,2+q,0],[0,2+q,-q],[q,2+q,0]],
  ];
  rows.flat().forEach((point, i) => nearArray(vertex(g.positions, i), point));
  nearArray(vertex(g.normals, 0), [q, -q, 0]); nearArray(vertex(g.normals, 15), [q, q, 0]);
  assert.deepEqual(g.uvs.slice(0, 2), [0, .2]); assert.deepEqual(g.uvs.slice(10, 12), [0, .4]);
  assert.deepEqual(g.uvs.slice(20, 22), [0, .6]); assert.deepEqual(g.uvs.slice(30, 32), [0, .8]);
  assert.deepEqual(g.indices, [0,6,1,0,5,6,1,7,2,1,6,7,2,8,3,2,7,8,3,9,4,3,8,9,
    5,11,6,5,10,11,6,12,7,6,11,12,7,13,8,7,12,13,8,14,9,8,13,14,
    10,16,11,10,15,16,11,17,12,11,16,17,12,18,13,12,17,18,13,19,14,13,18,19,
    20,0,1,21,1,2,22,2,3,23,3,4,15,24,16,16,25,17,17,26,18,18,27,19]);
  assert.equal(result.prepared.vertexCount, 28); assert.equal(result.prepared.triangleCount, 32); assert.equal(result.prepared.bufferBytes, 1088);
  nearArray(result.prepared.bounds.min, [-1, -3, -1]); nearArray(result.prepared.bounds.max, [1, 3, 1]);
}
const ray = (origin, direction) => ({ format: 'barocss-gpu-engine-ray', version: 0, coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', origin, direction, near: 0, far: 10 });
function hits(top, body) {
  for (const hit of [top, body]) { assert(hit); assert.equal(hit.nodeId, 'capsule_0'); assert.equal(hit.geometryId, 'capsule_authored'); assert.equal(hit.materialId, 'capsule_material'); assert(Number.isInteger(hit.triangleIndex)); }
  near(top.distance, 2); nearArray(top.point, [0, 3, 0]); nearArray(top.normal, [0, 1, 0]); near(top.uv[1], 1);
  near(body.distance, 2); nearArray(body.point, [1, 0, 0]); nearArray(body.normal, [1, 0, 0]); near(body.uv[1], .5);
  assert(top.uv[0] >= 0 && top.uv[0] <= 1 && body.uv[0] >= 0 && body.uv[0] <= 1);
  // Pole/major seam ties follow first eligible original triangles, with no ordinal promise.
}

let accepted = 0, refused = 0, getters = 0, reflections = 0;
const results = [], failures = [];
try {
  for (const [provider, gpu] of providers) {
    for (const name of ['prepareCapsuleGeometry', 'prepareEngineScene', 'raycastEngineScene', 'TriangleGeometryError']) assert.equal(typeof gpu[name], 'function');
    const records = []; let first, retainedPaths;
    for (const fixture of [{ name: 'literal_closed_control', input: source() }, { name: 'nonround_subdivisions', input: source(.3, 1.7, 6, 3, 3, 'capsule_nonround') }]) {
      const input = { ...fixture.input }, before = originalJSON(input), result = gpu.prepareCapsuleGeometry(input); verify(result, input);
      assert.equal(originalJSON(input), before); if (fixture.name === 'literal_closed_control') literal(result);
      else { const equatorX = (input.capSegments - 1) * (input.radialSegments + 1) * 3;
        assert.equal(result.source.radius, .3); assert.equal(result.source.halfLength, 1.7);
        assert.equal(result.prepared.geometry.positions[equatorX], .3); assert.notEqual(result.prepared.positions[equatorX], .3); }
      const repeated = gpu.prepareCapsuleGeometry(input); verify(repeated, input);
      assert.notStrictEqual(repeated.source, result.source); assert.notStrictEqual(repeated.prepared.geometry.positions, result.prepared.geometry.positions);
      const paths = [resolve(output, provider + '.' + fixture.name + '.source.json'), resolve(output, provider + '.' + fixture.name + '.geometry.json')];
      await writeFile(paths[0], originalJSON(result.source) + '\n'); await writeFile(paths[1], originalJSON(result.prepared.geometry) + '\n');
      const originalSource = originalJSON(result.source), originalGeometry = originalJSON(result.prepared.geometry), repeatedBuffers = bufferHashes(repeated.prepared);
      input.radius = 999; input.id = 'caller_changed'; assert.equal(originalJSON(result.source), originalSource);
      for (const [name, replacement] of [['positions', 99], ['normals', .125], ['uvs', .75], ['indices', 7]]) {
        const view = result.prepared[name], old = view[0]; assert.notStrictEqual(view, repeated.prepared[name]); view[0] = replacement;
        assert.equal(view[0], replacement); assert.equal(originalJSON(result.prepared.geometry), originalGeometry); assert.deepEqual(bufferHashes(repeated.prepared), repeatedBuffers); view[0] = old;
      }
      records.push({ name: fixture.name, source: result.source, geometrySHA256: hash(originalGeometry), paths, bounds: result.prepared.bounds, buffers: bufferHashes(result.prepared) });
      if (!first) { first = result; retainedPaths = paths; } accepted++;
    }
    const maximumInput = source(1, 2, 128, 128, 64, 'capsule_maximum'), maximum = gpu.prepareCapsuleGeometry(maximumInput); verify(maximum, maximumInput);
    assert.equal(maximum.prepared.vertexCount, 33151); assert.equal(maximum.prepared.triangleCount, 65280); assert.equal(maximum.prepared.bufferBytes, 1452512);
    assert.equal(maximum.prepared.indices.reduce((max, n) => Math.max(max, n), 0), 33150); accepted++;
    const rangeInput = source(250, 750, 4, 1, 2, 'capsule_endpoint_cap'), range = gpu.prepareCapsuleGeometry(rangeInput); verify(range, rangeInput);
    nearArray(range.prepared.bounds.min, [-250, -1000, -250], 1e-12); nearArray(range.prepared.bounds.max, [250, 1000, 250], 1e-12); accepted++;
    const edited = gpu.prepareCapsuleGeometry(source(2, 3)); assert.equal(edited.source.id, first.source.id); assert.notDeepEqual(edited.prepared.geometry.positions, first.prepared.geometry.positions);
    assert.equal(first.source.radius, 1); accepted++;
    const nullInput = Object.assign(Object.create(null), source(1, 2, 4, 1, 2, 'capsule_null')); verify(gpu.prepareCapsuleGeometry(nullInput), nullInput); accepted++;
    const sceneInput = { format: 'barocss-gpu-engine-scene', version: 0, id: 'capsule_instances', coordinateSystem: 'right-handed-y-up', positionUnit: 'scene',
      background: [.02, .04, .06], camera: { eye: [0, 4, 9], target: [0, 0, 0], up: [0, 1, 0], fovY: 45, near: .1, far: 100 },
      geometries: [first.prepared.geometry], materials: [{ id: 'capsule_material', type: 'unlit', colorSpace: 'linear', color: [.2, .4, .6] }],
      nodes: [[0, 0, 0], [5, 1, -2]].map((translation, i) => ({ id: 'capsule_' + i, type: 'mesh', parentId: null, geometryId: first.source.id,
        materialId: 'capsule_material', translation, rotationXYZW: [0, 0, 0, 1], scale: i ? [1, .5, .5] : [1, 1, 1], visible: true })) };
    const sceneText = originalJSON(sceneInput), scene = gpu.prepareEngineScene(sceneInput);
    assert.equal(originalJSON(sceneInput), sceneText); assert.equal(scene.geometries.length, 1); assert.equal(scene.draws.length, 2);
    assert.strictEqual(scene.draws[0].geometry, scene.draws[1].geometry); assert.notStrictEqual(scene.geometries[0].positions, first.prepared.positions);
    assert.equal(scene.bufferBytes, 1088); assert.equal(scene.vertexWork, 56);
    nearArray(scene.nodes[0].bounds.min, [-1, -3, -1]); nearArray(scene.nodes[0].bounds.max, [1, 3, 1]);
    nearArray(scene.nodes[1].bounds.min, [4, -.5, -2.5]); nearArray(scene.nodes[1].bounds.max, [6, 2.5, -1.5]);
    const rays = { top: ray([0, 5, 0], [0, -1, 0]), body: ray([3, 0, 0], [-1, 0, 0]) };
    const topHit = gpu.raycastEngineScene(sceneInput, rays.top), bodyHit = gpu.raycastEngineScene(sceneInput, rays.body); hits(topHit, bodyHit); accepted++;
    const scenePath = resolve(output, provider + '.original-scene.json'), rayPath = resolve(output, provider + '.original-rays.json');
    await writeFile(scenePath, sceneText + '\n'); await writeFile(rayPath, originalJSON({ rays, topHit, bodyHit }) + '\n');
    const oldSource = originalJSON(first.source), oldGeometry = originalJSON(first.prepared.geometry), oldBuffers = bufferHashes(first.prepared);
    const oldFiles = await Promise.all([...retainedPaths, scenePath, rayPath].map(async path => ({ path, sha256: hash(await readFile(path)) })));
    const refusals = [];
    async function reject(name, input, code, inspect) {
      let error; try { gpu.prepareCapsuleGeometry(input); } catch (cause) { error = cause; }
      assert(error instanceof gpu.TriangleGeometryError, name); assert.equal(error.code, code, name); inspect?.(error);
      assert.equal(originalJSON(first.source), oldSource); assert.equal(originalJSON(first.prepared.geometry), oldGeometry);
      assert.deepEqual(bufferHashes(first.prepared), oldBuffers); assert.equal(originalJSON(sceneInput), sceneText);
      for (const file of oldFiles) assert.equal(hash(await readFile(file.path)), file.sha256);
      refused++; refusals.push({ name, code: error.code, message: error.message, cause: error.cause instanceof Error ? { name: error.cause.name, message: error.cause.message } : null });
    }
    for (const [name, patch, code] of [
      ['wrong version', { version: 1 }, 'VERSION'], ['wrong unit', { positionUnit: 'mm' }, 'VERSION'],
      ['extra endpoint option', { endpoint: [0, 1, 0] }, 'INPUT'], ['invalid ID', { id: '9bad' }, 'INPUT'],
      ['radius non-number', { radius: '1' }, 'INPUT'], ['halfLength nonfinite', { halfLength: Infinity }, 'INPUT'],
      ['negative-zero radius', { radius: -0 }, 'GEOMETRY'], ['zero halfLength', { halfLength: 0 }, 'GEOMETRY'],
      ['endpoint bound exceeded', { halfLength: 1000 }, 'GEOMETRY'], ['radial below minimum', { radialSegments: 2 }, 'GEOMETRY'],
      ['body below minimum', { bodySegments: 0 }, 'GEOMETRY'], ['cap below minimum', { capSegments: 1 }, 'GEOMETRY'],
      ['fractional cap segments', { capSegments: 2.5 }, 'GEOMETRY'], ['radial segment budget', { radialSegments: 129 }, 'BUDGET'],
      ['body segment budget', { bodySegments: 129 }, 'BUDGET'], ['cap segment budget', { capSegments: 65 }, 'BUDGET'],
      ['nonfinite segments', { capSegments: NaN }, 'INPUT'],
      ['original cap extent guard', { radius: Number.MIN_VALUE, halfLength: 1 }, 'GEOMETRY'],
      ['original cap intermediate Y collapse', { radius: 2 ** -52, halfLength: 1 }, 'GEOMETRY'],
      ['Float32 cap intermediate Y collapse', { radius: 2 ** -23, halfLength: 1 }, 'REPRESENTATION'],
    ]) await reject(name, { ...source(), ...patch }, code,
      name === 'original cap extent guard' || name === 'Float32 cap intermediate Y collapse'
        ? error => assert(!Object.hasOwn(error, 'cause'), 'Scoped level guard does not invent a validator cause')
        : name === 'original cap intermediate Y collapse' ? error => assert(error.cause instanceof RangeError) : undefined);
    assert(1 + 2 ** -52 > 1, 'Intermediate original-level refusal follows a resolved positive endpoint');
    const accessor = source(); Object.defineProperty(accessor, 'radius', { enumerable: true, get() { getters++; return 1; } });
    await reject('getter never invoked', accessor, 'INPUT');
    const marker = new Error('Actual Capsule source reflection failure');
    await reject('actual reflection cause', new Proxy(source(), { getPrototypeOf() { reflections++; throw marker; } }), 'INPUT', error => assert.strictEqual(error.cause, marker));
    const hidden = source(); Object.defineProperty(hidden, 'id', { enumerable: false, value: hidden.id }); await reject('hidden root field', hidden, 'INPUT');
    await reject('foreign root prototype', Object.assign(Object.create({ foreign: true }), source()), 'INPUT'); assert.equal(getters, 0);
    const childCode = `import assert from'node:assert/strict';import{readFile}from'node:fs/promises';import{pathToFileURL}from'node:url';import{createHash}from'node:crypto';
      const cfg=JSON.parse(process.argv[1]);assert.equal(Number(process.versions.node.split('.')[0]),22);const hash=v=>createHash('sha256').update(v).digest('hex'),out=[];
      const sourceScene=JSON.parse(await readFile(cfg.scene,'utf8')),saved=JSON.parse(await readFile(cfg.rays,'utf8'));
      for(const entry of cfg.entries){const gpu=await import(pathToFileURL(entry).href);assert.deepEqual(Object.keys(gpu).sort(),cfg.namespace);const rows=[];
        for(const files of cfg.files){const source=JSON.parse(await readFile(files[0],'utf8')),geometry=JSON.parse(await readFile(files[1],'utf8')),result=gpu.prepareCapsuleGeometry(source);assert.deepEqual(result.source,source);assert.deepEqual(result.prepared.geometry,geometry);rows.push(Object.fromEntries(['positions','normals','uvs','indices'].map(k=>{const a=result.prepared[k];return[k,hash(Buffer.from(a.buffer,a.byteOffset,a.byteLength))]})));}
        const scene=gpu.prepareEngineScene(sourceScene);assert.equal(scene.geometries.length,1);assert.equal(scene.draws.length,2);assert.strictEqual(scene.draws[0].geometry,scene.draws[1].geometry);
        const top=gpu.raycastEngineScene(sourceScene,saved.rays.top),body=gpu.raycastEngineScene(sourceScene,saved.rays.body);assert.deepEqual(top,saved.topHit);assert.deepEqual(body,saved.bodyHit);out.push({rows,bounds:scene.nodes.map(n=>n.bounds),top,body});}
      console.log(JSON.stringify({node:process.version,providers:out}));`;
    const cold = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', childCode, JSON.stringify({ entries: [ordinary, emitted], namespace,
      files: records.map(record => record.paths), scene: scenePath, rays: rayPath })], { encoding: 'utf8' }));
    for (const row of cold.providers) { assert.deepEqual(row.rows, records.map(record => record.buffers)); assert.deepEqual(row.bounds, scene.nodes.map(node => node.bounds)); hits(row.top, row.body); }
    results.push({ provider, records, maximum: { rings: 255, vertices: 33151, triangles: 65280, numericValues: 461048, bytes: 1452512, maxIndex: 33150 },
      maximumRange: { source: range.source, bounds: range.prepared.bounds }, editedSource: edited.source,
      scene: { path: scenePath, rayPath, bounds: scene.nodes.map(node => node.bounds), topHit, bodyHit }, cold, refusals, retainedFiles: oldFiles });
  }
  assert.deepEqual(results[0].records.map(({ paths, ...record }) => record), results[1].records.map(({ paths, ...record }) => record));
  assert.deepEqual(results[0].scene.bounds, results[1].scene.bounds); assert.deepEqual(results[0].scene.topHit, results[1].scene.topHit); assert.deepEqual(results[0].scene.bodyHit, results[1].scene.bodyHit);
} catch (error) { failures.push(String(error.stack ?? error)); throw error; }
finally {
  const report = { issue: 1404, parent: '1614fdf964806f2ab76f018145b33323bfdaf73c',
    head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(), accepted, refused, getters, reflections,
    namespaceCount: namespace.length, sourceGraph: graph, results, failures,
    providers: { ordinary: { path: ordinary, sha256: hash(await readFile(ordinary)) }, emitted: { path: emitted, sha256: hash(await readFile(emitted)) },
      declarations: { path: declarationPath, sha256: hash(declaration), leafSHA256: hash(leafDeclaration) } }, actualGL: false, nativeCAD: false, publicCodec: false,
    limits: ['Generic closed sampled Capsule; original scalar parameters, generated Number mesh and mutable F32 execution remain separate.',
      'Equators are literal shared rows, poles have split UVs, and V is a ring-index parameter rather than metric arc length.',
      'Sampled bounds are not analytical/native/outward-rounded enclosure; original polygon CPU rays are not ideal SDF/raster hits.',
      'Original/F32 axial level guards reject merged levels without inventing kernel causes or certifying global quality.',
      'Own GPU/source-CAD graph is not all-CAD coverage; cold private evidence adds no public codec, renderer/parity/currentRoot/publication proof.'] };
  await writeFile(resolve(output, 'actual-result.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ issue: 1404, accepted, refused, getters, reflections, namespaceCount: namespace.length, actualGL: false, failures }));
}
