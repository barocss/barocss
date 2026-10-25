// CPU resource-lifecycle contract: the buffer spy is not actual GPU rendering evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Geometry, Mesh, ViewerError } from '../dist/viewer/scene.js';
import { prepareGeometry } from '../dist/viewer/geometry.js';
import { identity } from '../dist/viewer/math.js';

function fixture() {
  const calls = { moved: 0, render: 0, destroyed: 0 };
  const owner = { sceneMoved() { calls.moved++; }, requestRender() { calls.render++; } };
  const geometry = new Geometry(prepareGeometry({ positions: [0, 0, 0, 1, 0, 0, 0, 1, 0] }), owner);
  const mesh = new Mesh(geometry, owner, 1, { instances: { transforms: identity() } });
  const buffer = { destroy() { calls.destroyed++; } };
  mesh.instances.buffer = buffer;
  const bounds = mesh.bounds;
  calls.moved = 0; calls.render = 0;
  return { mesh, geometry, bounds, buffer, calls };
}

for (const [name, input] of [
  ['15 transform numbers', { transforms: new Float64Array(15) }],
  ['2 colors for one instance', { transforms: identity(), colors: [1, 0] }],
]) test(`setInstances rejects ${name} before releasing or replacing existing state`, () => {
  const { mesh, geometry, bounds, buffer, calls } = fixture();
  const instances = mesh.instances, data = instances.data, matrices = instances.matrices, firstMatrix = matrices[0];
  const geometryData = geometry.data, positions = geometryData.positions, normals = geometryData.normals, colors = geometryData.colors;
  const oldBytes = new Uint8Array(data).slice(), oldMatrix = firstMatrix.slice();
  assert.throws(() => mesh.setInstances(input), e => e instanceof ViewerError && e.code === 'INSTANCES_INVALID');
  assert.equal(mesh.geometry, geometry); assert.equal(geometry.data, geometryData);
  assert.equal(geometryData.positions, positions); assert.equal(geometryData.normals, normals); assert.equal(geometryData.colors, colors);
  assert.equal(mesh.instances, instances); assert.equal(mesh.instances.data, data);
  assert.equal(mesh.instances.matrices, matrices); assert.equal(mesh.instances.matrices[0], firstMatrix);
  assert.equal(mesh.instances.buffer, buffer); assert.equal(mesh.bounds, bounds);
  assert.deepEqual(new Uint8Array(data), oldBytes); assert.deepEqual(firstMatrix, oldMatrix);
  assert.deepEqual(calls, { moved: 0, render: 0, destroyed: 0 });
});

test('setInstances valid replacement and null each release only the prior buffer', () => {
  const { mesh, geometry, buffer, bounds, calls } = fixture();
  const previous = mesh.instances;
  const transform = identity(); transform[12] = 4;
  mesh.setInstances({ transforms: transform });
  assert.notEqual(mesh.instances, previous); assert.equal(mesh.geometry, geometry);
  assert.equal(calls.destroyed, 1); assert.equal(previous.buffer, buffer);
  assert.equal(mesh.instances.buffer, null); assert.equal(mesh.instances.count, 1);
  assert.equal(mesh.instances.matrices[0][12], 4);
  assert.notEqual(mesh.bounds, bounds); assert.equal(mesh.bounds.min[0], 4);
  assert.deepEqual(calls, { moved: 1, render: 1, destroyed: 1 });
  let secondReleased = 0;
  mesh.instances.buffer = { destroy() { secondReleased++; } };
  mesh.setInstances(null);
  assert.equal(mesh.instances, null); assert.equal(mesh.geometry, geometry);
  assert.equal(secondReleased, 1); assert.equal(calls.destroyed, 1);
  assert.deepEqual(calls, { moved: 2, render: 2, destroyed: 1 });
  assert.equal(mesh.bounds.min[0], 0);
});
