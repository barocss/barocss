import test from 'node:test';
import assert from 'node:assert/strict';
import { Camera } from '../dist/viewer/camera.js';
import { Geometry, Mesh, Viewer } from '../dist/viewer/viewer.js';
import { clippedRay, contourInstances, pointInstances, prepareGeometry, prepareScalars, rayTriangles, scalarAt, segmentInstances } from '../dist/viewer/geometry.js';
import { identity, transformPoint } from '../dist/viewer/math.js';

const CENTER = [999000, -998000, 997000];
const triangle = (center = CENTER) => Float64Array.from([-.001, -.001, 0, .001, -.001, 0, 0, .001, 0], (x, i) => x + center[i % 3]);
const normals = () => Float32Array.of(0, 0, 1, 0, 0, 1, 0, 0, 1);
const input = positions => ({ positions, normals: normals(), indices: [0, 1, 2], faces: [17], uvs: [0, 0, 1, 0, .5, 1] });
const bytes = view => new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
const span = p => [0, 1, 2].map(k => { const a = Array.from(p).filter((_, i) => i % 3 === k); return Math.max(...a) - Math.min(...a); });
const closePoint = (actual, expected) => assert.ok(actual.every((x, i) => Math.abs(x - expected[i]) <= 3e-10), `${actual} != ${expected}`);
function owner() {
  return Object.assign(Object.create(Viewer.prototype), {
    camera: new Camera({ position: [CENTER[0], CENTER[1], CENTER[2] + .01], target: [...CENTER], up: [0, 1, 0], projection: 'orthographic' }),
    canvas: { width: 800, height: 600, clientWidth: 800, clientHeight: 600 },
    grid: { visible: false }, clip: null, meshes: [], scene: null,
    alive() {}, requestRender() {}, sceneMoved() { this.scene = null; },
  });
}
function mesh(viewer, geometry) {
  const m = new Mesh(new Geometry(geometry, viewer), viewer, viewer.meshes.length + 1, {});
  viewer.meshes.push(m);
  return m;
}
function fakeUpload(g) {
  const buffers = [], writes = [], viewer = owner();
  viewer.device = {
    queue: { writeBuffer(buffer, offset, data) { const copy = Uint8Array.from(bytes(data)); buffer.bytes.set(copy, offset); writes.push({ buffer, bytes: copy }); } },
    createBuffer(descriptor) { const b = { descriptor, bytes: new Uint8Array(descriptor.size), destroy() {} }; buffers.push(b); return b; },
  };
  const geometry = new Geometry(g, viewer);
  assert.equal(viewer.upload(geometry), true);
  return { viewer, geometry, buffers, writes };
}

test('Float64 input retains exact owned world coordinates and genuine bounds', () => {
  const source = triangle(), expected = source.slice(), g = prepareGeometry(input(source));
  assert.ok(span(g.positions)[0] > .0019, 'far native span survives preparation');
  assert.deepEqual(Array.from(g.positions), Array.from(expected));
  assert.ok(g.positions instanceof Float64Array);
  assert.notEqual(g.positions.buffer, source.buffer);
  assert.deepEqual(g.bounds, { min: [expected[0], expected[1], expected[2]], max: [expected[3], expected[7], expected[8]] });
  source.fill(0);
  assert.deepEqual(Array.from(g.positions), Array.from(expected), 'caller edits cannot alter prepared storage');
  assert.equal(g.bounds.min[0], expected[0]);
});

test('Float64 subarray ownership copies only the admitted view', () => {
  const source = new Float64Array(15); source.set(triangle(), 3);
  const selected = source.subarray(3, 12), expected = selected.slice(), g = prepareGeometry(input(selected));
  assert.deepEqual(Array.from(g.positions), Array.from(expected));
  assert.equal(g.positions.length, 9);
  assert.notEqual(g.positions.buffer, source.buffer);
});

for (const center of [CENTER, [0, 0, 0], [32, 16, 4]]) test(`world triangle CPU ray stays on its literal plane at ${center}`, () => {
  const P = triangle(center), g = prepareGeometry(input(P));
  const origin = [center[0], center[1], center[2] + .01], direction = [0, 0, -1];
  const hit = rayTriangles(g, origin, direction);
  assert.ok(hit, 'nondegenerate triangle is intersected');
  assert.equal(hit.triangle, 0);
  assert.equal(origin[2] - hit.t, center[2], 'the reconstructed world hit is on the literal plane');
  const clipped = clippedRay(g, identity(), origin, direction, { normal: [1, 0, 0], offset: center[0] - .0005 }, false, true);
  assert.equal(clipped?.triangle, 0);
  assert.equal(clipped?.t, hit.t);
});

