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
function fixture() {
  const viewer = Object.create(Viewer.prototype);
  Object.assign(viewer, { requestRender() {}, meshes: [], freeSlots: [], costRecords: new Map() });
  const geometry = new Geometry(prepareGeometry({ positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], faces: [71] }), viewer);
  const transforms = [...translation([10, 0, 0]), ...identity()];
  const mesh = new Mesh(geometry, viewer, 17, { name: 'two instances', instances: { transforms } });
  viewer.meshes.push(mesh);
  const point = [0.25, 0.25, 0];
  const camera = new Camera({ position: [0.25, 0.25, 5], target: point, up: [0, 1, 0], projection: 'orthographic' });
  camera.clip({ min: [-20, -20, -20], max: [20, 20, 20] });
  const depth = clipDepth(camera.viewProjection(1), point);
  const calls = { maps: 0, reads: 0, unmaps: 0 };
  let held = null, mapped = false;
  const read = {
    async mapAsync() { calls.maps++; if (held) { held.entered.resolve(); await held.released.promise; } mapped = true; },
    getMappedRange(offset) {
      assert.equal(mapped, true); calls.reads++;
      return offset === 256 ? Float32Array.of(depth).buffer : Uint32Array.of(offset === 512 ? 1 : mesh.id).buffer;
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
    viewer, mesh, geometry, point, depth, calls,
    hold() { held = { entered: deferred(), released: deferred() }; return { entered: held.entered.promise, release: held.released.resolve }; },
  };
}
function checkHit(hit, f) {
  assert.ok(hit);
  assert.equal(hit.mesh, f.mesh); assert.equal(hit.instance, 1);
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

test('delayed instance readback: public instance shrink refuses old instance ID after unmapping once', async () => {
  const f = fixture(), accepted = await f.viewer.pickNow(0, 0);
  checkHit(accepted, f);
  const acceptedPoint = [...accepted.point], oldMatrices = f.mesh.instances.matrices;
  const hold = f.hold(), pending = f.viewer.pickNow(0, 0);
  try { await hold.entered; f.mesh.setInstances({ transforms: identity() }); }
  finally { hold.release(); }
  let stale;
  try { stale = await pending; }
  finally {
    assert.deepEqual(f.calls, { maps: 2, reads: 6, unmaps: 2 });
    assert.deepEqual(accepted.point, acceptedPoint);
    assert.equal(accepted.instance, 1); assert.equal(accepted.face, 71); assert.equal(accepted.triangle, 0);
    assert.equal(oldMatrices.length, 2); assert.equal(f.mesh.instanceCount, 1);
  }
  assert.equal(stale, null, 'old GPU instance 1 must not be reconstructed against a new one-instance array');
});
