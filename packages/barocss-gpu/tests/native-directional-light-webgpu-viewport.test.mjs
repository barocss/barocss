/** #1579 DETERMINISTIC SOFTWARE EVIDENCE ONLY.
 * The private platform below records calls and copies synthetic bytes. It does not
 * compile WGSL, rasterize, validate a driver, or prove GPU/pixel/interpolation behavior.
 * The actual prepareNativeDirectionalLightWebGPUFrame and every original-source provider run
 * unchanged. There is no public injectable device or provider replacement.
 * 32MiB candidate/64MiB residency and8MiB aggregate defenses may be unreachable
 * under stricter real-provider caps; no provider mocks fabricate their reachability.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import vm from 'node:vm';
import { build } from 'esbuild';

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

/** The same two complete original CAD sources are used by the cold qualifier. */
export const nativeSources = [
  '@model plane_original { version:0; length-unit:mm;\n@surface #plane_nonunit { type:nurbs; degree-u:1; degree-v:1; knots-u:[-3,-3,7,7]; knots-v:[2,2,5,5]; control-points:[[[0,0,-0],[0,3,-0]],[[2,0,-0],[2,3,-0]]]; weights:[[1,1],[1,1]]; }\n}\n',
  '@model tilted_original { version:0; length-unit:mm;\n@curve #retained_sibling { type:nurbs; degree:1; knots:[-0,-0,1,1]; control-points:[[-0,0,-0],[1,0,-0]]; weights:[1,1]; }\n@surface #plane_nonunit { type:nurbs; degree-u:1; degree-v:1; knots-u:[-2,-2,6,6]; knots-v:[3,3,11,11]; control-points:[[[0,0,0],[0,3,1]],[[2,0,1],[2,3,2]]]; weights:[[1,1],[1,1]]; }\n}\n',
];
export const materialSources = [
  '/* Original A é😀 / signed -0 */\r\n@shader #palette_A { @uniform amount:float(-0,1,.25); @fragment {color:mix(#000,#fff,amount);} }\r\n',
  '/* Original B */\n@shader #palette_B { @uniform amount:float(-0,1,.5); @fragment {color:mix(#000,#fff,amount);} }\n',
];
export function makeNativeFixtures(gpu, cad, sources = nativeSources, materials = materialSources) {
  const models = sources.map(source => { const result = cad.compileCadModel(source, { sourceVersion: 0 }); assert.equal(result.ok, true, JSON.stringify(result)); return result.model; });
  const entries = models.map((model, i) => {
    const surface = model.objects.find(object => object.id === 'plane_nonunit'); assert.ok(surface);
    return { kind: 'surface', ref: { modelId: i ? 'asset_right' : 'asset_left', geometryId: surface.id },
      packet: copy(cad.tessellateSurface(surface, { countU: 5, countV: 3, revision: 7 }).packet),
      color: i ? [.2, .8, .4] : [.9, .3, .1],
      transform: { translationMm: i ? [-4, 2, -8] : [4, -2, 8], rotationXYZW: i ? [1, 0, 0, 0] : [0, 0, 1, 0], scale: [2, 3, 4] } };
  });
  const request = { format: 'barocss-gpu-native-directional-light-webgpu-request', version: 0,
    frame: { version: 0, scene: { version: 2, entries }, particles: null,
      materials: entries.map((entry, i) => { const result = gpu.compileMeshMaterial(materials[i]); assert.equal(result.ok, true, JSON.stringify(result));
        return { ref: copy(entry.ref), binding: { material: copy(result.material), uniforms: i ? { amount: -0 } : {} } }; }),
      options: { mmToSceneUnit: .125, translate: [1, -2, .5], background: [.1, .2, .3],
        camera: { eye: [0, 0, 6], target: [0, 0, 0], up: [0, 2, 0], fovYDegrees: 60, near: .1, far: 100 } } },
    lights: { format: 'barocss-gpu-native-directional-lights', version: 0, profile: 'native-world-directional-linear-v0',
      sourceId: 'signed-light-study', revision: -0, ambientStrength: .1,
      lights: [{ nodeId: 'red-key', label: 'Red é😀', enabled: true, directionScene: [2, -0, 0], colorLinearRGB: [1, -0, 0], intensity: .5 },
        { nodeId: 'blue-fill', label: 'Blue\nFill', enabled: true, directionScene: [0, -0, 4], colorLinearRGB: [-0, 0, 1], intensity: .25 }] } };
  return { request, sources: [...sources], materialSources: [...materials], models };
}
export const makeNativeRequest = (gpu, cad) => makeNativeFixtures(gpu, cad).request;

const createSoftwareLimitValues = () => ({ maxTextureDimension2D: 4096, maxBufferSize: 1 << 26, maxUniformBufferBindingSize: 65536,
  maxColorAttachments: 8, maxColorAttachmentBytesPerSample: 32, maxVertexBuffers: 8, maxVertexAttributes: 16,
  maxBindGroups: 4, maxVertexBufferArrayStride: 2048, maxUniformBuffersPerShaderStage: 12, maxBindingsPerBindGroup: 1000 });

