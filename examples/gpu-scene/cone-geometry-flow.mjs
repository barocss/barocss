/** #1400: one closed Cone/source/emitted/Scene/ray/file/cold CPU flow.
 * node examples/gpu-scene/cone-geometry-flow.mjs --output <fresh-directory>
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
for (const name of ['cone-geometry.ts', 'cone-geometry-build-internal.ts', 'triangle-geometry.ts', 'engine-scene.ts', 'engine-raycast.ts'])
  assert(graph.some(path => (path.includes('/src/') && path.endsWith('/' + name))), 'Actual own source dependency ' + name);
assert(graph.some(path => /barocss-cad\/src\//.test(path)), 'Actual transitive own CAD source graph');
assert(!graph.some(path => /barocss-(gpu|cad)\/dist\//.test(path)), 'No own emitted fallback in ordinary source');
const providers = [['ordinary-source', await import(pathToFileURL(ordinary).href)], ['emitted-public', await import(pathToFileURL(emitted).href)]];
const namespace = Object.keys(providers[0][1]).sort(); assert.deepEqual(namespace, Object.keys(providers[1][1]).sort());
const declarationPath = resolve(pkg, published.types), declaration = await readFile(declarationPath, 'utf8');
for (const name of ['prepareConeGeometry', 'ConeGeometrySourceV0', 'PreparedConeGeometry'])
  assert(new RegExp('\\b' + name + '\\b').test(declaration), 'Actual public DTS ' + name);
const leafDeclaration = await readFile(resolve(pkg, 'dist/cone-geometry.d.ts'), 'utf8');
assert(/prepareConeGeometry\(input:\s*unknown\):\s*PreparedConeGeometry/.test(leafDeclaration));
for (const field of ['radius', 'height', 'radialSegments', 'heightSegments']) assert(new RegExp(field + ':\\s*number').test(leafDeclaration));

const hash = value => createHash('sha256').update(value).digest('hex');
function originalJSON(value) {
  if (typeof value === 'number') { assert(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(originalJSON).join(',') + ']';
  return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + originalJSON(child)).join(',') + '}';
}
const source = (radius = 1, height = 3, radialSegments = 4, heightSegments = 1, id = 'cone_authored') => ({
  format: 'barocss-gpu-cone-geometry', version: 0, id, coordinateSystem: 'right-handed-y-up', positionUnit: 'scene',
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
  const sideCount = h * (s + 1), apexStart = sideCount, rimStart = apexStart + s, centre = rimStart + s + 1;
  const count = (h + 2) * (s + 1), triangles = 2 * s * h, slopeLength = Math.hypot(input.height, input.radius);
  assert.equal(g.format, 'barocss-gpu-triangle-geometry'); assert.equal(g.version, 0); assert.equal(g.id, input.id);
  assert.equal(g.coordinateSystem, 'right-handed-y-up'); assert.equal(g.positionUnit, 'scene'); assert.equal(g.winding, 'ccw');
  assert.equal(p.vertexCount, count); assert.equal(p.triangleCount, triangles); assert.equal(p.bufferBytes, 32 * count + 6 * triangles); assert.equal(p.indexType, 'uint16');
  assert(p.positions instanceof Float32Array && p.normals instanceof Float32Array && p.uvs instanceof Float32Array && p.indices instanceof Uint16Array);
  assert.equal(g.positions.length, 3 * count); assert.equal(g.normals.length, 3 * count); assert.equal(g.uvs.length, 2 * count); assert.equal(g.indices.length, 3 * triangles);
  for (const name of ['positions', 'normals', 'uvs']) assert.deepEqual(Array.from(p[name]), g[name].map(Math.fround));
  assert.deepEqual(Array.from(p.indices), g.indices);
  for (let j = 0; j < h; j++) {
    const a = j * (s + 1), b = a + s, rho = input.radius * (1 - j / h);
    for (const values of [g.positions, g.normals]) for (let axis = 0; axis < 3; axis++) assert(Object.is(values[3 * a + axis], values[3 * b + axis]), 'Side seam Number bits');
    assert.deepEqual(g.uvs.slice(2 * a, 2 * a + 2), [0, j / h]); assert.deepEqual(g.uvs.slice(2 * b, 2 * b + 2), [1, j / h]);
    for (let i = 0; i <= s; i++) {
      const index = a + i, [x, y, z] = vertex(g.positions, index), normal = vertex(g.normals, index);
      near(Math.hypot(x, z), rho, 1e-12 * Math.max(1, rho));
      assert(Object.is(y, input.height * (j / h - .5)), 'Original positive-row operation order');
      nearArray(normal, [input.height * (x / rho) / slopeLength, input.radius / slopeLength, input.height * (z / rho) / slopeLength]);
      near(Math.hypot(...normal), 1); assert.deepEqual(g.uvs.slice(2 * index, 2 * index + 2), [i / s, j / h]);
    }
  }
  for (let i = 0; i < s; i++) {
    assert.deepEqual(vertex(g.positions, apexStart + i), [0, input.height * .5, 0]);
    assert.deepEqual(g.uvs.slice(2 * (apexStart + i), 2 * (apexStart + i) + 2), [(i + .5) / s, 1]);
    const normal = vertex(g.normals, apexStart + i);
    near(Math.hypot(...normal), 1); near(normal[1], input.radius / slopeLength);
    near(Math.hypot(normal[0], normal[2]), input.height / slopeLength);
    assert.notDeepEqual(normal, vertex(g.normals, (i + 1) % s + apexStart), 'Separate apex sector shading normals');
  }
  for (let i = 0; i <= s; i++) {
    for (let axis = 0; axis < 3; axis++) assert(Object.is(g.positions[3 * (rimStart + i) + axis], g.positions[3 * i + axis]), 'Actual bottom rim copies row0');
    assert.deepEqual(vertex(g.normals, rimStart + i), [0, -1, 0]); assert.notDeepEqual(vertex(g.normals, rimStart + i), vertex(g.normals, i));
    const phi = (2 * Math.PI) * ((i === s ? 0 : i) / s);
    assert.deepEqual(g.uvs.slice(2 * (rimStart + i), 2 * (rimStart + i) + 2), [(Math.cos(phi) + 1) / 2, (Math.sin(phi) + 1) / 2], 'Full angular disk UV, not scaled slope normals');
  }
  assert.deepEqual(vertex(g.positions, centre), [0, g.positions[1], 0]); assert.deepEqual(vertex(g.normals, centre), [0, -1, 0]);
  assert.deepEqual(g.uvs.slice(2 * centre, 2 * centre + 2), [.5, .5]);
  for (const values of [g.positions, g.normals]) for (let axis = 0; axis < 3; axis++)
    assert(Object.is(values[3 * rimStart + axis], values[3 * (rimStart + s) + axis]), 'Bottom rim seam Number bits');
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
  const g = result.prepared.geometry, base = [[1, -1.5, 0], [0, -1.5, 1], [-1, -1.5, 0], [0, -1.5, -1], [1, -1.5, 0]];
  base.forEach((point, i) => nearArray(vertex(g.positions, i), point)); base.forEach((point, i) => nearArray(vertex(g.positions, 9 + i), point));
  for (let i = 5; i < 9; i++) assert.deepEqual(vertex(g.positions, i), [0, 1.5, 0]);
  assert.deepEqual(vertex(g.positions, 14), [0, -1.5, 0]);
  const sideX = 3 / Math.sqrt(10), sideY = 1 / Math.sqrt(10), apexDiagonal = 3 / Math.sqrt(20);
  [[sideX, sideY, 0], [0, sideY, sideX], [-sideX, sideY, 0], [0, sideY, -sideX], [sideX, sideY, 0]]
    .forEach((normal, i) => nearArray(vertex(g.normals, i), normal));
  [[apexDiagonal, sideY, apexDiagonal], [-apexDiagonal, sideY, apexDiagonal], [-apexDiagonal, sideY, -apexDiagonal], [apexDiagonal, sideY, -apexDiagonal]]
    .forEach((normal, i) => nearArray(vertex(g.normals, 5 + i), normal));
  assert.deepEqual(g.uvs.slice(10, 18), [.125, 1, .375, 1, .625, 1, .875, 1]);
  [[1,.5],[.5,1],[0,.5],[.5,0],[1,.5]].forEach((uv, i) => nearArray(g.uvs.slice(2 * (9 + i), 2 * (9 + i) + 2), uv));
  assert.equal(g.uvs[18], 1); assert.notEqual(g.uvs[18], (sideX + 1) / 2, 'Cap UV is not shrunken by side slope normal');
  assert.deepEqual(g.indices, [0,5,1,1,6,2,2,7,3,3,8,4,14,9,10,14,10,11,14,11,12,14,12,13]);
  assert.equal(result.prepared.vertexCount, 15); assert.equal(result.prepared.triangleCount, 8); assert.equal(result.prepared.bufferBytes, 528);
  nearArray(result.prepared.bounds.min, [-1, -1.5, -1]); nearArray(result.prepared.bounds.max, [1, 1.5, 1]);
}
const ray = (origin, direction) => ({ format: 'barocss-gpu-engine-ray', version: 0, coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', origin, direction, near: 0, far: 10 });
function hits(base, side) {
  for (const hit of [base, side]) { assert(hit); assert.equal(hit.nodeId, 'cone_0'); assert.equal(hit.geometryId, 'cone_authored'); assert.equal(hit.materialId, 'cone_material'); assert(Number.isInteger(hit.triangleIndex)); }
  near(base.distance, 1.5); nearArray(base.point, [0, -1.5, 0]); nearArray(base.normal, [0, -1, 0]); nearArray(base.uv, [.5, .5]);
  near(side.distance, 2.5); nearArray(side.point, [.5, 0, 0]);
  near(Math.hypot(...side.normal), 1); assert(side.normal.every(Number.isFinite)); assert(side.uv.every(n => n >= 0 && n <= 1));
  // Split apex midpoint normals interpolate at this edge; no unique analytic normal or triangle ordinal is promised.
}

let accepted = 0, refused = 0, getters = 0, reflections = 0;
const results = [], failures = [];
try {
  for (const [provider, gpu] of providers) {
    for (const name of ['prepareConeGeometry', 'prepareEngineScene', 'raycastEngineScene', 'TriangleGeometryError']) assert.equal(typeof gpu[name], 'function');
    const records = []; let first, retainedPaths;
    for (const fixture of [{ name: 'literal_closed_control', input: source() }, { name: 'nonround_positive_rows', input: source(.3, .7, 6, 3, 'cone_nonround') }]) {
      const input = { ...fixture.input }, before = originalJSON(input), result = gpu.prepareConeGeometry(input); verify(result, input);
      assert.equal(originalJSON(input), before); if (fixture.name === 'literal_closed_control') literal(result);
      else { assert.equal(result.source.radius, .3); assert.equal(result.source.height, .7); assert.equal(result.prepared.geometry.positions[0], .3); assert.notEqual(result.prepared.positions[0], .3); }
      const repeated = gpu.prepareConeGeometry(input); verify(repeated, input);
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
    const maximumInput = source(1, 3, 128, 128, 'cone_maximum'), maximum = gpu.prepareConeGeometry(maximumInput); verify(maximum, maximumInput);
    assert.equal(maximum.prepared.vertexCount, 16770); assert.equal(maximum.prepared.triangleCount, 32768); assert.equal(maximum.prepared.bufferBytes, 733248);
    assert.equal(Math.max(...maximum.prepared.indices), 16769); accepted++;
    const rangeInput = source(1000, 2000, 4, 1, 'cone_range'), range = gpu.prepareConeGeometry(rangeInput); verify(range, rangeInput);
    nearArray(range.prepared.bounds.min, [-1000, -1000, -1000], 1e-12); nearArray(range.prepared.bounds.max, [1000, 1000, 1000], 1e-12); accepted++;
    const edited = gpu.prepareConeGeometry(source(2, 4)); assert.equal(edited.source.id, first.source.id); assert.notDeepEqual(edited.prepared.geometry.positions, first.prepared.geometry.positions);
    assert.equal(first.source.radius, 1); accepted++;
    const nullInput = Object.assign(Object.create(null), source(1, 3, 4, 1, 'cone_null')); verify(gpu.prepareConeGeometry(nullInput), nullInput); accepted++;
    const sceneInput = { format: 'barocss-gpu-engine-scene', version: 0, id: 'cone_instances', coordinateSystem: 'right-handed-y-up', positionUnit: 'scene',
      background: [.02, .04, .06], camera: { eye: [0, 3, 8], target: [0, 0, 0], up: [0, 1, 0], fovY: 45, near: .1, far: 100 },
      geometries: [first.prepared.geometry], materials: [{ id: 'cone_material', type: 'unlit', colorSpace: 'linear', color: [.2, .4, .6] }],
      nodes: [[0, 0, 0], [4, 0, -2]].map((translation, i) => ({ id: 'cone_' + i, type: 'mesh', parentId: null, geometryId: first.source.id,
        materialId: 'cone_material', translation, rotationXYZW: [0, 0, 0, 1], scale: i ? [1, 2, .5] : [1, 1, 1], visible: true })) };
    const sceneText = originalJSON(sceneInput), scene = gpu.prepareEngineScene(sceneInput);
    assert.equal(originalJSON(sceneInput), sceneText); assert.equal(scene.geometries.length, 1); assert.equal(scene.draws.length, 2);
    assert.strictEqual(scene.draws[0].geometry, scene.draws[1].geometry); assert.notStrictEqual(scene.geometries[0].positions, first.prepared.positions);
    assert.equal(scene.bufferBytes, 528); assert.equal(scene.vertexWork, 30);
    nearArray(scene.nodes[0].bounds.min, [-1, -1.5, -1]); nearArray(scene.nodes[0].bounds.max, [1, 1.5, 1]);
    nearArray(scene.nodes[1].bounds.min, [3, -3, -2.5]); nearArray(scene.nodes[1].bounds.max, [5, 3, -1.5]);
    const rays = { base: ray([0, -3, 0], [0, 1, 0]), side: ray([3, 0, 0], [-1, 0, 0]) };
    const baseHit = gpu.raycastEngineScene(sceneInput, rays.base), sideHit = gpu.raycastEngineScene(sceneInput, rays.side); hits(baseHit, sideHit); accepted++;
    const scenePath = resolve(output, provider + '.original-scene.json'), rayPath = resolve(output, provider + '.original-rays.json');
    await writeFile(scenePath, sceneText + '\n'); await writeFile(rayPath, originalJSON({ rays, baseHit, sideHit }) + '\n');
    const oldSource = originalJSON(first.source), oldGeometry = originalJSON(first.prepared.geometry), oldBuffers = bufferHashes(first.prepared);
    const oldFiles = await Promise.all([...retainedPaths, scenePath, rayPath].map(async path => ({ path, sha256: hash(await readFile(path)) })));
    const refusals = [];
    async function reject(name, input, code, inspect) {
      let error; try { gpu.prepareConeGeometry(input); } catch (cause) { error = cause; }
      assert(error instanceof gpu.TriangleGeometryError, name); assert.equal(error.code, code, name); inspect?.(error);
      assert.equal(originalJSON(first.source), oldSource); assert.equal(originalJSON(first.prepared.geometry), oldGeometry);
      assert.deepEqual(bufferHashes(first.prepared), oldBuffers); assert.equal(originalJSON(sceneInput), sceneText);
      for (const file of oldFiles) assert.equal(hash(await readFile(file.path)), file.sha256);
      refused++; refusals.push({ name, code: error.code, message: error.message, cause: error.cause instanceof Error ? { name: error.cause.name, message: error.cause.message } : null });
    }
    for (const [name, patch, code] of [
      ['wrong version', { version: 1 }, 'VERSION'], ['wrong frame', { coordinateSystem: 'z-up' }, 'VERSION'],
      ['extra top-radius option', { topRadius: 0 }, 'INPUT'], ['invalid ID', { id: '9bad' }, 'INPUT'],
      ['radius non-number', { radius: '1' }, 'INPUT'], ['height nonfinite', { height: Infinity }, 'INPUT'],
      ['negative-zero radius', { radius: -0 }, 'GEOMETRY'], ['height zero', { height: 0 }, 'GEOMETRY'],
      ['radius above cap', { radius: 1001 }, 'GEOMETRY'], ['height above cap', { height: 2001 }, 'GEOMETRY'],
      ['radial below minimum', { radialSegments: 2 }, 'GEOMETRY'], ['height rows below minimum', { heightSegments: 0 }, 'GEOMETRY'],
      ['fractional height rows', { heightSegments: 1.5 }, 'GEOMETRY'], ['radial segment budget', { radialSegments: 129 }, 'BUDGET'],
      ['height segment budget', { heightSegments: 129 }, 'BUDGET'], ['nonfinite segments', { radialSegments: NaN }, 'INPUT'],
      ['original half-height underflow guard', { height: Number.MIN_VALUE }, 'GEOMETRY'],
      ['original height-slope underflow guard', { radius: 1000, height: 2 * Number.MIN_VALUE }, 'GEOMETRY'],
      ['original radius-slope underflow guard', { radius: Number.MIN_VALUE, height: 3 }, 'GEOMETRY'],
      ['nonzero Float32 trigonometric coordinate underflow', { radius: 1e-35, height: 1 }, 'REPRESENTATION'],
    ]) await reject(name, { ...source(), ...patch }, code,
      name.endsWith('guard') ? error => assert(!Object.hasOwn(error, 'cause'), 'Original guard has no invented validator cause') : undefined);
    assert(Math.fround(1e-35) > 0 && Math.fround(.5) > 0, 'Nonzero F32 dimensions do not guarantee all trig coordinates');
    const accessor = source(); Object.defineProperty(accessor, 'radius', { enumerable: true, get() { getters++; return 1; } });
    await reject('getter never invoked', accessor, 'INPUT');
    const marker = new Error('Actual Cone source reflection failure');
    await reject('actual reflection cause', new Proxy(source(), { getPrototypeOf() { reflections++; throw marker; } }), 'INPUT', error => assert.strictEqual(error.cause, marker));
    const hidden = source(); Object.defineProperty(hidden, 'id', { enumerable: false, value: hidden.id }); await reject('hidden root field', hidden, 'INPUT');
    await reject('foreign root prototype', Object.assign(Object.create({ foreign: true }), source()), 'INPUT'); assert.equal(getters, 0);
    const childCode = `import assert from'node:assert/strict';import{readFile}from'node:fs/promises';import{pathToFileURL}from'node:url';import{createHash}from'node:crypto';
      const cfg=JSON.parse(process.argv[1]);assert.equal(Number(process.versions.node.split('.')[0]),22);const hash=v=>createHash('sha256').update(v).digest('hex'),out=[];
      const sourceScene=JSON.parse(await readFile(cfg.scene,'utf8')),saved=JSON.parse(await readFile(cfg.rays,'utf8'));
      for(const entry of cfg.entries){const gpu=await import(pathToFileURL(entry).href);assert.deepEqual(Object.keys(gpu).sort(),cfg.namespace);const rows=[];
        for(const files of cfg.files){const source=JSON.parse(await readFile(files[0],'utf8')),geometry=JSON.parse(await readFile(files[1],'utf8')),result=gpu.prepareConeGeometry(source);assert.deepEqual(result.source,source);assert.deepEqual(result.prepared.geometry,geometry);rows.push(Object.fromEntries(['positions','normals','uvs','indices'].map(k=>{const a=result.prepared[k];return[k,hash(Buffer.from(a.buffer,a.byteOffset,a.byteLength))]})));}
        const scene=gpu.prepareEngineScene(sourceScene);assert.equal(scene.geometries.length,1);assert.equal(scene.draws.length,2);assert.strictEqual(scene.draws[0].geometry,scene.draws[1].geometry);
        const base=gpu.raycastEngineScene(sourceScene,saved.rays.base),side=gpu.raycastEngineScene(sourceScene,saved.rays.side);assert.deepEqual(base,saved.baseHit);assert.deepEqual(side,saved.sideHit);out.push({rows,bounds:scene.nodes.map(n=>n.bounds),base,side});}
      console.log(JSON.stringify({node:process.version,providers:out}));`;
    const cold = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', childCode, JSON.stringify({ entries: [ordinary, emitted], namespace,
      files: records.map(record => record.paths), scene: scenePath, rays: rayPath })], { encoding: 'utf8' }));
    for (const row of cold.providers) { assert.deepEqual(row.rows, records.map(record => record.buffers)); assert.deepEqual(row.bounds, scene.nodes.map(node => node.bounds)); hits(row.base, row.side); }
    results.push({ provider, records, maximum: { vertices: 16770, triangles: 32768, numericValues: 232464, bytes: 733248, maxIndex: 16769 },
      maximumRange: { source: range.source, bounds: range.prepared.bounds }, editedSource: edited.source,
      scene: { path: scenePath, rayPath, bounds: scene.nodes.map(node => node.bounds), baseHit, sideHit }, cold, refusals, retainedFiles: oldFiles });
  }
  assert.deepEqual(results[0].records.map(({ paths, ...record }) => record), results[1].records.map(({ paths, ...record }) => record));
  assert.deepEqual(results[0].scene.bounds, results[1].scene.bounds); assert.deepEqual(results[0].scene.baseHit, results[1].scene.baseHit); assert.deepEqual(results[0].scene.sideHit, results[1].scene.sideHit);
} catch (error) { failures.push(String(error.stack ?? error)); throw error; }
finally {
  const report = { issue: 1400, parent: 'bef852311db5c7ba1b894ded68d8be546f892f75',
    head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(), accepted, refused, getters, reflections,
    namespaceCount: namespace.length, sourceGraph: graph, results, failures,
    providers: { ordinary: { path: ordinary, sha256: hash(await readFile(ordinary)) }, emitted: { path: emitted, sha256: hash(await readFile(emitted)) },
      declarations: { path: declarationPath, sha256: hash(declaration), leafSHA256: hash(leafDeclaration) } }, actualGL: false, nativeCAD: false, publicCodec: false,
    limits: ['Generic closed sampled Cone; original scalar source, generated Number mesh and mutable F32 execution stay separate.',
      'Split apex sector normals are fixed authored shading choices, not a unique analytical apex normal; hard cap UV uses full angular disk.',
      'Bounds are sampled vertices, not analytical/native/outward-rounded enclosure; CPU polygon rays are not SDF/raster hits.',
      'Ray edge ties use existing first eligible policy; no independent triangle ordinal or analytic side normal at split apex interpolation.',
      'Own GPU/source-CAD graph is not all-CAD coverage; cold private evidence adds no public codec, renderer/parity/currentRoot/publication proof.'] };
  await writeFile(resolve(output, 'actual-result.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ issue: 1400, accepted, refused, getters, reflections, namespaceCount: namespace.length, actualGL: false, failures }));
}
