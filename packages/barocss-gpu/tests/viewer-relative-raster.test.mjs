// CPU packet/algebra tests. Actual shader/device/pixel proof is a separate browser qualification.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Camera } from '../dist/viewer/camera.js';
import { Geometry, Mesh } from '../dist/viewer/viewer.js';
import { prepareGeometry, rasterOrigin, rasterPositions, setRasterOrigin, contourInstances } from '../dist/viewer/geometry.js';
import { captureRaster, decodeRasterPoint, packRasterMetadata, rasterInputs, rasterModel, sameRasterInputs } from '../dist/viewer/relative-raster.js';
import { identity, multiply, rotation, transformPoint, translation } from '../dist/viewer/math.js';
import { packFrame } from '../dist/viewer/lights.js';
import { packInstances } from '../dist/viewer/scene.js';
import { FRAME_BYTES, OBJECT_STRIDE, MAX_SHADOWS, surfaceWGSL } from '../dist/viewer/shaders.js';
import { materialLayerWGSL } from '../dist/viewer/shaders/material-layer.js';
import { pathTraceWGSL } from '../dist/viewer/shaders/path-trace.js';
import { C, fixture, prepare } from './fixtures/relative-raster-cpu.mjs';

const span = p => Math.max(p[0], p[3], p[6]) - Math.min(p[0], p[3], p[6]);
const capture = f => captureRaster(f.v.meshes, f.v.camera, f.v.gridFrame(), f.v.lights, f.v.environment, f.v.clip, 1);
const approx = (actual, expected, reserve = 2 ** -31) => assert.ok(actual.every((x, i) => Math.abs(x - expected[i]) <= reserve), `${actual} != ${expected}`);

test('captured origin is the exact public target and owned private offsets retain genuine native span', () => {
  const f = fixture(), r = capture(f); assert.ok(r);
  assert.deepEqual(r.origin, C); assert.notEqual(r.origin, f.v.camera.target);
  assert.deepEqual(r.origins.get(f.g), C);
  assert.equal(f.v.camera.position[2], C[2] + .01);
  assert.equal(f.g.data.positions[0], f.P[0]);
  prepare(f); assert.ok(span(rasterPositions(f.g.data)) > .0019);
});

test('affine local packing preserves represented transformed physical points and old linear normal inputs', () => {
  const f = fixture(), G = C, O = [C[0] + .01, C[1] - .02, C[2] + .03];
  const M = multiply(translation([17, -23, 41]), rotation([1, 2, -1], .37)), B = rasterModel(M, G, O);
  const q = f.P.subarray(0, 3).map((x, i) => x - G[i]);
  approx(transformPoint(B, q).map((x, i) => x + O[i]), transformPoint(M, Array.from(f.P.subarray(0, 3))), 2 ** -29);
  for (const k of [0, 1, 2, 4, 5, 6, 8, 9, 10]) assert.equal(B[k], M[k]);
});

test('relative projection uses the actual requested render target aspect without changing public matrices', () => {
  const f = fixture(), before = f.v.camera.viewProjection(1), r = captureRaster(f.v.meshes, f.v.camera, null, f.v.lights, {}, null, 2);
  assert.ok(r); assert.deepEqual(f.v.camera.viewProjection(1), before);
  assert.equal(r.viewProjection[0], Math.fround(f.v.camera.projectionMatrix(2)[0]));
  assert.notEqual(r.viewProjection[0], Math.fround(f.v.camera.projectionMatrix(1)[0]));
  assert.ok(r.inverse.every(Number.isFinite));
});

test('ordinary origin-zero frame prefix/object prefix and instance bytes retain legacy values', () => {
  const f = fixture([32, 16, 4]), vp = f.v.camera.viewProjection(1), before = packFrame(vp, f.v.camera, f.v.lights, {}, null, [800, 800, 1, 1]);
  prepare(f); assert.equal(f.v.raster, null);
  f.v.sceneBounds = () => ({ min: [31, 15, 3], max: [33, 17, 5] });
  f.v.writeUniforms(vp);
  const expected = packFrame(vp, f.v.camera, f.v.lights, {}, null, [800, 800, 1, Math.sqrt(3)]);
  assert.deepEqual(new Float32Array(f.v.frameBuffer.bytes.buffer).subarray(0, 580), expected.subarray(0, 580));
  assert.deepEqual(Array.from(before.subarray(580)), new Array(12).fill(0));
  const oldObject = new Float32Array(64), extended = new Float32Array(68); f.m.pack(oldObject, 0, 1); f.m.pack(extended, 0, 1);
  assert.deepEqual(extended.subarray(0, 64), oldObject); assert.deepEqual(Array.from(extended.subarray(64)), [0, 0, 0, 0]);
  const matrix = translation([3, 4, 5]), inst = packInstances({ transforms: matrix });
  assert.equal(inst.data.byteLength, 68); assert.deepEqual(new Float32Array(inst.data, 0, 16), Float32Array.from(matrix));
  assert.deepEqual(Array.from(new Uint8Array(inst.data, 64)), [255, 255, 255, 255]);
});

