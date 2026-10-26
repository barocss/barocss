// Native lifecycle contracts with a structural fake GPU. These do not prove shader or image correctness.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PathTraceSession } from '../dist/viewer/path-trace.js';
import { Camera } from '../dist/viewer/camera.js';
import { Geometry, Mesh } from '../dist/viewer/scene.js';
import { prepareGeometry } from '../dist/viewer/geometry.js';

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const settle = () => new Promise(resolve => setImmediate(resolve));
const owner = { requestRender() {}, sceneMoved() {} };
function snapshot() {
  const geometry = new Geometry(prepareGeometry({ positions: [0, 0, 0, 2, 0, 0, 0, 2, 0] }), owner);
  return { meshes: [new Mesh(geometry, owner, 1, {})], camera: new Camera({ position: [0, 0, 5], target: [0, 0, 0] }), environment: {}, lights: [], background: null, width: 2, height: 2, clipped: false };
}
function gpu({ pop = async () => null, holdWork = false, holdMaps = false } = {}) {
  const resources = [], submissions = [], work = [], maps = [];
  let popCalls = 0;
  const resource = (kind, descriptor) => {
    const data = kind === 'buffer' ? new ArrayBuffer(descriptor.size) : null;
    const item = { kind, label: descriptor.label, destroyed: 0, data, destroy() { this.destroyed++; }, createView() { return { texture: this }; },
      mapAsync() { const ready = deferred(); maps.push(ready); if (!holdMaps) ready.resolve(); return ready.promise; },
      getMappedRange() { return data; }, unmap() {},
    };
    resources.push(item); return item;
  };
  const device = {
    limits: { maxTextureDimension2D: 4096, maxTextureArrayLayers: 256, maxBufferSize: 1 << 24, maxStorageBufferBindingSize: 1 << 24 },
    pushErrorScope() {}, popErrorScope() { return pop(++popCalls); },
    createShaderModule() { return { getCompilationInfo: async () => ({ messages: [] }) }; },
    createComputePipelineAsync: async () => ({ getBindGroupLayout: () => ({}) }),
    createBuffer: descriptor => resource('buffer', descriptor), createTexture: descriptor => resource('texture', descriptor),
    createBindGroup: descriptor => descriptor,
    createCommandEncoder() {
      let label;
      return { beginComputePass(descriptor) { label = descriptor.label; return { setPipeline() {}, setBindGroup() {}, dispatchWorkgroups() {}, end() {} }; },
        copyTextureToBuffer() {}, finish() { return { label }; } };
    },
    queue: {
      writeBuffer(buffer, offset, data) {
        const bytes = ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : new Uint8Array(data);
        new Uint8Array(buffer.data).set(bytes, offset);
      },
      writeTexture() {}, submit(commands) { submissions.push(...commands.map(command => command.label)); },
      onSubmittedWorkDone() { const ready = deferred(); work.push(ready); if (!holdWork) ready.resolve(); return ready.promise; },
    },
  };
  return { device, resources, submissions, work, maps, get popCalls() { return popCalls; } };
}

test('failed creation releases every allocated resource even when both scope pops reject, preserving the first error', async () => {
  const original = new Error('original scope pop/device failure'), cleanup = new Error('cleanup scope pop failure');
  const fake = gpu({ pop: async call => { throw call === 1 ? original : cleanup; } });
  let removed = 0;
  await assert.rejects(PathTraceSession.create(fake.device, snapshot(), {}, () => { removed++; }), error => error === original);
  assert.equal(fake.popCalls, 2, 'the failed cleanup scope pop was exercised');
  assert.ok(fake.resources.filter(resource => resource.kind === 'buffer').length >= 10, 'failure occurs after full buffer allocation');
  assert.equal(fake.resources.filter(resource => resource.kind === 'texture').length, 3, 'colour atlas, data atlas and export target were allocated');
  for (const resource of fake.resources) assert.equal(resource.destroyed, 1, resource.label);
  assert.equal(removed, 1);
});

test('capture records its queued sample snapshot and keeps it fixed after later work completes', async t => {
  const fake = gpu({ holdWork: true, holdMaps: true });
  let removed = 0;
  const session = await PathTraceSession.create(fake.device, snapshot(), {}, () => { removed++; });
  t.after(() => session.dispose());
  const first = session.sample(); await settle();
  const captured = session.capture(false); await settle();
  assert.equal(session.samples, 0, 'capture is queued behind the unfinished first sample, not captured at call time');
  assert.deepEqual(fake.submissions, ['progressive still sample']);
  fake.work[0].resolve(); assert.equal(await first, 1); await settle();
  assert.deepEqual(fake.submissions, ['progressive still sample', 'trace denoise and output']);
  const second = session.sample(); await settle();
  assert.equal(fake.work.length, 1, 'no next sample may use the buffers during readback');
  assert.equal(session.samples, 1, 'the later sample is queued behind capture readback');
  fake.maps[0].resolve();
  const frame = await captured; assert.deepEqual([frame.width, frame.height, frame.data.length], [2, 2, 16]);
  assert.equal(frame.samples, 1, 'image metadata belongs to the sample completed before its serialized capture');
  await settle(); assert.equal(fake.work.length, 2);
  fake.work[1].resolve(); assert.equal(await second, 2);
  assert.equal(session.samples, 2, 'the later queued sample has completed');
  assert.equal(frame.samples, 1, 'later session progress must not change the captured image metadata');
  session.dispose(); assert.equal(removed, 1);
  for (const resource of fake.resources) assert.equal(resource.destroyed, 1, resource.label);
});

test('stop then restart suppresses the old progress callback while preserving bounded in-flight work', async t => {
  const fake = gpu({ holdWork: true }), session = await PathTraceSession.create(fake.device, snapshot(), {}, () => {});
  t.after(() => session.dispose());
  const oldProgress = [], newProgress = [];
  const before = session.start(samples => oldProgress.push(samples)); await settle();
  assert.equal(fake.work.length, 1);
  session.stop();
  const after = session.start(samples => { newProgress.push(samples); session.stop(); });
  fake.work[0].resolve(); await settle();
  assert.equal(fake.work.length, 2);
  assert.deepEqual(oldProgress, [], 'a stopped run cannot report into the new run');
  fake.work[1].resolve(); await Promise.all([before, after]);
  assert.deepEqual(newProgress, [2]); assert.equal(session.samples, 2); assert.equal(session.running, false);
});

test('dispose during capture rejects active and queued readbacks and frees each allocation once', async () => {
  const fake = gpu({ holdMaps: true }); let removed = 0;
  const session = await PathTraceSession.create(fake.device, snapshot(), {}, () => { removed++; });
  await session.sample();
  const active = assert.rejects(session.capture(), { code: 'DISPOSED' }); await settle();
  const queued = assert.rejects(session.capture(false), { code: 'DISPOSED' });
  assert.equal(fake.maps.length, 1);
  session.dispose(); session.dispose(); fake.maps[0].resolve();
  await Promise.all([active, queued]);
  assert.equal(fake.maps.length, 1, 'queued capture does not allocate another readback after disposal');
  assert.equal(removed, 1); assert.equal(session.running, false);
  for (const resource of fake.resources) assert.equal(resource.destroyed, 1, resource.label);
});
