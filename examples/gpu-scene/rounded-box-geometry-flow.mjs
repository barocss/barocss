/** #1414: one RoundedBox/source/emitted/chart/Scene/ray/file/cold CPU flow.
 * node examples/gpu-scene/rounded-box-geometry-flow.mjs --output <fresh-absolute-directory>
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';

assert.equal(Number(process.versions.node.split('.')[0]), 22, 'Actual Node22 required');
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), args = process.argv.slice(2), at = args.indexOf('--output');
assert(at >= 0 && args[at + 1] && isAbsolute(args[at + 1]), '--output <fresh-absolute-directory> required');
const output = resolve(args[at + 1]); await mkdir(output, { recursive: false });
const pkg = resolve(repo, 'packages/barocss-gpu'), manifest = JSON.parse(await readFile(resolve(pkg, 'package.json'), 'utf8'));
const published = manifest.publishConfig.exports['.']; assert.equal(published.import, './dist/index.js'); assert.equal(published.types, './dist/index.d.ts');
const ordinary = resolve(output, 'ordinary-source.mjs'), emitted = resolve(pkg, published.import);
const bundled = await build({ entryPoints: [resolve(pkg, manifest.exports['.'].import)], bundle: true, platform: 'node', format: 'esm',
  target: 'node22', outfile: ordinary, metafile: true });
const graph = Object.keys(bundled.metafile.inputs);
for (const name of ['rounded-box-geometry.ts', 'rounded-box-geometry-build-internal.ts', 'triangle-geometry.ts', 'engine-scene.ts', 'engine-raycast.ts'])
  assert(graph.some(path => path.endsWith('/src/' + name)), 'Actual own source dependency ' + name);
assert(graph.some(path => /barocss-cad\/src\//.test(path)), 'Actual transitive own CAD source graph');
assert(!graph.some(path => /barocss-(gpu|cad)\/dist\//.test(path)), 'No own emitted fallback in ordinary source');
const providers = [['ordinary-source', await import(pathToFileURL(ordinary).href)], ['emitted-public', await import(pathToFileURL(emitted).href)]];
const namespace = Object.keys(providers[0][1]).sort(); assert.deepEqual(namespace, Object.keys(providers[1][1]).sort());
const declarationPath = resolve(pkg, published.types), declaration = await readFile(declarationPath, 'utf8');
for (const name of ['prepareRoundedBoxGeometry', 'RoundedBoxGeometrySourceV0', 'PreparedRoundedBoxGeometry'])
  assert(new RegExp('\\b' + name + '\\b').test(declaration), 'Actual public DTS ' + name);
const leafDeclaration = await readFile(resolve(pkg, 'dist/rounded-box-geometry.d.ts'), 'utf8');
assert(/prepareRoundedBoxGeometry\(input:\s*unknown\):\s*PreparedRoundedBoxGeometry/.test(leafDeclaration));
for (const field of ['sizeXYZ', 'cornerRadius', 'segments']) assert(new RegExp('\\b' + field + ':').test(leafDeclaration));
const hash = value => createHash('sha256').update(value).digest('hex');
function originalJSON(value) {
  if (typeof value === 'number') { assert(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(originalJSON).join(',') + ']';
  return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + originalJSON(child)).join(',') + '}';
}
const source = (sizeXYZ = [2, 4, 6], cornerRadius = .25, segments = 2, id = 'rounded_box_authored') => ({
  format: 'barocss-gpu-rounded-box-geometry', version: 0, id, coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', sizeXYZ, cornerRadius, segments });
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
  assert.notStrictEqual(result.source, input); assert.notStrictEqual(result.source.sizeXYZ, input.sizeXYZ);
  assert.deepEqual(Object.keys(result.source).sort(), Object.keys(source()).sort());
  const p = result.prepared, g = p.geometry, n = input.segments, half = input.sizeXYZ.map(value => value * .5), core = half.map(value => value - input.cornerRadius);
  const count = 4 * n * n + 36 * n + 56, triangles = 12 + 24 * n + 8 * n * n;
  assert.equal(g.format, 'barocss-gpu-triangle-geometry'); assert.equal(g.version, 0); assert.equal(g.id, input.id);
  assert.equal(g.coordinateSystem, 'right-handed-y-up'); assert.equal(g.positionUnit, 'scene'); assert.equal(g.winding, 'ccw');
  assert.equal(p.vertexCount, count); assert.equal(p.triangleCount, triangles); assert.equal(p.bufferBytes, 32 * count + 6 * triangles); assert.equal(p.indexType, 'uint16');
  assert(p.positions instanceof Float32Array && p.normals instanceof Float32Array && p.uvs instanceof Float32Array && p.indices instanceof Uint16Array);
  assert.equal(g.positions.length, 3 * count); assert.equal(g.normals.length, 3 * count); assert.equal(g.uvs.length, 2 * count); assert.equal(g.indices.length, 3 * triangles);
  for (const name of ['positions', 'normals', 'uvs']) assert.deepEqual(Array.from(p[name]), g[name].map(Math.fround));
  assert.deepEqual(Array.from(p.indices), g.indices);
  const seams = new Map(), charts = []; let cursor = 0, triangleCursor = 0, seamCopies = 0;
  function sample(index, signs, lattice, uv) {
    const point = vertex(g.positions, index), normal = vertex(g.normals, index);
    assert.deepEqual(g.uvs.slice(2 * index, 2 * index + 2), uv);
    const q = lattice.map(value => value / n), length = Math.hypot(...q);
    const expectedNormal = q.map((value, axis) => value === 0 ? 0 : signs[axis] * value / length);
    nearArray(normal, expectedNormal); near(Math.hypot(...normal), 1);
    normal.forEach((value, axis) => { if (lattice[axis] === 0) assert(Object.is(value, 0), 'Zero normal components are explicit +0'); });
    const closest = point.map((value, axis) => Math.max(-core[axis], Math.min(core[axis], value)));
    const delta = subtract(point, closest), distance = Math.hypot(...delta);
    near(distance, input.cornerRadius, 1e-12 * Math.max(1, input.cornerRadius));
    nearArray(normal, delta.map(value => value / distance), 1e-12);
    for (let axis = 0; axis < 3; axis++) {
      if (lattice[axis] === 0) assert(Object.is(point[axis], signs[axis] * core[axis]), 'Exact core-plane component');
      if (lattice[axis] === n) assert(Object.is(point[axis], signs[axis] * half[axis]), 'Exact outer support component');
    }
    const key = signs.join(',') + ':' + lattice.join(','), previous = seams.get(key);
    if (previous) { for (let axis = 0; axis < 3; axis++) {
      assert(Object.is(previous.point[axis], point[axis]), 'Incident chart position bits copied exactly');
      assert(Object.is(previous.normal[axis], normal[axis]), 'Incident chart normal bits copied exactly');
    } seamCopies++; } else seams.set(key, { point, normal });
  }
  function chart(kind, start, vertices, t) { charts.push({ kind, start, vertices, firstTriangle: triangleCursor, triangles: t }); triangleCursor += t; }
  for (let axis = 0; axis < 3; axis++) for (const side of [-1, 1]) {
    const other = [0, 1, 2].filter(value => value !== axis), start = cursor;
    for (const [a, b, uv] of [[-1,-1,[0,0]],[1,-1,[1,0]],[-1,1,[0,1]],[1,1,[1,1]]]) {
      const signs = [0, 0, 0], lattice = [0, 0, 0]; signs[axis] = side; signs[other[0]] = a; signs[other[1]] = b; lattice[axis] = n;
      sample(cursor++, signs, lattice, uv);
    }
    chart('plane', start, 4, 2);
  }
  for (let axis = 0; axis < 3; axis++) {
    const other = [0, 1, 2].filter(value => value !== axis);
    for (const a of [-1, 1]) for (const b of [-1, 1]) {
      const start = cursor;
      for (const [side, row] of [[-1,0],[1,1]]) for (let j = 0; j <= n; j++) {
        const signs = [0, 0, 0], lattice = [0, 0, 0]; signs[axis] = side; signs[other[0]] = a; signs[other[1]] = b;
        lattice[other[0]] = n - j; lattice[other[1]] = j; sample(cursor++, signs, lattice, [j / n, row]);
      }
      chart('edge', start, 2 * (n + 1), 2 * n);
    }
  }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const start = cursor;
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) sample(cursor++, [sx, sy, sz], [i, j, n - i - j], [i / n, j / n]);
    chart('corner', start, (n + 1) * (n + 2) / 2, n * n);
  }
  assert.equal(cursor, count); assert.equal(triangleCursor, triangles); assert.equal(charts.length, 26);
  assert.equal(seams.size, 4 * (n + 1) * (n + 2)); assert.equal(seamCopies, count - seams.size);
  for (const c of charts) for (let t = c.firstTriangle; t < c.firstTriangle + c.triangles; t++) {
    const ids = g.indices.slice(3 * t, 3 * t + 3);
    assert(ids.every(index => Number.isInteger(index) && index >= c.start && index < c.start + c.vertices), 'Triangles stay in their ordered UV chart');
    const [a, b, cc] = ids.map(index => vertex(g.positions, index)), direction = cross(subtract(b, a), subtract(cc, a));
    assert(Math.hypot(...direction) > 0); for (const index of ids) assert(dot(direction, vertex(g.normals, index)) > 0, 'Every original triangle outward nonzero');
  }
  for (let axis = 0; axis < 3; axis++) {
    const values = g.positions.filter((_, i) => i % 3 === axis);
    assert.equal(p.bounds.min[axis], Math.min(...values)); assert.equal(p.bounds.max[axis], Math.max(...values));
    assert.equal(p.bounds.min[axis], -half[axis]); assert.equal(p.bounds.max[axis], half[axis]);
  }
  frozen(result); return { planes: 6, edges: 12, corners: 8, seamGroups: seams.size, seamCopies };
}
function lowControl(result) {
  const g = result.prepared.geometry;
  [[-1,-1.75,-2.75],[-1,1.75,-2.75],[-1,-1.75,2.75],[-1,1.75,2.75]].forEach((point, i) => assert.deepEqual(vertex(g.positions, i), point));
  for (let i = 0; i < 4; i++) assert.deepEqual(vertex(g.normals, i), [-1, 0, 0]);
  assert.equal(result.prepared.vertexCount, 144); assert.equal(result.prepared.triangleCount, 92); assert.equal(result.prepared.bufferBytes, 5160);
  assert.deepEqual(result.prepared.bounds, { min: [-1, -2, -3], max: [1, 2, 3] });
}
const ray = (origin, direction) => ({ format: 'barocss-gpu-engine-ray', version: 0, coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', origin, direction, near: 0, far: 20 });
function hits(side, top) {
  for (const hit of [side, top]) { assert(hit); assert.equal(hit.nodeId, 'rounded_box_0'); assert.equal(hit.geometryId, 'rounded_box_authored'); assert.equal(hit.materialId, 'rounded_box_material'); assert(Number.isInteger(hit.triangleIndex)); }
  near(side.distance, 2); nearArray(side.point, [-3, 0, 0]); nearArray(side.normal, [-1, 0, 0]); nearArray(side.uv, [.5, .5]);
  near(top.distance, 3); nearArray(top.point, [-2, 2, 0]); nearArray(top.normal, [0, 1, 0]); nearArray(top.uv, [.5, .5]);
  // Face-interior diagonal ties retain the existing first eligible triangle; no ordinal promise.
}

let accepted = 0, refused = 0, getters = 0, reflections = 0, earlyEnumeration = 0;
const results = [], failures = [];
try {
  for (const [provider, gpu] of providers) {
    for (const name of ['prepareRoundedBoxGeometry', 'prepareEngineScene', 'raycastEngineScene', 'TriangleGeometryError']) assert.equal(typeof gpu[name], 'function');
    const records = []; let first, retainedPaths;
    for (const fixture of [{ name: 'literal_asymmetric_charts', input: source() }, { name: 'nonround_corner_interiors', input: source([.3, .7, 1.1], .05, 3, 'rounded_box_nonround') }]) {
      const input = { ...fixture.input, sizeXYZ: [...fixture.input.sizeXYZ] }, before = originalJSON(input), result = gpu.prepareRoundedBoxGeometry(input), charts = verify(result, input);
      assert.equal(originalJSON(input), before); if (fixture.name === 'literal_asymmetric_charts') lowControl(result);
      else { assert.equal(result.source.sizeXYZ[0], .3); assert.equal(result.source.cornerRadius, .05); assert.equal(result.prepared.geometry.positions[0], -.15); assert.notEqual(result.prepared.positions[0], -.15); }
      const repeated = gpu.prepareRoundedBoxGeometry(input); verify(repeated, input);
      assert.notStrictEqual(repeated.source.sizeXYZ, result.source.sizeXYZ); assert.notStrictEqual(repeated.prepared.geometry.positions, result.prepared.geometry.positions);
      const paths = [resolve(output, provider + '.' + fixture.name + '.source.json'), resolve(output, provider + '.' + fixture.name + '.geometry.json')];
      await writeFile(paths[0], originalJSON(result.source) + '\n'); await writeFile(paths[1], originalJSON(result.prepared.geometry) + '\n');
      const originalSource = originalJSON(result.source), originalGeometry = originalJSON(result.prepared.geometry), repeatedBuffers = bufferHashes(repeated.prepared);
      input.sizeXYZ[0] = 999; input.cornerRadius = .1; input.id = 'caller_changed'; assert.equal(originalJSON(result.source), originalSource);
      for (const [name, replacement] of [['positions', 99], ['normals', .125], ['uvs', .75], ['indices', 7]]) {
        const view = result.prepared[name], old = view[0]; assert.notStrictEqual(view, repeated.prepared[name]); view[0] = replacement;
        assert.equal(view[0], replacement); assert.equal(originalJSON(result.prepared.geometry), originalGeometry); assert.deepEqual(bufferHashes(repeated.prepared), repeatedBuffers); view[0] = old;
      }
      records.push({ name: fixture.name, source: result.source, geometrySHA256: hash(originalGeometry), paths, charts, bounds: result.prepared.bounds, buffers: bufferHashes(result.prepared) });
      if (!first) { first = result; retainedPaths = paths; } accepted++;
    }
    const maximumInput = source([2, 4, 6], .25, 64, 'rounded_box_maximum'), maximum = gpu.prepareRoundedBoxGeometry(maximumInput), maxCharts = verify(maximum, maximumInput);
    assert.equal(maximum.prepared.vertexCount, 18744); assert.equal(maximum.prepared.triangleCount, 34316); assert.equal(maximum.prepared.bufferBytes, 805704);
    assert.equal(maximum.prepared.indices.reduce((max, n) => Math.max(max, n), 0), 18743); accepted++;
    const rangeInput = source([2000, 2000, 2000], 250, 2, 'rounded_box_range'), range = gpu.prepareRoundedBoxGeometry(rangeInput); verify(range, rangeInput);
    assert.deepEqual(range.prepared.bounds, { min: [-1000,-1000,-1000], max: [1000,1000,1000] }); accepted++;
    const editedInput = source([4, 3, 2], .2, 3), edited = gpu.prepareRoundedBoxGeometry(editedInput); verify(edited, editedInput);
    assert.equal(edited.source.id, first.source.id); assert.notDeepEqual(edited.prepared.geometry.positions, first.prepared.geometry.positions); assert.equal(first.source.segments, 2); accepted++;
    const nullInput = Object.assign(Object.create(null), source([2, 4, 6], .25, 2, 'rounded_box_null')); verify(gpu.prepareRoundedBoxGeometry(nullInput), nullInput); accepted++;
    const sceneInput = { format: 'barocss-gpu-engine-scene', version: 0, id: 'rounded_box_instances', coordinateSystem: 'right-handed-y-up', positionUnit: 'scene',
      background: [.02, .04, .06], camera: { eye: [0, 4, 9], target: [0, 0, 0], up: [0, 1, 0], fovYDegrees: 45, near: .1, far: 100 },
      geometries: [first.prepared.geometry], materials: [{ id: 'rounded_box_material', type: 'unlit', colorSpace: 'linear', color: [.2, .4, .6] }],
      nodes: [[-2, 0, 0], [2, 0, 0]].map((translation, i) => ({ id: 'rounded_box_' + i, type: 'mesh', parentId: null, geometryId: first.source.id,
        materialId: 'rounded_box_material', translation, rotationXYZW: [0, 0, 0, 1], scale: [1, 1, 1], visible: true })) };
    const sceneText = originalJSON(sceneInput), scene = gpu.prepareEngineScene(sceneInput);
    assert.equal(originalJSON(sceneInput), sceneText); assert.equal(scene.geometries.length, 1); assert.equal(scene.draws.length, 2);
    assert.strictEqual(scene.draws[0].geometry, scene.draws[1].geometry); assert.notStrictEqual(scene.geometries[0].positions, first.prepared.positions);
    assert.equal(scene.bufferBytes, 5160); assert.equal(scene.vertexWork, 288);
    nearArray(scene.nodes[0].bounds.min, [-3, -2, -3]); nearArray(scene.nodes[0].bounds.max, [-1, 2, 3]);
    nearArray(scene.nodes[1].bounds.min, [1, -2, -3]); nearArray(scene.nodes[1].bounds.max, [3, 2, 3]);
    const rays = { side: ray([-5, 0, 0], [1, 0, 0]), top: ray([-2, 5, 0], [0, -1, 0]) };
    const sideHit = gpu.raycastEngineScene(sceneInput, rays.side), topHit = gpu.raycastEngineScene(sceneInput, rays.top); hits(sideHit, topHit); accepted++;
    const scenePath = resolve(output, provider + '.original-scene.json'), rayPath = resolve(output, provider + '.original-rays.json');
    await writeFile(scenePath, sceneText + '\n'); await writeFile(rayPath, originalJSON({ rays, sideHit, topHit }) + '\n');
    const oldSource = originalJSON(first.source), oldGeometry = originalJSON(first.prepared.geometry), oldBuffers = bufferHashes(first.prepared);
    const oldFiles = await Promise.all([...retainedPaths, scenePath, rayPath].map(async path => ({ path, sha256: hash(await readFile(path)) })));
    const refusals = [];
    async function reject(name, input, code, inspect) {
      let error; try { gpu.prepareRoundedBoxGeometry(input); } catch (cause) { error = cause; }
      assert(error instanceof gpu.TriangleGeometryError, name);
      if (code !== null) assert.equal(error.code, code, name); else assert(['GEOMETRY', 'REPRESENTATION'].includes(error.code), name + ': preserve actual reached geometry stage');
      inspect?.(error); assert.equal(originalJSON(first.source), oldSource); assert.equal(originalJSON(first.prepared.geometry), oldGeometry);
      assert.deepEqual(bufferHashes(first.prepared), oldBuffers); assert.equal(originalJSON(sceneInput), sceneText);
      for (const file of oldFiles) assert.equal(hash(await readFile(file.path)), file.sha256);
      refused++; refusals.push({ name, family: error.name, code: error.code, message: error.message,
        cause: error.cause instanceof Error ? { name: error.cause.name, message: error.cause.message } : null,
        actualStageObserved: true, proposedStageNotForced: code === null });
    }
    for (const [name, patch, code] of [
      ['wrong version', { version: 1 }, 'VERSION'], ['wrong frame', { coordinateSystem: 'z-up' }, 'VERSION'],
      ['extra constructor option', { smooth: true }, 'INPUT'], ['invalid ID', { id: '9bad' }, 'INPUT'],
      ['size wrong type', { sizeXYZ: '2 4 6' }, 'INPUT'], ['size missing component', { sizeXYZ: [2,4] }, 'GEOMETRY'],
      ['size array budget', { sizeXYZ: [2,4,6,8] }, 'BUDGET'], ['size nonfinite', { sizeXYZ: [2,Infinity,6] }, 'INPUT'],
      ['zero dimension', { sizeXYZ: [0,4,6] }, 'GEOMETRY'], ['dimension above cap', { sizeXYZ: [2001,4,6] }, 'GEOMETRY'],
      ['radius non-number', { cornerRadius: '.25' }, 'INPUT'], ['radius negative zero', { cornerRadius: -0 }, 'GEOMETRY'],
      ['radius equals half dimension', { cornerRadius: 1 }, 'GEOMETRY'], ['segments below minimum', { segments: 1 }, 'GEOMETRY'],
      ['fractional segments', { segments: 2.5 }, 'INPUT'], ['segment budget', { segments: 65 }, 'BUDGET'],
      ['original radius extent lost', { cornerRadius: Number.MIN_VALUE }, 'GEOMETRY'],
      ['original half-size collapsed', { sizeXYZ: [Number.MIN_VALUE,4,6] }, 'GEOMETRY'],
      ['proposed Float32 rounded-edge collapse', { cornerRadius: 2 ** -25 }, null],
    ]) await reject(name, { ...source(), ...patch }, code);
    const getter = source(); Object.defineProperty(getter, 'cornerRadius', { enumerable: true, get() { getters++; return .25; } }); await reject('getter never invoked', getter, 'INPUT');
    const oversized = new Proxy([2,4,6,8], { ownKeys() { earlyEnumeration++; throw new Error('Size budget must precede own keys'); } });
    await reject('early array budget', source(oversized), 'BUDGET'); assert.equal(earlyEnumeration, 0);
    const marker = new Error('Actual RoundedBox reflection failure');
    await reject('actual reflection cause', new Proxy(source(), { getPrototypeOf() { reflections++; throw marker; } }), 'INPUT', error => assert.strictEqual(error.cause, marker));
    const symbol = source(); symbol[Symbol('extra')] = true; await reject('symbol field', symbol, 'INPUT'); assert.equal(getters, 0);
    const childCode = `import assert from'node:assert/strict';import{readFile}from'node:fs/promises';import{pathToFileURL}from'node:url';import{createHash}from'node:crypto';
      const cfg=JSON.parse(process.argv[1]);assert.equal(Number(process.versions.node.split('.')[0]),22);const hash=v=>createHash('sha256').update(v).digest('hex'),out=[];
      const sourceScene=JSON.parse(await readFile(cfg.scene,'utf8')),saved=JSON.parse(await readFile(cfg.rays,'utf8'));
      for(const entry of cfg.entries){const gpu=await import(pathToFileURL(entry).href);assert.deepEqual(Object.keys(gpu).sort(),cfg.namespace);const rows=[];
        for(const files of cfg.files){const source=JSON.parse(await readFile(files[0],'utf8')),geometry=JSON.parse(await readFile(files[1],'utf8')),result=gpu.prepareRoundedBoxGeometry(source);assert.deepEqual(result.source,source);assert.deepEqual(result.prepared.geometry,geometry);rows.push(Object.fromEntries(['positions','normals','uvs','indices'].map(k=>{const a=result.prepared[k];return[k,hash(Buffer.from(a.buffer,a.byteOffset,a.byteLength))]})));}
        const scene=gpu.prepareEngineScene(sourceScene);assert.equal(scene.geometries.length,1);assert.equal(scene.draws.length,2);assert.strictEqual(scene.draws[0].geometry,scene.draws[1].geometry);
        const side=gpu.raycastEngineScene(sourceScene,saved.rays.side),top=gpu.raycastEngineScene(sourceScene,saved.rays.top);assert.deepEqual(side,saved.sideHit);assert.deepEqual(top,saved.topHit);out.push({rows,bounds:scene.nodes.map(n=>n.bounds),side,top});}
      console.log(JSON.stringify({node:process.version,providers:out}));`;
    const cold = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', childCode, JSON.stringify({ entries: [ordinary, emitted], namespace,
      files: records.map(record => record.paths), scene: scenePath, rays: rayPath })], { encoding: 'utf8' }));
    for (const row of cold.providers) { assert.deepEqual(row.rows, records.map(record => record.buffers)); assert.deepEqual(row.bounds, scene.nodes.map(node => node.bounds)); hits(row.side, row.top); }
    results.push({ provider, records, maximum: { vertices: 18744, triangles: 34316, numericValues: 252900, bytes: 805704, maxIndex: 18743, charts: maxCharts },
      maximumRange: { source: range.source, bounds: range.prepared.bounds }, editedSource: edited.source,
      scene: { path: scenePath, rayPath, bounds: scene.nodes.map(node => node.bounds), sideHit, topHit }, cold, refusals, retainedFiles: oldFiles });
  }
  assert.deepEqual(results[0].records.map(({ paths, ...record }) => record), results[1].records.map(({ paths, ...record }) => record));
  assert.deepEqual(results[0].scene.bounds, results[1].scene.bounds); assert.deepEqual(results[0].scene.sideHit, results[1].scene.sideHit); assert.deepEqual(results[0].scene.topHit, results[1].scene.topHit);
} catch (error) { failures.push(String(error.stack ?? error)); throw error; }
finally {
  const report = { issue: 1414, parent: '74333e3d79781183224389676836941c7ef96c3f',
    head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(), accepted, refused, getters, reflections, earlyEnumeration,
    namespaceCount: namespace.length, sourceGraph: graph, results, failures,
    providers: { ordinary: { path: ordinary, sha256: hash(await readFile(ordinary)) }, emitted: { path: emitted, sha256: hash(await readFile(emitted)) },
      declarations: { path: declarationPath, sha256: hash(declaration), leafSHA256: hash(leafDeclaration) } }, actualGL: false, nativeCAD: false, publicCodec: false,
    limits: ['Generic sampled RoundedBox; original scalar/size source remains distinct from sampled Number geometry and mutable F32 views.',
      'Verifier uses independent chart indexing, closest-core distances/normals and public vertex bits; no builder cache/counter imported.',
      'Split UV charts are not atlas/material/filter/topological/BRep/CAD Fillet/Chamfer or analytic collision certificates.',
      'Sampled bounds and original polygon face rays do not certify outward-rounded ideal corners, SDF/raster, performance or physical memory.',
      'Own GPU/source-CAD graph is not all-CAD coverage; cold evidence adds no public codec, renderer/parity/currentRoot/consumer/publication proof.'] };
  await writeFile(resolve(output, 'actual-result.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ issue: 1414, accepted, refused, getters, reflections, earlyEnumeration, namespaceCount: namespace.length, actualGL: false, failures }));
}
