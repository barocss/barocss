/** #1574 DETERMINISTIC SOFTWARE EVIDENCE ONLY.
 * The private platform below records calls and copies synthetic bytes. It does not
 * compile WGSL, rasterize, validate a driver, or prove GPU/pixel/interpolation behavior.
 * The actual prepareNativeSurfaceUV01Frame and every original-source provider run
 * unchanged. There is no public injectable device or provider replacement.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
export function signed(value) {
  if (typeof value === 'number') return Object.is(value, -0) ? '-0' : JSON.stringify(value);
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  return Array.isArray(value) || ArrayBuffer.isView(value) ? '[' + Array.from(value, signed).join(',') + ']'
    : '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + signed(value[key])).join(',') + '}';
}
export const copy = value => JSON.parse(signed(value));
export function frozen(value) {
  if (value && typeof value === 'object') {
    assert.ok(!ArrayBuffer.isView(value), 'Public observations contain ordinary data only');
    assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen);
  }
}
function references(value, seen = new Set()) {
  if (value && typeof value === 'object' && !seen.has(value)) {
    seen.add(value); if (ArrayBuffer.isView(value)) seen.add(value.buffer);
    else Object.values(value).forEach(child => references(child, seen));
  } return seen;
}
export function independent(left, right) {
  const other = references(right); for (const value of references(left)) assert.ok(!other.has(value));
}
export const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
export async function drain() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
export async function reached(harness, phase, before = 0) {
  for (let i = 0; i < 500; i++) { if ((harness.calls.get(phase) ?? 0) > before) return; await Promise.resolve(); }
  assert.fail('Software boundary was not reached: ' + phase);
}

export async function makeNativeRequest(gpu) {
  const fixture = JSON.parse(await readFile(resolve(here, '../../../examples/gpu-scene/fixtures/area-revision1.cad-document.json'), 'utf8'));
  const sourceA = fixture.assets[0].source;
  const sourceB = '@model tilted_original { version:0; length-unit:mm;\n@curve #retained_sibling { type:nurbs; degree:1; knots:[-0,-0,1,1]; control-points:[[-0,0,-0],[1,0,-0]]; weights:[1,1]; }\n@surface #plane_nonunit { type:nurbs; degree-u:1; degree-v:1; knots-u:[-2,-2,6,6]; knots-v:[3,3,11,11]; control-points:[[[0,0,0],[0,3,1]],[[2,0,1],[2,3,2]]]; weights:[[1,1],[1,1]]; }\n}\n';
  const sources = [
    '// Original A é\r\n@shader #native_A { @uniform zeta:float(0,1,.25); @uniform alpha:float(-0,1,-0); @fragment { color:mix(#000,#fff,(surface_u01*zeta+surface_v01*alpha)*.5); } }\r\n',
    '// Original B\n@shader #native_B { @uniform zeta:float(0,1,.5); @uniform alpha:float(-0,1,-0); @fragment { color:mix(#000,#fff,(surface_v01*zeta+surface_u01*alpha)*.5); } }\n',
  ];
  return { format: 'barocss-gpu-native-surface-uv01-frame-request', version: 0,
    entries: [sourceA, sourceB].map((source, i) => {
      const compiled = gpu.compileNativeSurfaceUV01Material(sources[i]); assert.equal(compiled.ok, true);
      return { ref: { modelId: i ? 'asset_right' : 'asset_left', geometryId: 'plane_nonunit' },
        geometry: { format: 'barocss-gpu-native-surface-uv01-request', version: 0, sourceVersion: 0, source, surfaceId: 'plane_nonunit', countU: 5, countV: 3, revision: 7 },
        material: copy(compiled.material), uniforms: i ? { zeta: -0, alpha: -0 } : {},
        transform: { translationMm: i ? [-4, 2, -8] : [4, -2, 8], rotationXYZW: i ? [1, 0, 0, 0] : [0, 0, 1, 0], scale: [2, 3, 4] } };
    }), options: { mmToSceneUnit: .125, translate: [1, -2, .5], background: [.1, .2, .3],
      camera: { eye: [0, 0, 6], target: [0, 0, 0], up: [0, 2, 0], fovYDegrees: 60, near: .1, far: 100 },
      lighting: { direction: [2, -3, 6], ambientStrength: .2, directionalStrength: .6 } } };
}

// Private, test-only software boundary. No package import or provider interception.
export function createSoftwarePlatform(options = {}) {
  const faults = new Map(), calls = new Map(), records = { buffers: [], textures: [], uploads: [], shaders: [], pipelines: [], layouts: [], pipelineLayouts: [], groups: [], passes: [], copies: [], submissions: [], configurations: [], adapterRequests: [], deviceRequests: [], scopes: [], events: [] };
  const lost = deferred(); lost.promise.catch(() => {});
  let destroyed = 0, unconfigured = 0, renderSerial = 0, lastSubmission = 'none';
  const limits = { maxTextureDimension2D: 4096, maxBufferSize: 1 << 26, maxUniformBufferBindingSize: 65536,
    maxColorAttachments: 8, maxColorAttachmentBytesPerSample: 32, maxVertexBuffers: 8, maxVertexAttributes: 16,
    maxBindGroups: 4, maxVertexBufferArrayStride: 2048, maxUniformBuffersPerShaderStage: 12, maxBindingsPerBindGroup: 1000, ...options.limits };
  function invoke(phase, fallback = () => undefined, ...args) {
    calls.set(phase, (calls.get(phase) ?? 0) + 1); records.events.push(phase);
    const queue = faults.get(phase); return queue?.length ? queue.shift()(...args) : fallback(...args);
  }
  function promise(phase, fallback = () => undefined, ...args) {
    try { return Promise.resolve(invoke(phase, fallback, ...args)); } catch (cause) { return Promise.reject(cause); }
  }
  const h = { records, calls, limits, lost, identityAt: (x, _y, pass) => x < pass.draws.length ? x + 1 : 0,
    enqueue(phase, action) { const queue = faults.get(phase) ?? []; queue.push(action); faults.set(phase, queue); },
    failNext(phase, cause = new Error('software ' + phase)) { this.enqueue(phase, () => { throw cause; }); return cause; },
    gateNext(phase) { const gate = deferred(); this.enqueue(phase, () => gate.promise); return gate; },
    get destroyed() { return destroyed; }, get unconfigured() { return unconfigured; },
    assertReleased() {
      for (const resource of [...records.buffers, ...records.textures]) assert.equal(resource.destroyCount, 1, 'Owned resource destroyed exactly once');
      assert.equal(destroyed, 1, 'Owned device destroyed exactly once');
    },
  };
  function texture(descriptor, owned = true) {
    const size = descriptor.size ?? { width: 1, height: 1 };
    const result = { descriptor, width: size.width, height: size.height, bytes: new Uint8Array(size.width * size.height * 4), destroyCount: 0,
      createView() { return invoke('createView', () => ({ texture: result }), result); },
      destroy() { result.destroyCount++; invoke('destroyTexture', () => {}, result); } };
    if (owned) records.textures.push(result); return result;
  }
  const device = {
    limits, lost: lost.promise,
    createBuffer(descriptor) {
      return invoke('createBuffer', () => {
        const result = { descriptor, bytes: new Uint8Array(descriptor.size), destroyCount: 0, unmapCount: 0, mapped: false,
          destroy() { result.destroyCount++; invoke('destroyBuffer', () => {}, result); },
          async mapAsync(mode) { await promise('map', () => {}, result, mode); result.mapped = true; },
          getMappedRange() { return invoke('getMappedRange', () => result.bytes.buffer, result); },
          unmap() { result.unmapCount++; result.mapped = false; invoke('unmap', () => {}, result); } };
        records.buffers.push(result); return result;
      }, descriptor);
    },
    createTexture(descriptor) { return invoke('createTexture', () => texture(descriptor), descriptor); },
    createSampler() { assert.fail('This profile has no sampler'); },
    createShaderModule(descriptor) {
      return invoke('createShaderModule', () => {
        const result = { descriptor, getCompilationInfo() { return promise('compilation', () => ({ messages: [] }), result); } };
        records.shaders.push(result); return result;
      }, descriptor);
    },
    createRenderPipelineAsync(descriptor) { records.pipelines.push(descriptor); return promise('pipeline', () => ({ descriptor, getBindGroupLayout(index) { return descriptor.layout.bindGroupLayouts[index]; } }), descriptor); },
    createBindGroupLayout(descriptor) { records.layouts.push(descriptor); return invoke('createBindGroupLayout', () => descriptor, descriptor); },
    createPipelineLayout(descriptor) { records.pipelineLayouts.push(descriptor); return invoke('createPipelineLayout', () => descriptor, descriptor); },
    createBindGroup(descriptor) { records.groups.push(descriptor); return invoke('createBindGroup', () => descriptor, descriptor); },
    createCommandEncoder() {
      return invoke('createCommandEncoder', () => {
        const commands = [];
        return {
          beginRenderPass(descriptor) {
            const record = { descriptor, draws: [], ended: false }; records.passes.push(record);
            let pipeline, group, indices; const slots = new Map();
            const pass = {
              setPipeline(value) { pipeline = value; }, setBindGroup(index, value) { assert.equal(index, 0); group = value; },
              setVertexBuffer(index, value) { slots.set(index, value); }, setIndexBuffer(buffer, format) { indices = { buffer, format }; },
              drawIndexed(count) { record.draws.push({ pipeline, group, indices, slots: new Map(slots), count }); },
              end() { record.ended = true; commands.push({ kind: 'render', record }); },
            }; return invoke('beginRenderPass', () => pass, descriptor);
          },
          copyTextureToTexture(source, destination, size) {
            invoke('copyTextureToTexture'); const command = { kind: 'present', source, destination, size };
            records.copies.push(command); commands.push(command);
          },
          copyTextureToBuffer(source, destination, size) {
            invoke('copyTextureToBuffer'); const command = { kind: 'readback', source, destination, size };
            records.copies.push(command); commands.push(command);
          },
          finish() { return invoke('finish', () => ({ commands })); },
        };
      });
    },
    pushErrorScope(filter) { records.scopes.push(['push', filter]); invoke('pushScope', () => {}, filter); },
    popErrorScope() { records.scopes.push(['pop']); return promise('popScope', () => null); },
    destroy() { destroyed++; invoke('destroyDevice'); },
    queue: {
      writeBuffer(buffer, offset, data) {
        invoke('writeBuffer', () => {}, buffer, offset, data); const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        records.uploads.push({ buffer, offset, bytes: bytes.slice(), caller: data }); buffer.bytes.set(bytes, offset);
      },
      writeTexture() { assert.fail('This profile has no sampled texture upload'); },
      submit(batches) {
        const kinds = batches.flatMap(batch => batch.commands.map(command => command.kind)); lastSubmission = kinds[0] ?? 'empty';
        records.submissions.push({ batches, kinds }); invoke('submit'); invoke('submit:' + lastSubmission);
        for (const batch of batches) for (const command of batch.commands) {
          if (command.kind === 'render') {
            const record = command.record, color = record.descriptor.colorAttachments[0].view.texture;
            const identity = record.descriptor.colorAttachments[1].view.texture, tokenView = new DataView(identity.bytes.buffer); renderSerial++;
            for (let y = 0; y < color.height; y++) for (let x = 0; x < color.width; x++) {
              color.bytes.set([renderSerial % 256, x % 256, y % 256, 255], (y * color.width + x) * 4);
              tokenView.setUint32((y * color.width + x) * 4, h.identityAt(x, y, record), true);
            }
          } else if (command.kind === 'present') {
            command.destination.texture.bytes.set(command.source.texture.bytes);
          } else {
            const { source, destination, size } = command, origin = source.origin ?? { x: 0, y: 0 };
            destination.buffer.bytes.fill(0xDD);
            for (let row = 0; row < size.height; row++) {
              const start = ((origin.y + row) * source.texture.width + origin.x) * 4;
              destination.buffer.bytes.set(source.texture.bytes.subarray(start, start + size.width * 4), row * destination.bytesPerRow);
            }
          }
        }
      },
      onSubmittedWorkDone() { return promise('workDone', () => promise('workDone:' + lastSubmission)); },
    },
  };
  class Canvas {
    constructor() { this.width = 300; this.height = 150; this.presented = null; this.contextRequests = []; }
    getContext(kind) { this.contextRequests.push(kind); return invoke('getContext', () => kind === 'webgpu' ? context : null, this); }
  }
  const canvas = new Canvas();
  const context = {
    configure(descriptor) { records.configurations.push(descriptor); invoke('configure', () => {}, descriptor); },
    unconfigure() { unconfigured++; invoke('unconfigure'); },
    getCurrentTexture() { return invoke('getCurrentTexture', () => {
      const current = texture({ size: { width: canvas.width, height: canvas.height }, format: 'rgba8unorm' }, false);
      canvas.presented = current; return current;
    }); },
  };
  const adapter = { requestDevice(descriptor) { records.deviceRequests.push(descriptor); return promise('requestDevice', () => device, descriptor); } };
  const platform = { requestAdapter() { records.adapterRequests.push({}); return promise('requestAdapter', () => adapter); }, getPreferredCanvasFormat() { assert.fail('Fixed RGBA8 must not use preferred format'); } };
  const originalCanvas = Object.getOwnPropertyDescriptor(globalThis, 'HTMLCanvasElement'), originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'HTMLCanvasElement', { configurable: true, writable: true, value: Canvas });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, writable: true, value: { gpu: platform } });
  Object.assign(h, { canvas, context, device, adapter, platform, restore() {
    if (originalCanvas) Object.defineProperty(globalThis, 'HTMLCanvasElement', originalCanvas); else delete globalThis.HTMLCanvasElement;
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator); else delete globalThis.navigator;
  } });
  return h;
}

export function assertNativeMountUploads(h, prepared, from = { uploads: 0, pipelines: 0, groups: 0, passes: 0, textures: 0 }) {
  const { records } = h, count = prepared.draws.length;
  assert.equal(records.uploads.length - from.uploads, 7 * count, 'Seven verbatim provider uploads per draw');
  assert.equal(records.pipelines.length - from.pipelines, count);
  assert.equal(records.groups.length - from.groups, count);
  assert.deepEqual(records.textures.slice(from.textures).map(t => t.descriptor.format), ['rgba8unorm', 'r32uint', 'depth24plus']);
  const pass = records.passes[from.passes]; assert.ok(pass.ended); assert.equal(pass.draws.length, count);
  assert.equal(pass.descriptor.colorAttachments[1].clearValue.r, 0);
  assert.equal(pass.descriptor.depthStencilAttachment.depthClearValue, 1);
  for (let i = 0; i < count; i++) {
    const draw = prepared.draws[i], pipeline = records.pipelines[from.pipelines + i], group = records.groups[from.groups + i];
    assert.equal(pipeline.vertex.module.descriptor.code, draw.program.code);
    assert.equal(pipeline.fragment.module, pipeline.vertex.module);
    assert.equal(pipeline.vertex.entryPoint, draw.program.entryPoints.vertex); assert.equal(pipeline.fragment.entryPoint, draw.program.entryPoints.fragment);
    assert.deepEqual(pipeline.vertex.buffers, [
      { arrayStride: 12, stepMode: 'vertex', attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
      { arrayStride: 12, stepMode: 'vertex', attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }] },
      { arrayStride: 8, stepMode: 'vertex', attributes: [{ shaderLocation: 2, offset: 0, format: 'float32x2' }] },
    ]);
    assert.deepEqual(pipeline.fragment.targets, [{ format: 'rgba8unorm' }, { format: 'r32uint' }]);
    assert.deepEqual(pipeline.primitive, { topology: 'triangle-list', cullMode: 'none' });
    assert.deepEqual(pipeline.depthStencil, { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' });
    assert.deepEqual(pipeline.multisample, { count: 1 });
    assert.deepEqual(group.layout.entries, [
      { binding: 0, visibility: 3, buffer: { type: 'uniform', minBindingSize: 160 } },
      { binding: 1, visibility: 2, buffer: { type: 'uniform', minBindingSize: 64 } },
      { binding: 2, visibility: 2, buffer: { type: 'uniform', minBindingSize: 16 } },
    ]);
    assert.deepEqual(group.entries.map(e => e.binding), [0, 1, 2]);
    for (const [binding, name] of ['frame', 'material', 'draw'].entries()) assert.deepEqual(group.entries[binding].resource.buffer.bytes, draw.uniforms[name]);
    const call = pass.draws[i]; assert.deepEqual([...call.slots.keys()], [0, 1, 2]);
    for (const [slot, name] of ['positions', 'normals', 'uv01'].entries()) assert.deepEqual(call.slots.get(slot).bytes, draw[name]);
    assert.deepEqual(call.indices.buffer.bytes, draw.indices); assert.equal(call.indices.format, 'uint16'); assert.equal(call.count, draw.indexCount);
    const expected = [draw.positions, draw.normals, draw.indices, draw.uv01, ...Object.values(draw.uniforms)];
    const actual = records.uploads.slice(from.uploads + i * 7, from.uploads + (i + 1) * 7);
    // Buffer creation order is private; match every immutable byte receipt exactly once.
    for (const bytes of expected) { const match = actual.findIndex(upload => signed(upload.bytes) === signed(bytes)); assert.notEqual(match, -1); actual.splice(match, 1); }
    assert.equal(actual.length, 0);
  }
}
export const counters = h => Object.fromEntries(['uploads', 'pipelines', 'groups', 'passes', 'textures'].map(key => [key, h.records[key].length]));

// Shared with the source/emitted/original-file/cold flow, strictly software evidence.
export async function observeSoftwareRuntime(gpu, request, width, height) {
  const h = createSoftwarePlatform(); let viewport;
  try {
    const expected = gpu.prepareNativeSurfaceUV01Frame(request, width, height);
    viewport = await gpu.mountNativeSurfaceUV01WebGPUViewport(h.canvas, request, { width, height });
    assertNativeMountUploads(h, expected); assert.equal(signed(viewport.originals), signed(request));
    frozen(viewport.originals); independent(viewport.originals, request); independent(viewport.originals, viewport.originals);
    assert.deepEqual(viewport.status.resources, expected.resources); assert.equal(viewport.status.generation, 1);
    const picked = await viewport.pick(1, 0); assert.deepEqual(picked, { generation: 1, ref: request.entries[1].ref });
    const pixels = await viewport.readPixels(); assert.equal(pixels.length, width * height * 4);
    const result = { evidence: 'DETERMINISTIC SOFTWARE EVIDENCE', generation: viewport.status.generation,
      originals: signed(viewport.originals), resources: viewport.status.resources, selectedPair: picked,
      pipelineCount: h.records.pipelines.length, verbatimUploadCount: h.records.uploads.length,
      syntheticReadbackBytes: pixels.length, genuineGraphicsDevice: false };
    viewport.dispose(); h.assertReleased(); return result;
  } finally { if (viewport && viewport.status.state !== 'disposed') viewport.dispose(); h.restore(); }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  assert.equal(Number(process.versions.node.split('.')[0]), 22, 'Use Node22');
  const modulePath = process.env.BAROCSS_NATIVE_UV01_MODULE ?? resolve(here, '../dist/index.js');
  const gpu = await import(pathToFileURL(modulePath).href);
  const input = await makeNativeRequest(gpu), WIDTH = 65, HEIGHT = 3;
  const mount = (h, request = input, dimensions = { width: WIDTH, height: HEIGHT }) => gpu.mountNativeSurfaceUV01WebGPUViewport(h.canvas, request, dimensions);
  const err = (error, code) => { assert.ok(error instanceof gpu.NativeSurfaceUV01WebGPUError); assert.equal(error.code, code); assert.ok(error.message.length <= 1024); return true; };
  const refuse = (result, code) => { assert.equal(result.ok, false); err(result.error, code); return result.error; };
  const success = result => assert.deepEqual(result, { ok: true });
  const withMounted = async action => {
    const h = createSoftwarePlatform(); let viewport;
    try { viewport = await mount(h); return await action(h, viewport); }
    finally { if (viewport && viewport.status.state !== 'disposed') viewport.dispose(); h.restore(); }
  };

  test('DETERMINISTIC SOFTWARE EVIDENCE: exact native three-slot, three-binding, seven-upload ABI and shared attachments', async () => {
    await withMounted(async (h, v) => {
      const expected = gpu.prepareNativeSurfaceUV01Frame(input, WIDTH, HEIGHT); assertNativeMountUploads(h, expected);
      assert.deepEqual(gpu.NativeSurfaceUV01WebGPUDiagnosticCode, Object.fromEntries(['INPUT', 'FRAME', 'BUDGET', 'UNSUPPORTED', 'INIT', 'DEVICE_LOST', 'RENDER', 'STATE', 'BUSY'].map(code => [code, code])));
      assert.deepEqual(h.records.deviceRequests, [{ requiredFeatures: [] }]); assert.deepEqual(h.canvas.contextRequests, ['webgpu']);
      assert.deepEqual(h.records.configurations, [{ device: h.device, format: 'rgba8unorm', alphaMode: 'opaque', colorSpace: 'srgb', usage: 18 }]);
      assert.deepEqual(Reflect.ownKeys(v).sort(), ['canvas', 'originals', 'selected', 'status', 'updateFrame', 'resize', 'readPixels', 'pick', 'select', 'dispose'].sort()); assert.ok(Object.isFrozen(v));
      assert.equal(v.canvas, h.canvas); assert.equal(v.status.backend, 'webgpu'); assert.equal(v.status.profile, 'source0-native-surface-uv01-webgpu-v0');
      assert.equal(v.status.state, 'ready'); assert.equal(v.status.generation, 1); assert.deepEqual(v.status.resources, expected.resources);
      assert.equal(v.status.width, WIDTH); assert.equal(v.status.height, HEIGHT); assert.equal(Object.keys(v.status.resources).length, 11);
      assert.deepEqual(Object.keys(v.status).sort(), ['backend', 'profile', 'state', 'generation', 'width', 'height', 'limits', 'resources'].sort());
      assert.deepEqual(v.status.limits, h.limits); frozen(v.status); frozen(v.originals); assert.equal(signed(v.originals), signed(input));
      independent(v.originals, input); independent(v.originals, v.originals); independent(v.status, v.status);
      assert.ok(Object.is(v.originals.entries[1].uniforms.zeta, -0)); assert.equal(v.originals.entries[0].geometry.source, input.entries[0].geometry.source);
      assert.deepEqual(await v.pick(0, 0), { generation: 1, ref: input.entries[0].ref });
      assert.deepEqual(await v.pick(1, 0), { generation: 1, ref: input.entries[1].ref });
      assert.deepEqual(await v.pick(2, 0), { generation: 1, ref: null });
      v.dispose(); v.dispose(); assert.equal(v.status.state, 'disposed'); assert.ok(Object.values(v.status.resources).every(n => n === 0)); h.assertReleased();
    });
  });

  test('mount/update prepare synchronously; copy caller originals; commit only after software presentation; resize raw request', async () => {
    const h = createSoftwarePlatform(); let v;
    try {
      const request = copy(input), before = signed(request), gate = h.gateNext('requestAdapter');
      let rawSnapshots = 0; const observedRequest = new Proxy(request, { ownKeys(target) { rawSnapshots++; return Reflect.ownKeys(target); } });
      const pending = mount(h, observedRequest); assert.equal(rawSnapshots, 1); assert.equal(h.calls.get('requestAdapter'), 1);
      request.entries[0].geometry.source = 'invalid AFTER prepare'; request.entries[1].uniforms.zeta = .875;
      gate.resolve(h.adapter); v = await pending; assert.equal(signed(v.originals), before);
      const update = copy(input); update.entries[0].geometry.source = update.entries[0].geometry.source.replace('[[2,0,-0],[2,3,-0]]', '[[4,0,-0],[4,3,-0]]');
      update.entries[1].uniforms.zeta = .75; update.entries[0].transform.translationMm = [2, -3, 4]; update.options.camera.eye = [0, 0, 8];
      update.options.lighting.direction = [0, 1, 0]; update.options.lighting.ambientStrength = .4; update.options.background = [.2, .3, .4];
      const accepted = signed(update), expected = gpu.prepareNativeSurfaceUV01Frame(update, WIDTH, HEIGHT), start = counters(h);
      const presentedBefore = h.canvas.presented.bytes.slice(), presentationGate = h.gateNext('workDone:present'), count = h.calls.get('workDone:present');
      const observedUpdate = new Proxy(update, { ownKeys(target) { rawSnapshots++; return Reflect.ownKeys(target); } });
      const replacing = v.updateFrame(observedUpdate); assert.equal(rawSnapshots, 2); update.entries[0].geometry.source = 'invalid AFTER synchronous update prepare';
      await reached(h, 'workDone:present', count); assert.equal(v.status.generation, 1); assert.equal(signed(v.originals), before);
      assertNativeMountUploads(h, expected, start); presentationGate.resolve(); success(await replacing);
      assert.equal(v.status.generation, 2); assert.equal(signed(v.originals), accepted); assert.notDeepEqual(h.canvas.presented.bytes, presentedBefore);
      const raw = v.originals, resizeExpected = gpu.prepareNativeSurfaceUV01Frame(raw, 7, 5), resizeStart = counters(h);
      success(await v.resize(7, 5)); assertNativeMountUploads(h, resizeExpected, resizeStart);
      assert.equal(signed(v.originals), accepted); assert.equal(v.status.generation, 3); assert.equal(v.status.width, 7); assert.equal(v.status.height, 5);
      assert.deepEqual(v.status.resources, resizeExpected.resources); v.dispose(); h.assertReleased();
    } finally { if (v && v.status.state !== 'disposed') v.dispose(); h.restore(); }
  });

  test('genuine raw/provider/profile refusals preserve accepted originals, selection, ledger and software presentation', async () => {
    await withMounted(async (h, v) => {
      success(v.select(input.entries[1].ref)); const saved = signed(v.originals), status = v.status, selected = v.selected, presented = h.canvas.presented.bytes.slice();
      let getterReads = 0;
      const mutations = [
        ['shape', r => { r.extra = true; }], ['source', r => { r.entries[0].geometry.source = 'invalid Source0'; }],
        ['reference', r => { r.entries[0].ref.geometryId = 'different'; }], ['uniform', r => { r.entries[0].uniforms.unknown = .5; }],
        ['uniform-range', r => { r.entries[0].uniforms.zeta = 2; }], ['legacy-profile', r => { const compiled = gpu.compileMeshMaterial('@shader #legacy { @fragment { color:#fff; } }'); assert.equal(compiled.ok, true); r.entries[0].material = copy(compiled.material); }],
        ['texture-profile', r => { r.entries[0].material.profile = 'engine-uv'; }], ['external-program', r => { r.entries[0].program = {}; }],
        ['unbound', r => { delete r.entries[0].geometry; }], ['empty', r => { r.entries = []; }],
        ['camera', r => { r.options.camera.target = [0, 0, 6]; }],
        ['accessor', r => { Object.defineProperty(r.entries[0].geometry, 'source', { enumerable: true, get() { getterReads++; return ''; } }); }],
      ];
      for (const [name, mutate] of mutations) {
        const candidate = copy(input); mutate(candidate); const gpuCalls = h.records.events.length;
        const error = refuse(await v.updateFrame(candidate), 'FRAME'); assert.ok(error.cause instanceof gpu.NativeSurfaceUV01FrameError, name);
        assert.equal(h.records.events.length, gpuCalls, name + ' refused before device work');
        assert.equal(signed(v.originals), saved); assert.deepEqual(v.status, status); assert.deepEqual(v.selected, selected); assert.deepEqual(h.canvas.presented.bytes, presented);
        if (name === 'source') { assert.ok(error.cause.cause instanceof gpu.NativeSurfaceUV01BindingError); assert.ok(error.cause.cause.cause); }
      }
      const prepared = gpu.prepareNativeSurfaceUV01Frame(input, WIDTH, HEIGHT); refuse(await v.updateFrame(prepared), 'FRAME');
      assert.equal(getterReads, 0); const resize = await v.resize(1025, HEIGHT); assert.equal(resize.ok, false); assert.ok(['FRAME', 'BUDGET'].includes(resize.error.code));
      assert.equal(signed(v.originals), saved); assert.equal(v.status.generation, 1);
    });
  });

  test('exact own current-realm options and reflection failures refuse before any adapter/device work', async () => {
    const h = createSoftwarePlatform();
    try {
      let getters = 0;
      const variants = [undefined, null, {}, { width: WIDTH }, { width: WIDTH, height: HEIGHT, extra: true },
        { width: 1.5, height: 2 }, { width: NaN, height: 2 },
        Object.assign(Object.create(null), { width: WIDTH, height: HEIGHT }), vm.runInNewContext('({width:65,height:3})'),
        Object.defineProperty({ width: WIDTH, height: HEIGHT }, 'hidden', { value: 1 }),
        { width: WIDTH, height: HEIGHT, [Symbol('field')]: 1 },
        { get width() { getters++; return WIDTH; }, height: HEIGHT },
      ];
      for (const options of variants) await assert.rejects(gpu.mountNativeSurfaceUV01WebGPUViewport(h.canvas, input, options), error => { err(error, 'INPUT'); assert.equal(Object.hasOwn(error, 'cause'), false); return true; });
      for (const width of [0, -1, 1025]) await assert.rejects(mount(h, input, { width, height: 1 }), error => err(error, 'BUDGET'));
      for (const phase of ['getPrototypeOf', 'ownKeys', 'getOwnPropertyDescriptor']) for (const marker of [new Error('exact reflection'), undefined]) {
        const proxy = new Proxy({ width: WIDTH, height: HEIGHT }, { [phase]() { throw marker; } });
        await assert.rejects(mount(h, input, proxy), error => { err(error, 'INPUT'); const cause = Object.getOwnPropertyDescriptor(error, 'cause'); assert.ok(cause); assert.strictEqual(cause.value, marker); return true; });
      }
      assert.equal(getters, 0); assert.equal(h.records.adapterRequests.length, 0); assert.equal(h.records.buffers.length, 0);
      assert.throws(() => { throw new gpu.NativeSurfaceUV01WebGPUError('INPUT', 'x'.repeat(2000)); }, error => { assert.equal(error.message.length, 1024); assert.equal(Object.hasOwn(error, 'cause'), false); return true; });
    } finally { h.restore(); }
  });

  test('unavailable adapter/context/configuration refuse, release the route-local claim, and allow explicit remount', async () => {
    for (const phase of ['platform', 'requestAdapter', 'getContext', 'configure']) {
      const h = createSoftwarePlatform(); let v;
      try {
        if (phase === 'platform') delete globalThis.navigator.gpu;
        else if (phase === 'requestAdapter' || phase === 'getContext') h.enqueue(phase, () => null);
        else h.failNext(phase);
        await assert.rejects(mount(h), error => err(error, phase === 'getContext' ? 'INIT' : 'UNSUPPORTED'));
        assert.equal(h.records.buffers.length, 0); if (phase !== 'platform' && phase !== 'requestAdapter') assert.equal(h.destroyed, 1);
        // A second adapter request on the same object proves the failed claim was released.
        // Stop before acquiring another device; no destroyed software device is reused.
        if (phase === 'platform') globalThis.navigator.gpu = h.platform;
        const adapterCalls = h.records.adapterRequests.length; h.enqueue('requestAdapter', () => null);
        await assert.rejects(mount(h), error => err(error, 'UNSUPPORTED'));
        assert.equal(h.records.adapterRequests.length, adapterCalls + 1);
      } finally { if (v && v.status.state !== 'disposed') v.dispose(); h.restore(); }
    }
  });

  test('snapshot all actual limits; insufficient and candidate-dependent limits refuse before GPU allocations', async () => {
    const requirements = { maxTextureDimension2D: WIDTH, maxBufferSize: 512 * HEIGHT, maxUniformBufferBindingSize: 160,
      maxColorAttachments: 2, maxColorAttachmentBytesPerSample: 12, maxVertexBuffers: 3, maxVertexAttributes: 3,
      maxBindGroups: 1, maxVertexBufferArrayStride: 12, maxUniformBuffersPerShaderStage: 3, maxBindingsPerBindGroup: 3 };
    for (const [name, minimum] of Object.entries(requirements)) {
      const h = createSoftwarePlatform({ limits: { [name]: minimum - 1 } });
      try { await assert.rejects(mount(h), error => err(error, 'UNSUPPORTED')); assert.equal(h.records.buffers.length, 0, name); assert.equal(h.records.textures.length, 0, name); assert.equal(h.destroyed, 1, name); }
      finally { h.restore(); }
    }
    const h = createSoftwarePlatform({ limits: { maxTextureDimension2D: 65, maxBufferSize: 1536 } }); let v;
    try {
      v = await mount(h); const status = v.status, allocationCount = h.records.buffers.length;
      refuse(await v.resize(66, 3), 'UNSUPPORTED'); refuse(await v.resize(65, 4), 'UNSUPPORTED');
      const larger = copy(input); larger.entries[0].geometry.countU = 20; larger.entries[0].geometry.countV = 20;
      refuse(await v.updateFrame(larger), 'UNSUPPORTED'); assert.equal(h.records.buffers.length, allocationCount); assert.deepEqual(v.status, status);
      h.limits.maxTextureDimension2D = 8192; assert.equal(v.status.limits.maxTextureDimension2D, 65, 'Status retains initialization snapshot');
    } finally { if (v && v.status.state !== 'disposed') v.dispose(); h.restore(); }
    const tiny = createSoftwarePlatform({ limits: { maxBufferSize: 255 } });
    try { await assert.rejects(mount(tiny, input, { width: 1, height: 1 }), error => err(error, 'UNSUPPORTED')); assert.equal(tiny.records.buffers.length, 0); }
    finally { tiny.restore(); }
  });

  test('render-target byte cost requires twelve while logical packed attachment storage remains eight', async () => {
    for (const limit of [8, 11, 12]) {
      const h = createSoftwarePlatform({ limits: { maxColorAttachmentBytesPerSample: limit } }); let v;
      try {
        if (limit < 12) {
          await assert.rejects(mount(h), error => err(error, 'UNSUPPORTED'));
          assert.equal(h.records.buffers.length, 0); assert.equal(h.records.textures.length, 0);
          assert.equal(h.destroyed, 1);
        } else {
          v = await mount(h); assert.equal(v.status.limits.maxColorAttachmentBytesPerSample, 12);
          assert.equal(v.status.resources.colorIdentityBytes, 8 * WIDTH * HEIGHT);
          v.dispose(); h.assertReleased();
        }
      } finally { if (v && v.status.state !== 'disposed') v.dispose(); h.restore(); }
    }
  });

  test('compilation/pipeline/allocation/scope/submission failures retain accepted state and release candidates', async () => {
    for (const phase of ['compilation', 'pipeline', 'createBuffer', 'writeBuffer', 'createTexture', 'createBindGroup', 'pushScope', 'popScope', 'submit:render', 'workDone:render']) {
      await withMounted(async (h, v) => {
        const original = signed(v.originals), status = v.status, selection = input.entries[1].ref; success(v.select(selection));
        const presented = h.canvas.presented.bytes.slice(), buffers = h.records.buffers.length, textures = h.records.textures.length;
        if (phase === 'compilation') h.enqueue(phase, () => ({ messages: [{ type: 'error', message: 'Software compilation rejection' }] }));
        else if (phase === 'popScope') h.enqueue(phase, () => ({ message: 'Software validation rejection' }));
        else h.failNext(phase);
        refuse(await v.updateFrame(copy(input)), 'RENDER'); assert.equal(signed(v.originals), original); assert.deepEqual(v.status, status); assert.deepEqual(v.selected, selection);
        assert.deepEqual(h.canvas.presented.bytes, presented); for (const owned of [...h.records.buffers.slice(buffers), ...h.records.textures.slice(textures)]) assert.equal(owned.destroyCount, 1);
        success(await v.updateFrame(copy(input))); assert.equal(v.status.generation, 2);
      });
    }
  });

  test('presentation rollback restores dimensions and software accepted bytes; rollback failure is terminal', async () => {
    await withMounted(async (h, v) => {
      const original = signed(v.originals), status = v.status, pixels = h.canvas.presented.bytes.slice();
      h.failNext('workDone:present'); refuse(await v.resize(9, 4), 'RENDER');
      assert.deepEqual(v.status, status); assert.equal(signed(v.originals), original); assert.equal(h.canvas.width, WIDTH); assert.equal(h.canvas.height, HEIGHT);
      assert.deepEqual(h.canvas.presented.bytes, pixels); assert.equal(h.records.submissions.filter(s => s.kinds[0] === 'present').length, 3);
      h.failNext('workDone:present'); h.failNext('workDone:present');
      const error = refuse(await v.resize(9, 4), 'RENDER'); assert.ok(error.cause instanceof AggregateError);
      assert.equal(v.status.state, 'failed'); assert.ok(Object.values(v.status.resources).every(n => n === 0));
      assert.equal(signed(v.originals), original); refuse(await v.updateFrame(input), 'STATE'); h.assertReleased();
    });
  });

  test('top-left independent tightly packed readback, background/invalid identity and full-pair selection', async () => {
    await withMounted(async (h, v) => {
      const pixels = await v.readPixels(); assert.equal(pixels.length, WIDTH * HEIGHT * 4);
      for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) assert.deepEqual([...pixels.subarray((y * WIDTH + x) * 4, (y * WIDTH + x + 1) * 4)], [1, x, y, 255]);
      const receipt = h.records.copies.at(-1); assert.equal(receipt.destination.bytesPerRow, 512); assert.equal(receipt.destination.buffer.descriptor.size, 1536);
      pixels[0] = 0; assert.equal((await v.readPixels())[0], 1); assert.notEqual(pixels.buffer, (await v.readPixels()).buffer);
      const before = h.records.buffers.length; for (const [x, y] of [[-1, 0], [0, -1], [65, 0], [0, 3], [.5, 0], [0, NaN]]) await assert.rejects(v.pick(x, y), error => err(error, 'INPUT'));
      assert.equal(h.records.buffers.length, before);
      success(v.select(input.entries[1].ref)); independent(v.selected, input.entries[1].ref); independent(v.selected, v.selected); frozen(v.selected);
      refuse(v.select({ modelId: 'other', geometryId: 'plane_nonunit' }), 'INPUT');
      const reordered = copy(input); reordered.entries.reverse(); success(await v.updateFrame(reordered)); assert.deepEqual(v.selected, input.entries[1].ref);
      assert.deepEqual(await v.pick(0, 0), { generation: 2, ref: input.entries[1].ref });
      const removed = copy(input); removed.entries.splice(1); success(await v.updateFrame(removed)); assert.equal(v.selected, null);
      h.identityAt = () => 0xFFFFFFFF; success(await v.updateFrame(input)); await assert.rejects(v.pick(0, 0), error => err(error, 'RENDER')); assert.equal(v.status.state, 'ready');
      success(v.select(null));
    });
  });

  test('BUSY refusals never unlock another pending operation; external backing changes refuse', async () => {
    await withMounted(async (h, v) => {
      const gate = h.gateNext('pipeline'), before = h.calls.get('pipeline'), operation = v.updateFrame(input);
      await reached(h, 'pipeline', before); refuse(await v.updateFrame(input), 'BUSY'); refuse(await v.resize(2, 2), 'BUSY');
      await assert.rejects(v.readPixels(), error => err(error, 'BUSY')); await assert.rejects(v.pick(0, 0), error => err(error, 'BUSY')); refuse(v.select(null), 'BUSY');
      refuse(await v.updateFrame(input), 'BUSY'); gate.resolve({}); success(await operation);
      h.canvas.width++; refuse(await v.updateFrame(input), 'STATE'); refuse(await v.resize(2, 2), 'STATE');
      await assert.rejects(v.readPixels(), error => err(error, 'STATE')); refuse(v.select(null), 'STATE'); h.canvas.width--;
      success(await v.updateFrame(input));
    });
    const h = createSoftwarePlatform();
    try { const gate = h.gateNext('requestDevice'), mounting = mount(h); await reached(h, 'requestDevice'); h.canvas.width++; gate.resolve(h.device); await assert.rejects(mounting, error => err(error, 'STATE')); assert.equal(h.records.buffers.length, 0); assert.equal(h.destroyed, 1); }
    finally { h.restore(); }
  });

  test('ten-second initialization timeout owns late device and releases the route claim', async () => {
    const h = createSoftwarePlatform(), timers = new Map(), originalSet = globalThis.setTimeout, originalClear = globalThis.clearTimeout; let id = 0;
    globalThis.setTimeout = (callback, delay) => { assert.equal(delay, 10000); const token = ++id; timers.set(token, callback); return token; };
    globalThis.clearTimeout = token => { timers.delete(token); };
    try {
      const gate = h.gateNext('requestDevice'), mounting = mount(h); await reached(h, 'requestDevice'); assert.equal(timers.size, 1);
      const rejection = assert.rejects(mounting, error => err(error, 'STATE')); [...timers.values()][0](); await rejection;
      assert.equal(h.destroyed, 0); gate.resolve(h.device); await drain(); assert.equal(h.destroyed, 1); assert.equal(h.records.buffers.length, 0);
      const attempts = h.records.adapterRequests.length; h.enqueue('requestAdapter', () => null); await assert.rejects(mount(h), error => err(error, 'UNSUPPORTED')); assert.equal(h.records.adapterRequests.length, attempts + 1);
    } finally { globalThis.setTimeout = originalSet; globalThis.clearTimeout = originalClear; h.restore(); }
  });

  test('dispose during pending pipeline/map cancels waits, cleans exactly once and owns late-map unmap', async () => {
    for (const phase of ['pipeline', 'map']) await withMounted(async (h, v) => {
      const gate = h.gateNext(phase), before = h.calls.get(phase) ?? 0;
      const pending = phase === 'pipeline' ? v.updateFrame(input) : v.readPixels();
      const result = phase === 'pipeline' ? pending : pending.then(() => assert.fail('Disposed readback resolved'), error => { err(error, 'STATE'); return null; });
      await reached(h, phase, before); const mapped = phase === 'map' ? h.records.buffers.at(-1) : null;
      v.dispose(); v.dispose(); if (phase === 'pipeline') refuse(await result, 'STATE'); else await result;
      assert.equal(v.status.state, 'disposed'); assert.ok(Object.values(v.status.resources).every(n => n === 0)); h.assertReleased();
      const beforeUnmap = mapped?.unmapCount; gate.resolve({}); await drain(); h.assertReleased();
      if (mapped) { assert.equal(mapped.unmapCount, beforeUnmap + 1); assert.equal(mapped.mapped, false); }
    });
  });

  test('device loss at async phases and rejected lost promise are terminal with no fallback or late commit', async () => {
    for (const phase of ['compilation', 'pipeline', 'workDone:render', 'workDone:present', 'map']) {
      await withMounted(async (h, v) => {
        const saved = signed(v.originals), gate = h.gateNext(phase), count = h.calls.get(phase) ?? 0;
        const isReadback = phase === 'map', pending = isReadback ? v.readPixels() : v.updateFrame(input);
        const observed = isReadback ? pending.then(() => assert.fail('Lost readback resolved'), error => { err(error, 'DEVICE_LOST'); return null; }) : pending;
        await reached(h, phase, count); h.lost.resolve({ reason: 'unknown', message: 'synthetic boundary loss' }); await drain();
        if (isReadback) await observed; else refuse(await observed, 'DEVICE_LOST');
        assert.equal(v.status.state, 'lost'); assert.equal(v.status.generation, 1); assert.equal(signed(v.originals), saved);
        assert.ok(Object.values(v.status.resources).every(n => n === 0)); h.assertReleased();
        gate.resolve(phase === 'compilation' ? { messages: [] } : {}); await drain(); assert.equal(v.status.generation, 1); h.assertReleased();
        refuse(await v.updateFrame(input), 'DEVICE_LOST'); assert.deepEqual(h.canvas.contextRequests, ['webgpu']);
      });
    }
    await withMounted(async (h, v) => { const marker = new Error('rejected device lost promise'); h.lost.reject(marker); await drain(); assert.equal(v.status.state, 'lost'); const error = refuse(await v.updateFrame(input), 'DEVICE_LOST'); assert.strictEqual(error.cause, marker); h.assertReleased(); });
  });

  test('primary plus cleanup failures remain observable and terminal; disposal stays idempotent', async () => {
    await withMounted(async (h, v) => {
      const primary = h.failNext('workDone:render'), cleanup = h.failNext('destroyBuffer');
      const error = refuse(await v.updateFrame(input), 'RENDER'); assert.equal(v.status.state, 'failed'); assert.ok(error.cause instanceof AggregateError);
      const all = []; const visit = value => { all.push(value); if (value?.cause) visit(value.cause); if (value instanceof AggregateError) value.errors.forEach(visit); }; visit(error);
      assert.ok(all.includes(primary)); assert.ok(all.includes(cleanup)); assert.ok(Object.values(v.status.resources).every(n => n === 0)); h.assertReleased();
    });
    const h = createSoftwarePlatform(); let v;
    try { v = await mount(h); const cleanup = h.failNext('unconfigure'); assert.throws(() => v.dispose(), error => { err(error, 'RENDER'); assert.ok(error.cause instanceof AggregateError); assert.ok(error.cause.errors.includes(cleanup)); return true; }); v.dispose(); assert.equal(h.unconfigured, 1); h.assertReleased(); }
    finally { h.restore(); }
  });
}