const fallbacks = [
  ['instances', f => f.m.setInstances({ transforms: identity() })],
  ['scalar data', f => f.g.setScalars([1], 'triangle')],
  ['custom material', f => { f.m.material = { shader: { expression: 'vec3f(1.0)' } }; }],
  ['finish', f => { f.m.material = { film: 1 }; }],
  ['active clipping', f => { f.v.clip = { normal: [1, 0, 0], offset: C[0], cap: [1, 1, 1], planes: [{ normal: [1, 0, 0], offset: C[0] }] }; }],
  ['point light', f => { f.v.lights = [{ kind: 'point', position: C }]; }],
  ['soft shadow', f => { f.v.environment.softShadows = 1; }],
  ['projective matrix', f => { const M = identity(); M[3] = .5; f.m.transform = M; }],
  ['manual clipping', f => { f.v.camera.autoClip = false; }],
  ['non-cardinal visible grid', f => { f.v.grid.visible = true; f.v.camera.up = [1, 1, 1]; }],
];
for (const [name, change] of fallbacks) test(`complete legacy fallback for ${name} resets uploaded positions and recovers`, () => {
  const f = fixture(); prepare(f); f.v.upload(f.g); const local = f.g.gpu;
  assert.ok(span(new Float32Array(local.positions.bytes.buffer)) > .0019);
  change(f); prepare(f); assert.equal(f.v.raster, null); assert.equal(local.positions.destroyed, true);
  assert.deepEqual(rasterOrigin(f.g.data), [0, 0, 0]); f.v.upload(f.g);
  assert.deepEqual(new Float32Array(f.g.gpu.positions.bytes.buffer), Float32Array.from(f.P));
  assert.equal(span(new Float32Array(f.g.gpu.positions.bytes.buffer)), 0);
  assert.deepEqual(f.g.data.positions, f.P);
});

test('resident hidden unsupported geometry keeps the whole old frame; disposing restores relative mode', () => {
  const f = fixture(); prepare(f); const label = new Geometry(prepareGeometry({ topology: 'labels', positions: [], labels: [] }), f.v), m = new Mesh(label, f.v, 9, {});
  m.visible = false; f.v.meshes.push(m); f.v.geometries.add(label); prepare(f); assert.equal(f.v.raster, null);
  label.disposed = true; prepare(f); assert.ok(f.v.raster);
});

test('generated or supplied zero triangle normals remain on the whole legacy far frame', () => {
  for (const supplied of [false, true]) {
    const f = fixture(), data = prepareGeometry({ positions: f.P, ...(supplied ? { normals: new Float32Array(9) } : {}) });
    const g = new Geometry(data, f.v); f.v.meshes[0] = new Mesh(g, f.v, 2, {}); f.v.geometries = new Set([g]);
    prepare(f); assert.equal(f.v.raster, null);
  }
});

test('hiding the supported body and camera orbit retain source-derived G/O; reupload retains local bytes', () => {
  const f = fixture(); prepare(f); f.v.upload(f.g); const bytes = f.g.gpu.positions.bytes.slice(), origin = [...f.v.raster.origin];
  f.m.visible = false; f.v.camera.position = [C[0] + .01, C[1], C[2]]; prepare(f);
  assert.deepEqual(f.v.raster.origin, origin); assert.deepEqual(rasterOrigin(f.g.data), C);
  f.g.release(); f.v.upload(f.g); assert.deepEqual(f.g.gpu.positions.bytes, bytes);
});

