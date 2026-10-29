// CPU reconstruction regression: real pickNow, Camera, Geometry and public Mesh.setInstances.
// Device submission, drawing, visibility and prepareCamera are stubs; this is not native GPU or public pick() proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Viewer, Geometry, Mesh } from '../dist/viewer/viewer.js';
import { Camera } from '../dist/viewer/camera.js';
import { prepareGeometry } from '../dist/viewer/geometry.js';
import { identity, translation } from '../dist/viewer/math.js';

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function clipDepth(matrix, point) {
  const z = matrix[2] * point[0] + matrix[6] * point[1] + matrix[10] * point[2] + matrix[14];
  const w = matrix[3] * point[0] + matrix[7] * point[1] + matrix[11] * point[2] + matrix[15];
  return Math.fround(z / w);
}
function fixture(instanced = true) {
  const viewer = Object.create(Viewer.prototype);
  Object.assign(viewer, { requestRender() {}, pickSceneRevision: 0, meshes: [], geometries: new Set(), freeSlots: [], nextSlot: 0, costRecords: new Map() });
  const geometry = new Geometry(prepareGeometry({ positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], faces: [71] }), viewer);
  const transforms = [...translation([10, 0, 0]), ...identity()];
  viewer.geometries.add(geometry);
  const mesh = new Mesh(geometry, viewer, 17, { name: 'two instances', ...(instanced ? { instances: { transforms } } : {}) });
  mesh.slot = 0; viewer.nextSlot = 1; viewer.meshes.push(mesh);
  const point = [0.25, 0.25, 0];
  const camera = new Camera({ position: [0.25, 0.25, 5], target: point, up: [0, 1, 0], projection: 'orthographic' });
  camera.clip({ min: [-20, -20, -20], max: [20, 20, 20] });
  const depth = clipDepth(camera.viewProjection(1), point);
  const calls = { maps: 0, reads: 0, unmaps: 0 };
  let held = null, mapped = false, reportedInstance = instanced ? 1 : 0;
  const read = {
    async mapAsync() { calls.maps++; if (held) { held.entered.resolve(); await held.released.promise; } mapped = true; },
    getMappedRange(offset) {
      assert.equal(mapped, true); calls.reads++;
      return offset === 256 ? Float32Array.of(depth).buffer : Uint32Array.of(offset === 512 ? reportedInstance : mesh.id).buffer;
    },
    unmap() { assert.equal(mapped, true); mapped = false; calls.unmaps++; },
  };
  const pass = { setScissorRect() {}, setBindGroup() {}, end() {} };
  Object.assign(viewer, {
    canvas: { width: 1, height: 1, clientWidth: 1, clientHeight: 1 }, camera, clip: null,
    device: { queue: { submit() {} }, createCommandEncoder: () => ({ beginRenderPass: () => pass, copyTextureToBuffer() {}, finish() {} }) },
    alive() {}, prepareCamera: () => camera.viewProjection(1), visibleMeshes: () => ({ opaque: viewer.meshes, transparent: [] }),
    writeUniforms() {}, drawCapFront() {}, drawMesh() {}, drawCaps() {}, ensurePickTargets: () => ({ views: {}, read }),
  });
  return {
    viewer, mesh, geometry, point, depth, calls, transforms, expectedInstance: instanced ? 1 : null,
    reportInstance(value) { reportedInstance = value; },
    hold() { held = { entered: deferred(), released: deferred() }; return { entered: held.entered.promise, release: held.released.resolve }; },
  };
}
function checkHit(hit, f, instance = f.expectedInstance) {
  assert.ok(hit);
  assert.equal(hit.mesh, f.mesh); assert.equal(hit.instance, instance);
  assert.equal(hit.triangle, 0); assert.equal(hit.face, 71); assert.equal(hit.cap, false);
  assert.equal(hit.depth, f.depth);
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(hit.point[i] - f.point[i]) < 1e-5, `point[${i}]=${hit.point[i]}`);
}

test('delayed instance readback: unchanged control preserves instance, triangle, face and world point', async () => {
  const f = fixture(), hold = f.hold(), pending = f.viewer.pickNow(0, 0);
  try { await hold.entered; } finally { hold.release(); }
  checkHit(await pending, f);
  assert.deepEqual(f.calls, { maps: 1, reads: 3, unmaps: 1 });
});