for (const accelerate of [false, true]) test(`public far world raycast keeps face and world point; acceleration=${accelerate}`, () => {
  const v = owner(), g = prepareGeometry(input(triangle())), m = mesh(v, g);
  v.accelerate = accelerate;
  const hit = v.raycast(400, 300);
  assert.ok(hit);
  assert.equal(hit.mesh, m); assert.equal(hit.face, 17); assert.equal(hit.triangle, 0);
  closePoint(hit.point, CENTER);
  assert.deepEqual(m.bounds, g.bounds);
});

for (const accelerate of [false, true]) test(`off-center far line CPU pick retains edge and world point; acceleration=${accelerate}`, () => {
  const v = owner();
  const P = Float64Array.of(CENTER[0] - .001, CENTER[1], CENTER[2], CENTER[0] + .001, CENTER[1], CENTER[2]);
  const g = prepareGeometry({ positions: P, topology: 'lines', edges: [29] }), m = mesh(v, g);
  v.accelerate = accelerate;
  const point = [P[0] + (P[3] - P[0]) * .75, CENTER[1], CENTER[2]];
  const q = transformPoint(v.camera.viewProjection(v.aspect), point), x = (q[0] + 1) * 400, y = (1 - q[1]) * 300;
  assert.ok(Math.abs(x - 400) > 20, 'query stays away from the collapsed center');
  const hit = v.pickLine(x, y, 2, { throughSurfaces: true });
  assert.ok(hit, 'a real off-center segment is found');
  assert.equal(hit.mesh, m); assert.equal(hit.edge, 29); assert.equal(hit.segment, 0);
  closePoint(hit.point, point);
  assert.equal(g.bounds.max[0] - g.bounds.min[0], P[3] - P[0]);
});

test('scalar-expanded Float64 geometry retains indexed world samples and scalar membership', () => {
  const P = triangle(), g = prepareGeometry({ ...input(P), indices: [2, 0, 1] });
  const f = prepareScalars(g, [42], 'triangle');
  const expected = Float64Array.from([2, 0, 1].flatMap(v => Array.from(P.subarray(v * 3, v * 3 + 3))));
  assert.deepEqual(Array.from(f.draw.positions), Array.from(expected));
  assert.ok(f.draw.positions instanceof Float64Array);
  assert.notEqual(f.draw.positions.buffer, g.positions.buffer);
  assert.deepEqual(Array.from(f.draw.values), [42, 42, 42]);
  g.scalars = f;
  assert.equal(scalarAt(g, 0, CENTER), 42);
  assert.equal(prepareScalars(g, [1, 2, 3], 'vertex').draw.positions, null);
});

test('triangle GPU upload has exact legacy numeric Float32 bytes without changing CPU authority', () => {
  const P = triangle(), g = prepareGeometry(input(P)), snapshot = g.positions.slice(), { geometry, buffers } = fakeUpload(g);
  const uploaded = buffers.find(b => b.descriptor.label === 'positions');
  assert.equal(uploaded.descriptor.size, P.length * 4, 'vertex stream has four bytes per coordinate');
  assert.deepEqual(uploaded.bytes, bytes(Float32Array.from(P)));
  assert.equal(geometry.gpu.positions, uploaded);
  assert.deepEqual(g.positions, snapshot);
  assert.ok(span(g.positions)[0] > .0019);
});

test('released triangle buffers re-upload numeric Float32 bytes from retained world doubles', () => {
  const P = triangle(), g = prepareGeometry(input(P)), { viewer, geometry, buffers } = fakeUpload(g);
  geometry.release();
  assert.equal(geometry.gpu, null);
  viewer.upload(geometry);
  const uploads = buffers.filter(b => b.descriptor.label === 'positions');
  assert.equal(uploads.length, 2);
  assert.deepEqual(uploads[1].bytes, bytes(Float32Array.from(P)));
  assert.deepEqual(Array.from(g.positions), Array.from(P));
});

