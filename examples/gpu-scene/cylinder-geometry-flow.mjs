/** #1396: one closed Cylinder/source/emitted/Scene/ray/file/cold CPU flow.
 * node examples/gpu-scene/cylinder-geometry-flow.mjs --output <fresh-directory>
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
for (const name of ['cylinder-geometry.ts', 'cylinder-geometry-build-internal.ts', 'triangle-geometry.ts', 'engine-scene.ts', 'engine-raycast.ts'])
  assert(graph.some(path => path.endsWith('/src/' + name)), 'Actual own source dependency ' + name);
assert(graph.some(path => /barocss-cad\/src\//.test(path)), 'Actual transitive own CAD source graph');
assert(!graph.some(path => /barocss-(gpu|cad)\/dist\//.test(path)), 'No own emitted fallback in ordinary source');
const providers = [['ordinary-source', await import(pathToFileURL(ordinary).href)], ['emitted-public', await import(pathToFileURL(emitted).href)]];
const namespace = Object.keys(providers[0][1]).sort(); assert.deepEqual(namespace, Object.keys(providers[1][1]).sort());
const declarationPath = resolve(pkg, published.types), declaration = await readFile(declarationPath, 'utf8');
for (const name of ['prepareCylinderGeometry', 'CylinderGeometrySourceV0', 'PreparedCylinderGeometry'])
  assert(new RegExp('\\b' + name + '\\b').test(declaration), 'Actual public DTS ' + name);
const leafDeclaration = await readFile(resolve(pkg, 'dist/cylinder-geometry.d.ts'), 'utf8');
assert(/prepareCylinderGeometry\(input:\s*unknown\):\s*PreparedCylinderGeometry/.test(leafDeclaration));
for (const field of ['radius', 'height', 'radialSegments', 'heightSegments']) assert(new RegExp(field + ':\\s*number').test(leafDeclaration));
const hash = value => createHash('sha256').update(value).digest('hex');
function originalJSON(value) {
  if (typeof value === 'number') { assert(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(originalJSON).join(',') + ']';
  return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + originalJSON(child)).join(',') + '}';
}
const source = (radius = 1, height = 3, radialSegments = 4, heightSegments = 1, id = 'cylinder_authored') => ({
  format: 'barocss-gpu-cylinder-geometry', version: 0, id, coordinateSystem: 'right-handed-y-up', positionUnit: 'scene',
  radius, height, radialSegments, heightSegments });
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
  const p = result.prepared, g = p.geometry, s = input.radialSegments, h = input.heightSegments;
  const sideCount = (s + 1) * (h + 1), topRim = sideCount, topCentre = topRim + s + 1;
  const bottomRim = topCentre + 1, bottomCentre = bottomRim + s + 1, count = sideCount + 2 * (s + 2), triangles = 2 * s * h + 2 * s;
  assert.equal(g.format, 'barocss-gpu-triangle-geometry'); assert.equal(g.version, 0); assert.equal(g.id, input.id);
  assert.equal(g.coordinateSystem, 'right-handed-y-up'); assert.equal(g.positionUnit, 'scene'); assert.equal(g.winding, 'ccw');
  assert.equal(p.vertexCount, count); assert.equal(p.triangleCount, triangles); assert.equal(p.bufferBytes, 32 * count + 6 * triangles); assert.equal(p.indexType, 'uint16');
  assert(p.positions instanceof Float32Array && p.normals instanceof Float32Array && p.uvs instanceof Float32Array && p.indices instanceof Uint16Array);
  assert.equal(g.positions.length, 3 * count); assert.equal(g.normals.length, 3 * count); assert.equal(g.uvs.length, 2 * count); assert.equal(g.indices.length, 3 * triangles);
  for (const name of ['positions', 'normals', 'uvs']) assert.deepEqual(Array.from(p[name]), g[name].map(Math.fround));
  assert.deepEqual(Array.from(p.indices), g.indices);
  for (let j = 0; j <= h; j++) {
    const a = j * (s + 1), b = a + s;
    for (const values of [g.positions, g.normals]) for (let axis = 0; axis < 3; axis++) assert(Object.is(values[3 * a + axis], values[3 * b + axis]), 'Side seam Number bits');
    assert.deepEqual(g.uvs.slice(2 * a, 2 * a + 2), [0, j / h]); assert.deepEqual(g.uvs.slice(2 * b, 2 * b + 2), [1, j / h]);
    for (let i = 0; i <= s; i++) {
      const index = a + i, [x, y, z] = vertex(g.positions, index), normal = vertex(g.normals, index);
      near(Math.hypot(x, z), input.radius, 1e-12 * Math.max(1, input.radius));
      assert(Object.is(y, input.height * (j / h - .5)), 'Original row operation order');
      nearArray(normal, [x / input.radius, 0, z / input.radius]); assert.equal(g.uvs[2 * index], i / s);
    }
  }
  for (const [rim, centre, row, sign] of [[topRim, topCentre, h * (s + 1), 1], [bottomRim, bottomCentre, 0, -1]]) {
    for (let i = 0; i <= s; i++) {
      for (let axis = 0; axis < 3; axis++) assert(Object.is(g.positions[3 * (rim + i) + axis], g.positions[3 * (row + i) + axis]), 'Copied cap rim Number bits');
      assert.deepEqual(vertex(g.normals, rim + i), [0, sign, 0]);
      assert.deepEqual(g.uvs.slice(2 * (rim + i), 2 * (rim + i) + 2), [(g.normals[3 * (row + i)] + 1) / 2, (g.normals[3 * (row + i) + 2] + 1) / 2]);
      assert.notDeepEqual(vertex(g.normals, rim + i), vertex(g.normals, row + i), 'Hard cap/side crease');
    }
    assert.deepEqual(vertex(g.positions, centre), [0, g.positions[3 * row + 1], 0]);
    assert.deepEqual(vertex(g.normals, centre), [0, sign, 0]); assert.deepEqual(g.uvs.slice(2 * centre, 2 * centre + 2), [.5, .5]);
    for (const values of [g.positions, g.normals]) for (let axis = 0; axis < 3; axis++)
      assert(Object.is(values[3 * rim + axis], values[3 * (rim + s) + axis]), 'Cap rim seam Number bits');
    assert.deepEqual(g.uvs.slice(2 * rim, 2 * rim + 2), g.uvs.slice(2 * (rim + s), 2 * (rim + s) + 2));
  }
  for (let offset = 0; offset < g.indices.length; offset += 3) {
    const ids = g.indices.slice(offset, offset + 3), [a, b, c] = ids.map(i => vertex(g.positions, i)), normal = cross(subtract(b, a), subtract(c, a));
    assert(Math.hypot(...normal) > 0); for (const i of ids) assert(dot(normal, vertex(g.normals, i)) > 0, 'Every original triangle outward CCW');
  }
  for (let axis = 0; axis < 3; axis++) {
    const values = g.positions.filter((_, i) => i % 3 === axis);
    assert.equal(p.bounds.min[axis], Math.min(...values)); assert.equal(p.bounds.max[axis], Math.max(...values));
  }
  frozen(result);
}
function literal(result) {
  const g = result.prepared.geometry, bottom = [[1, -1.5, 0], [0, -1.5, 1], [-1, -1.5, 0], [0, -1.5, -1], [1, -1.5, 0]];
  bottom.forEach((point, i) => nearArray(vertex(g.positions, i), point));
  bottom.map(([x, , z]) => [x, 1.5, z]).forEach((point, i) => nearArray(vertex(g.positions, i + 5), point));
  assert.deepEqual(g.indices, [0,6,1,0,5,6,1,7,2,1,6,7,2,8,3,2,7,8,3,9,4,3,8,9,
    15,11,10,15,12,11,15,13,12,15,14,13,21,16,17,21,17,18,21,18,19,21,19,20]);
  assert.equal(result.prepared.vertexCount, 22); assert.equal(result.prepared.triangleCount, 16); assert.equal(result.prepared.bufferBytes, 800);
  nearArray(result.prepared.bounds.min, [-1, -1.5, -1]); nearArray(result.prepared.bounds.max, [1, 1.5, 1]);
  const [a, b, c] = g.indices.slice(0, 3).map(i => vertex(g.positions, i)), raw = cross(subtract(b, a), subtract(c, a));
  assert(Math.hypot(...subtract(raw.map(n => n / Math.hypot(...raw)), vertex(g.normals, 0))) > .1, 'Side radial normals differ from polygon facet normals');
}
const ray = (origin, direction) => ({ format: 'barocss-gpu-engine-ray', version: 0, coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', origin, direction, near: 0, far: 10 });
function hits(top, side) {
  for (const hit of [top, side]) { assert(hit); assert.equal(hit.nodeId, 'cylinder_0'); assert.equal(hit.geometryId, 'cylinder_authored'); assert.equal(hit.materialId, 'cylinder_material'); assert(Number.isInteger(hit.triangleIndex)); }
  near(top.distance, 1.5); nearArray(top.point, [0, 1.5, 0]); nearArray(top.normal, [0, 1, 0]); nearArray(top.uv, [.5, .5]);
  near(side.distance, 2); nearArray(side.point, [1, 0, 0]); nearArray(side.normal, [1, 0, 0]); near(side.uv[1], .5);
  assert(side.uv[0] >= 0 && side.uv[0] <= 1); // Seam ties use existing first eligible order; no ordinal promise.
}

let accepted = 0, refused = 0, getters = 0, reflections = 0;
const results = [], failures = [];
try {
  for (const [provider, gpu] of providers) {
    for (const name of ['prepareCylinderGeometry', 'prepareEngineScene', 'raycastEngineScene', 'TriangleGeometryError']) assert.equal(typeof gpu[name], 'function');
    const records = []; let first, retainedPaths;
    for (const fixture of [{ name: 'literal_closed_control', input: source() }, { name: 'nonround_source', input: source(.3, .7, 6, 3, 'cylinder_nonround') }]) {
      const input = { ...fixture.input }, before = originalJSON(input), result = gpu.prepareCylinderGeometry(input); verify(result, input);
      assert.equal(originalJSON(input), before); if (fixture.name === 'literal_closed_control') literal(result);
      else { assert.equal(result.source.radius, .3); assert.equal(result.source.height, .7); assert.equal(result.prepared.geometry.positions[0], .3); assert.notEqual(result.prepared.positions[0], .3); }
      const repeated = gpu.prepareCylinderGeometry(input); verify(repeated, input);
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
    const maximumInput = source(1, 3, 128, 128, 'cylinder_maximum'), maximum = gpu.prepareCylinderGeometry(maximumInput); verify(maximum, maximumInput);
    assert.equal(maximum.prepared.vertexCount, 16901); assert.equal(maximum.prepared.triangleCount, 33024); assert.equal(maximum.prepared.bufferBytes, 738976);
    assert.equal(Math.max(...maximum.prepared.indices), 16900); accepted++;
    const rangeInput = source(1000, 2000, 4, 1, 'cylinder_range'), range = gpu.prepareCylinderGeometry(rangeInput); verify(range, rangeInput);
    nearArray(range.prepared.bounds.min, [-1000, -1000, -1000], 1e-12); nearArray(range.prepared.bounds.max, [1000, 1000, 1000], 1e-12); accepted++;
    const edited = gpu.prepareCylinderGeometry(source(2, 4)); assert.equal(edited.source.id, first.source.id); assert.notDeepEqual(edited.prepared.geometry.positions, first.prepared.geometry.positions);
    assert.equal(first.source.radius, 1); accepted++;
    const nullInput = Object.assign(Object.create(null), source(1, 3, 4, 1, 'cylinder_null')); verify(gpu.prepareCylinderGeometry(nullInput), nullInput); accepted++;
    const sceneInput = { format: 'barocss-gpu-engine-scene', version: 0, id: 'cylinder_instances', coordinateSystem: 'right-handed-y-up', positionUnit: 'scene',
      background: [.02, .04, .06], camera: { eye: [0, 3, 8], target: [0, 0, 0], up: [0, 1, 0], fovYDegrees: 45, near: .1, far: 100 },
      geometries: [first.prepared.geometry], materials: [{ id: 'cylinder_material', type: 'unlit', colorSpace: 'linear', color: [.2, .4, .6] }],
      nodes: [[0, 0, 0], [4, 0, -2]].map((translation, i) => ({ id: 'cylinder_' + i, type: 'mesh', parentId: null, geometryId: first.source.id,
        materialId: 'cylinder_material', translation, rotationXYZW: [0, 0, 0, 1], scale: i ? [1, 2, .5] : [1, 1, 1], visible: true })) };
    const sceneText = originalJSON(sceneInput), scene = gpu.prepareEngineScene(sceneInput);
    assert.equal(originalJSON(sceneInput), sceneText); assert.equal(scene.geometries.length, 1); assert.equal(scene.draws.length, 2);
    assert.strictEqual(scene.draws[0].geometry, scene.draws[1].geometry); assert.notStrictEqual(scene.geometries[0].positions, first.prepared.positions);
    assert.equal(scene.bufferBytes, 800); assert.equal(scene.vertexWork, 44);
    nearArray(scene.nodes[0].bounds.min, [-1, -1.5, -1]); nearArray(scene.nodes[0].bounds.max, [1, 1.5, 1]);
    nearArray(scene.nodes[1].bounds.min, [3, -3, -2.5]); nearArray(scene.nodes[1].bounds.max, [5, 3, -1.5]);
    const rays = { top: ray([0, 3, 0], [0, -1, 0]), side: ray([3, 0, 0], [-1, 0, 0]) };
    const topHit = gpu.raycastEngineScene(sceneInput, rays.top), sideHit = gpu.raycastEngineScene(sceneInput, rays.side); hits(topHit, sideHit); accepted++;
    const scenePath = resolve(output, provider + '.original-scene.json'), rayPath = resolve(output, provider + '.original-rays.json');
    await writeFile(scenePath, sceneText + '\n'); await writeFile(rayPath, originalJSON({ rays, topHit, sideHit }) + '\n');
    const oldSource = originalJSON(first.source), oldGeometry = originalJSON(first.prepared.geometry), oldBuffers = bufferHashes(first.prepared);
    const oldFiles = await Promise.all([...retainedPaths, scenePath, rayPath].map(async path => ({ path, sha256: hash(await readFile(path)) })));
    const refusals = [];
    async function reject(name, input, code, inspect) {
      let error; try { gpu.prepareCylinderGeometry(input); } catch (cause) { error = cause; }
      assert(error instanceof gpu.TriangleGeometryError, name); assert.equal(error.code, code, name); inspect?.(error);
      assert.equal(originalJSON(first.source), oldSource); assert.equal(originalJSON(first.prepared.geometry), oldGeometry);
      assert.deepEqual(bufferHashes(first.prepared), oldBuffers); assert.equal(originalJSON(sceneInput), sceneText);
      for (const file of oldFiles) assert.equal(hash(await readFile(file.path)), file.sha256);
      refused++; refusals.push({ name, code: error.code, message: error.message, cause: error.cause instanceof Error ? { name: error.cause.name, message: error.cause.message } : null });
    }
    for (const [name, patch, code] of [
      ['wrong version', { version: 1 }, 'VERSION'], ['wrong unit', { positionUnit: 'mm' }, 'VERSION'],
      ['extra open-cap option', { openEnded: true }, 'INPUT'], ['invalid ID', { id: '9bad' }, 'INPUT'],
      ['radius non-number', { radius: '1' }, 'INPUT'], ['height nonfinite', { height: Infinity }, 'INPUT'],
      ['negative-zero radius', { radius: -0 }, 'GEOMETRY'], ['height zero', { height: 0 }, 'GEOMETRY'],
      ['negative height', { height: -1 }, 'GEOMETRY'], ['radius above cap', { radius: 1001 }, 'GEOMETRY'],
      ['height above cap', { height: 2001 }, 'GEOMETRY'], ['radial below minimum', { radialSegments: 2 }, 'GEOMETRY'],
      ['height cells below minimum', { heightSegments: 0 }, 'GEOMETRY'], ['fractional height cells', { heightSegments: 1.5 }, 'GEOMETRY'],
      ['radial segment budget', { radialSegments: 129 }, 'BUDGET'], ['height segment budget', { heightSegments: 129 }, 'BUDGET'],
      ['nonfinite segments', { radialSegments: NaN }, 'INPUT'], ['original half-height underflow', { height: Number.MIN_VALUE }, 'GEOMETRY'],
      ['Float32 trigonometric coordinate underflow', { radius: 1e-35, height: 1 }, 'REPRESENTATION'],
    ]) await reject(name, { ...source(), ...patch }, code,
      name === 'original half-height underflow' ? error => assert(error.cause instanceof RangeError) : undefined);
    assert(Math.fround(1e-35) > 0 && Math.fround(.5) > 0, 'The tiny-coordinate refusal is not zero Float32 radius/half-height admission');
    const accessor = source(); Object.defineProperty(accessor, 'radius', { enumerable: true, get() { getters++; return 1; } });
    await reject('getter never invoked', accessor, 'INPUT');
    const marker = new Error('Actual Cylinder source reflection failure');
    await reject('actual reflection cause', new Proxy(source(), { getPrototypeOf() { reflections++; throw marker; } }), 'INPUT', error => assert.strictEqual(error.cause, marker));
    const hidden = source(); Object.defineProperty(hidden, 'id', { enumerable: false, value: hidden.id }); await reject('hidden root field', hidden, 'INPUT');
    await reject('foreign root prototype', Object.assign(Object.create({ foreign: true }), source()), 'INPUT'); assert.equal(getters, 0);
    const childCode = `import assert from'node:assert/strict';import{readFile}from'node:fs/promises';import{pathToFileURL}from'node:url';import{createHash}from'node:crypto';
      const cfg=JSON.parse(process.argv[1]);assert.equal(Number(process.versions.node.split('.')[0]),22);const hash=v=>createHash('sha256').update(v).digest('hex'),out=[];
      const sourceScene=JSON.parse(await readFile(cfg.scene,'utf8')),saved=JSON.parse(await readFile(cfg.rays,'utf8'));
      for(const entry of cfg.entries){const gpu=await import(pathToFileURL(entry).href);assert.deepEqual(Object.keys(gpu).sort(),cfg.namespace);const rows=[];
        for(const files of cfg.files){const source=JSON.parse(await readFile(files[0],'utf8')),geometry=JSON.parse(await readFile(files[1],'utf8')),result=gpu.prepareCylinderGeometry(source);assert.deepEqual(result.source,source);assert.deepEqual(result.prepared.geometry,geometry);rows.push(Object.fromEntries(['positions','normals','uvs','indices'].map(k=>{const a=result.prepared[k];return[k,hash(Buffer.from(a.buffer,a.byteOffset,a.byteLength))]})));}
        const scene=gpu.prepareEngineScene(sourceScene);assert.equal(scene.geometries.length,1);assert.equal(scene.draws.length,2);assert.strictEqual(scene.draws[0].geometry,scene.draws[1].geometry);
        const top=gpu.raycastEngineScene(sourceScene,saved.rays.top),side=gpu.raycastEngineScene(sourceScene,saved.rays.side);assert.deepEqual(top,saved.topHit);assert.deepEqual(side,saved.sideHit);out.push({rows,bounds:scene.nodes.map(n=>n.bounds),top,side});}
      console.log(JSON.stringify({node:process.version,providers:out}));`;
    const cold = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', childCode, JSON.stringify({ entries: [ordinary, emitted], namespace,
      files: records.map(record => record.paths), scene: scenePath, rays: rayPath })], { encoding: 'utf8' }));
    for (const row of cold.providers) { assert.deepEqual(row.rows, records.map(record => record.buffers)); assert.deepEqual(row.bounds, scene.nodes.map(node => node.bounds)); hits(row.top, row.side); }
    results.push({ provider, records, maximum: { vertices: 16901, triangles: 33024, numericValues: 234280, bytes: 738976, maxIndex: 16900 },
      maximumRange: { source: range.source, bounds: range.prepared.bounds }, editedSource: edited.source,
      scene: { path: scenePath, rayPath, bounds: scene.nodes.map(node => node.bounds), topHit, sideHit }, cold, refusals, retainedFiles: oldFiles });
  }
  assert.deepEqual(results[0].records.map(({ paths, ...record }) => record), results[1].records.map(({ paths, ...record }) => record));
  assert.deepEqual(results[0].scene.bounds, results[1].scene.bounds); assert.deepEqual(results[0].scene.topHit, results[1].scene.topHit); assert.deepEqual(results[0].scene.sideHit, results[1].scene.sideHit);
} catch (error) { failures.push(String(error.stack ?? error)); throw error; }
finally {
  const report = { issue: 1396, parent: '85cf445be8cafd795ae2815998c7b941df252c03',
    head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(), accepted, refused, getters, reflections,
    namespaceCount: namespace.length, sourceGraph: graph, results, failures,
    providers: { ordinary: { path: ordinary, sha256: hash(await readFile(ordinary)) }, emitted: { path: emitted, sha256: hash(await readFile(emitted)) },
      declarations: { path: declarationPath, sha256: hash(declaration), leafSHA256: hash(leafDeclaration) } }, actualGL: false, nativeCAD: false, publicCodec: false,
    limits: ['Generic closed sampled Cylinder; original scalar parameters stay separate from generated Number mesh and mutable Float32 execution.',
      'Side radial and hard cap normals are distinct; sampled bounds are not analytical circle enclosure, native topology or outward rounding.',
      'Original polygon CPU ray queries retain first eligible triangle ties, not ideal SDF hits or raster pixels.',
      'Own GPU source graph/public emitted checks are not all-transitive-CAD coverage; no renderer, physical-memory, parity, currentRoot or publication proof.',
      'Cold original JSON is private evidence, not a public geometry codec.'] };
  await writeFile(resolve(output, 'actual-result.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ issue: 1396, accepted, refused, getters, reflections, namespaceCount: namespace.length, actualGL: false, failures }));
}