// Each changed state is reached through a real public scene operation. Equal final coordinates in the ABA
// case still belong to a later instance owner; an old readback must not acquire that owner's authority.
const staleChanges = [
  ['matrix replacement', f => f.mesh.setInstances({ transforms: [...translation([10, 0, 0]), ...translation([0, 5, 0])] })],
  ['instance reorder', f => f.mesh.setInstances({ transforms: [...identity(), ...translation([10, 0, 0])] })],
  ['instance shrink', f => f.mesh.setInstances({ transforms: identity() })],
  ['instance removal', f => f.mesh.setInstances(null)],
  ['mesh removal', f => f.mesh.remove()],
  ['scene clear', f => f.viewer.clear()],
  ['instance ABA', f => { f.mesh.setInstances({ transforms: [...identity(), ...translation([10, 0, 0])] }); f.mesh.setInstances({ transforms: f.transforms }); }],
  ['camera translation', f => { f.viewer.camera.position = [4.25, 0.25, 5]; f.viewer.camera.target = [4.25, 0.25, 0]; }],
  ['clip change', f => { f.viewer.clipPlane = { normal: [1, 0, 0], offset: 0 }; }],
  ['base mesh transform', f => { f.mesh.transform = translation([4, 0, 0]); }],
];
for (const [name, change] of staleChanges) {
  test(`delayed instance readback: ${name} refuses old metadata after unmapping once`, async t => {
    const f = fixture(), accepted = await f.viewer.pickNow(0, 0);
    checkHit(accepted, f);
    const acceptedMetadata = { point: [...accepted.point], instance: accepted.instance, face: accepted.face, triangle: accepted.triangle, depth: accepted.depth };
    const oldMatrices = f.mesh.instances.matrices, originalMatrices = oldMatrices.map(matrix => [...matrix]);
    const hold = f.hold(), pending = f.viewer.pickNow(0, 0);
    try { await hold.entered; change(f); }
    finally { hold.release(); }
    let stale;
    try { stale = await pending; }
    finally {
      assert.deepEqual(f.calls, { maps: 2, reads: 6, unmaps: 2 });
      assert.deepEqual({ point: accepted.point, instance: accepted.instance, face: accepted.face, triangle: accepted.triangle, depth: accepted.depth }, acceptedMetadata);
      assert.deepEqual(oldMatrices.map(matrix => [...matrix]), originalMatrices, 'replacement does not change the old matrices');
      t.diagnostic(`${name}: maps=${f.calls.maps}, reads=${f.calls.reads}, unmaps=${f.calls.unmaps}`);
    }
    assert.equal(stale, null, 'old GPU depth and instance ID must not be combined with current scene metadata');
    if (name === 'instance shrink') {
      f.reportInstance(0);
      checkHit(await f.viewer.pickNow(0, 0), f, 0);
      assert.deepEqual(f.calls, { maps: 3, reads: 9, unmaps: 3 }, 'the same read buffer remains usable by a later current pick');
    }
  });
}

test('delayed instance readback: rejected public setter preserves the pending valid hit and original state', async () => {
  const f = fixture(), instances = f.mesh.instances, oldData = new Uint8Array(instances.data).slice();
  const hold = f.hold(), pending = f.viewer.pickNow(0, 0);
  try {
    await hold.entered;
    assert.throws(() => f.mesh.setInstances({ transforms: new Float64Array(15) }), error => error.code === 'INSTANCES_INVALID');
    assert.equal(f.mesh.instances, instances);
    assert.deepEqual(new Uint8Array(instances.data), oldData);
  } finally { hold.release(); }
  checkHit(await pending, f);
  assert.deepEqual(f.calls, { maps: 1, reads: 3, unmaps: 1 });
});

test('delayed instance readback: setting already-null instances preserves a non-instanced hit', async () => {
  const f = fixture(false), hold = f.hold(), pending = f.viewer.pickNow(0, 0);
  try { await hold.entered; f.mesh.setInstances(null); }
  finally { hold.release(); }
  checkHit(await pending, f);
  assert.equal(f.mesh.instances, null);
  assert.deepEqual(f.calls, { maps: 1, reads: 3, unmaps: 1 });
});

test('delayed instance readback: detached mesh changes and no-op removal preserve the attached hit', async () => {
  const f = fixture();
  const detached = new Mesh(f.geometry, f.viewer, 18, { instances: { transforms: identity() } });
  const hold = f.hold(), pending = f.viewer.pickNow(0, 0);
  try {
    await hold.entered;
    f.viewer.remove(detached);
    detached.setInstances({ transforms: translation([2, 0, 0]) });
    detached.transform = translation([3, 0, 0]);
    assert.deepEqual(f.viewer.meshList, [f.mesh]);
  } finally { hold.release(); }
  checkHit(await pending, f);
  assert.deepEqual(f.calls, { maps: 1, reads: 3, unmaps: 1 });
});

test('delayed instance readback: failed prior-buffer release preserves the current instance owner and hit', async () => {
  const f = fixture(), instances = f.mesh.instances, failure = new Error('Mock buffer release failed');
  instances.buffer = { destroy() { throw failure; } };
  const hold = f.hold(), pending = f.viewer.pickNow(0, 0);
  try {
    await hold.entered;
    assert.throws(() => f.mesh.setInstances({ transforms: identity() }), error => error === failure);
    assert.equal(f.mesh.instances, instances);
  } finally { hold.release(); }
  checkHit(await pending, f);
  assert.deepEqual(f.calls, { maps: 1, reads: 3, unmaps: 1 });
});