test('mapped scalar GPU upload has exact legacy numeric Float32 bytes', () => {
  const P = triangle(), g = prepareGeometry({ ...input(P), indices: [2, 0, 1] });
  g.scalars = prepareScalars(g, [42], 'triangle');
  const { viewer, geometry, buffers } = fakeUpload(g), expected = Float32Array.from([2, 0, 1].flatMap(v => Array.from(P.subarray(v * 3, v * 3 + 3))));
  viewer.instanceBuffer = () => ({}); viewer.mapGroup2 = () => ({});
  const pass = { setVertexBuffer() {}, setBindGroup() {}, draw() {} };
  viewer.drawMapped(pass, { geometry, instanceCount: 1 });
  const uploaded = buffers.find(b => b.descriptor.label === 'scalar positions');
  assert.equal(uploaded.descriptor.size, expected.byteLength);
  assert.deepEqual(uploaded.bytes, bytes(expected));
  assert.ok(g.scalars.draw.positions instanceof Float64Array);
});

for (const topology of ['lines', 'points', 'contour']) test(`${topology} GPU packing retains exact legacy Float32 bytes`, () => {
  const P = topology === 'lines' ? triangle().subarray(0, 6) : triangle();
  const values = { positions: P, topology: topology === 'contour' ? 'lines' : topology,
    ...(topology === 'contour' ? { contour: true, normals: normals(), indices: [0, 1, 2] } : {}) };
  const g = prepareGeometry(values), legacy = prepareGeometry({ ...values, positions: Float32Array.from(P) });
  const pack = topology === 'lines' ? segmentInstances : topology === 'points' ? pointInstances : contourInstances;
  assert.deepEqual(new Uint8Array(pack(g)), new Uint8Array(pack(legacy)));
  const { geometry } = fakeUpload(g);
  assert.deepEqual(geometry.gpu.positions.bytes, new Uint8Array(pack(legacy)), 'the real upload uses those packed numeric bytes');
  assert.ok(span(g.positions)[0] > .0019);
});

for (const [name, coordinates] of [
  ['Float32Array', Float32Array.from(triangle())], ['number array', Array.from(triangle())],
  ['other ArrayLike', Object.assign({ length: 9 }, Array.from(triangle()))],
]) test(`${name} keeps its legacy owned Float32 preparation and scalar expansion`, () => {
  const expected = Float32Array.from(coordinates), g = prepareGeometry(input(coordinates));
  assert.ok(g.positions instanceof Float32Array);
  assert.deepEqual(g.positions, expected);
  assert.notEqual(g.positions, coordinates);
  assert.equal(span(g.positions)[0], 0);
  const scalar = prepareScalars(g, [1], 'triangle');
  assert.ok(scalar.draw.positions instanceof Float32Array);
  assert.deepEqual(scalar.draw.positions, expected);
});

test('Float64 omitted normals keep legacy numeric Float32-derived normals', () => {
  const P = triangle(), g = prepareGeometry({ positions: P, indices: [0, 1, 2] });
  const legacy = prepareGeometry({ positions: Float32Array.from(P), indices: [0, 1, 2] });
  assert.deepEqual(g.normals, legacy.normals);
  assert.ok(span(g.positions)[0] > .0019);
});

test('Float64 coordinates retain the existing finite-Float32 admission boundary', () => {
  for (const value of [NaN, Infinity, -Infinity, 1e40, -1e40]) {
    assert.throws(() => prepareGeometry({ positions: Float64Array.of(value, 0, 0), topology: 'points' }),
      error => error.code === 'GEOMETRY_INVALID' && /positions\[0\] is not finite/.test(error.message));
  }
  const P = Float64Array.of(1e-100, 0, 0), g = prepareGeometry({ positions: P, topology: 'points' });
  assert.equal(g.positions[0], P[0], 'accepted finite source values remain exact, even below F32 range');
  assert.deepEqual(new Uint8Array(pointInstances(g)), new Uint8Array(pointInstances(prepareGeometry({ positions: Float32Array.from(P), topology: 'points' }))));
});

test('label anchor storage keeps its existing Float32 profile', () => {
  const g = prepareGeometry({ positions: [], topology: 'labels', labels: [{ text: 'far', at: CENTER, size: 12 }] });
  assert.ok(g.positions instanceof Float32Array);
  assert.deepEqual(Array.from(g.positions), CENTER);
});