test('normal supplied empty triangles and offcenter native lines do not exclude supported geometry', () => {
  const f = fixture(C, 'lines'), empty = new Geometry(prepareGeometry({ positions: new Float64Array() }), f.v);
  f.v.meshes.push(new Mesh(empty, f.v, 4, {})); f.v.geometries.add(empty); prepare(f);
  assert.ok(f.v.raster); assert.ok(rasterPositions(f.g.data)[0] < -.0009);
});

test('separated mixed world scene and nonfinite/packed-collapse candidates keep legacy without public mutation', () => {
  const f = fixture(), far = new Geometry(prepareGeometry({ positions: [0, 0, 0], topology: 'points' }), f.v);
  f.v.meshes.push(new Mesh(far, f.v, 5, {})); f.v.geometries.add(far); assert.equal(capture(f), null);
  f.v.meshes.pop(); f.v.camera.near = 1e10; f.v.camera.far = 1e10 + .01;
  assert.equal(capture(f), null); assert.equal(f.v.camera.near, 1e10);
});

test('grid independent major/minor phases preserve genuine positive world lines and world axes', () => {
  const center = [999000 + 2 ** -16, -998000 + 3 * 2 ** -16, 0], f = fixture(center);
  f.v.camera.up = [0, 0, 1]; f.v.camera.position = [center[0], center[1], .01]; f.v.grid = { visible: true, cell: 10, major: 5, height: 0 };
  const r = capture(f); assert.ok(r);
  assert.deepEqual(r.gridPhase, [2 ** -16, 3 * 2 ** -16, 2 ** -16, 3 * 2 ** -16]);
  assert.deepEqual(r.gridAxis.slice(0, 2), center.slice(0, 2)); assert.equal(r.grid.height, 0);
  // A literal world grid intersection maps to the periodic local zero; axes stay at world zero far outside the view.
  assert.equal((999000 - center[0]) + r.gridPhase[0], 0);
  assert.equal((-998000 - center[1]) + r.gridPhase[1], 0);
  f.v.grid = { visible: true, cell: .3, major: 2.5, height: 0 };
  const other = capture(f), c = Math.fround(.3), major = Math.fround(c * Math.fround(2.5)); assert.ok(other);
  assert.equal(other.gridPhase[2], center[0] % major);
  assert.notEqual(other.gridPhase[2], other.gridPhase[0], 'noninteger major needs its own period');
});

test('hard shadow including zero intensity uses the same relative frame without changing bias or world scene bounds', () => {
  const f = fixture(); prepare(f); const light = f.v.lights[0], worldBounds = structuredClone(f.v.sceneBounds());
  const old = f.v.shadowFrame(light), relative = f.v.shadowFrame(light, C);
  assert.ok(relative); approx(relative.eye.map((x, i) => x + C[i]), old.eye);
  assert.equal(relative.bias, old.bias); assert.equal(relative.texel, old.texel); assert.equal(relative.normalOffset, old.normalOffset);
  const worldPoint = Array.from(f.P.subarray(0, 3)), q = worldPoint.map((x, i) => x - C[i]);
  const half = worldBounds.max.map((x, i) => (x - worldBounds.min[i]) / 2), radius = Math.hypot(...half);
  const physical = [(worldPoint[0] - C[0]) / radius, (worldPoint[1] - C[1]) / radius,
    ((relative.eye[2] - q[2]) - .9 * radius) / (2.2 * radius)];
  approx(transformPoint(relative.viewProjection, q), physical, 4096 * Number.EPSILON);
  f.v.writeUniforms(f.v.camera.viewProjection(1), [relative]);
  const frame = new Float32Array(f.v.frameBuffer.bytes.buffer), shadow = new Float32Array(f.v.shadowFrameBuffers[0].bytes.buffer);
  assert.deepEqual(Array.from(frame.subarray(200, 216)), Array.from(Float32Array.from(relative.viewProjection)));
  assert.deepEqual(Array.from(shadow.subarray(16, 19)), Array.from(Float32Array.from(relative.eye)));
  assert.deepEqual(f.v.sceneBounds(), worldBounds); assert.equal(light.intensity, 0); assert.equal(light.castShadow, true);
});

test('captured packed inverse decodes pixelcenter depth and restores O exactly once', () => {
  const f = fixture(), r = capture(f); assert.ok(r);
  const p = [0, 0, 0], ndc = transformPoint(r.viewProjection, p), depth = Math.fround(ndc[2]);
  const decoded = decodeRasterPoint(r, ndc[0], ndc[1], depth);
  approx(decoded, C, 2 ** -31);
  f.v.camera.target = [0, 0, 0]; f.v.camera.position = [1, 1, 1];
  assert.deepEqual(decodeRasterPoint(r, ndc[0], ndc[1], depth), decoded, 'capture owns its origin/inverse');
});

