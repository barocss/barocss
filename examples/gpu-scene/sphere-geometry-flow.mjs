/** #1379: one original-parameter/source/emitted/Scene/file/cold CPU flow. No GL.
 * node examples/gpu-scene/sphere-geometry-flow.mjs --output <fresh-directory>
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';

assert.equal(Number(process.versions.node.split('.')[0]), 22, 'Actual Node22 required');
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2), at = args.indexOf('--output');
assert(at >= 0 && args[at + 1] && !args[at + 1].startsWith('--'), '--output <fresh-directory> required');
const output = resolve(args[at + 1]); await mkdir(output, { recursive: false });
const pkg = resolve(repo, 'packages/barocss-gpu');
const manifest = JSON.parse(await readFile(resolve(pkg, 'package.json'), 'utf8'));
const published = manifest.publishConfig.exports['.'];
assert.equal(published.import, './dist/index.js'); assert.equal(published.types, './dist/index.d.ts');
const ordinary = resolve(output, 'ordinary-source.mjs'), emitted = resolve(pkg, published.import);
const bundled = await build({ entryPoints: [resolve(pkg, manifest.exports['.'].import)], bundle: true,
  format: 'esm', platform: 'node', target: 'node22', outfile: ordinary, metafile: true });
const graph = Object.keys(bundled.metafile.inputs);
for (const name of ['sphere-geometry.ts', 'sphere-geometry-build-internal.ts', 'triangle-geometry.ts', 'engine-scene.ts'])
  assert(graph.some(path => (path.includes('/src/') && path.endsWith('/' + name))), 'Actual own source dependency ' + name);
assert(!graph.some(path => /barocss-gpu\/dist\//.test(path)), 'No own emitted fallback in ordinary source');
const providers = [['ordinary-source', await import(pathToFileURL(ordinary).href)],
  ['emitted-public', await import(pathToFileURL(emitted).href)]];
const namespace = Object.keys(providers[0][1]).sort();
assert.deepEqual(namespace, Object.keys(providers[1][1]).sort());
const declarationPath = resolve(pkg, published.types), declaration = await readFile(declarationPath, 'utf8');
for (const name of ['prepareSphereGeometry', 'SphereGeometrySourceV0', 'PreparedSphereGeometry'])
  assert(new RegExp('\\b' + name + '\\b').test(declaration), 'Actual public declaration ' + name);
const leafDeclaration = await readFile(resolve(pkg, 'dist/sphere-geometry.d.ts'), 'utf8');
assert(/prepareSphereGeometry\(input:\s*unknown\):\s*PreparedSphereGeometry/.test(leafDeclaration));
for (const field of ['radius', 'longitudeSegments', 'latitudeSegments'])
  assert(new RegExp(field + ':\\s*number').test(leafDeclaration));

const hash = value => createHash('sha256').update(value).digest('hex');
function originalJSON(value) {
  if (typeof value === 'number') { assert(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(originalJSON).join(',') + ']';
  return '{' + Object.entries(value).map(([name, child]) => JSON.stringify(name) + ':' + originalJSON(child)).join(',') + '}';
}
const source = (radius = 2, longitudeSegments = 4, latitudeSegments = 2, id = 'sphere_authored') => ({
  format: 'barocss-gpu-sphere-geometry', version: 0, id, coordinateSystem: 'right-handed-y-up',
  positionUnit: 'scene', radius, longitudeSegments, latitudeSegments });
const near = (a, b, tolerance = 1e-14) => assert(Math.abs(a - b) <= tolerance, `${a} versus independent ${b}`);
const nearArray = (a, b, tolerance = 1e-14) => { assert.equal(a.length, b.length); a.forEach((n, i) => near(n, b[i], tolerance)); };
const subtract = (a, b) => a.map((n, i) => n - b[i]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a.reduce((sum, n, i) => sum + n * b[i], 0);
const vertex = (values, index) => values.slice(3 * index, 3 * index + 3);
const bufferHashes = prepared => Object.fromEntries(['positions', 'normals', 'uvs', 'indices'].map(name => {
  const array = prepared[name]; return [name, hash(Buffer.from(array.buffer, array.byteOffset, array.byteLength))];
}));
function frozen(value) {
  if (value && typeof value === 'object' && !ArrayBuffer.isView(value)) {
    assert(Object.isFrozen(value)); Object.values(value).forEach(frozen);
  }
}
function verify(result, input) {
  assert.deepEqual(Object.keys(result).sort(), ['prepared', 'source']);
  assert.deepEqual(result.source, { ...input }); assert.notStrictEqual(result.source, input);
  assert.deepEqual(Object.keys(result.source).sort(), Object.keys(source()).sort());
  const p = result.prepared, g = p.geometry, w = input.longitudeSegments, h = input.latitudeSegments;
  const vertices = (h - 1) * (w + 1) + 2 * w, triangles = 2 * w * (h - 1);
  assert.equal(g.id, input.id); assert.equal(g.format, 'barocss-gpu-triangle-geometry');
  assert.equal(g.version, 0); assert.equal(g.coordinateSystem, 'right-handed-y-up');
  assert.equal(g.positionUnit, 'scene'); assert.equal(g.winding, 'ccw');
  assert.equal(p.vertexCount, vertices); assert.equal(p.triangleCount, triangles);
  assert.equal(p.bufferBytes, 32 * vertices + 6 * triangles); assert.equal(p.indexType, 'uint16');
  assert(p.positions instanceof Float32Array && p.normals instanceof Float32Array && p.uvs instanceof Float32Array);
  assert(p.indices instanceof Uint16Array);
  assert.equal(g.positions.length, 3 * vertices); assert.equal(g.normals.length, 3 * vertices);
  assert.equal(g.uvs.length, 2 * vertices); assert.equal(g.indices.length, 3 * triangles);
  assert.deepEqual(Array.from(p.positions), g.positions.map(Math.fround));
  assert.deepEqual(Array.from(p.normals), g.normals.map(Math.fround));
  assert.deepEqual(Array.from(p.uvs), g.uvs.map(Math.fround)); assert.deepEqual(Array.from(p.indices), g.indices);
  for (let j = 1; j < h; j++) {
    const start = (j - 1) * (w + 1), end = start + w;
    for (const values of [g.positions, g.normals]) for (let axis = 0; axis < 3; axis++)
      assert(Object.is(values[3 * start + axis], values[3 * end + axis]), 'Copied seam Number bits');
    assert.equal(g.uvs[2 * start], 0); assert.equal(g.uvs[2 * end], 1);
    assert.equal(g.uvs[2 * start + 1], 1 - j / h);
  }
  const north = (h - 1) * (w + 1), south = north + w;
  for (let i = 0; i < w; i++) {
    assert.deepEqual(vertex(g.positions, north + i), [0, input.radius, 0]);
    assert.deepEqual(vertex(g.positions, south + i), [0, -input.radius, 0]);
    assert.deepEqual(vertex(g.normals, north + i), [0, 1, 0]);
    assert.deepEqual(vertex(g.normals, south + i), [0, -1, 0]);
    assert.deepEqual(g.uvs.slice(2 * (north + i), 2 * (north + i) + 2), [(i + .5) / w, 1]);
    assert.deepEqual(g.uvs.slice(2 * (south + i), 2 * (south + i) + 2), [(i + .5) / w, 0]);
  }
  for (let i = 0; i < vertices; i++) {
    near(Math.hypot(...vertex(g.normals, i)), 1);
    nearArray(vertex(g.positions, i), vertex(g.normals, i).map(n => input.radius * n));
  }
  for (let offset = 0; offset < g.indices.length; offset += 3) {
    const ids = g.indices.slice(offset, offset + 3), [a, b, c] = ids.map(id => vertex(g.positions, id));
    const facet = cross(subtract(b, a), subtract(c, a)); assert(Math.hypot(...facet) > 0);
    for (const id of ids) assert(dot(facet, vertex(g.normals, id)) > 0, 'Every original triangle outward CCW');
  }
  for (let axis = 0; axis < 3; axis++) {
    const values = g.positions.filter((_, index) => index % 3 === axis);
    assert.equal(p.bounds.min[axis], Math.min(...values)); assert.equal(p.bounds.max[axis], Math.max(...values));
  }
  frozen(result);
}
function cardinalControl(result) {
  const g = result.prepared.geometry;
  [[2, 0, 0], [0, 0, 2], [-2, 0, 0], [0, 0, -2], [2, 0, 0]]
    .forEach((point, i) => nearArray(vertex(g.positions, i), point));
  assert.deepEqual(g.indices, [5, 1, 0, 6, 2, 1, 7, 3, 2, 8, 4, 3, 0, 1, 9, 1, 2, 10, 2, 3, 11, 3, 4, 12]);
  assert.equal(result.prepared.vertexCount, 13); assert.equal(result.prepared.triangleCount, 8);
  assert.equal(result.prepared.bufferBytes, 464);
  const ids = g.indices.slice(0, 3), [a, b, c] = ids.map(id => vertex(g.positions, id));
  const raw = cross(subtract(b, a), subtract(c, a)), facet = raw.map(n => n / Math.hypot(...raw));
  assert(Math.hypot(...subtract(facet, vertex(g.normals, ids[0]))) > .1, 'Radial smooth normal is not a triangle facet normal');
  nearArray(result.prepared.bounds.min, [-2, -2, -2]); nearArray(result.prepared.bounds.max, [2, 2, 2]);
}

let accepted = 0, refused = 0, getters = 0, reflections = 0;
const results = [], failures = [];
try {
  for (const [provider, gpu] of providers) {
    for (const name of ['prepareSphereGeometry', 'prepareEngineScene', 'TriangleGeometryError']) assert.equal(typeof gpu[name], 'function');
    const records = []; let first, savedFiles;
    for (const fixture of [{ name: 'literal_cardinals', input: source() },
      { name: 'nonround_radius', input: source(.3, 5, 3, 'sphere_nonround') }]) {
      const input = { ...fixture.input }, before = originalJSON(input), result = gpu.prepareSphereGeometry(input);
      verify(result, input); assert.equal(originalJSON(input), before);
      if (fixture.name === 'literal_cardinals') cardinalControl(result);
      else {
        const northY = (input.latitudeSegments - 1) * (input.longitudeSegments + 1) * 3 + 1;
        assert.equal(result.prepared.geometry.positions[northY], .3);
        assert.notEqual(result.prepared.positions[northY], .3, 'Original non-round radius stays separate from Float32');
      }
      const repeated = gpu.prepareSphereGeometry(input); verify(repeated, input);
      assert.notStrictEqual(repeated.source, result.source); assert.notStrictEqual(repeated.prepared.geometry.positions, result.prepared.geometry.positions);
      const files = [resolve(output, provider + '.' + fixture.name + '.source.json'), resolve(output, provider + '.' + fixture.name + '.geometry.json')];
      await writeFile(files[0], originalJSON(result.source) + '\n'); await writeFile(files[1], originalJSON(result.prepared.geometry) + '\n');
      const oldSource = originalJSON(result.source), oldGeometry = originalJSON(result.prepared.geometry), repeatedHashes = bufferHashes(repeated.prepared);
      input.radius = 999; input.id = 'caller_changed'; assert.equal(originalJSON(result.source), oldSource);
      for (const [name, replacement] of [['positions', 77], ['normals', .125], ['uvs', .75], ['indices', 7]]) {
        assert.notStrictEqual(repeated.prepared[name], result.prepared[name]);
        const value = result.prepared[name][0]; result.prepared[name][0] = replacement;
        assert.equal(result.prepared[name][0], replacement); assert.equal(originalJSON(result.prepared.geometry), oldGeometry);
        assert.deepEqual(bufferHashes(repeated.prepared), repeatedHashes); result.prepared[name][0] = value;
      }
      const record = { name: fixture.name, source: result.source, geometrySHA256: hash(oldGeometry), buffers: bufferHashes(result.prepared),
        counts: { vertices: result.prepared.vertexCount, triangles: result.prepared.triangleCount, bytes: result.prepared.bufferBytes }, files };
      records.push(record); if (!first) { first = result; savedFiles = files; } accepted++;
    }
    const maximumInput = source(2, 128, 128, 'sphere_maximum');
    const maximum = gpu.prepareSphereGeometry(maximumInput); verify(maximum, maximumInput);
    assert.equal(maximum.prepared.vertexCount, 16639); assert.equal(maximum.prepared.triangleCount, 32512);
    assert.equal(maximum.prepared.bufferBytes, 727520); assert.equal(Math.max(...maximum.prepared.indices), 16638); accepted++;
    const edited = gpu.prepareSphereGeometry(source(3)); assert.equal(edited.source.id, first.source.id);
    assert.notDeepEqual(edited.prepared.geometry.positions, first.prepared.geometry.positions); assert.equal(first.source.radius, 2); accepted++;
    const nullInput = Object.assign(Object.create(null), source(2, 4, 2, 'sphere_null'));
    const nullResult = gpu.prepareSphereGeometry(nullInput); verify(nullResult, nullInput); accepted++;
    const sceneInput = { format: 'barocss-gpu-engine-scene', version: 0, id: 'sphere_instances', coordinateSystem: 'right-handed-y-up', positionUnit: 'scene',
      background: [.02, .04, .06], camera: { eye: [0, 0, 15], target: [0, 0, 0], up: [0, 1, 0], fovY: 45, near: .1, far: 100 },
      geometries: [first.prepared.geometry], materials: [{ id: 'sphere_material', type: 'unlit', colorSpace: 'linear', color: [.2, .4, .6] }],
      nodes: [[-5, 0, 0], [5, 1, -2]].map((translation, i) => ({ id: 'sphere_' + i, type: 'mesh', parentId: null,
        geometryId: first.source.id, materialId: 'sphere_material', translation, rotationXYZW: [0, 0, 0, 1], scale: [1, 1, 1], visible: true })) };
    const sceneBefore = originalJSON(sceneInput), scene = gpu.prepareEngineScene(sceneInput);
    assert.equal(originalJSON(sceneInput), sceneBefore); assert.equal(scene.geometries.length, 1); assert.equal(scene.draws.length, 2);
    assert.equal(scene.bufferBytes, 464); assert.equal(scene.vertexWork, 26); assert.strictEqual(scene.draws[0].geometry, scene.draws[1].geometry);
    assert.notStrictEqual(scene.geometries[0].positions, first.prepared.positions);
    nearArray(scene.nodes[0].bounds.min, [-7, -2, -2]); nearArray(scene.nodes[0].bounds.max, [-3, 2, 2]);
    nearArray(scene.nodes[1].bounds.min, [3, -1, -4]); nearArray(scene.nodes[1].bounds.max, [7, 3, 0]);
    const scenePath = resolve(output, provider + '.original-scene.json'); await writeFile(scenePath, sceneBefore + '\n'); accepted++;

    const firstSource = originalJSON(first.source), firstGeometry = originalJSON(first.prepared.geometry), firstHashes = bufferHashes(first.prepared);
    const oldFiles = await Promise.all(savedFiles.map(async path => ({ path, sha256: hash(await readFile(path)) })));
    const refusals = [];
    async function reject(name, input, code, inspect) {
      let error; try { gpu.prepareSphereGeometry(input); } catch (cause) { error = cause; }
      assert(error instanceof gpu.TriangleGeometryError, name); assert.equal(error.code, code, name); inspect?.(error);
      assert.equal(originalJSON(first.source), firstSource); assert.equal(originalJSON(first.prepared.geometry), firstGeometry);
      assert.deepEqual(bufferHashes(first.prepared), firstHashes); assert.equal(originalJSON(sceneInput), sceneBefore);
      for (const file of oldFiles) assert.equal(hash(await readFile(file.path)), file.sha256);
      refusals.push({ name, code: error.code, message: error.message, cause: error.cause instanceof Error ? { name: error.cause.name, message: error.cause.message } : null }); refused++;
    }
    for (const [name, patch, code] of [
      ['extra centre', { center: [0, 0, 0] }, 'INPUT'], ['wrong version', { version: 1 }, 'VERSION'],
      ['wrong frame', { coordinateSystem: 'z-up' }, 'VERSION'], ['wrong unit', { positionUnit: 'mm' }, 'VERSION'],
      ['bad ID', { id: '9bad' }, 'INPUT'], ['radius zero', { radius: 0 }, 'GEOMETRY'],
      ['radius minus zero', { radius: -0 }, 'GEOMETRY'], ['radius negative', { radius: -1 }, 'GEOMETRY'],
      ['radius above cap', { radius: 1001 }, 'GEOMETRY'], ['radius nonfinite', { radius: Infinity }, 'INPUT'],
      ['longitude below minimum', { longitudeSegments: 2 }, 'GEOMETRY'], ['latitude below minimum', { latitudeSegments: 1 }, 'GEOMETRY'],
      ['longitude above cap', { longitudeSegments: 129 }, 'BUDGET'], ['latitude above cap', { latitudeSegments: 129 }, 'BUDGET'],
      ['fractional segment', { longitudeSegments: 3.5 }, 'GEOMETRY'], ['non-number segment', { latitudeSegments: '2' }, 'INPUT'],
      ['tiny original area', { radius: 1e-200 }, 'GEOMETRY'], ['tiny Float32 representation', { radius: 1e-50 }, 'REPRESENTATION'],
    ]) await reject(name, { ...source(), ...patch }, code);
    const accessor = source(); Object.defineProperty(accessor, 'radius', { enumerable: true, get() { getters++; return 2; } });
    await reject('getter not invoked', accessor, 'INPUT');
    const marker = new Error('Actual Sphere root reflection failure');
    await reject('reflection retains actual cause', new Proxy(source(), { getPrototypeOf() { reflections++; throw marker; } }), 'INPUT', error => assert.strictEqual(error.cause, marker));
    assert.equal(getters, 0);

    const childCode = `import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';import{pathToFileURL}from'node:url';import{createHash}from'node:crypto';
      const cfg=JSON.parse(process.argv[1]);assert.equal(Number(process.versions.node.split('.')[0]),22);
      const hash=v=>createHash('sha256').update(v).digest('hex'),out=[];
      for(const entry of cfg.entries){const gpu=await import(pathToFileURL(entry).href);assert.deepEqual(Object.keys(gpu).sort(),cfg.namespace);const rows=[];
        for(const files of cfg.files){const input=JSON.parse(await readFile(files[0],'utf8')),g=JSON.parse(await readFile(files[1],'utf8')),result=gpu.prepareSphereGeometry(input);assert.deepEqual(result.source,input);assert.deepEqual(result.prepared.geometry,g);
          rows.push(Object.fromEntries(['positions','normals','uvs','indices'].map(k=>{const a=result.prepared[k];return[k,hash(Buffer.from(a.buffer,a.byteOffset,a.byteLength))]})));}
        const scene=gpu.prepareEngineScene(JSON.parse(await readFile(cfg.scene,'utf8')));assert.equal(scene.geometries.length,1);assert.equal(scene.draws.length,2);assert.strictEqual(scene.draws[0].geometry,scene.draws[1].geometry);out.push({rows,bounds:scene.nodes.map(n=>n.bounds)});}
      console.log(JSON.stringify({node:process.version,providers:out}));`;
    const cold = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', childCode,
      JSON.stringify({ entries: [ordinary, emitted], namespace, files: records.map(record => record.files), scene: scenePath })], { encoding: 'utf8' }));
    for (const row of cold.providers) {
      assert.deepEqual(row.rows, records.map(record => record.buffers)); assert.deepEqual(row.bounds, scene.nodes.map(node => node.bounds));
    }
    results.push({ provider, namespaceCount: Object.keys(gpu).length, records, maximum: { vertices: 16639, triangles: 32512, bytes: 727520, numericValues: 230648 },
      editedSource: edited.source, scene: { path: scenePath, sharedGeometries: 1, instances: 2, bounds: scene.nodes.map(node => node.bounds) },
      cold, refusals, retainedFiles: oldFiles });
  }
  assert.deepEqual(results[0].records.map(({ files, ...record }) => record), results[1].records.map(({ files, ...record }) => record));
  assert.deepEqual(results[0].scene.bounds, results[1].scene.bounds);
} catch (error) { failures.push(String(error.stack ?? error)); throw error; }
finally {
  const report = { issue: 1379, parent: '618d9dca3ce5b87df6f3ca57ff33a37f3bbee9fb',
    head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
    accepted, refused, getters, reflections, namespaceCount: namespace.length, ordinarySourceGraph: graph, results, failures,
    providers: { ordinary: { path: ordinary, sha256: hash(await readFile(ordinary)) }, emitted: { path: emitted, sha256: hash(await readFile(emitted)) },
      declarations: { path: declarationPath, sha256: hash(declaration), leafSHA256: hash(leafDeclaration) } },
    actualGL: false, nativeCAD: false, publicCodec: false,
    limits: ['Generic sampled Y-polar triangle Sphere; original scalar source stays separate from generated Number geometry and mutable Float32 execution.',
      'Bounds describe actual sampled vertices, not an analytical sphere or outward enclosure.', 'Radial smooth normals differ from triangle facet normals; no exact-circle/surface certificate.',
      'Two shared EngineScene instances and cold Node22 files prove CPU source composition only; no raster pixels, physical memory, parity or publication.',
      'Source graph qualification covers own GPU source inputs; it is not a claim that every transitive CAD API was exercised.'] };
  await writeFile(resolve(output, 'actual-result.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ issue: 1379, accepted, refused, getters, reflections, namespaceCount: namespace.length, actualGL: false, failures }));
}
