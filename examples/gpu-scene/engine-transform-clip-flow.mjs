/** #1274: atomic caller-time local TRS from original complete scene0.
 * node examples/gpu-scene/engine-transform-clip-flow.mjs --output <fresh-directory>
 * CPU source/API/file evidence; no clock, renderer, browser or GPU pixels.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const at = process.argv.indexOf('--output');
assert(at >= 0 && process.argv[at + 1], '--output <fresh-directory> is required');
const output = resolve(process.argv[at + 1]);
await mkdir(output, { recursive: false });
const pkg = resolve(repo, 'packages/barocss-gpu');
const manifest = JSON.parse(await readFile(resolve(pkg, 'package.json'), 'utf8'));
const published = manifest.publishConfig.exports['.'];
const ordinary = resolve(output, 'ordinary-source.mjs');
const bundled = await build({ entryPoints: [resolve(pkg, manifest.exports['.'].import)], bundle: true,
  platform: 'node', format: 'esm', target: 'node22', outfile: ordinary, metafile: true });
const graph = Object.keys(bundled.metafile.inputs);
assert(graph.some(p => p.endsWith('/src/engine/engine-transform-clip.ts')));
assert(!graph.some(p => /barocss-(gpu|cad)\/dist\//.test(p)));
const hash = v => createHash('sha256').update(v).digest('hex');
async function receipt(path) { const bytes = await readFile(path); return { path, bytes: bytes.length, sha256: hash(bytes) }; }
function json(v) {
  if (typeof v === 'number') { assert(Number.isFinite(v)); return Object.is(v, -0) ? '-0' : JSON.stringify(v); }
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(json).join(',') + ']';
  return '{' + Object.entries(v).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([k, n]) => JSON.stringify(k) + ':' + json(n)).join(',') + '}';
}
const clone = v => JSON.parse(json(v));
const near = (a, b) => assert(Math.abs(a - b) <= 1e-10, `actual ${a}; expected ${b}`);
const vector = (a, b) => { assert.equal(a.length, b.length); a.forEach((n, i) => near(n, b[i])); };
function frozen(v) { if (v && typeof v === 'object' && !ArrayBuffer.isView(v)) {
  assert(Object.isFrozen(v)); for (const child of Object.values(v)) frozen(child);
} }
const group = (id, parentId, translation = [-0, 0, 0]) => ({ id, type: 'group', parentId,
  translation, rotationXYZW: [-0, 0, 0, 1], scale: [1, 1, 1], visible: true });
function source() { return { format: 'barocss-gpu-engine-scene', version: 0, id: 'atomic_scene',
  coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', background: [0, .1, .2],
  camera: { eye: [-0, 0, 6], target: [0, 0, 0], up: [0, 1, 0], fovYDegrees: 45, near: .01, far: 100 },
  geometries: [{ format: 'barocss-gpu-triangle-geometry', version: 0, id: 'sloped_quad',
    coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', winding: 'ccw',
    positions: [-.5, -.5, -.5, .5, -.5, .5, .5, .5, .5, -.5, .5, -.5],
    normals: Array.from({ length: 4 }, () => [-Math.SQRT1_2, 0, Math.SQRT1_2]).flat(),
    uvs: [-0, 0, 1, 0, 1, 1, 0, 1], indices: [-0, 1, 2, 0, 2, 3] }],
  materials: [{ id: 'white', type: 'unlit', colorSpace: 'linear', color: [1, 1, 1] }],
  nodes: [group('parent', null), group('child', 'parent'),
    { ...group('mesh_a', 'child'), type: 'mesh', geometryId: 'sloped_quad', materialId: 'white' }] }; }
const key = (timeSeconds, translation = [-0, 0, 0], rotationXYZW = [-0, 0, 0, 1], scale = [1, 1, 1]) =>
  ({ timeSeconds, translation: [...translation], rotationXYZW: [...rotationXYZW], scale: [...scale] });
const request = (timeSeconds = 2) => ({ format: 'barocss-gpu-engine-transform-clip-request', version: 0, timeSeconds });
const clip = () => ({ format: 'barocss-gpu-engine-transform-clip', version: 0, id: 'atomic_keys',
  sceneId: 'atomic_scene', coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', timeUnit: 'seconds',
  rotationOrder: 'xyzw', interpolation: 'linear-trs-shortest-path-nlerp',
  tracks: [{ nodeId: 'parent', keys: [key(1), key(3, [6, 2, 0], [0, 0, 1, 0], [3, 5, 7])] }] });
const providers = [['ordinary-source', await import(pathToFileURL(ordinary).href)],
  ['emitted-public', await import(pathToFileURL(resolve(pkg, published.import)).href)]];
assert.deepEqual(Object.keys(providers[0][1]).sort(), Object.keys(providers[1][1]).sort());
assert.equal(Object.keys(providers[0][1]).length, 101);
const declarationPath = resolve(pkg, published.types), declaration = await readFile(declarationPath, 'utf8');
for (const name of ['EngineTransformKeyV0', 'EngineTransformTrackV0', 'EngineTransformClipV0',
  'EngineTransformClipRequestV0', 'SampledEngineTransformClip']) assert(new RegExp('\\b' + name + '\\b').test(declaration));
let accepted = 0, refused = 0, getters = 0, proxyReflections = 0, oversizeOwnKeys = 0;
const results = [];
for (const [name, gpu] of providers) {
  for (const fn of ['sampleEngineTransformClip', 'EngineTransformClipError', 'prepareEngineScene',
    'sampleEngineTranslationClip', 'sampleEngineRotationClip', 'raycastEngineScene']) assert.equal(typeof gpu[fn], 'function');
  assert(Object.isFrozen(gpu.EngineTransformClipDiagnosticCode));
  assert.deepEqual(Object.keys(gpu.EngineTransformClipDiagnosticCode).sort(),
    ['INPUT', 'VERSION', 'BUDGET', 'REFERENCE', 'RANGE', 'SCENE', 'FRAME'].sort());
  const acceptance = [], refusals = [], controls = [];
  function verify(s, c, q, p) {
    assert.deepEqual(Object.keys(p).sort(), ['clip', 'originalScene', 'request', 'scene']);
    frozen(p); assert.deepEqual(p.originalScene, s); assert.deepEqual(p.clip, c); assert.deepEqual(p.request, q);
    assert.notStrictEqual(p.originalScene, s); assert.notStrictEqual(p.clip, c); assert.notStrictEqual(p.request, q);
    assert.notStrictEqual(p.scene.scene, p.originalScene);
    for (const field of ['id', 'format', 'version', 'coordinateSystem', 'positionUnit',
      'geometries', 'materials', 'camera', 'background']) assert.deepEqual(p.scene.scene[field], s[field]);
    for (const n of s.nodes) {
      const final = p.scene.scene.nodes.find(v => v.id === n.id);
      for (const field of ['id', 'type', 'parentId', 'visible', ...(n.type === 'mesh' ? ['geometryId', 'materialId'] : [])])
        assert.deepEqual(final[field], n[field]);
      if (!c.tracks.some(t => t.nodeId === n.id)) assert.deepEqual(final, n);
    }
  }
  const sourceResult = p => ({ originalScene: p.originalScene, clip: p.clip, request: p.request,
    scene: p.scene.scene, nodes: p.scene.nodes.map(n => ({ id: n.id, worldMatrix: n.worldMatrix,
      normalMatrix: n.normalMatrix, bounds: n.bounds, effectiveVisible: n.effectiveVisible })) });
  async function accept(label, s, c, q, observe = () => null) {
    const sb = json(s), cb = json(c), qb = json(q), p = gpu.sampleEngineTransformClip(s, c, q);
    verify(s, c, q, p); assert.equal(json(s), sb); assert.equal(json(c), cb); assert.equal(json(q), qb);
    const observation = observe(p);
    const originalFile = resolve(output, name + '.' + label + '.original.json');
    const sampledFile = resolve(output, name + '.' + label + '.sampled-source.json');
    await writeFile(originalFile, json({ scene: s, clip: c, request: q }) + '\n');
    await writeFile(sampledFile, json(sourceResult(p)) + '\n');
    const cold = JSON.parse(await readFile(originalFile, 'utf8'));
    const reopened = gpu.sampleEngineTransformClip(cold.scene, cold.clip, cold.request);
    verify(s, c, q, reopened); assert.deepEqual(reopened, p); assert.notStrictEqual(reopened.scene, p.scene);
    assert.deepEqual(JSON.parse(await readFile(sampledFile, 'utf8')), sourceResult(p));
    assert.deepEqual(observe(reopened), observation);
    accepted++; acceptance.push({ label, observation, sourceSHA256: hash(sb), clipSHA256: hash(cb),
      sampledSHA256: hash(json(sourceResult(p))), files: await Promise.all([originalFile, sampledFile].map(receipt)) });
    return p;
  }
  for (const time of [0, 1, 2, 3, 4]) await accept('caller_time_' + time, source(), clip(), request(time), p => {
    const node = p.scene.scene.nodes[0];
    if (time <= 1) { assert.deepEqual(node.translation, [-0, 0, 0]); assert.deepEqual(node.rotationXYZW, [-0, 0, 0, 1]); vector(node.scale, [1, 1, 1]); }
    if (time >= 3) { vector(node.translation, [6, 2, 0]); vector(node.rotationXYZW, [0, 0, 1, 0]); vector(node.scale, [3, 5, 7]); }
    if (time !== 2) return { translation: node.translation, rotationXYZW: node.rotationXYZW, scale: node.scale };
    vector(node.translation, [3, 1, 0]); vector(node.rotationXYZW, [0, 0, Math.SQRT1_2, Math.SQRT1_2]); vector(node.scale, [2, 3, 4]);
    const mesh = p.scene.nodes.find(n => n.id === 'mesh_a');
    vector(mesh.bounds.min, [1.5, 0, -2]); vector(mesh.bounds.max, [4.5, 2, 2]);
    const hit = gpu.raycastEngineScene(p.scene.scene, { format: 'barocss-gpu-engine-ray', version: 0,
      coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', origin: [3.3, 1.2, 6], direction: [0, 0, -1], near: .01, far: 100 });
    assert(hit); assert.equal(hit.nodeId, 'mesh_a'); assert.equal(hit.geometryId, 'sloped_quad'); assert.equal(hit.materialId, 'white');
    near(hit.distance, 5.6); vector(hit.point, [3.3, 1.2, .4]); vector(hit.uv, [.6, .4]);
    vector(hit.barycentric, [.4, .2, .4]); vector(hit.normal, [0, -2 / Math.sqrt(5), 1 / Math.sqrt(5)]);
    return { translation: node.translation, rotationXYZW: node.rotationXYZW, scale: node.scale, hit, bounds: mesh.bounds };
  });
  const atomic = source(); atomic.geometries = []; atomic.materials = [];
  atomic.nodes = [group('parent', null, [1000, 0, 0]), group('child', 'parent', [-1000, 0, 0])];
  const atomicClip = clip(); atomicClip.tracks[0].keys = [key(0, [1000, 0, 0]), key(1, [-1000, 0, 0], [0, 1, 0, 0])];
  const common = { version: 0, id: 'intermediate', sceneId: atomic.id,
    coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', timeUnit: 'seconds' };
  const oneT = { ...common, format: 'barocss-gpu-engine-translation-clip', interpolation: 'linear',
    tracks: [{ nodeId: 'parent', keys: [{ timeSeconds: 1, translation: [-1000, 0, 0] }] }] };
  const oneR = { ...common, format: 'barocss-gpu-engine-rotation-clip', interpolation: 'shortest-path-nlerp', rotationOrder: 'xyzw',
    tracks: [{ nodeId: 'parent', keys: [{ timeSeconds: 1, rotationXYZW: [0, 1, 0, 0] }] }] };
  vector(gpu.prepareEngineScene(atomic).nodes[1].worldMatrix.slice(12, 15), [0, 0, 0]);
  for (const [label, fn, c, format] of [['translation-only', gpu.sampleEngineTranslationClip, oneT, 'barocss-gpu-engine-translation-clip-request'],
    ['rotation-only', gpu.sampleEngineRotationClip, oneR, 'barocss-gpu-engine-rotation-clip-request']]) {
    let e; try { fn(atomic, c, { format, version: 0, timeSeconds: 1 }); } catch (error) { e = error; }
    assert(e); assert.equal(e.code, 'FRAME'); assert(e.cause instanceof gpu.EngineSceneError); assert.equal(e.cause.code, 'TRANSFORM');
    controls.push({ label, code: e.code, causeCode: e.cause.code, message: e.cause.message });
  }
  await accept('atomic_valid_endpoint', atomic, atomicClip, request(1), p => {
    vector(p.scene.nodes[1].worldMatrix.slice(12, 15), [0, 0, 0]);
    return { childWorld: p.scene.nodes[1].worldMatrix.slice(12, 15), intermediateControls: controls };
  });
  const none = clip(); none.tracks = [];
  await accept('no_tracks', source(), none, request(3600));
  const empty = source(); empty.nodes = []; empty.geometries = []; empty.materials = [];
  await accept('genuine_empty', empty, none, request(0));
  const hidden = source(); hidden.nodes[0].visible = false;
  await accept('hidden_target', hidden, clip(), request(2), p => { assert.equal(p.scene.draws.length, 0); return { draws: 0 }; });
  await accept('negative_zero_caller', source(), clip(), request(-0), p => { assert(Object.is(p.request.timeSeconds, -0)); return { negativeZero: true }; });
  const nearUnit = clip(); nearUnit.tracks[0].keys = [key(0, [-0, 0, 0], [-0, 0, 0, 1 - 5e-10])];
  await accept('literal_near_unit', source(), nearUnit, request(0), p => {
    assert.deepEqual(p.scene.scene.nodes[0].rotationXYZW, [-0, 0, 0, 1 - 5e-10]); return { q: p.scene.scene.nodes[0].rotationXYZW };
  });
  const antipodal = clip(); antipodal.tracks[0].keys = [key(0), key(2, [2, 0, 0], [0, 0, 0, -1], [3, 3, 3])];
  await accept('antipodal_interior', source(), antipodal, request(1), p => {
    vector(p.scene.scene.nodes[0].rotationXYZW, [0, 0, 0, 1]); vector(p.scene.scene.nodes[0].translation, [1, 0, 0]);
    vector(p.scene.scene.nodes[0].scale, [2, 2, 2]); return { q: p.scene.scene.nodes[0].rotationXYZW };
  });
  const gap = clip(); gap.tracks[0].keys = [key(0), key(1e-6, [2, 0, 0])];
  await accept('minimum_gap', source(), gap, request(.5e-6), p => { vector(p.scene.scene.nodes[0].translation, [1, 0, 0]); return null; });
  const many = source(); many.geometries = []; many.materials = [];
  many.nodes = Array.from({ length: 32 }, (_, i) => group('group_' + i, null));
  const maximum = clip(); maximum.tracks = many.nodes.map(n => ({ nodeId: n.id,
    keys: Array.from({ length: 16 }, (_, i) => key(i, [-0, 0, 0], [-0, 0, 0, 1], [.01, 100, 1])) }));
  await accept('32_tracks_512_keys', many, maximum, request(4), p => { assert.equal(p.clip.tracks.length, 32); return { keys: 512 }; });
  const retainedS = source(), retainedC = clip(), retainedQ = request(2);
  const previous = gpu.sampleEngineTransformClip(retainedS, retainedC, retainedQ), bits = json(sourceResult(previous));
  const file = resolve(output, name + '.retained.original.json');
  await writeFile(file, json({ scene: retainedS, clip: retainedC, request: retainedQ }) + '\n');
  const saved = await readFile(file), sb = json(retainedS), cb = json(retainedC), qb = json(retainedQ);
  const callers = [clone(retainedS), clone(retainedC), clone(retainedQ)];
  const owned = gpu.sampleEngineTransformClip(...callers); callers[0].nodes[0].translation[0] = 9;
  callers[1].tracks[0].keys[0].scale[0] = 8; callers[2].timeSeconds = 0;
  assert.deepEqual(sourceResult(owned), sourceResult(previous));
  owned.scene.nodes[0].worldMatrixF32[12] = 999; owned.scene.geometries[0].positions[0] = 999;
  assert.deepEqual(owned.originalScene, retainedS); assert.deepEqual(owned.scene.scene, previous.scene.scene);
  const fresh = gpu.sampleEngineTransformClip(retainedS, retainedC, retainedQ);
  assert.notEqual(fresh.scene.nodes[0].worldMatrixF32[12], 999);
  assert.notEqual(fresh.scene.geometries[0].positions[0], 999);
  const failures = [];
  function change(label, edit, code, causeCode) { const s = source(), c = clip(), q = request(); edit(s, c, q);
    failures.push({ label, s, c, q, code, causeCode }); }
  for (const [field, value] of [['format', 'other'], ['version', 1], ['coordinateSystem', 'left-handed'],
    ['positionUnit', 'mm'], ['timeUnit', 'ms'], ['rotationOrder', 'wxyz'], ['interpolation', 'slerp']])
    change('clip_' + field, (s, c) => c[field] = value, 'VERSION');
  change('request_version', (s, c, q) => q.version = 1, 'VERSION');
  for (const value of [-1, 3601, NaN, '1']) change('request_time_' + String(value), (s, c, q) => q.timeSeconds = value, 'RANGE');
  change('wrong_scene', (s, c) => c.sceneId = 'other', 'REFERENCE');
  change('missing_node', (s, c) => c.tracks[0].nodeId = 'absent', 'REFERENCE');
  change('duplicate_target', (s, c) => c.tracks.push(clone(c.tracks[0])), 'REFERENCE');
  change('invalid_id', (s, c) => c.id = 'bad id', 'INPUT');
  change('tracks33', (s, c) => c.tracks = Array.from({ length: 33 }, () => clone(c.tracks[0])), 'BUDGET');
  change('keys0', (s, c) => c.tracks[0].keys = [], 'BUDGET');
  change('keys33', (s, c) => c.tracks[0].keys = Array.from({ length: 33 }, (_, i) => key(i)), 'BUDGET');
  const oversizedKeys = clip(); oversizedKeys.tracks[0].keys = new Proxy(new Array(33), {
    ownKeys() { oversizeOwnKeys++; throw new Error('must not enumerate oversized keys'); } });
  failures.push({ label: 'oversize_keys_before_ownKeys', s: source(), c: oversizedKeys, q: request(), code: 'BUDGET' });
  change('aggregate513', (s, c) => c.tracks = Array.from({ length: 17 }, (_, i) => ({ nodeId: 'n_' + i,
    keys: Array.from({ length: i === 16 ? 1 : 32 }, (_, t) => key(t)) })), 'BUDGET');
  change('duplicate_time', (s, c) => c.tracks[0].keys[1].timeSeconds = 1, 'RANGE');
  change('descending_time', (s, c) => c.tracks[0].keys[1].timeSeconds = 0, 'RANGE');
  change('small_gap', (s, c) => c.tracks[0].keys[1].timeSeconds = 1 + .5e-6, 'RANGE');
  change('late_key', (s, c) => c.tracks[0].keys[1].timeSeconds = 3601, 'RANGE');
  for (const [field, value] of [['translation', 1000.1], ['translation', -1000.1],
    ['scale', 0], ['scale', .009], ['scale', 100.01], ['rotationXYZW', 1.01], ['scale', Infinity]])
    change(field + '_range_' + value, (s, c) => c.tracks[0].keys[0][field][0] = value, 'RANGE');
  change('quaternion_norm', (s, c) => c.tracks[0].keys[0].rotationXYZW = [0, 0, 0, .5], 'RANGE');
  for (const field of ['translation', 'rotationXYZW', 'scale']) {
    change(field + '_wrong_count', (s, c) => c.tracks[0].keys[0][field] = [1, 1], 'INPUT');
    change(field + '_typed_array', (s, c) => c.tracks[0].keys[0][field] = new Float64Array(field === 'rotationXYZW' ? 4 : 3), 'INPUT');
    change(field + '_getter', (s, c) => Object.defineProperty(c.tracks[0].keys[0][field], '0',
      { enumerable: true, get() { getters++; return 1; } }), 'INPUT');
  }
  change('request_extra', (s, c, q) => q.extra = 1, 'INPUT');
  change('clip_symbol', (s, c) => c[Symbol('extra')] = 1, 'INPUT');
  change('key_hidden', (s, c) => Object.defineProperty(c.tracks[0].keys[0], 'extra', { value: 1 }), 'INPUT');
  change('tracks_sparse', (s, c) => delete c.tracks[0], 'INPUT');
  change('keys_sparse', (s, c) => delete c.tracks[0].keys[0], 'INPUT');
  change('request_getter', (s, c, q) => Object.defineProperty(q, 'timeSeconds',
    { enumerable: true, get() { getters++; return 2; } }), 'INPUT');
  change('clip_getter', (s, c) => Object.defineProperty(c, 'tracks',
    { enumerable: true, get() { getters++; return []; } }), 'INPUT');
  change('key_getter', (s, c) => Object.defineProperty(c.tracks[0].keys[0], 'scale',
    { enumerable: true, get() { getters++; return [1, 1, 1]; } }), 'INPUT');
  const trap = new Error('actual atomic transform ownKeys trap');
  failures.push({ label: 'proxy_reflection', s: source(), c: new Proxy(clip(), {
    ownKeys() { proxyReflections++; throw trap; } }), q: request(), code: 'INPUT', exactCause: trap });
  failures.push({ label: 'foreign_record_prototype', s: source(), c: Object.assign(Object.create({}), clip()), q: request(), code: 'INPUT' });
  change('actual_original_scene', s => s.nodes[2].geometryId = 'absent', 'SCENE', 'REFERENCE');
  change('actual_final_world', (s, c, q) => { s.nodes[1].translation = [11, 0, 0];
    c.tracks[0].keys = [key(0, [0, 0, 0], [0, 0, 0, 1], [100, 100, 100])]; q.timeSeconds = 0; }, 'FRAME', 'TRANSFORM');
  const aggregateFirst = clip(); aggregateFirst.tracks = Array.from({ length: 17 }, (_, i) => ({
    nodeId: 'n_' + i, keys: Array.from({ length: i === 16 ? 1 : 32 }, (_, t) => key(t)) }));
  Object.defineProperty(aggregateFirst.tracks[0].keys[0], 'translation', { enumerable: true,
    get() { getters++; return [0, 0, 0]; } });
  failures.push({ label: 'aggregate_ceiling_before_key_values', s: source(), c: aggregateFirst, q: request(), code: 'BUDGET' });
  const badRequest = request(-1);
  failures.push({ label: 'request_before_bad_clip_scene', s: {}, c: {}, q: badRequest, code: 'RANGE' });
  const oversized = new Proxy(new Array(33), { ownKeys() { oversizeOwnKeys++; throw new Error('must not enumerate oversized tracks'); } });
  const oversizeClip = clip(); oversizeClip.tracks = oversized;
  failures.push({ label: 'oversize_before_ownKeys', s: source(), c: oversizeClip, q: request(), code: 'BUDGET' });
  for (const { label, s, c, q, code, causeCode, exactCause } of failures) {
    let error; try { gpu.sampleEngineTransformClip(s, c, q); } catch (e) { error = e; }
    assert(error instanceof gpu.EngineTransformClipError, label + ' actual public error class');
    assert.equal(error.code, code, label); assert.equal(error.name, 'EngineTransformClipError');
    assert(error.message.startsWith('Engine transform clip: ')); assert(error.message.length <= 1024);
    if (causeCode) { assert(error.cause instanceof gpu.EngineSceneError); assert.equal(error.cause.code, causeCode); }
    if (exactCause) assert.strictEqual(error.cause, exactCause);
    assert.equal(getters, 0); assert.equal(oversizeOwnKeys, 0);
    assert.equal(json(sourceResult(previous)), bits); assert.equal(json(retainedS), sb); assert.equal(json(retainedC), cb);
    assert.equal(json(retainedQ), qb); assert.deepEqual(await readFile(file), saved);
    refused++; refusals.push({ label, code, message: error.message, causeCode: error.cause?.code ?? null,
      cause: error.cause?.message ?? null, priorOriginalResultAndFileRetained: true });
  }
  results.push({ provider: name, exports: Object.keys(gpu).sort(), acceptance, controls, refusals,
    retainedFile: await receipt(file), finalSampleSHA256: hash(bits) });
}
assert.equal(results[0].finalSampleSHA256, results[1].finalSampleSHA256);
const report = { issue: 1274, stage: 'CPU-original-atomic-local-TRS-file', accepted, refused, getters,
  proxyReflections, oversizeOwnKeys, actualGL: false, sourceGraph: graph,
  source: await receipt(resolve(pkg, 'src/engine/engine-transform-clip.ts')), declarations: await receipt(declarationPath),
  ordinary: await receipt(ordinary), emitted: await receipt(resolve(pkg, published.import)), results,
  support: 'One original and one complete selected-frame scene admission. Original scene0/complete TRS clip0/request0, caller seconds, componentwise linear translation and positive scale, shortest-path quaternion nlerp. Literal endpoints retain coefficients/sign bits; originals and derived buffers stay separate. Atomic valid frame despite real invalid single-channel intermediates, independent interior normal/ray/UV and cold original files. No timer, global interval certificate, blending, slerp, renderer/pixels, native source rewrite, performance or publication claim.' };
const resultFile = resolve(output, 'actual-result.json');
await writeFile(resultFile, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ issue: 1274, accepted, refused, getters, proxyReflections, oversizeOwnKeys,
  exports: results[0].exports.length, resultSHA256: (await receipt(resultFile)).sha256, actualGL: false }));
