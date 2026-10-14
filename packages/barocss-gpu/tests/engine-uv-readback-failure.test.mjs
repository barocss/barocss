/** #1670 controlled device evidence. This mock does not execute WGSL or prove physical GPU pixels. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { compileEngineUVTextureMaterial, EngineUVWebGPUError, mountEngineUVTextureWebGPUViewport } from '../dist/index.js';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const tick = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const ref = { sceneId: 'uv_scene', nodeId: 'triangle', geometryId: 'tri' };
const source = '@shader #uv {@sampler image:sampler2d;@fragment{color:sample(image,uv_u,uv_v);}}';
const compiled = compileEngineUVTextureMaterial(source);
assert.equal(compiled.ok, true);
const scene = {
  format: 'barocss-gpu-engine-scene', version: 0, id: 'uv_scene', coordinateSystem: 'right-handed-y-up', positionUnit: 'scene',
  background: [0, 0, 0], camera: { eye: [0, 0, 6], target: [0, 0, 0], up: [0, 1, 0], fovYDegrees: 45, near: .01, far: 100 },
  geometries: [{ format: 'barocss-gpu-triangle-geometry', version: 0, id: 'tri', coordinateSystem: 'right-handed-y-up',
    positionUnit: 'scene', winding: 'ccw', positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
    uvs: [0, 0, 1, 0, 0, 1], indices: [0, 1, 2] }],
  materials: [{ id: 'mat', type: 'unlit', colorSpace: 'linear', color: [1, 1, 1] }],
  nodes: [{ id: 'triangle', type: 'mesh', parentId: null, translation: [0, 0, 0], rotationXYZW: [0, 0, 0, 1],
    scale: [1, 1, 1], visible: true, geometryId: 'tri', materialId: 'mat' }],
};
const textures = { format: 'barocss-gpu-engine-texture-bindings', version: 0, sceneId: 'uv_scene',
  textures: [{ id: 'tex', width: 1, height: 1, format: 'rgba8', colorSpace: 'srgb', rowOrigin: 'bottom-left',
    filter: 'nearest', wrapS: 'clamp-to-edge', wrapT: 'clamp-to-edge', pixels: [10, 20, 30, 255] }],
  bindings: [{ materialId: 'mat', textureId: 'tex' }] };
const materials = { format: 'barocss-gpu-engine-uv-texture-material-bindings', version: 0, sceneId: 'uv_scene',
  bindings: [{ materialId: 'mat', material: compiled.material, uniforms: {} }] };

function platform() {
  const faults = new Map(), calls = new Map(), buffers = [], texturesOwned = [], events = [];
  let destroyed = 0, unconfigured = 0, lastKind = '';
  const limits = Object.fromEntries(['maxTextureDimension2D', 'maxBufferSize', 'maxUniformBufferBindingSize',
    'maxColorAttachments', 'maxColorAttachmentBytesPerSample', 'maxVertexBuffers', 'maxVertexAttributes',
    'maxBindGroups', 'maxVertexBufferArrayStride', 'maxSampledTexturesPerShaderStage',
    'maxSamplersPerShaderStage', 'maxUniformBuffersPerShaderStage', 'maxBindingsPerBindGroup'].map(key => [key, 1 << 20]));
  const lost = deferred(); lost.promise.catch(() => {});
  function call(name, fallback = () => undefined) {
    calls.set(name, (calls.get(name) ?? 0) + 1); events.push(name);
    const queue = faults.get(name); return queue?.length ? queue.shift()() : fallback();
  }
  const promise = (name, fallback) => { try { return Promise.resolve(call(name, fallback)); } catch (error) { return Promise.reject(error); } };
  function texture(descriptor, owned = true) {
    const { width, height } = descriptor.size;
    const result = { descriptor, width, height, bytes: new Uint8Array(width * height * 4), destroyCount: 0,
      createView() { return { texture: result }; }, destroy() { result.destroyCount++; call('destroyTexture'); } };
    if (owned) texturesOwned.push(result); return result;
  }
  const device = {
    limits, lost: lost.promise,
    createBuffer(descriptor) {
      return call('createBuffer', () => {
        const buffer = { descriptor, bytes: new Uint8Array(descriptor.size), destroyCount: 0, unmapCount: 0,
          destroy() { buffer.destroyCount++; call('destroyBuffer'); },
          async mapAsync() { await promise('map', () => undefined); },
          getMappedRange() { return call('range', () => buffer.bytes.buffer); },
          unmap() { buffer.unmapCount++; call('unmap'); } };
        buffers.push(buffer); return buffer;
      });
    },
    createTexture(descriptor) { return texture(descriptor); },
    createSampler() { return {}; },
    createShaderModule() { return { getCompilationInfo: () => Promise.resolve({ messages: [] }) }; },
    createRenderPipelineAsync() { return Promise.resolve({}); },
    createBindGroupLayout() { return {}; }, createPipelineLayout() { return {}; }, createBindGroup() { return {}; },
    createCommandEncoder() {
      const commands = [];
      return {
        beginRenderPass(descriptor) { const pass = { descriptor, draws: 0,
          setPipeline() {}, setBindGroup() {}, setVertexBuffer() {}, setIndexBuffer() {},
          drawIndexed() { pass.draws++; }, end() { commands.push({ kind: 'render', pass }); } }; return pass; },
        copyTextureToTexture(source, destination, size) { commands.push({ kind: 'present', source, destination, size }); },
        copyTextureToBuffer(source, destination, size) { commands.push({ kind: 'readback', source, destination, size }); },
        finish() { return { commands }; },
      };
    },
    pushErrorScope() {}, popErrorScope() { return Promise.resolve(null); },
    destroy() { destroyed++; },
    queue: {
      writeBuffer(buffer, offset, data) { buffer.bytes.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), offset); },
      writeTexture() {},
      submit(batches) {
        const commands = batches.flatMap(batch => batch.commands); lastKind = commands[0]?.kind ?? '';
        call('submit:' + lastKind);
        for (const command of commands) {
          if (command.kind === 'render') {
            assert.equal(command.pass.draws, 1, 'Short renderer smoke reaches one original draw');
            const color = command.pass.descriptor.colorAttachments[0].view.texture;
            const identity = command.pass.descriptor.colorAttachments[1].view.texture;
            for (let y = 0; y < color.height; y++) for (let x = 0; x < color.width; x++) {
              color.bytes.set([7, x, y, 255], (y * color.width + x) * 4);
              new DataView(identity.bytes.buffer).setUint32((y * color.width + x) * 4, x === 0 ? 1 : 0, true);
            }
          } else if (command.kind === 'present') command.destination.texture.bytes.set(command.source.texture.bytes);
          else {
            const { source, destination, size } = command, { x = 0, y = 0 } = source.origin ?? {};
            destination.buffer.bytes.fill(0xDD);
            for (let row = 0; row < size.height; row++) {
              const start = ((y + row) * source.texture.width + x) * 4;
              destination.buffer.bytes.set(source.texture.bytes.subarray(start, start + size.width * 4), row * destination.bytesPerRow);
            }
          }
        }
      },
      onSubmittedWorkDone() { return promise('workDone:' + lastKind, () => undefined); },
    },
  };
  const context = { configure() {}, unconfigure() { unconfigured++; },
    getCurrentTexture() { return texture({ size: { width: canvas.width, height: canvas.height } }, false); } };
  class Canvas { constructor() { this.width = 2; this.height = 2; } getContext(kind) { assert.equal(kind, 'webgpu'); return context; } }
  const canvas = new Canvas(), adapter = { requestDevice: async () => device };
  const previousCanvas = Object.getOwnPropertyDescriptor(globalThis, 'HTMLCanvasElement');
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'HTMLCanvasElement', { configurable: true, value: Canvas });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { gpu: { requestAdapter: async () => adapter } } });
  return { canvas, calls, buffers, texturesOwned, events, lost,
    get destroyed() { return destroyed; }, get unconfigured() { return unconfigured; },
    fault(name, action) { const queue = faults.get(name) ?? []; queue.push(action); faults.set(name, queue); },
    fail(name, error = new Error(name)) { this.fault(name, () => { throw error; }); return error; },
    gate(name) { const gate = deferred(); this.fault(name, () => gate.promise); return gate; },
    restore() {
      if (previousCanvas) Object.defineProperty(globalThis, 'HTMLCanvasElement', previousCanvas); else delete globalThis.HTMLCanvasElement;
      if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator); else delete globalThis.navigator;
    },
    assertReleased() {
      assert.ok([...buffers, ...texturesOwned].every(item => item.destroyCount === 1));
      assert.equal(destroyed, 1); assert.equal(unconfigured, 1);
    },
  };
}

async function mounted(run) {
  const h = platform(); let viewport;
  try { viewport = await mountEngineUVTextureWebGPUViewport(h.canvas, scene, textures, materials, { width: 2, height: 2 });
    assert.equal(viewport.status.state, 'ready'); assert.equal(viewport.status.generation, 1);
    await run(h, viewport);
  } finally { viewport?.dispose(); h.restore(); }
}
const code = expected => error => { assert.ok(error instanceof EngineUVWebGPUError); assert.equal(error.code, expected); return true; };

test('readPixels and pick preserve packed pixel and source identity after short render', async () => {
  await mounted(async (h, v) => {
    const pixels = await v.readPixels();
    assert.deepEqual([...pixels], [7, 0, 0, 255, 7, 1, 0, 255, 7, 0, 1, 255, 7, 1, 1, 255]);
    assert.deepEqual(await v.pick(0, 1), { generation: 1, ref });
    assert.deepEqual(await v.pick(1, 1), { generation: 1, ref: null });
    assert.equal(h.buffers.at(-1).unmapCount, 1); assert.equal(v.status.state, 'ready');
  });
});

test('queue submission, work completion, and mapping errors release readback and leave viewport ready', async () => {
  for (const phase of ['submit:readback', 'workDone:readback', 'map']) await mounted(async (h, v) => {
    const primary = h.fail(phase), before = h.buffers.length;
    await assert.rejects(v.readPixels(), error => { code('RENDER')(error); assert.equal(error.cause, primary); return true; });
    assert.equal(h.buffers.length, before + 1); assert.equal(h.buffers.at(-1).destroyCount, 1);
    assert.equal(h.buffers.at(-1).unmapCount, 1); assert.equal(v.status.state, 'ready');
    assert.deepEqual(await v.pick(0, 0), { generation: 1, ref });
    assert.equal((await v.readPixels())[0], 7);
  });
});

test('cleanup failure keeps the primary error first, enters terminal state, and releases once', async () => {
  for (const phase of ['unmap', 'destroyBuffer']) for (const withPrimary of [false, true]) await mounted(async (h, v) => {
    const primary = withPrimary ? h.fail('submit:readback') : null, cleanup = h.fail(phase);
    await assert.rejects(v.readPixels(), error => {
      code('RENDER')(error); assert.ok(error.cause instanceof AggregateError);
      assert.deepEqual(error.cause.errors, primary ? [primary, cleanup] : [cleanup]); return true;
    });
    assert.equal(v.status.state, 'failed');
    await assert.rejects(v.readPixels(), code('STATE'));
    await assert.rejects(v.pick(0, 0), code('STATE'));
    h.assertReleased(); v.dispose(); h.assertReleased();
  });
});

test('mapping timeout rejects the pending operation, retires ownership, and refuses later work', async () => {
  await mounted(async (h, v) => {
    const gate = h.gate('map'), before = h.calls.get('map') ?? 0;
    const realSet = globalThis.setTimeout, realClear = globalThis.clearTimeout;
    const timers = new Map(); let next = 0;
    globalThis.setTimeout = (callback, delay) => { assert.equal(delay, 10000); const id = ++next; timers.set(id, callback); return id; };
    globalThis.clearTimeout = id => { timers.delete(id); };
    try {
      const pending = v.readPixels();
      for (let i = 0; i < 200 && (h.calls.get('map') ?? 0) === before; i++) await Promise.resolve();
      assert.equal(h.calls.get('map'), before + 1); assert.equal(timers.size, 1);
      await assert.rejects(v.pick(0, 0), code('BUSY'));
      [...timers.values()][0](); await assert.rejects(pending, code('STATE'));
      assert.equal(v.status.state, 'failed'); h.assertReleased();
      gate.resolve(); await tick(); h.assertReleased();
      await assert.rejects(v.readPixels(), code('STATE'));
    } finally { globalThis.setTimeout = realSet; globalThis.clearTimeout = realClear; }
  });
});