// Private, test-only software boundary. No package import or provider interception.
export function createSoftwarePlatform(options = {}) {
  const faults = new Map(), calls = new Map(), records = { buffers: [], textures: [], uploads: [], shaders: [], pipelines: [], layouts: [], pipelineLayouts: [], groups: [], passes: [], copies: [], submissions: [], configurations: [], adapterRequests: [], deviceRequests: [], scopes: [], events: [] };
  const lost = deferred(); lost.promise.catch(() => {});
  let destroyed = 0, unconfigured = 0, renderSerial = 0, lastSubmission = 'none';
  const limits = { ...createSoftwareLimitValues(), ...options.limits };
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
    assert.equal(pipeline.vertex.entryPoint, draw.program.vertexEntryPoint); assert.equal(pipeline.fragment.entryPoint, draw.program.fragmentEntryPoint);
    assert.deepEqual(pipeline.vertex.buffers, [
      { arrayStride: 12, stepMode: 'vertex', attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
      { arrayStride: 12, stepMode: 'vertex', attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }] },
    ]);
    assert.deepEqual(pipeline.fragment.targets, [{ format: 'rgba8unorm' }, { format: 'r32uint' }]);
    assert.deepEqual(pipeline.primitive, { topology: 'triangle-list', cullMode: 'none' });
    assert.deepEqual(pipeline.depthStencil, { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' });
    assert.deepEqual(pipeline.multisample, { count: 1 });
    assert.deepEqual(group.layout.entries, [
      { binding: 0, visibility: 3, buffer: { type: 'uniform', minBindingSize: 144 } },
      { binding: 1, visibility: 2, buffer: { type: 'uniform', minBindingSize: 64 } },
      { binding: 2, visibility: 2, buffer: { type: 'uniform', minBindingSize: 144 } },
      { binding: 3, visibility: 2, buffer: { type: 'uniform', minBindingSize: 16 } },
    ]);
    assert.deepEqual(group.entries.map(e => e.binding), [0, 1, 2, 3]);
    for (const [binding, name] of ['frame', 'material', 'lights', 'draw'].entries()) assert.deepEqual(group.entries[binding].resource.buffer.bytes, draw.uniforms[name]);
    const call = pass.draws[i]; assert.deepEqual([...call.slots.keys()], [0, 1]);
    for (const [slot, name] of ['positions', 'normals'].entries()) assert.deepEqual(call.slots.get(slot).bytes, draw[name]);
    assert.deepEqual(call.indices.buffer.bytes, draw.indices); assert.equal(call.indices.format, 'uint16'); assert.equal(call.count, draw.indexCount);
    const expected = [draw.positions, draw.normals, draw.indices, ...Object.values(draw.uniforms)];
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
    const expected = gpu.prepareNativeDirectionalLightWebGPUFrame(request, width, height);
    viewport = await gpu.mountNativeDirectionalLightWebGPUViewport(h.canvas, request, { width, height });
    assertNativeMountUploads(h, expected); assert.equal(signed(viewport.originals), signed(request));
    frozen(viewport.originals); independent(viewport.originals, request); independent(viewport.originals, viewport.originals);
    assert.deepEqual(viewport.status.resources, expected.resources); assert.equal(viewport.status.generation, 1);
    const x = Math.min(1, width - 1, request.frame.scene.entries.length - 1);
    const picked = await viewport.pick(x, 0); assert.deepEqual(picked, { generation: 1, ref: request.frame.scene.entries[x].ref });
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
  const modulePath = process.env.BAROCSS_NATIVE_DIRECTIONAL_MODULE;
  const fixtureModule = await build({ stdin: { contents: `export {compileCadModel} from './packages/barocss-cad/src/model-compiler.ts'; export {tessellateSurface} from './packages/barocss-cad/src/preview.ts'; export {prepareNativeDirectionalLightWebGPUFrame} from './packages/barocss-gpu/src/native-directional-light-webgpu-frame.ts'; export {prepareCamera} from './packages/barocss-gpu/src/camera.ts'; export {preparePrimitiveSceneFrame} from './packages/barocss-gpu/src/primitive-frame-preflight.ts';`, resolveDir: resolve(here, '../../..') }, bundle: true, format: 'esm', platform: 'node', write: false });
  const privateCPU = await import('data:text/javascript;base64,' + Buffer.from(fixtureModule.outputFiles[0].text).toString('base64'));
  const gpu = { ...await import(pathToFileURL(modulePath ?? resolve(here, '../dist/index.js')).href), ...privateCPU };
  const input = makeNativeRequest(gpu, privateCPU), WIDTH = 65, HEIGHT = 3;
  const mount = (h, request = input, dimensions = { width: WIDTH, height: HEIGHT }) => gpu.mountNativeDirectionalLightWebGPUViewport(h.canvas, request, dimensions);
  const err = (error, code) => { assert.ok(error instanceof gpu.NativeDirectionalLightWebGPUError); assert.equal(error.code, code); assert.ok(error.message.length <= 1024); return true; };
  const refuse = (result, code) => { assert.equal(result.ok, false); err(result.error, code); return result.error; };
  const success = result => assert.deepEqual(result, { ok: true });
  const withMounted = async action => {
    const h = createSoftwarePlatform(); let viewport;
    try { viewport = await mount(h); return await action(h, viewport); }
    finally { if (viewport && viewport.status.state !== 'disposed') viewport.dispose(); h.restore(); }
  };

  test('DETERMINISTIC SOFTWARE EVIDENCE: exact native two-slot, four-binding, seven-upload ABI and shared attachments', async () => {
    await withMounted(async (h, v) => {
      const expected = gpu.prepareNativeDirectionalLightWebGPUFrame(input, WIDTH, HEIGHT); assertNativeMountUploads(h, expected);
      assert.deepEqual(gpu.NativeDirectionalLightWebGPUDiagnosticCode, Object.fromEntries(['INPUT', 'PROFILE', 'FRAME', 'PROGRAM', 'REPRESENTATION', 'BUDGET', 'UNSUPPORTED', 'INIT', 'DEVICE_LOST', 'RENDER', 'STATE', 'BUSY'].map(code => [code, code])));
      assert.deepEqual(h.records.deviceRequests, [{ requiredFeatures: [] }]); assert.deepEqual(h.canvas.contextRequests, ['webgpu']);
      assert.deepEqual(h.records.configurations, [{ device: h.device, format: 'rgba8unorm', alphaMode: 'opaque', colorSpace: 'srgb', usage: 18 }]);
      assert.deepEqual(Reflect.ownKeys(v).sort(), ['canvas', 'originals', 'selected', 'status', 'updateFrame', 'resize', 'readPixels', 'pick', 'select', 'dispose'].sort()); assert.ok(Object.isFrozen(v));
      assert.equal(v.canvas, h.canvas); assert.equal(v.status.backend, 'webgpu'); assert.equal(v.status.profile, 'qualified-surface-authored-directional-webgpu-v0');
      assert.equal(v.status.state, 'ready'); assert.equal(v.status.generation, 1); assert.deepEqual(v.status.resources, expected.resources);
      assert.equal(v.status.width, WIDTH); assert.equal(v.status.height, HEIGHT); assert.equal(Object.keys(v.status.resources).length, 11);
      assert.deepEqual(Object.keys(v.status).sort(), ['backend', 'profile', 'state', 'generation', 'width', 'height', 'limits', 'resources'].sort());
      assert.deepEqual(v.status.limits, h.limits); frozen(v.status); frozen(v.originals); assert.equal(signed(v.originals), signed(input));
      independent(v.originals, input); independent(v.originals, v.originals); independent(v.status, v.status);
      assert.ok(Object.is(v.originals.frame.materials[1].binding.uniforms.amount, -0));
      assert.equal(v.originals.frame.materials[0].binding.material.source, materialSources[0]);
      assert.deepEqual(v.originals.frame.materials[0].binding.uniforms, {});
      assert.equal(v.status.resources.uniformBytes, 368 * 2); assert.equal(v.status.resources.buffers, 7 * 2);
      assert.deepEqual(await v.pick(0, 0), { generation: 1, ref: input.frame.scene.entries[0].ref });
      assert.deepEqual(await v.pick(1, 0), { generation: 1, ref: input.frame.scene.entries[1].ref });
      assert.deepEqual(await v.pick(2, 0), { generation: 1, ref: null });
      v.dispose(); v.dispose(); assert.equal(v.status.state, 'disposed'); assert.ok(Object.values(v.status.resources).every(n => n === 0)); h.assertReleased();
    });
  });

  test('actual common geometry and camera providers and authored programs preserve every LE ABI byte', async () => {
    const original = signed(input), prepared = gpu.prepareNativeDirectionalLightWebGPUFrame(input, WIDTH, HEIGHT);
    const common = gpu.preparePrimitiveSceneFrame(input.frame, 'qualified-v2'), camera = gpu.prepareCamera(input.frame.options.camera, WIDTH / HEIGHT);
    const floats = values => { const bytes = Buffer.alloc(values.length * 4); values.forEach((value, i) => bytes.writeFloatLE(value, i * 4)); return bytes; };
    for (const [index, draw] of prepared.draws.entries()) {
      const source = common.primitives[index], frame = Buffer.alloc(144), identity = Buffer.alloc(16);
      camera.view.forEach((value, i) => frame.writeFloatLE(value, i * 4));
      camera.projection.forEach((value, i) => frame.writeFloatLE(value, 64 + i * 4));
      source.entry.color.forEach((value, i) => frame.writeFloatLE(value, 128 + i * 4)); identity.writeUInt32LE(index + 1);
      const binding = input.frame.materials.find(item => signed(item.ref) === signed(source.entry.ref));
      const program = gpu.prepareNativeDirectionalLightProgramWGSL({ lights: input.lights, material: binding?.binding ?? null });
      assert.deepEqual(Buffer.from(draw.uniforms.frame), frame); assert.deepEqual(Buffer.from(draw.uniforms.draw), identity);
      assert.deepEqual(draw.uniforms.material, program.uniforms.material); assert.deepEqual(draw.uniforms.lights, program.uniforms.lights);
      assert.deepEqual(draw.program, program.program); assert.deepEqual(draw.abi, program.abi);
      assert.deepEqual(Buffer.from(draw.positions), floats(source.positions)); assert.deepEqual(Buffer.from(draw.normals), floats(source.normals));
      const indices = Buffer.alloc(Math.ceil(source.indices.byteLength / 4) * 4); source.indices.forEach((value, i) => indices.writeUInt16LE(value, i * 2));
      assert.deepEqual(Buffer.from(draw.indices), indices); assert.equal(draw.indexCount, source.indices.length);
      independent(draw.uniforms.material, program.uniforms.material); independent(draw.uniforms.lights, program.uniforms.lights);
    }
    // A valid caller packet may contain an odd number of native triangles; the
    // provider validates it without pretending to prove original CAD provenance.
    const odd = copy(input); odd.frame.scene.entries[0].packet.indices.splice(-3);
    const h = createSoftwarePlatform(); let v;
    try {
      const expected = gpu.prepareNativeDirectionalLightWebGPUFrame(odd, WIDTH, HEIGHT);
      assert.equal(expected.draws[0].indexCount, 45); assert.equal(expected.draws[0].indices.length, 92);
      assert.deepEqual([...expected.draws[0].indices.slice(-2)], [0, 0]);
      v = await mount(h, odd); assertNativeMountUploads(h, expected);
    } finally { if (v) v.dispose(); h.restore(); }
    assert.equal(signed(input), original);
  });

  test('raw zero/four/disabled light slots, edits/removal/reorder, fallback color and complete material replacement', async () => {
    await withMounted(async (h, v) => {
      const variants = [];
      const zero = copy(input); zero.lights.lights = []; zero.frame.materials = []; variants.push(zero);
      const four = copy(input); four.lights.lights.push(
        { ...copy(four.lights.lights[0]), nodeId: 'disabled-key', enabled: false, intensity: Number.MIN_VALUE },
        { ...copy(four.lights.lights[1]), nodeId: 'fourth-fill', enabled: false }); variants.push(four);
      const changed = copy(input); changed.lights.lights[0].directionScene = [0, 3, 0]; changed.lights.lights[0].colorLinearRGB = [.2, .7, .4]; changed.lights.lights[0].intensity = .75; changed.frame.materials[0].binding.uniforms.amount = .1; variants.push(changed);
      const removed = copy(input); removed.lights.lights.shift(); removed.frame.materials.splice(1); variants.push(removed);
      const reordered = copy(input); reordered.lights.lights.reverse(); variants.push(reordered);
      const disabled = copy(input); disabled.lights.lights.forEach(light => { light.enabled = false; }); variants.push(disabled);
      const fourDraws = copy(input); for (const id of ['asset_third', 'asset_fourth']) { const entry = copy(fourDraws.frame.scene.entries[0]); entry.ref.modelId = id; fourDraws.frame.scene.entries.push(entry); } variants.push(fourDraws);
      let generation = 1;
      for (const request of variants) {
        const expected = gpu.prepareNativeDirectionalLightWebGPUFrame(request, WIDTH, HEIGHT), start = counters(h);
        success(await v.updateFrame(request)); assert.equal(v.status.generation, ++generation); assertNativeMountUploads(h, expected, start);
        assert.equal(signed(v.originals), signed(request)); assert.equal(v.status.resources.uniformBytes, 368 * request.frame.scene.entries.length);
        for (const draw of expected.draws) assert.equal(draw.abi.bindings.length, 4);
        if (!request.frame.materials.length) {
          assert.deepEqual(v.originals.frame.materials, []);
          for (const draw of expected.draws) { assert.ok(draw.uniforms.material.every(value => value === 0)); assert.match(draw.program.code, /pow\(frameParams.color.xyz/); }
        }
        if (request.lights.lights.length === 4) {
          for (const draw of expected.draws) {
            const bytes = new DataView(draw.uniforms.lights.buffer); assert.equal(bytes.getFloat32(92, true), 0); assert.equal(bytes.getFloat32(124, true), 0);
          }
          assert.equal(v.originals.lights.lights[2].intensity, Number.MIN_VALUE);
        }
      }
    });
  });

  test('selection admits modelId128, matches full pairs, and never renders or increments generation', async () => {
    const h = createSoftwarePlatform(); let v;
    try {
      const request = copy(input), long = 'm' + 'a'.repeat(127);
      request.frame.scene.entries[1].ref.modelId = long; request.frame.materials[1].ref.modelId = long;
      v = await mount(h, request); const start = counters(h), generation = v.status.generation, ref = request.frame.scene.entries[1].ref;
      success(v.select(ref)); assert.deepEqual(v.selected, ref); assert.deepEqual(await v.pick(1, 0), { generation, ref });
      assert.equal(v.status.generation, generation); assert.deepEqual(counters(h), start);
      const picked = await v.pick(1, 0); frozen(picked); independent(picked.ref, ref); independent(picked.ref, v.selected);
      let getterCalls = 0;
      for (const invalid of [{ ...ref, extra: 1 }, { modelId: long + 'a', geometryId: ref.geometryId },
        Object.assign(Object.create(null), ref), vm.runInNewContext(JSON.stringify(ref).replace(/^/, '(').replace(/$/, ')')),
        { get modelId() { getterCalls++; return long; }, geometryId: ref.geometryId }]) refuse(v.select(invalid), 'INPUT');
      assert.equal(getterCalls, 0);
      const reordered = copy(request); reordered.frame.scene.entries.reverse(); success(await v.updateFrame(reordered)); assert.deepEqual(v.selected, ref);
      const removed = copy(request); removed.frame.scene.entries.splice(1); removed.frame.materials.splice(1); success(await v.updateFrame(removed)); assert.equal(v.selected, null);
    } finally { if (v) v.dispose(); h.restore(); }
  });

  test('mount/update prepare synchronously; copy caller originals; commit only after software presentation; resize raw request', async () => {
    const h = createSoftwarePlatform(); let v;
    try {
      const request = copy(input), before = signed(request), gate = h.gateNext('requestAdapter');
      let rawSnapshots = 0; const observedRequest = new Proxy(request, { ownKeys(target) { rawSnapshots++; return Reflect.ownKeys(target); } });
      const pending = mount(h, observedRequest); assert.equal(rawSnapshots, 1); assert.equal(h.calls.get('requestAdapter'), 1);
      request.frame.scene.entries[0].packet.positions[0] = 999; request.frame.materials[1].binding.uniforms.amount = .875; request.lights.lights.reverse();
      gate.resolve(h.adapter); v = await pending; assert.equal(signed(v.originals), before);
      const update = copy(input); update.frame.scene.entries[0].packet.revision = 8;
      update.frame.materials[1].binding.uniforms.amount = .75; update.frame.scene.entries[0].transform.translationMm = [2, -3, 4]; update.frame.options.camera.eye = [0, 0, 8];
      update.lights.lights[0].directionScene = [0, 3, 0]; update.lights.ambientStrength = .4; update.frame.options.background = [.2, .3, .4];
      const accepted = signed(update), expected = gpu.prepareNativeDirectionalLightWebGPUFrame(update, WIDTH, HEIGHT), start = counters(h);
      const presentedBefore = h.canvas.presented.bytes.slice(), presentationGate = h.gateNext('workDone:present'), count = h.calls.get('workDone:present');
      const observedUpdate = new Proxy(update, { ownKeys(target) { rawSnapshots++; return Reflect.ownKeys(target); } });
      const replacing = v.updateFrame(observedUpdate); assert.equal(rawSnapshots, 2); update.frame.scene.entries[0].packet.positions[0] = 999;
      await reached(h, 'workDone:present', count); assert.equal(v.status.generation, 1); assert.equal(signed(v.originals), before);
      assertNativeMountUploads(h, expected, start); presentationGate.resolve(); success(await replacing);
      assert.equal(v.status.generation, 2); assert.equal(signed(v.originals), accepted); assert.notDeepEqual(h.canvas.presented.bytes, presentedBefore);
      const raw = v.originals, resizeExpected = gpu.prepareNativeDirectionalLightWebGPUFrame(raw, 7, 5), resizeStart = counters(h);
      success(await v.resize(7, 5)); assertNativeMountUploads(h, resizeExpected, resizeStart);
      assert.equal(signed(v.originals), accepted); assert.equal(v.status.generation, 3); assert.equal(v.status.width, 7); assert.equal(v.status.height, 5);
      assert.deepEqual(v.status.resources, resizeExpected.resources); v.dispose(); h.assertReleased();
    } finally { if (v && v.status.state !== 'disposed') v.dispose(); h.restore(); }
  });

  test('genuine raw/provider/profile refusals preserve accepted originals, selection, ledger and software presentation', async () => {
    await withMounted(async (h, v) => {
      success(v.select(input.frame.scene.entries[1].ref)); const saved = signed(v.originals), status = v.status, selected = v.selected, presented = h.canvas.presented.bytes.slice();
      let getterReads = 0;
      const mutations = [
        ['shape', 'INPUT', r => { r.extra = true; }],
        ['packet', 'FRAME', r => { r.frame.scene.entries[0].packet.bounds.min[0] = 99; }],
        ['reference', 'FRAME', r => { r.frame.scene.entries[0].ref.geometryId = 'different'; }],
        ['material-reference', 'FRAME', r => { r.frame.materials[0].ref.modelId = 'absent'; }],
        ['duplicate-pair', 'FRAME', r => { r.frame.scene.entries[1].ref = copy(r.frame.scene.entries[0].ref); }],
        ['duplicate-material', 'FRAME', r => { r.frame.materials[1].ref = copy(r.frame.materials[0].ref); }],
        ['uniform', 'FRAME', r => { r.frame.materials[0].binding.uniforms.unknown = .5; }],
        ['uniform-range', 'FRAME', r => { r.frame.materials[0].binding.uniforms.amount = 2; }],
        ['source-mismatch', 'FRAME', r => { r.frame.materials[0].binding.material.source = 'invalid material'; }],
        ['texture-profile', 'FRAME', r => { r.frame.materials[0].binding.material.profile = 'engine-uv'; }],
        ['external-program', 'FRAME', r => { r.frame.scene.entries[0].program = {}; }],
        ['missing-packet', 'FRAME', r => { delete r.frame.scene.entries[0].packet; }],
        ['wrong-kind', 'PROFILE', r => { r.frame.scene.entries[0].kind = 'curve'; }],
        ['particles', 'PROFILE', r => { r.frame.particles = {}; }],
        ['scene-profile', 'PROFILE', r => { r.frame.scene.version = 1; }],
        ['light-profile', 'PROFILE', r => { r.lights.profile = 'legacy'; }],
        ['legacy-lighting', 'PROFILE', r => { r.frame.options.lighting = { ambientStrength: 0 }; }],
        ['undefined-lighting', 'PROFILE', r => { r.frame.options.lighting = undefined; }],
        ['empty', 'BUDGET', r => { r.frame.scene.entries = []; }],
        ['five-surfaces', 'BUDGET', r => { r.frame.scene.entries = Array(5).fill(r.frame.scene.entries[0]); }],
        ['five-materials', 'BUDGET', r => { r.frame.materials = Array(5).fill(r.frame.materials[0]); }],
        ['five-lights', 'BUDGET', r => { r.lights.lights = Array(5).fill(r.lights.lights[0]); }],
        ['camera', 'FRAME', r => { r.frame.options.camera.target = [0, 0, 6]; }],
        ['material-representation', 'PROGRAM', r => { r.frame.materials[0].binding.uniforms.amount = Number.MIN_VALUE; }],
        ['light-direction', 'PROGRAM', r => { r.lights.lights[0].directionScene = [0, 0, 0]; }],
        ['light-intensity', 'PROGRAM', r => { r.lights.lights[0].intensity = Number.MIN_VALUE; }],
        ['local-f32-loss', 'REPRESENTATION', r => { r.frame.scene.entries[0].color[0] = Number.MIN_VALUE; }],
        ['nonfinite', 'INPUT', r => { r.frame.scene.entries[0].color[0] = Infinity; }],
        ['foreign', 'INPUT', r => { r.frame.options.translate = vm.runInNewContext('[0, 0, 0]'); }],
        ['symbol', 'INPUT', r => { r.frame.scene.entries[0].packet[Symbol('hidden')] = 1; }],
        ['hidden', 'INPUT', r => { Object.defineProperty(r.frame.scene.entries[0].packet, 'hidden', { value: 1 }); }],
        ['sparse', 'INPUT', r => { delete r.frame.scene.entries[0].packet.positions[0]; }],
        ['array-extra', 'INPUT', r => { r.frame.scene.entries[0].packet.positions.extra = 1; }],
        ['cycle', 'INPUT', r => { r.frame.scene.entries[0].packet.positions[0] = r; }],
        ['accessor', 'INPUT', r => { Object.defineProperty(r.frame.scene.entries[0].packet, 'revision', { enumerable: true, get() { getterReads++; return 7; } }); }],
      ];
      for (const [name, code, mutate] of mutations) {
        const candidate = copy(input); mutate(candidate); const gpuCalls = h.records.events.length;
        const error = refuse(await v.updateFrame(candidate), code);
        if (code === 'FRAME' || code === 'PROGRAM') assert.ok(error.cause instanceof Error, name);
        else assert.equal(Object.hasOwn(error, 'cause'), false, name);
        if (code === 'PROGRAM') { assert.equal(error.cause.name, 'NativeDirectionalLightProgramWGSLError'); assert.ok(typeof error.cause.code === 'string'); }
        assert.equal(h.records.events.length, gpuCalls, name + ' refused before device work');
        assert.equal(signed(v.originals), saved); assert.deepEqual(v.status, status); assert.deepEqual(v.selected, selected); assert.deepEqual(h.canvas.presented.bytes, presented);
      }
      for (const phase of ['getPrototypeOf', 'ownKeys', 'getOwnPropertyDescriptor']) for (const marker of [new Error('exact reflection'), undefined]) {
        const proxy = new Proxy(copy(input), { [phase]() { throw marker; } });
        const error = refuse(await v.updateFrame(proxy), 'INPUT'); assert.ok(Object.hasOwn(error, 'cause')); assert.strictEqual(error.cause, marker);
      }
      const prepared = gpu.prepareNativeDirectionalLightWebGPUFrame(input, WIDTH, HEIGHT); refuse(await v.updateFrame(prepared), 'INPUT');
      assert.equal(getterReads, 0); refuse(await v.resize(1025, HEIGHT), 'BUDGET');
      assert.equal(signed(v.originals), saved); assert.equal(v.status.generation, 1);
    });
  });

  test('local snapshot budgets and cardinalities refuse before element enumeration or GPU work', async () => {
    await withMounted(async (h, v) => {
      const saved = signed(v.originals), status = v.status; let enumerations = 0;
      const oversized = length => new Proxy(Array(length), { ownKeys() { enumerations++; throw new Error('must check length first'); } });
      const cases = [
        r => { r.frame.scene.entries = oversized(5); }, r => { r.frame.materials = oversized(5); }, r => { r.lights.lights = oversized(5); },
        r => { r.frame.scene.entries[0].packet.positions = oversized(24577); },
        r => { r.frame.scene.entries[0].packet.bounds = Object.fromEntries(Array.from({ length: 65 }, (_, i) => ['field' + i, i])); },
        r => { r.frame.materials[0].binding.material.source = 'x'.repeat(65537); },
        r => { r.frame.materials[0].binding.material.source = '€'.repeat(21846); },
        r => { let nested = 0; for (let i = 0; i < 50; i++) nested = [nested]; r.frame.scene.entries[0].packet.positions[0] = nested; },
        // Repeated paths are charged independently, not deduplicated by reference.
        r => { const shared = 'x'.repeat(65536); r.frame.scene.entries[0].packet.positions = Array(33).fill(shared); },
        r => { const shared = Array(8192).fill(0); r.frame.scene.entries[0].packet.positions = Array(33).fill(shared); },
      ];
      for (const mutate of cases) { const request = copy(input); mutate(request); const calls = h.records.events.length;
        refuse(await v.updateFrame(request), 'BUDGET'); assert.equal(h.records.events.length, calls); assert.equal(signed(v.originals), saved); assert.deepEqual(v.status, status); }
      assert.equal(enumerations, 0);
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
      for (const options of variants) await assert.rejects(gpu.mountNativeDirectionalLightWebGPUViewport(h.canvas, input, options), error => { err(error, 'INPUT'); assert.equal(Object.hasOwn(error, 'cause'), false); return true; });
      for (const width of [0, -1, 1025]) await assert.rejects(mount(h, input, { width, height: 1 }), error => err(error, 'BUDGET'));
      for (const phase of ['getPrototypeOf', 'ownKeys', 'getOwnPropertyDescriptor']) for (const marker of [new Error('exact reflection'), undefined]) {
        const proxy = new Proxy({ width: WIDTH, height: HEIGHT }, { [phase]() { throw marker; } });
        await assert.rejects(mount(h, input, proxy), error => { err(error, 'INPUT'); const cause = Object.getOwnPropertyDescriptor(error, 'cause'); assert.ok(cause); assert.strictEqual(cause.value, marker); return true; });
      }
      assert.equal(getters, 0); assert.equal(h.records.adapterRequests.length, 0); assert.equal(h.records.buffers.length, 0);
      assert.throws(() => { throw new gpu.NativeDirectionalLightWebGPUError('INPUT', 'x'.repeat(2000)); }, error => { assert.equal(error.message.length, 1024); assert.equal(Object.hasOwn(error, 'cause'), false); return true; });
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
    const requirements = { maxTextureDimension2D: WIDTH, maxBufferSize: 512 * HEIGHT, maxUniformBufferBindingSize: 144,
      maxColorAttachments: 2, maxColorAttachmentBytesPerSample: 12, maxVertexBuffers: 2, maxVertexAttributes: 2,
      maxBindGroups: 1, maxVertexBufferArrayStride: 12, maxUniformBuffersPerShaderStage: 4, maxBindingsPerBindGroup: 4 };
    for (const [name, minimum] of Object.entries(requirements)) {
      const h = createSoftwarePlatform({ limits: { [name]: minimum - 1 } });
      try { await assert.rejects(mount(h), error => err(error, 'UNSUPPORTED')); assert.equal(h.records.buffers.length, 0, name); assert.equal(h.records.textures.length, 0, name); assert.equal(h.destroyed, 1, name); }
      finally { h.restore(); }
    }
    const h = createSoftwarePlatform({ limits: { maxTextureDimension2D: 65, maxBufferSize: 1536 } }); let v;
    try {
      v = await mount(h); const status = v.status, allocationCount = h.records.buffers.length;
      refuse(await v.resize(66, 3), 'UNSUPPORTED'); refuse(await v.resize(65, 4), 'UNSUPPORTED');
      assert.equal(h.records.buffers.length, allocationCount); assert.deepEqual(v.status, status);
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
    for (const phase of ['createBindGroupLayout', 'createPipelineLayout', 'createShaderModule', 'compilation', 'pipeline', 'createBuffer', 'writeBuffer', 'createTexture', 'createView', 'createBindGroup', 'createCommandEncoder', 'beginRenderPass', 'finish', 'pushScope', 'popScope', 'submit:render', 'workDone:render']) {
      await withMounted(async (h, v) => {
        const original = signed(v.originals), status = v.status, selection = input.frame.scene.entries[1].ref; success(v.select(selection));
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
      success(v.select(input.frame.scene.entries[1].ref)); independent(v.selected, input.frame.scene.entries[1].ref); independent(v.selected, v.selected); frozen(v.selected);
      refuse(v.select({ modelId: 'other', geometryId: 'plane_nonunit' }), 'INPUT');
      const reordered = copy(input); reordered.frame.scene.entries.reverse(); success(await v.updateFrame(reordered)); assert.deepEqual(v.selected, input.frame.scene.entries[1].ref);
      assert.deepEqual(await v.pick(0, 0), { generation: 2, ref: input.frame.scene.entries[1].ref });
      const removed = copy(input); removed.frame.scene.entries.splice(1); removed.frame.materials.splice(1); success(await v.updateFrame(removed)); assert.equal(v.selected, null);
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

  test('mount refuses foreign canvas and duplicate claim, restores initial dimensions and cleans every initial failure', async () => {
    const h = createSoftwarePlatform(); let v;
    try {
      await assert.rejects(gpu.mountNativeDirectionalLightWebGPUViewport({}, input, { width: WIDTH, height: HEIGHT }), error => err(error, 'INPUT'));
      v = await mount(h); const calls = h.records.adapterRequests.length;
      await assert.rejects(mount(h), error => err(error, 'STATE')); assert.equal(h.records.adapterRequests.length, calls);
    } finally { if (v) v.dispose(); h.restore(); }
    for (const phase of ['requestDevice', 'pipeline', 'writeBuffer', 'createTexture', 'getCurrentTexture', 'workDone:present']) {
      const h = createSoftwarePlatform();
      try {
        const before = [h.canvas.width, h.canvas.height], primary = h.failNext(phase);
        await assert.rejects(mount(h), error => { assert.ok(['INIT', 'RENDER'].includes(error.code));
          const causes = []; const walk = item => { causes.push(item); if (item && Object.hasOwn(item, 'cause')) walk(item.cause); if (item instanceof AggregateError) item.errors.forEach(walk); }; walk(error);
          assert.ok(causes.includes(primary)); return true; });
        assert.deepEqual([h.canvas.width, h.canvas.height], before);
        if (phase !== 'requestDevice') { h.assertReleased(); assert.equal(h.unconfigured, 1); }
        h.enqueue('requestAdapter', () => null); await assert.rejects(mount(h), error => err(error, 'UNSUPPORTED'));
      } finally { h.restore(); }
    }
  });

  test('all eleven device limit values must be safe integers, and exact minima are sufficient', async () => {
    for (const name of Object.keys(createSoftwareLimitValues())) for (const value of [NaN, Infinity, 12.5, Number.MAX_SAFE_INTEGER + 1, undefined]) {
      const h = createSoftwarePlatform({ limits: { [name]: value } });
      try { await assert.rejects(mount(h), error => err(error, 'UNSUPPORTED')); assert.equal(h.records.buffers.length, 0); assert.equal(h.records.textures.length, 0); h.assertReleased(); }
      finally { h.restore(); }
    }
    const h = createSoftwarePlatform({ limits: { maxTextureDimension2D: WIDTH, maxBufferSize: 1536, maxUniformBufferBindingSize: 144,
      maxColorAttachments: 2, maxColorAttachmentBytesPerSample: 12, maxVertexBuffers: 2, maxVertexAttributes: 2,
      maxBindGroups: 1, maxVertexBufferArrayStride: 12, maxUniformBuffersPerShaderStage: 4, maxBindingsPerBindGroup: 4 } }); let v;
    try { v = await mount(h); assert.deepEqual(v.status.limits, h.limits); assert.equal(Object.keys(v.status.limits).length, 11); assert.equal((await v.readPixels()).length, WIDTH * HEIGHT * 4); }
    finally { if (v) v.dispose(); h.restore(); }
  });

  test('readback failures preserve accepted state; cleanup failure attempts unmap and destroy then becomes terminal', async () => {
    for (const phase of ['createBuffer', 'copyTextureToBuffer', 'submit:readback', 'workDone:readback', 'map', 'getMappedRange']) {
      await withMounted(async (h, v) => {
        const original = signed(v.originals), status = v.status, count = h.records.buffers.length, primary = h.failNext(phase);
        await assert.rejects(v.readPixels(), error => { err(error, 'RENDER'); assert.strictEqual(error.cause, primary); return true; });
        assert.deepEqual(v.status, status); assert.equal(signed(v.originals), original);
        for (const resource of h.records.buffers.slice(count)) { assert.equal(resource.destroyCount, 1); assert.equal(resource.unmapCount, 1); }
        assert.equal((await v.readPixels()).length, WIDTH * HEIGHT * 4);
      });
    }
    await withMounted(async (h, v) => {
      h.enqueue('getMappedRange', () => new ArrayBuffer(1)); await assert.rejects(v.readPixels(), error => err(error, 'RENDER'));
      assert.equal(v.status.state, 'ready');
      const primary = h.failNext('map'), unmap = h.failNext('unmap'), destroy = h.failNext('destroyBuffer');
      await assert.rejects(v.readPixels(), error => { err(error, 'RENDER'); assert.ok(error.cause instanceof AggregateError);
        assert.ok(error.cause.errors.includes(unmap)); assert.ok(error.cause.errors.includes(destroy)); assert.equal(error.cause.errors[0].cause, primary); return true; });
      assert.equal(v.status.state, 'failed'); h.assertReleased();
    });
  });

  test('runtime pipeline and map deadlines are terminal, cancel locks, and cannot resurrect late results', async () => {
    for (const phase of ['pipeline', 'map']) await withMounted(async (h, v) => {
      const timers = new Map(), originalSet = globalThis.setTimeout, originalClear = globalThis.clearTimeout; let next = 0;
      globalThis.setTimeout = (callback, delay) => { assert.equal(delay, 10000); const id = ++next; timers.set(id, callback); return id; };
      globalThis.clearTimeout = id => { timers.delete(id); };
      try {
        const original = signed(v.originals), gate = h.gateNext(phase), before = h.calls.get(phase) ?? 0;
        const pending = phase === 'pipeline' ? v.updateFrame(input) : v.readPixels();
        const result = phase === 'pipeline' ? pending : assert.rejects(pending, error => err(error, 'STATE'));
        await reached(h, phase, before); assert.equal(timers.size, 1); const resource = phase === 'map' ? h.records.buffers.at(-1) : null;
        [...timers.values()][0](); if (phase === 'pipeline') refuse(await result, 'STATE'); else await result;
        assert.equal(v.status.state, 'failed'); assert.equal(v.status.generation, 1); assert.equal(signed(v.originals), original); h.assertReleased();
        const unmaps = resource?.unmapCount; gate.resolve({}); await drain(); assert.equal(v.status.generation, 1); assert.equal(timers.size, 0); h.assertReleased();
        if (resource) { assert.equal(resource.unmapCount, unmaps + 1); assert.equal(resource.mapped, false); }
        refuse(await v.updateFrame(input), 'STATE');
      } finally { globalThis.setTimeout = originalSet; globalThis.clearTimeout = originalClear; }
    });
  });

  test('backing mutations after pending compilation/readback are refused without accepting host resize', async () => {
    for (const phase of ['pipeline', 'map']) await withMounted(async (h, v) => {
      const original = signed(v.originals), status = v.status, gate = h.gateNext(phase), before = h.calls.get(phase) ?? 0;
      const pending = phase === 'pipeline' ? v.updateFrame(input) : v.readPixels();
      const observed = phase === 'pipeline' ? pending : assert.rejects(pending, error => err(error, 'STATE'));
      await reached(h, phase, before); h.canvas.height++; gate.resolve({});
      if (phase === 'pipeline') refuse(await observed, 'STATE'); else await observed;
      assert.equal(h.canvas.height, HEIGHT + 1); assert.equal(signed(v.originals), original); assert.deepEqual(v.status, status);
      h.canvas.height--; success(await v.updateFrame(input));
    });
  });

  test('dispose attempts every owned release despite multiple failures; committed old cleanup failure is terminal', async () => {
    const h = createSoftwarePlatform(); let v;
    try {
      v = await mount(h); success(v.select(input.frame.scene.entries[0].ref));
      const markers = ['destroyBuffer', 'destroyTexture', 'unconfigure', 'destroyDevice'].map(phase => h.failNext(phase));
      assert.throws(() => v.dispose(), error => { err(error, 'RENDER'); assert.ok(error.cause instanceof AggregateError);
        for (const marker of markers) assert.ok(error.cause.errors.includes(marker)); return true; });
      assert.equal(v.selected, null); assert.equal(v.status.state, 'disposed'); assert.ok(Object.values(v.status.resources).every(value => value === 0));
      v.dispose(); h.assertReleased(); assert.equal(h.unconfigured, 1);
    } finally { h.restore(); }
    await withMounted(async (h, v) => {
      h.failNext('destroyBuffer'); const error = refuse(await v.updateFrame(input), 'RENDER'); assert.ok(error.cause instanceof AggregateError);
      assert.equal(v.status.state, 'failed'); assert.equal(v.status.generation, 2); assert.ok(Object.values(v.status.resources).every(value => value === 0)); h.assertReleased();
    });
  });


  test('settled compilation/pipeline waits cannot acquire anything after disposal before their continuation', async () => {
    for (const phase of ['compilation', 'pipeline']) await withMounted(async (h, v) => {
      const original = signed(v.originals), gate = h.gateNext(phase), before = h.calls.get(phase) ?? 0;
      const pending = v.updateFrame(input); await reached(h, phase, before);
      const buffers = h.records.buffers.length, pipelines = h.records.pipelines.length, uploads = h.records.uploads.length;
      // wait() registered its fulfillment first. This reaction disposes after that
      // fulfillment resolves the wait but before create() resumes its await.
      const disposed = gate.promise.then(() => v.dispose());
      gate.resolve(phase === 'compilation' ? { messages: [] } : {});
      refuse(await pending, 'STATE'); await disposed; await drain();
      assert.equal(v.status.state, 'disposed'); assert.equal(v.status.generation, 1); assert.equal(signed(v.originals), original);
      assert.equal(h.records.pipelines.length, pipelines, 'No late pipeline acquired after cleanup');
      assert.equal(h.records.buffers.length, buffers, 'No late buffer acquired after cleanup');
      assert.equal(h.records.uploads.length, uploads, 'No upload after cleanup');
      assert.ok(Object.values(v.status.resources).every(value => value === 0)); h.assertReleased();
    });
  });

  test('disposal or loss while readback scopes finish cannot start mapping released readback', async () => {
    for (const event of ['dispose', 'loss']) await withMounted(async (h, v) => {
      const gate = h.gateNext('popScope'), before = h.calls.get('popScope') ?? 0, maps = h.calls.get('map') ?? 0;
      const pending = v.readPixels(), refusal = assert.rejects(pending, error => err(error, event === 'dispose' ? 'STATE' : 'DEVICE_LOST'));
      await reached(h, 'popScope', before);
      const released = gate.promise.then(() => { if (event === 'dispose') v.dispose(); else h.lost.resolve({ reason: 'unknown', message: 'loss before mapping' }); });
      gate.resolve(null); await released; await refusal; await drain();
      assert.equal(h.calls.get('map') ?? 0, maps); assert.equal(v.status.generation, 1);
      assert.equal(v.status.state, event === 'dispose' ? 'disposed' : 'lost'); h.assertReleased();
    });
  });

  test('host backing mutation during adapter await refuses before requesting a device', async () => {
    const h = createSoftwarePlatform();
    try {
      const gate = h.gateNext('requestAdapter'), pending = mount(h); await reached(h, 'requestAdapter');
      h.canvas.width++; gate.resolve(h.adapter); await assert.rejects(pending, error => err(error, 'STATE'));
      assert.equal(h.records.deviceRequests.length, 0); assert.equal(h.records.buffers.length, 0); assert.equal(h.records.textures.length, 0); assert.equal(h.destroyed, 0);
      h.enqueue('requestAdapter', () => null); await assert.rejects(mount(h), error => err(error, 'UNSUPPORTED'));
    } finally { h.restore(); }
  });

}
