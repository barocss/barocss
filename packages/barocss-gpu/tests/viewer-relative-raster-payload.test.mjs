// Frozen numeric negative witnesses use only pre-existing APIs. The optional private preparation is absent on old dist.
// Device writes are observed fake-device bytes, not proof that hardware executed these shaders.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Geometry, Mesh } from '../dist/viewer/viewer.js';
import { prepareGeometry, segmentInstances, pointInstances } from '../dist/viewer/geometry.js';
import { identity, transformPoint } from '../dist/viewer/math.js';
import { FRAME_BYTES, OBJECT_BYTES, OBJECT_STRIDE } from '../dist/viewer/shaders.js';

import { C, fixture, prepare } from './fixtures/relative-raster-cpu.mjs';
const floatBuffer = buffer => new Float32Array(buffer.bytes.buffer);

// These two names are the only baseline selection. Both old failures must be numeric assertions, not missing imports.
test('relative native upload preserves each represented far coordinate offset', () => {
  const f = fixture(); prepare(f); f.v.upload(f.g);
  const q = floatBuffer(f.g.gpu.positions), expected = Float32Array.from(f.P, (x, i) => x - C[i % 3]);
  assert.deepEqual(q, expected, 'numeric GPU coordinates must be local, not the collapsed world center');
  assert.ok(q[3] - q[0] > .0019, 'nonzero physical span reaches the triangle upload');
  assert.deepEqual(f.g.data.positions, f.P, 'world CPU authority remains exact');
  const packet = f.v.camera.viewProjection(1); f.v.writeUniforms(packet);
  const B = Float64Array.from(f.v.objectData.subarray(0, 16));
  const local = transformPoint(B, Array.from(q.subarray(0, 3)));
  assert.ok(local.every((x, i) => Math.abs(x + C[i] - f.P[i]) <= 2 ** -32));
});

test('relative placed ground cancels the world translation before Float32 object packing', () => {
  const f = fixture(), g = new Geometry(prepareGeometry({ positions: [-1, -1, 0, 1, -1, 0, 0, 1, 0], normals: [0, 0, 1, 0, 0, 1, 0, 0, 1] }), f.v);
  const ground = new Mesh(g, f.v, 2, { pickable: false, castShadow: false, material: { shadowOnly: true } });
  const M = identity(); M[0] = M[5] = 20; M[12] = C[0]; M[13] = C[1]; M[14] = C[2] - .02;
  ground.transform = M; ground.slot = 1; f.v.meshes.push(ground); f.v.geometries.add(g);
  f.v.objectData = new Float32Array(2 * OBJECT_STRIDE / 4); f.v.objectBuffer = { bytes: new Uint8Array(2 * OBJECT_STRIDE) };
  prepare(f); f.v.writeUniforms(f.v.camera.viewProjection(1));
  const B = f.v.objectData.subarray(OBJECT_STRIDE / 4, OBJECT_STRIDE / 4 + 16);
  assert.equal(B[12], 0); assert.equal(B[13], 0);
  assert.equal(B[14], Math.fround(M[14] - C[2]), 'ground keeps the actual represented offset, not a fabricated plane');
  assert.equal(B[0], 20); assert.equal(B[5], 20); assert.equal(B[10], 1);
  assert.deepEqual(g.data.positions, Float32Array.of(-1, -1, 0, 1, -1, 0, 0, 1, 0));
});

test('relative world frustum culling keeps the original far body', () => {
  const f = fixture(); prepare(f);
  const seen = f.v.visibleMeshes(f.v.camera.viewProjection(1));
  assert.ok(seen.opaque.includes(f.m), 'world bounds must be tested with world VP');
  assert.equal(seen.culled, 0);
});

for (const topology of ['lines', 'points']) test(`relative ${topology} update keeps local position bytes after setColors`, () => {
  const f = fixture(C, topology); prepare(f); f.v.upload(f.g);
  const before = f.g.gpu.positions.bytes.slice();
  f.g.setColors([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  const actual = floatBuffer(f.g.gpu.positions);
  assert.equal(actual[0], Math.fround(f.P[0] - C[0]));
  const expected = new Uint8Array(topology === 'lines' ? segmentInstances(f.g.data) : pointInstances(f.g.data));
  assert.deepEqual(f.g.gpu.positions.bytes, expected);
  assert.notDeepEqual(f.g.gpu.positions.bytes, before, 'color bytes really changed');
});

test('private appended ABI sizes are explicit, not mistaken for unchanged legacy packet lengths', () => {
  assert.equal(FRAME_BYTES, 2368); assert.equal(OBJECT_BYTES, 272); assert.equal(OBJECT_STRIDE, 512);
});
