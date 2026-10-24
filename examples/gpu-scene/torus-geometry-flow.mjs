/** #1389: one authored Torus/source/emitted/Scene/ray/file/cold CPU flow.
 * node examples/gpu-scene/torus-geometry-flow.mjs --output <fresh-directory>
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
for (const name of ['torus-geometry.ts', 'torus-geometry-build-internal.ts', 'triangle-geometry.ts', 'engine-scene.ts', 'engine-raycast.ts'])
  assert(graph.some(path => (path.includes('/src/') && path.endsWith('/' + name))), 'Actual own source dependency ' + name);
assert(!graph.some(path => /barocss-gpu\/dist\//.test(path)), 'No own emitted fallback in ordinary source');
const providers = [['ordinary-source', await import(pathToFileURL(ordinary).href)], ['emitted-public', await import(pathToFileURL(emitted).href)]];
const namespace = Object.keys(providers[0][1]).sort(); assert.deepEqual(namespace, Object.keys(providers[1][1]).sort());
const declarationPath = resolve(pkg, published.types), declaration = await readFile(declarationPath, 'utf8');
for (const name of ['prepareTorusGeometry', 'TorusGeometrySourceV0', 'PreparedTorusGeometry'])
  assert(new RegExp('\\b' + name + '\\b').test(declaration), 'Actual public DTS ' + name);
const leafDeclaration = await readFile(resolve(pkg, 'dist/geometry/torus-geometry.d.ts'), 'utf8');
assert(/prepareTorusGeometry\(input:\s*unknown\):\s*PreparedTorusGeometry/.test(leafDeclaration));
for (const field of ['majorRadius', 'minorRadius', 'majorSegments', 'minorSegments'])
  assert(new RegExp(field + ':\\s*number').test(leafDeclaration));

const hash = value => createHash('sha256').update(value).digest('hex');
function originalJSON(value) {
  if (typeof value === 'number') { assert(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(originalJSON).join(',') + ']';
  return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + originalJSON(child)).join(',') + '}';
}
const source = (majorRadius = 2, minorRadius = .5, majorSegments = 4, minorSegments = 4, id = 'torus_authored') => ({
  format: 'barocss-gpu-torus-geometry', version: 0, id, coordinateSystem: 'right-handed-y-up', positionUnit: 'scene',
  majorRadius, minorRadius, majorSegments, minorSegments });
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
  const p = result.prepared, g = p.geometry, w = input.majorSegments, h = input.minorSegments;
  const v = (w + 1) * (h + 1), t = 2 * w * h;
  assert.equal(g.format, 'barocss-gpu-triangle-geometry'); assert.equal(g.version, 0); assert.equal(g.id, input.id);
  assert.equal(g.coordinateSystem, 'right-handed-y-up'); assert.equal(g.positionUnit, 'scene'); assert.equal(g.winding, 'ccw');
  assert.equal(p.vertexCount, v); assert.equal(p.triangleCount, t); assert.equal(p.bufferBytes, 32 * v + 6 * t); assert.equal(p.indexType, 'uint16');
  assert(p.positions instanceof Float32Array && p.normals instanceof Float32Array && p.uvs instanceof Float32Array && p.indices instanceof Uint16Array);
  assert.equal(g.positions.length, 3 * v); assert.equal(g.normals.length, 3 * v); assert.equal(g.uvs.length, 2 * v); assert.equal(g.indices.length, 3 * t);
  for (const name of ['positions', 'normals', 'uvs']) assert.deepEqual(Array.from(p[name]), g[name].map(Math.fround));
  assert.deepEqual(Array.from(p.indices), g.indices);
  for (let j = 0; j <= h; j++) {
    const a = j * (w + 1), b = a + w;
    for (const values of [g.positions, g.normals]) for (let axis = 0; axis < 3; axis++)
      assert(Object.is(values[3 * a + axis], values[3 * b + axis]), 'Major seam retains original Number bits');
    assert.deepEqual(g.uvs.slice(2 * a, 2 * a + 2), [0, j / h]); assert.deepEqual(g.uvs.slice(2 * b, 2 * b + 2), [1, j / h]);
  }
  for (let i = 0; i <= w; i++) {
    const a = i, b = h * (w + 1) + i;
    for (const values of [g.positions, g.normals]) for (let axis = 0; axis < 3; axis++)
      assert(Object.is(values[3 * a + axis], values[3 * b + axis]), 'Minor seam retains original Number bits');
    assert.deepEqual(g.uvs.slice(2 * a, 2 * a + 2), [i / w, 0]); assert.deepEqual(g.uvs.slice(2 * b, 2 * b + 2), [i / w, 1]);
  }
  assert.deepEqual(g.uvs.slice(0, 2), [0, 0]); assert.deepEqual(g.uvs.slice(2 * w, 2 * w + 2), [1, 0]);
  assert.deepEqual(g.uvs.slice(2 * h * (w + 1), 2 * h * (w + 1) + 2), [0, 1]); assert.deepEqual(g.uvs.slice(-2), [1, 1]);
  for (let i = 0; i < v; i++) {
    const [x, y, z] = vertex(g.positions, i), rho = Math.hypot(x, z), n = vertex(g.normals, i);
    near(Math.hypot(...n), 1); near(Math.hypot(rho - input.majorRadius, y), input.minorRadius, 1e-12 * Math.max(1, input.minorRadius));
    nearArray(n, [(rho - input.majorRadius) / input.minorRadius * x / rho, y / input.minorRadius,
      (rho - input.majorRadius) / input.minorRadius * z / rho], 1e-12);
  }
  for (let offset = 0; offset < g.indices.length; offset += 3) {
    const ids = g.indices.slice(offset, offset + 3), [a, b, c] = ids.map(i => vertex(g.positions, i));
    const normal = cross(subtract(b, a), subtract(c, a)); assert(Math.hypot(...normal) > 0);
    for (const i of ids) assert(dot(normal, vertex(g.normals, i)) > 0, 'Every original triangle outward CCW');
  }
  for (let axis = 0; axis < 3; axis++) {
    const values = g.positions.filter((_, i) => i % 3 === axis);
    assert.equal(p.bounds.min[axis], Math.min(...values)); assert.equal(p.bounds.max[axis], Math.max(...values));
  }
  frozen(result);
}
function cardinal(result) {
  const g = result.prepared.geometry;
  const rows = [
    [[2.5, 0, 0], [0, 0, 2.5], [-2.5, 0, 0], [0, 0, -2.5], [2.5, 0, 0]],
    [[2, .5, 0], [0, .5, 2], [-2, .5, 0], [0, .5, -2], [2, .5, 0]],
    [[1.5, 0, 0], [0, 0, 1.5], [-1.5, 0, 0], [0, 0, -1.5], [1.5, 0, 0]],
    [[2, -.5, 0], [0, -.5, 2], [-2, -.5, 0], [0, -.5, -2], [2, -.5, 0]],
  ];
  rows.push(rows[0]); rows.flat().forEach((point, i) => nearArray(vertex(g.positions, i), point));
  nearArray(vertex(g.normals, 0), [1, 0, 0]); nearArray(vertex(g.normals, 5), [0, 1, 0]);
  nearArray(vertex(g.normals, 10), [-1, 0, 0]); nearArray(vertex(g.normals, 15), [0, -1, 0]);
  assert.deepEqual(g.indices, [0,6,1,0,5,6,1,7,2,1,6,7,2,8,3,2,7,8,3,9,4,3,8,9,
    5,11,6,5,10,11,6,12,7,6,11,12,7,13,8,7,12,13,8,14,9,8,13,14,
    10,16,11,10,15,16,11,17,12,11,16,17,12,18,13,12,17,18,13,19,14,13,18,19,
    15,21,16,15,20,21,16,22,17,16,21,22,17,23,18,17,22,23,18,24,19,18,23,24]);
  const [a, b, c] = g.indices.slice(0, 3).map(i => vertex(g.positions, i)), raw = cross(subtract(b, a), subtract(c, a));
  const facet = raw.map(n => n / Math.hypot(...raw)); assert(Math.hypot(...subtract(facet, vertex(g.normals, 0))) > .1, 'Radial normal differs from facet normal');
  assert.equal(result.prepared.vertexCount, 25); assert.equal(result.prepared.triangleCount, 32); assert.equal(result.prepared.bufferBytes, 992);
  nearArray(result.prepared.bounds.min, [-2.5, -.5, -2.5]); nearArray(result.prepared.bounds.max, [2.5, .5, 2.5]);
}
const ray = origin => ({ format: 'barocss-gpu-engine-ray', version: 0, coordinateSystem: 'right-handed-y-up', positionUnit: 'scene',
  origin, direction: [0, -1, 0], near: 0, far: 10 });
function tubeHit(hit) {
  assert(hit); assert.equal(hit.nodeId, 'ring_0'); assert.equal(hit.geometryId, 'torus_authored'); assert.equal(hit.materialId, 'torus_material');
  near(hit.distance, 2.5); nearArray(hit.point, [2, .5, 0]); nearArray(hit.normal, [0, 1, 0]);
  near(hit.uv[1], .25); assert(Math.abs(hit.uv[0]) <= 1e-14 || Math.abs(hit.uv[0] - 1) <= 1e-14, 'Front seam UV endpoint');
  assert(Number.isInteger(hit.triangleIndex)); // Existing first eligible tie policy; no independent ordinal promise.
}

let accepted = 0, refused = 0, getters = 0, reflections = 0;
const results = [], failures = [];
try {
  for (const [provider, gpu] of providers) {
    for (const name of ['prepareTorusGeometry', 'prepareEngineScene', 'raycastEngineScene', 'TriangleGeometryError']) assert.equal(typeof gpu[name], 'function');
    const records = []; let first, retainedPaths;
    for (const fixture of [{ name: 'literal_cardinals', input: source() }, { name: 'nonround_radii', input: source(1.7, .3, 4, 4, 'torus_nonround') }]) {
      const input = { ...fixture.input }, before = originalJSON(input), result = gpu.prepareTorusGeometry(input); verify(result, input);
      assert.equal(originalJSON(input), before); if (fixture.name === 'literal_cardinals') cardinal(result);
      else { assert.equal(result.source.majorRadius, 1.7); assert.equal(result.source.minorRadius, .3);
        assert.equal(result.prepared.geometry.positions[16], .3); assert.notEqual(result.prepared.positions[16], .3); }
      const repeated = gpu.prepareTorusGeometry(input); verify(repeated, input);
      assert.notStrictEqual(repeated.source, result.source); assert.notStrictEqual(repeated.prepared.geometry.positions, result.prepared.geometry.positions);
      const paths = [resolve(output, provider + '.' + fixture.name + '.source.json'), resolve(output, provider + '.' + fixture.name + '.geometry.json')];
      await writeFile(paths[0], originalJSON(result.source) + '\n'); await writeFile(paths[1], originalJSON(result.prepared.geometry) + '\n');
      const originalSource = originalJSON(result.source), originalGeometry = originalJSON(result.prepared.geometry), repeatedBuffers = bufferHashes(repeated.prepared);
      input.majorRadius = 999; input.id = 'caller_changed'; assert.equal(originalJSON(result.source), originalSource);
      for (const [name, replacement] of [['positions', 99], ['normals', .125], ['uvs', .75], ['indices', 7]]) {
        const view = result.prepared[name], old = view[0]; assert.notStrictEqual(view, repeated.prepared[name]); view[0] = replacement;
        assert.equal(view[0], replacement); assert.equal(originalJSON(result.prepared.geometry), originalGeometry);
        assert.deepEqual(bufferHashes(repeated.prepared), repeatedBuffers); view[0] = old;
      }
      records.push({ name: fixture.name, source: result.source, geometrySHA256: hash(originalGeometry), paths,
        bounds: result.prepared.bounds, buffers: bufferHashes(result.prepared) }); if (!first) { first = result; retainedPaths = paths; } accepted++;
    }
    const maxInput = source(2, .5, 128, 128, 'torus_maximum'), maximum = gpu.prepareTorusGeometry(maxInput); verify(maximum, maxInput);
    assert.equal(maximum.prepared.vertexCount, 16641); assert.equal(maximum.prepared.triangleCount, 32768); assert.equal(maximum.prepared.bufferBytes, 729120);
    assert.equal(Math.max(...maximum.prepared.indices), 16640); accepted++;
    const outerInput = source(750, 250, 4, 4, 'torus_outer_cap'), outer = gpu.prepareTorusGeometry(outerInput); verify(outer, outerInput);
    nearArray(outer.prepared.bounds.min, [-1000, -250, -1000], 1e-12); nearArray(outer.prepared.bounds.max, [1000, 250, 1000], 1e-12); accepted++;
    const edited = gpu.prepareTorusGeometry(source(3, .75)); assert.equal(edited.source.id, first.source.id);
    assert.notDeepEqual(edited.prepared.geometry.positions, first.prepared.geometry.positions); assert.equal(first.source.majorRadius, 2); accepted++;
    const nullInput = Object.assign(Object.create(null), source(2, .5, 4, 4, 'torus_null'));
    verify(gpu.prepareTorusGeometry(nullInput), nullInput); accepted++;
    const sceneInput = { format: 'barocss-gpu-engine-scene', version: 0, id: 'torus_instances', coordinateSystem: 'right-handed-y-up', positionUnit: 'scene',
      background: [.02, .04, .06], camera: { eye: [0, 5, 12], target: [0, 0, 0], up: [0, 1, 0], fovY: 45, near: .1, far: 100 },
      geometries: [first.prepared.geometry], materials: [{ id: 'torus_material', type: 'unlit', colorSpace: 'linear', color: [.2, .4, .6] }],
      nodes: [[0, 0, 0], [6, 1, 0]].map((translation, i) => ({ id: 'ring_' + i, type: 'mesh', parentId: null, geometryId: first.source.id,
        materialId: 'torus_material', translation, rotationXYZW: [0, 0, 0, 1], scale: [1, i ? .5 : 1, 1], visible: true })) };
    const sceneText = originalJSON(sceneInput), scene = gpu.prepareEngineScene(sceneInput);
    assert.equal(originalJSON(sceneInput), sceneText); assert.equal(scene.geometries.length, 1); assert.equal(scene.draws.length, 2);
    assert.strictEqual(scene.draws[0].geometry, scene.draws[1].geometry); assert.notStrictEqual(scene.geometries[0].positions, first.prepared.positions);
    assert.equal(scene.bufferBytes, 992); assert.equal(scene.vertexWork, 50);
    nearArray(scene.nodes[0].bounds.min, [-2.5, -.5, -2.5]); nearArray(scene.nodes[0].bounds.max, [2.5, .5, 2.5]);
    nearArray(scene.nodes[1].bounds.min, [3.5, .75, -2.5]); nearArray(scene.nodes[1].bounds.max, [8.5, 1.25, 2.5]);
    const rays = { hole: ray([0, 3, 0]), tube: ray([2, 3, 0]) }, hit = gpu.raycastEngineScene(sceneInput, rays.tube);
    assert.equal(gpu.raycastEngineScene(sceneInput, rays.hole), null); tubeHit(hit); accepted++;
    const scenePath = resolve(output, provider + '.original-scene.json'), rayPath = resolve(output, provider + '.original-rays.json');
    await writeFile(scenePath, sceneText + '\n'); await writeFile(rayPath, originalJSON({ rays, hit }) + '\n');
    const oldSource = originalJSON(first.source), oldGeometry = originalJSON(first.prepared.geometry), oldBuffers = bufferHashes(first.prepared);
    const oldFiles = await Promise.all([...retainedPaths, scenePath, rayPath].map(async path => ({ path, sha256: hash(await readFile(path)) })));
    const refusals = [];
    async function reject(name, input, code, inspect) {
      let error; try { gpu.prepareTorusGeometry(input); } catch (cause) { error = cause; }
      assert(error instanceof gpu.TriangleGeometryError, name); assert.equal(error.code, code, name); inspect?.(error);
      assert.equal(originalJSON(first.source), oldSource); assert.equal(originalJSON(first.prepared.geometry), oldGeometry);
      assert.deepEqual(bufferHashes(first.prepared), oldBuffers); assert.equal(originalJSON(sceneInput), sceneText);
      for (const file of oldFiles) assert.equal(hash(await readFile(file.path)), file.sha256);
      refused++; refusals.push({ name, code: error.code, message: error.message, cause: error.cause instanceof Error ? { name: error.cause.name, message: error.cause.message } : null });
    }
    for (const [name, patch, code] of [
      ['wrong metadata version', { version: 1 }, 'VERSION'], ['wrong coordinate frame', { coordinateSystem: 'z-up' }, 'VERSION'],
      ['extra centre field', { center: [0, 0, 0] }, 'INPUT'], ['invalid ID', { id: '9bad' }, 'INPUT'],
      ['major nonfinite', { majorRadius: Infinity }, 'INPUT'], ['minor non-number', { minorRadius: '.5' }, 'INPUT'],
      ['minor zero', { minorRadius: 0 }, 'GEOMETRY'], ['minor negative zero', { minorRadius: -0 }, 'GEOMETRY'],
      ['negative radius', { majorRadius: -2 }, 'GEOMETRY'], ['horn relation', { minorRadius: 2 }, 'GEOMETRY'],
      ['outer bound exceeded', { majorRadius: 1000 }, 'GEOMETRY'], ['major lower segments', { majorSegments: 2 }, 'GEOMETRY'],
      ['minor fractional segments', { minorSegments: 3.5 }, 'GEOMETRY'], ['major upper segments', { majorSegments: 129 }, 'BUDGET'],
      ['minor upper segments', { minorSegments: 129 }, 'BUDGET'], ['nonfinite segments', { minorSegments: NaN }, 'INPUT'],
      ['original tiny area', { majorRadius: 2 * Number.MIN_VALUE, minorRadius: Number.MIN_VALUE }, 'GEOMETRY'],
      ['nonzero Float32 underflow', { majorRadius: 2e-50, minorRadius: .5e-50 }, 'REPRESENTATION'],
    ]) await reject(name, { ...source(), ...patch }, code,
      name === 'original tiny area' ? error => assert(error.cause instanceof RangeError) : undefined);
    const accessor = source(); Object.defineProperty(accessor, 'majorRadius', { enumerable: true, get() { getters++; return 2; } });
    await reject('getter never invoked', accessor, 'INPUT');
    const marker = new Error('Actual Torus source reflection failure');
    await reject('actual reflection cause', new Proxy(source(), { getPrototypeOf() { reflections++; throw marker; } }), 'INPUT', error => assert.strictEqual(error.cause, marker));
    assert.equal(getters, 0);
    const childCode = `import assert from'node:assert/strict';import{readFile}from'node:fs/promises';import{pathToFileURL}from'node:url';import{createHash}from'node:crypto';
      const cfg=JSON.parse(process.argv[1]);assert.equal(Number(process.versions.node.split('.')[0]),22);const hash=v=>createHash('sha256').update(v).digest('hex'),out=[];
      const sourceScene=JSON.parse(await readFile(cfg.scene,'utf8')),savedRays=JSON.parse(await readFile(cfg.rays,'utf8'));
      for(const entry of cfg.entries){const gpu=await import(pathToFileURL(entry).href);assert.deepEqual(Object.keys(gpu).sort(),cfg.namespace);const rows=[];
        for(const files of cfg.files){const source=JSON.parse(await readFile(files[0],'utf8')),geometry=JSON.parse(await readFile(files[1],'utf8')),result=gpu.prepareTorusGeometry(source);assert.deepEqual(result.source,source);assert.deepEqual(result.prepared.geometry,geometry);rows.push(Object.fromEntries(['positions','normals','uvs','indices'].map(k=>{const a=result.prepared[k];return[k,hash(Buffer.from(a.buffer,a.byteOffset,a.byteLength))]})));}
        const scene=gpu.prepareEngineScene(sourceScene);assert.equal(scene.geometries.length,1);assert.equal(scene.draws.length,2);assert.strictEqual(scene.draws[0].geometry,scene.draws[1].geometry);
        assert.equal(gpu.raycastEngineScene(sourceScene,savedRays.rays.hole),null);const hit=gpu.raycastEngineScene(sourceScene,savedRays.rays.tube);assert.deepEqual(hit,savedRays.hit);out.push({rows,bounds:scene.nodes.map(n=>n.bounds),hit});}
      console.log(JSON.stringify({node:process.version,providers:out}));`;
    const cold = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', childCode, JSON.stringify({ entries: [ordinary, emitted],
      namespace, files: records.map(record => record.paths), scene: scenePath, rays: rayPath })], { encoding: 'utf8' }));
    for (const row of cold.providers) { assert.deepEqual(row.rows, records.map(record => record.buffers)); assert.deepEqual(row.bounds, scene.nodes.map(node => node.bounds)); tubeHit(row.hit); }
    results.push({ provider, records, maximum: { vertices: 16641, triangles: 32768, numericValues: 231432, bytes: 729120, maxIndex: 16640 },
      maximumOuter: { source: outer.source, bounds: outer.prepared.bounds }, editedSource: edited.source,
      scene: { path: scenePath, rayPath, bounds: scene.nodes.map(node => node.bounds), hit, holeMiss: true }, cold, refusals, retainedFiles: oldFiles });
  }
  assert.deepEqual(results[0].records.map(({ paths, ...record }) => record), results[1].records.map(({ paths, ...record }) => record));
  assert.deepEqual(results[0].scene.bounds, results[1].scene.bounds); assert.deepEqual(results[0].scene.hit, results[1].scene.hit);
} catch (error) { failures.push(String(error.stack ?? error)); throw error; }
finally {
  const report = { issue: 1389, parent: '89cf31f7896938efb035818f9b82e556e8b16ab3',
    head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(), accepted, refused, getters, reflections,
    namespaceCount: namespace.length, sourceGraph: graph, results, failures,
    providers: { ordinary: { path: ordinary, sha256: hash(await readFile(ordinary)) }, emitted: { path: emitted, sha256: hash(await readFile(emitted)) },
      declarations: { path: declarationPath, sha256: hash(declaration), leafSHA256: hash(leafDeclaration) } },
    actualGL: false, nativeCAD: false, publicCodec: false,
    limits: ['Generic origin-centred sampled Y-ring mesh; original scalar parameters are distinct from generated Number mesh and mutable F32 views.',
      'Sampled bounds are not analytical torus enclosure, native topology or outward-rounded guarantees.',
      'Ray results describe admitted original polygon triangles, not ideal SDF geometry or raster pixels; vertex ties retain first eligible policy.',
      'Own GPU source graph and actual public emitted API do not establish all transitive CAD API coverage.',
      'Cold original JSON is evidence only; no renderer, physical-memory, parity, currentRoot/consumer or publication certificate.'] };
  await writeFile(resolve(output, 'actual-result.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ issue: 1389, accepted, refused, getters, reflections, namespaceCount: namespace.length, actualGL: false, failures }));
}