test('snapshot rejects profile changes without sceneMoved including direct visibility/material/lighting edits', () => {
  const changes = [f => { f.m.visible = false; }, f => { f.g.setScalars([1], 'triangle'); }, f => { f.m.material = { film: 1 }; }, f => { f.v.lights[0].direction = [1, 0, 0]; }];
  for (const change of changes) { const f = fixture(), before = rasterInputs(f.v.meshes, f.v.camera, f.v.grid, f.v.lights, f.v.environment, f.v.clip); change(f);
    assert.equal(sameRasterInputs(before, rasterInputs(f.v.meshes, f.v.camera, f.v.grid, f.v.lights, f.v.environment, f.v.clip)), false); }
});

test('relative contours retain local triangle positions and their original normals', () => {
  const f = fixture(), g = prepareGeometry({ positions: f.P, normals: f.g.data.normals, topology: 'lines', contour: true });
  setRasterOrigin(g, C); const values = new Float32Array(contourInstances(g));
  assert.deepEqual(values.subarray(0, 9), Float32Array.from(f.P, (x, i) => x - C[i % 3]));
  assert.deepEqual(values.subarray(9), f.g.data.normals);
});

test('raster-only material restoration leaves path-trace shared WGSL and trace object fields unchanged', () => {
  const surface = surfaceWGSL(); assert.match(surface, /object\.meshOrigin\.xyz/); assert.match(surface, /frame\.origin\.w/);
  assert.doesNotMatch(materialLayerWGSL, /meshOrigin|frame\.origin/); assert.doesNotMatch(pathTraceWGSL, /meshOrigin|frame\.origin/);
  const f = new Float32Array(FRAME_BYTES / 4), fixtureData = fixture(), r = capture(fixtureData); packRasterMetadata(f, r);
  assert.deepEqual(Array.from(f.subarray(580, 584)), [...C, 1]);
  assert.equal(f.length, 592); assert.equal(OBJECT_STRIDE / 256, 2); assert.equal(MAX_SHADOWS, 14);
});


test('scalar fallback removal atomically rebuilds local bytes again', () => {
  const f = fixture(); prepare(f); f.v.upload(f.g); const before = f.g.gpu.positions.bytes.slice();
  f.g.setScalars([1], 'triangle'); prepare(f); f.v.upload(f.g); assert.equal(f.v.raster, null);
  f.g.setScalars(null); prepare(f); f.v.upload(f.g);
  assert.ok(f.v.raster); assert.deepEqual(f.g.gpu.positions.bytes, before);
  assert.equal(f.g.data.scalars, null); assert.deepEqual(f.g.data.positions, f.P);
});

function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
function pendingPick() {
  const f = fixture(); prepare(f); const r = f.v.raster, ndc = transformPoint(r.viewProjection, [0, 0, 0]), depth = Math.fround(ndc[2]);
  const entered = deferred(), release = deferred(), calls = { unmaps: 0 };
  const read = { async mapAsync() { entered.resolve(); await release.promise; }, getMappedRange(offset) { return offset === 256 ? Float32Array.of(depth).buffer : Uint32Array.of(offset === 512 ? 0 : f.m.id).buffer; }, unmap() { calls.unmaps++; } };
  const pass = { setScissorRect() {}, setBindGroup() {}, end() {} };
  Object.assign(f.v.device.queue, { submit() {} });
  f.v.device.createCommandEncoder = () => ({ beginRenderPass: () => pass, copyTextureToBuffer() {}, finish() {} });
  Object.assign(f.v, { pickSceneRevision: 0, requireDevice() {}, prepareCamera: () => f.v.camera.viewProjection(1),
    visibleMeshes: () => ({ opaque: [f.m], transparent: [] }), drawCapFront() {}, drawMesh() {}, drawCaps() {}, ensurePickTargets: () => ({ views: {}, read }) });
  return { ...f, entered: entered.promise, release: release.resolve, calls, depth };
}

test('real pickNow restores captured relative point at the backing pixel center', async () => {
  const f = pendingPick(), p = f.v.pickNow(400, 400); await f.entered; f.release(); const hit = await p;
  assert.ok(hit); assert.equal(hit.mesh, f.m); assert.equal(hit.triangle, 0); assert.equal(hit.face, 17); assert.equal(hit.depth, f.depth);
  const r = f.v.raster, expected = decodeRasterPoint(r, 2 * (400.5 / 800) - 1, 1 - 2 * (400.5 / 800), f.depth);
  assert.deepEqual(hit.point, expected); assert.equal(f.calls.unmaps, 1);
});
for (const [name, change] of [['scalar setter', f => f.g.setScalars([1], 'triangle')], ['material setter', f => { f.m.material = { film: 1 }; }], ['direct light change', f => { f.v.lights[0].direction = [1, 0, 0]; }], ['visibility', f => { f.m.visible = false; }]]) {
  test(`pending relative pick rejects ${name} before another frame and unmaps once`, async () => {
    const f = pendingPick(), p = f.v.pickNow(400, 400); await f.entered; change(f); f.release();
    assert.equal(await p, null); assert.equal(f.calls.unmaps, 1);
  });
}


test('pending relative pick rejects direct null-auto grid cell to NaN without requestRender', async () => {
  const f = pendingPick(); f.v.grid = { visible: true, cell: null };
  const p = f.v.pickNow(400, 400); await f.entered;
  assert.ok(f.v.raster, 'null cell uses the existing automatic grid period');
  const revision = f.v.rasterRevision; f.v.grid.cell = NaN;
  assert.equal(f.v.rasterRevision, revision, 'direct public assignment has no render-request invalidation');
  f.release(); assert.equal(await p, null); assert.equal(f.calls.unmaps, 1);
});

test('snapshot value comparison preserves null/undefined/nonfinite and signed zero distinctions', () => {
  const f = fixture();
  for (const [before, after] of [[null, NaN], [undefined, Infinity], [0, -0]]) {
    f.v.grid.cell = before; const key = rasterInputs(f.v.meshes, f.v.camera, f.v.grid, f.v.lights, f.v.environment, f.v.clip);
    f.v.grid.cell = after; assert.equal(sameRasterInputs(key, rasterInputs(f.v.meshes, f.v.camera, f.v.grid, f.v.lights, f.v.environment, f.v.clip)), false);
  }
});


test('private admission retains legacy when a finite affine model has overflowing packed normal coefficients', () => {
  const f = fixture(), M = identity(); M[0] = 1e-40; f.m.transform = M;
  f.v.camera.target = [C[0] * M[0], C[1], C[2]];
  f.v.camera.position = [f.v.camera.target[0], C[1], C[2] + .01];
  const source = f.P.slice(), before = M.slice();
  assert.equal(capture(f), null); assert.deepEqual(f.m.transform, before); assert.deepEqual(f.g.data.positions, source);
});

test('private admission retains legacy when the existing directional normalization is nonfinite', () => {
  const f = fixture(); f.v.lights[0].direction = [1e-320, 0, 0];
  assert.equal(capture(f), null); assert.deepEqual(f.v.lights[0].direction, [1e-320, 0, 0]);
  assert.equal(f.v.lights[0].castShadow, true); assert.equal(f.v.lights[0].intensity, 0);
});


test('private admission retains legacy when a finite world placement overflows appended Float32 origin metadata', () => {
  const f = fixture(), positions = Float64Array.from([-1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1, -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1], x => x * .001);
  const normals = new Float32Array(24); for (let i = 2; i < normals.length; i += 3) normals[i] = 1;
  const g = new Geometry(prepareGeometry({ positions, normals, indices: [0, 1, 2, 0, 2, 3] }), f.v), m = new Mesh(g, f.v, 5, {}), M = identity(); M[12] = 1e40; m.transform = M;
  f.v.meshes = [m]; f.v.geometries = new Set([g]);
  f.v.camera.target = [1e40, 0, 0]; f.v.camera.position = [1e40, -1e24, 1e24]; f.v.camera.up = [0, 0, 1]; f.v.camera.projection = 'perspective'; f.v.camera.near = 1e-6; f.v.camera.far = Infinity;
  assert.equal(capture(f), null); assert.deepEqual(m.transform, M); assert.deepEqual(g.data.positions, positions);
  assert.deepEqual(f.v.camera.target, [1e40, 0, 0]);
});
