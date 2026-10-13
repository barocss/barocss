import { preparePrimitiveSceneFrame } from './primitive-frame-preflight.js';
import type { PreparedPrimitiveSceneFrame, PrimitiveSceneCpuFrameV0 } from './primitive-frame-preflight.js';
import { mountPrimitiveViewport } from './primitive-scene-renderer.js';
import type { PrimitiveSceneRef, PrimitiveViewport } from './primitive-scene-renderer.js';
import type { UpdateResult } from './renderer.js';
import { prepareCamera } from './camera.js';
import { lowerMeshMaterialWGSL } from './mesh-material-wgsl.js';
import { releasePrimitiveReadback } from './primitive-readback-lifetime.js';
import type { PrimitiveReadbackLease } from './primitive-readback-lifetime.js';
import type { GPUBufferHandle, GPUTextureHandle, GPUPipelineHandle, GPUDeviceHandle,
  GPUPlatformHandle, GPUCanvasHandle } from './webgpu-platform.js';

export const PrimitiveBackendDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', PROFILE: 'PROFILE', BUDGET: 'BUDGET', UNSUPPORTED: 'UNSUPPORTED',
  INIT: 'INIT', DEVICE_LOST: 'DEVICE_LOST', RENDER: 'RENDER', STATE: 'STATE', BUSY: 'BUSY',
} as const);
export type PrimitiveBackendDiagnosticCode = keyof typeof PrimitiveBackendDiagnosticCode;
export class PrimitiveBackendError extends Error {
  constructor(readonly code: PrimitiveBackendDiagnosticCode, message: string) {
    super(message.slice(0, 1024)); this.name = 'PrimitiveBackendError';
  }
}
export type PrimitiveBackendMode = 'webgpu' | 'webgl2' | 'auto';
export interface PrimitiveBackendOptions { backend: PrimitiveBackendMode; fallbackCanvas: HTMLCanvasElement | null }
export interface PrimitiveBackendLimits {
  maxTextureDimension2D: number; maxBufferSize: number; maxUniformBufferBindingSize: number;
  maxColorAttachments: number; maxColorAttachmentBytesPerSample: number; maxVertexBuffers: number;
  maxVertexAttributes: number; maxBindGroups: number; maxVertexBufferArrayStride: number;
}
export interface PrimitiveBackendStatus {
  backend: 'webgpu' | 'webgl2'; state: 'ready' | 'lost' | 'disposed' | 'failed';
  generation: number; fallbackReason: string | null; limits: PrimitiveBackendLimits | null;
}
export interface PrimitiveBackendPick { generation: number; ref: PrimitiveSceneRef | null }
export interface PreparedWebGPUPrimitiveFrame {
  readonly format: 'barocss-gpu-webgpu-primitive-frame'; readonly version: 0;
  readonly profile: 'qualified-surface-v0'; readonly frame: PreparedPrimitiveSceneFrame;
  readonly wgsl: string; readonly frameUniforms: Float32Array; readonly materialUniforms: Float32Array;
}
export interface PrimitiveBackendViewport {
  readonly canvas: HTMLCanvasElement;
  readonly frame: PrimitiveSceneCpuFrameV0;
  readonly selected: PrimitiveSceneRef | null;
  readonly status: PrimitiveBackendStatus;
  updateFrame(input: unknown): Promise<UpdateResult>;
  resize(width: number, height: number): Promise<UpdateResult>;
  readPixels(): Promise<Uint8Array>;
  pick(x: number, y: number): Promise<PrimitiveBackendPick>;
  select(ref: PrimitiveSceneRef | null): UpdateResult;
  dispose(): void;
}
function fail(code: PrimitiveBackendDiagnosticCode, message: string): never { throw new PrimitiveBackendError(code, message); }
function wrap(code: PrimitiveBackendDiagnosticCode, message: string, cause: unknown): PrimitiveBackendError {
  const error = new PrimitiveBackendError(code, message);
  Object.defineProperty(error, 'cause', { value: cause, configurable: true }); return error;
}
function dimensions(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1
    || width > 1024 || height > 1024 || width * height > 1048576) fail('BUDGET', 'Canvas dimensions require1..1024 and at most1048576 pixels');
}
function f32(value: number): number {
  const derived = Math.fround(value);
  if (!Number.isFinite(derived) || value !== 0 && derived === 0) fail('PROFILE', 'Execution coefficient overflows or underflows f32');
  return derived;
}
function own(input: unknown, keys: string[], label: string): Record<string, unknown> {
  let proto: object | null, actual: (string | symbol)[], descriptors: PropertyDescriptorMap;
  if (input === null || typeof input !== 'object') fail('INPUT', label + ' requires ordinary own data');
  try {
    proto = Object.getPrototypeOf(input); actual = Reflect.ownKeys(input); descriptors = Object.getOwnPropertyDescriptors(input);
  } catch (cause) { throw wrap('INPUT', label + ' own-data reflection refused', cause); }
  if (proto !== Object.prototype || actual.length !== keys.length || actual.some(key => typeof key !== 'string'
    || !keys.includes(key) || !Object.hasOwn(descriptors, key) || !('value' in descriptors[key]) || !descriptors[key].enumerable)) fail('INPUT', label + ' requires exact own data fields');
  return Object.fromEntries(keys.map(key => [key, descriptors[key].value]));
}
function copyRef(ref: PrimitiveSceneRef | null): PrimitiveSceneRef | null {
  return ref === null ? null : Object.freeze({ modelId: ref.modelId, geometryId: ref.geometryId });
}
function sameRef(a: PrimitiveSceneRef, b: PrimitiveSceneRef): boolean { return a.modelId === b.modelId && a.geometryId === b.geometryId; }
const MATERIAL_DECLARATION = 'struct MaterialParams { slot: array<vec4<f32>, 4>, }\n';
function shader(declarations: string, expression: string): string {
  return `struct FrameParams { view: mat4x4<f32>, projection: mat4x4<f32>, light: vec4<f32>, style: vec4<f32>, }
${declarations}
@group(0) @binding(0) var<uniform> frameParams: FrameParams;
@group(0) @binding(1) var<uniform> materialParams: MaterialParams;
struct VertexOutput { @builtin(position) position: vec4<f32>, @location(0) normal: vec3<f32>, }
@vertex fn vertexMain(@location(0) position: vec3<f32>, @location(1) normal: vec3<f32>) -> VertexOutput {
  var output: VertexOutput;
  let clip = frameParams.projection * frameParams.view * vec4<f32>(position, 1.0);
  output.position = vec4<f32>(clip.xy, (clip.z + clip.w) * 0.5, clip.w);
  output.normal = normal; return output;
}
fn material_mix(a: vec3<f32>, b: vec3<f32>, ratio: f32) -> vec3<f32> {
  let t = clamp(ratio, 0.0, 1.0); return a * (1.0 - t) + b * t;
}
struct FragmentOutput { @location(0) color: vec4<f32>, @location(1) identity: u32, }
@fragment fn fragmentMain(input: VertexOutput) -> FragmentOutput {
  let base = ${expression};
  let light = frameParams.style.w + frameParams.light.w * max(dot(normalize(input.normal), frameParams.light.xyz), 0.0);
  var output: FragmentOutput;
  output.color = vec4<f32>(pow(base * light, vec3<f32>(1.0 / 2.2)), 1.0);
  output.identity = 1u; return output;
}
`;
}
/** Common source/native admission and trusted derived execution data; no device work. */
export function prepareWebGPUPrimitiveFrame(input: unknown, width: number, height: number): PreparedWebGPUPrimitiveFrame {
  dimensions(width, height);
  let frame: PreparedPrimitiveSceneFrame;
  try { frame = preparePrimitiveSceneFrame(input, 'qualified-v2'); }
  catch (cause) { throw wrap('INPUT', 'Common primitive frame admission refused', cause); }
  if (frame.primitives.length !== 1 || frame.primitives[0].entry.kind !== 'surface'
    || frame.frame.options.camera === undefined || frame.frame.materials.length > 1) fail('PROFILE', 'WebGPU first profile requires one qualified Surface and explicit camera');
  const primitive = frame.primitives[0];
  if (!primitive.normals || !primitive.indices) fail('PROFILE', 'Surface execution needs admitted normals and indices');
  const camera = prepareCamera(frame.frame.options.camera, width / height);
  const lighting = frame.frame.options.lighting ?? { direction: [-0.6, 0.8, 1], ambientStrength: 0.35, directionalStrength: 0.65 };
  const directionScale = Math.max(...lighting.direction.map(Math.abs));
  const scaledDirection = lighting.direction.map(value => value / directionScale);
  const directionLength = Math.hypot(...scaledDirection);
  const frameUniforms = new Float32Array(40);
  frameUniforms.set(camera.view, 0); frameUniforms.set(camera.projection, 16);
  frameUniforms.set(scaledDirection.map(value => f32(value / directionLength)), 32);
  frameUniforms[35] = f32(lighting.directionalStrength);
  frameUniforms.set(primitive.entry.color.map(f32), 36); frameUniforms[39] = f32(lighting.ambientStrength);
  const materialUniforms = new Float32Array(16);
  let expression = 'pow(frameParams.style.xyz, vec3<f32>(2.2))', declarations = MATERIAL_DECLARATION;
  if (primitive.material) {
    const lowered = lowerMeshMaterialWGSL(primitive.material.material);
    expression = lowered.expression; declarations = lowered.declarations;
    for (const uniform of lowered.uniformLayout) {
      const descriptor = Object.getOwnPropertyDescriptor(primitive.material.uniforms, uniform.name);
      if (!descriptor || !('value' in descriptor) || typeof descriptor.value !== 'number'
        || !Number.isFinite(descriptor.value) || descriptor.value < uniform.min || descriptor.value > uniform.max)
        fail('PROFILE', 'Resolved material uniform requires an own finite declared Number');
      materialUniforms[uniform.index] = f32(descriptor.value);
    }
  }
  const wgsl = shader(declarations, expression);
  if (wgsl.length > 65536 || new TextEncoder().encode(wgsl).length > 65536) fail('BUDGET', 'Trusted WGSL exceeds64KiB');
  return Object.freeze({ format: 'barocss-gpu-webgpu-primitive-frame', version: 0, profile: 'qualified-surface-v0', frame, wgsl, frameUniforms, materialUniforms });
}

/** Observe both device-loss settlement paths without an orphaned rejection. */
function observeDeviceLoss(lost: Promise<unknown>, onSettled: () => void): void {
  const settle = (): void => {
    try { onSettled(); } catch { /* Terminal device-loss cleanup must not escape the observer. */ }
  };
  void lost.then(settle, settle);
}

const WAIT_MS = 10000;
function bounded<T>(promise: Promise<T>, label: string, late?: (value: T) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    let expired = false;
    const timer = setTimeout(() => { expired = true; reject(new PrimitiveBackendError('STATE', label + ' exceeded10s; remount required')); }, WAIT_MS);
    promise.then(value => {
      clearTimeout(timer);
      if (expired) {
        // The timeout has already rejected the public wait. A late cleanup
        // refusal must not create an unhandled rejection on this detached then.
        try { late?.(value); } catch { /* No later error can settle the completed wait. */ }
      } else resolve(value);
    }, cause => { clearTimeout(timer); if (!expired) reject(cause); });
  });
}
interface Resources {
  prepared: PreparedWebGPUPrimitiveFrame; width: number; height: number;
  buffers: GPUBufferHandle[]; textures: GPUTextureHandle[];
  pipeline: GPUPipelineHandle | null; group: object | null;
}
const COPY_DST = 8, VERTEX = 32, INDEX = 16, UNIFORM = 64, MAP_READ = 1;
const TEXTURE_COPY_SRC = 1, TEXTURE_COPY_DST = 2, RENDER_ATTACHMENT = 16;
const LIMIT_REQUIREMENTS: PrimitiveBackendLimits = {
  maxTextureDimension2D: 1024, maxBufferSize: 4194304, maxUniformBufferBindingSize: 160,
  maxColorAttachments: 2, maxColorAttachmentBytesPerSample: 8, maxVertexBuffers: 2,
  maxVertexAttributes: 2, maxBindGroups: 1, maxVertexBufferArrayStride: 12,
};
function readLimits(device: GPUDeviceHandle): PrimitiveBackendLimits {
  const result = {} as PrimitiveBackendLimits;
  for (const key of Object.keys(LIMIT_REQUIREMENTS) as (keyof PrimitiveBackendLimits)[]) {
    const value = device.limits[key];
    if (!Number.isSafeInteger(value) || value < LIMIT_REQUIREMENTS[key]) fail('UNSUPPORTED', 'Device limit insufficient: ' + key);
    result[key] = value;
  }
  return Object.freeze(result);
}
function release(resources: Resources | null): unknown[] {
  if (!resources) return [];
  const failures: unknown[] = [];
  // Clear ownership before invoking driver cleanup: callbacks and repeated
  // terminal release must never destroy a partially processed handle twice.
  const buffers = resources.buffers.splice(0), textures = resources.textures.splice(0);
  resources.pipeline = null; resources.group = null;
  for (const buffer of buffers) try { buffer.destroy(); } catch (cause) { failures.push(cause); }
  for (const texture of textures) try { texture.destroy(); } catch (cause) { failures.push(cause); }
  return failures;
}

class BackendViewport implements PrimitiveBackendViewport {
  private cpu: PreparedWebGPUPrimitiveFrame;
  private accepted: Resources | null = null;
  private candidate: Resources | null = null;
  private readback: PrimitiveReadbackLease | null = null;
  private gl: PrimitiveViewport | null = null;
  private currentSelection: PrimitiveSceneRef | null = null;
  private busy = false;
  private width: number;
  private height: number;
  private current: PrimitiveBackendStatus;
  private readonly loss = (event: Event) => { event.preventDefault(); if (this.current.state === 'ready') this.current.state = 'lost'; };
  constructor(readonly canvas: HTMLCanvasElement, prepared: PreparedWebGPUPrimitiveFrame,
    backend: 'webgpu' | 'webgl2', private readonly device: GPUDeviceHandle | null,
    private readonly context: GPUCanvasHandle | null, private readonly format: string,
    fallbackReason: string | null, limits: PrimitiveBackendLimits | null) {
    this.width = canvas.width; this.height = canvas.height;
    this.cpu = prepared; this.current = { backend, state: 'ready', generation: 0, fallbackReason, limits };
    if (device) observeDeviceLoss(device.lost, () => {
      if (this.current.state === 'disposed' || this.current.state === 'failed') return;
      this.current.state = 'lost';
      if (this.releaseOwned().length) this.current.state = 'failed';
    });
  }
  get frame(): PrimitiveSceneCpuFrameV0 { return structuredClone(this.cpu.frame.frame); }
  get selected(): PrimitiveSceneRef | null { return copyRef(this.currentSelection); }
  get status(): PrimitiveBackendStatus { return Object.freeze({ ...this.current, limits: this.current.limits === null ? null : Object.freeze({ ...this.current.limits }) }); }
  private live(): void {
    if (this.current.state === 'lost') fail('DEVICE_LOST', 'Device/context lost; explicit remount required');
    if (this.current.state !== 'ready') fail('STATE', 'Viewport is ' + this.current.state);
    if (!this.busy && (this.canvas.width !== this.width || this.canvas.height !== this.height))
      fail('STATE', 'Host changed canvas dimensions outside resize; explicit remount required');
  }
  private enter(): void { this.live(); if (this.busy) fail('BUSY', 'One asynchronous operation is already pending'); this.busy = true; }
  private terminal(error: unknown): void {
    if (error instanceof PrimitiveBackendError && error.code === 'STATE' && this.current.state === 'ready') {
      this.current.state = 'failed';
      const failures: unknown[] = [];
      try { failures.push(...this.releaseOwned()); } catch (cause) { failures.push(cause); }
      try { this.device?.destroy(); } catch (cause) { failures.push(cause); }
      // Preserve the original STATE failure while retaining every teardown refusal.
      if (failures.length) {
        const causes = error.cause === undefined ? failures : [error.cause, ...failures];
        Object.defineProperty(error, 'cause', {
          value: new AggregateError(causes, 'GPU terminal cleanup refused'), configurable: true,
        });
      }
    }
  }
  private releaseOwned(): unknown[] {
    const failures = [...release(this.accepted), ...release(this.candidate), ...releasePrimitiveReadback(this.readback)];
    this.accepted = null; this.candidate = null; this.readback = null;
    return failures;
  }
  async initialize(): Promise<void> {
    if (this.current.backend === 'webgl2') {
      this.gl = mountPrimitiveViewport(this.canvas, this.cpu.frame.frame.options);
      this.canvas.addEventListener('webglcontextlost', this.loss);
      const result = this.gl.updateFrame(this.cpu.frame.frame);
      if (!result.ok) { this.dispose(); throw result.error; }
      this.current.generation = 1;
    } else {
      this.busy = true;
      try {
        await this.scoped(async () => {
          this.context!.configure({ device: this.device, format: this.format, alphaMode: 'opaque', colorSpace: 'srgb', usage: RENDER_ATTACHMENT | TEXTURE_COPY_DST });
        });
        await this.replace(this.cpu, this.width, this.height);
      }
      catch (cause) {
        try { this.dispose(); }
        catch (cleanup) { throw wrap('RENDER', 'Viewport initialization and cleanup refused', new AggregateError([cause, cleanup])); }
        throw cause;
      }
      finally { this.busy = false; }
    }
  }
  private async scoped<T>(operation: () => Promise<T>): Promise<T> {
    const device = this.device!;
    device.pushErrorScope('out-of-memory'); device.pushErrorScope('internal'); device.pushErrorScope('validation');
    let result: T | undefined, original: unknown, failed = false;
    try { result = await operation(); } catch (cause) { failed = true; original = cause; }
    const errors: ({ message: string } | null)[] = [];
    for (let index = 0; index < 3; index++) {
      try { errors.push(await bounded(device.popErrorScope(), 'Device error scope')); }
      catch (cause) { if (!failed) { failed = true; original = cause; } }
    }
    if (failed) throw original;
    const actual = errors.find(error => error !== null);
    if (actual) throw wrap('RENDER', 'Actual GPU error: ' + actual.message, actual);
    this.live(); return result as T;
  }
  private upload(resources: Resources, data: ArrayBufferView, usage: number): GPUBufferHandle {
    const size = Math.ceil(data.byteLength / 4) * 4;
    const buffer = this.device!.createBuffer({ size, usage: usage | COPY_DST }); resources.buffers.push(buffer);
    const bytes = new Uint8Array(size); bytes.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
    this.device!.queue.writeBuffer(buffer, 0, bytes); return buffer;
  }
  private async create(prepared: PreparedWebGPUPrimitiveFrame, width: number, height: number): Promise<Resources> {
    const device = this.device!, resources: Resources = { prepared, width, height, buffers: [], textures: [], pipeline: null, group: null };
    this.candidate = resources;
    const module = device.createShaderModule({ code: prepared.wgsl });
    const compilation = await bounded(module.getCompilationInfo(), 'WGSL compilation'); this.live();
    if (compilation.messages.some(message => message.type === 'error')) fail('RENDER', 'WGSL compilation failed: ' + compilation.messages.filter(message => message.type === 'error').map(message => message.message).join('; '));
    const groupLayout = device.createBindGroupLayout({ entries: [
      { binding: 0, visibility: 3, buffer: { type: 'uniform', minBindingSize: 160 } },
      { binding: 1, visibility: 2, buffer: { type: 'uniform', minBindingSize: 64 } },
    ] });
    const pipeline = await bounded(device.createRenderPipelineAsync({
      layout: device.createPipelineLayout({ bindGroupLayouts: [groupLayout] }), vertex: { module, entryPoint: 'vertexMain', buffers: [
        { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
        { arrayStride: 12, attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }] },
      ] }, fragment: { module, entryPoint: 'fragmentMain', targets: [{ format: this.format }, { format: 'r32uint' }] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' }, multisample: { count: 1 },
    }), 'GPU pipeline'); this.live(); resources.pipeline = pipeline;
    const primitive = prepared.frame.primitives[0];
    this.upload(resources, primitive.positions, VERTEX); this.upload(resources, primitive.normals!, VERTEX);
    this.upload(resources, primitive.indices!, INDEX);
    const frameBuffer = this.upload(resources, prepared.frameUniforms, UNIFORM);
    const materialBuffer = this.upload(resources, prepared.materialUniforms, UNIFORM);
    resources.group = device.createBindGroup({ layout: groupLayout, entries: [
      { binding: 0, resource: { buffer: frameBuffer } }, { binding: 1, resource: { buffer: materialBuffer } },
    ] });
    for (const format of [this.format, 'r32uint', 'depth24plus']) resources.textures.push(device.createTexture({
      size: { width, height, depthOrArrayLayers: 1 }, format,
      usage: format === 'depth24plus' ? RENDER_ATTACHMENT : RENDER_ATTACHMENT | TEXTURE_COPY_SRC,
    }));
    const encoder = device.createCommandEncoder(), background = prepared.frame.frame.options.background;
    const pass = encoder.beginRenderPass({ colorAttachments: [
      { view: resources.textures[0].createView(), clearValue: { r: background[0], g: background[1], b: background[2], a: 1 }, loadOp: 'clear', storeOp: 'store' },
      { view: resources.textures[1].createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' },
    ], depthStencilAttachment: { view: resources.textures[2].createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' } });
    pass.setPipeline(resources.pipeline); pass.setBindGroup(0, resources.group);
    pass.setVertexBuffer(0, resources.buffers[0]); pass.setVertexBuffer(1, resources.buffers[1]);
    pass.setIndexBuffer(resources.buffers[2], 'uint16'); pass.drawIndexed(primitive.indices!.length); pass.end();
    device.queue.submit([encoder.finish()]); await bounded(device.queue.onSubmittedWorkDone(), 'GPU render submission'); this.live();
    return resources;
  }
  private async present(resources: Resources): Promise<void> {
    const encoder = this.device!.createCommandEncoder();
    encoder.copyTextureToTexture({ texture: resources.textures[0] }, { texture: this.context!.getCurrentTexture() },
      { width: resources.width, height: resources.height, depthOrArrayLayers: 1 });
    this.device!.queue.submit([encoder.finish()]); await bounded(this.device!.queue.onSubmittedWorkDone(), 'GPU presentation submission'); this.live();
  }
  private async replace(prepared: PreparedWebGPUPrimitiveFrame, width: number, height: number): Promise<void> {
    const oldWidth = this.canvas.width, oldHeight = this.canvas.height;
    let presentationAttempted = false;
    try {
      const candidate = await this.scoped(() => this.create(prepared, width, height));
      presentationAttempted = true; this.canvas.width = width; this.canvas.height = height;
      await this.scoped(() => this.present(candidate)); this.live();
      const previous = this.accepted; this.accepted = candidate; this.candidate = null;
      this.cpu = prepared; this.width = width; this.height = height; this.current.generation++; release(previous);
      if (this.currentSelection && !sameRef(this.currentSelection, prepared.frame.primitives[0].entry.ref)) this.currentSelection = null;
    } catch (cause) {
      this.terminal(cause);
      if (presentationAttempted && this.current.state === 'ready') {
        try {
          this.canvas.width = oldWidth; this.canvas.height = oldHeight;
          const accepted = this.accepted;
          if (accepted) await this.scoped(() => this.present(accepted));
        } catch (recovery) {
          this.current.state = 'failed'; this.releaseOwned(); this.device?.destroy();
          throw wrap('RENDER', 'Candidate presentation and accepted recovery failed', new AggregateError([cause, recovery]));
        }
      }
      const cleanupFailures = release(this.candidate); this.candidate = null;
      if (cleanupFailures.length)
        throw wrap('RENDER', 'Candidate operation and cleanup refused', new AggregateError([cause, ...cleanupFailures]));
      throw cause;
    }
  }
  async updateFrame(input: unknown): Promise<UpdateResult> {
    let entered = false;
    try {
      this.enter(); entered = true;
      const prepared = prepareWebGPUPrimitiveFrame(input, this.canvas.width, this.canvas.height);
      if (this.gl) {
        const result = this.gl.updateFrame(prepared.frame.frame); if (!result.ok) return result;
        this.cpu = prepared; this.current.generation++;
        if (this.currentSelection && !sameRef(this.currentSelection, prepared.frame.primitives[0].entry.ref)) this.currentSelection = null;
      } else await this.replace(prepared, this.canvas.width, this.canvas.height);
      return { ok: true };
    } catch (cause) { this.terminal(cause); return { ok: false, error: cause instanceof Error ? cause : wrap('RENDER', 'Frame update refused', cause) }; }
    finally { if (entered) this.busy = false; }
  }
  async resize(width: number, height: number): Promise<UpdateResult> {
    let entered = false;
    try {
      this.enter(); entered = true;
      const prepared = prepareWebGPUPrimitiveFrame(this.cpu.frame.frame, width, height);
      if (this.gl) { this.gl.resize(width, height); this.cpu = prepared; this.width = width; this.height = height; this.current.generation++; }
      else await this.replace(prepared, width, height);
      return { ok: true };
    } catch (cause) { this.terminal(cause); return { ok: false, error: cause instanceof Error ? cause : wrap('RENDER', 'Resize refused', cause) }; }
    finally { if (entered) this.busy = false; }
  }
  private async download(identity: boolean, x = 0, y = 0): Promise<Uint8Array> {
    const frame = this.accepted!, width = identity ? 1 : frame.width, height = identity ? 1 : frame.height;
    const rowBytes = Math.ceil(width * 4 / 256) * 256;
    const device = this.device!;
    let readback: PrimitiveReadbackLease | null = null;
    let resultPixels: Uint8Array | undefined;
    let originalError: unknown, failed = false;
    let cleanupError: PrimitiveBackendError | undefined;
    try {
      await this.scoped(async () => {
        readback = { buffer: device.createBuffer({ size: rowBytes * height, usage: MAP_READ | COPY_DST }), unmapped: false, destroyed: false, failures: [] };
        this.readback = readback;
        const buffer = readback.buffer;
        const encoder = device.createCommandEncoder();
        encoder.copyTextureToBuffer({ texture: frame.textures[identity ? 1 : 0], origin: { x, y, z: 0 } },
          { buffer, bytesPerRow: rowBytes, rowsPerImage: height }, { width, height, depthOrArrayLayers: 1 });
        device.queue.submit([encoder.finish()]); await bounded(device.queue.onSubmittedWorkDone(), 'GPU readback submission');
      });
      const mappedBuffer = (readback as PrimitiveReadbackLease | null)?.buffer ?? null;
      if (!mappedBuffer) fail('RENDER', 'Readback allocation did not complete');
      await bounded(mappedBuffer.mapAsync(1), 'GPU readback map', () => { releasePrimitiveReadback(readback); }); this.live();
      const padded = new Uint8Array(mappedBuffer.getMappedRange()), result = new Uint8Array(width * height * 4);
      for (let row = 0; row < height; row++) result.set(padded.subarray(row * rowBytes, row * rowBytes + width * 4), row * width * 4);
      if (!identity && this.format === 'bgra8unorm') for (let offset = 0; offset < result.length; offset += 4) [result[offset], result[offset + 2]] = [result[offset + 2], result[offset]];
      resultPixels = result;
    } catch (cause) {
      failed = true; originalError = cause;
    } finally {
      const failures = releasePrimitiveReadback(readback);
      if (this.readback === readback) this.readback = null;
      if (failures.length)
        cleanupError = wrap('RENDER', 'GPU readback cleanup refused', new AggregateError(failed ? [originalError, ...failures] : failures));
    }
    if (cleanupError) throw cleanupError;
    if (failed) throw originalError;
    if (!resultPixels) fail('RENDER', 'Readback produced no pixels');
    return resultPixels;
  }
  async readPixels(): Promise<Uint8Array> {
    let entered = false;
    try {
      this.enter(); entered = true;
      if (!this.gl) return await this.download(false);
      const raw = this.gl.readPixels(), width = this.canvas.width, height = this.canvas.height, result = new Uint8Array(raw.length);
      for (let y = 0; y < height; y++) result.set(raw.subarray((height - 1 - y) * width * 4, (height - y) * width * 4), y * width * 4);
      return result;
    } catch (cause) { this.terminal(cause); throw cause; }
    finally { if (entered) this.busy = false; }
  }
  async pick(x: number, y: number): Promise<PrimitiveBackendPick> {
    let entered = false;
    try {
      this.enter(); entered = true;
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= this.canvas.width || y >= this.canvas.height) fail('INPUT', 'Pick requires a bounded integer top-left canvas pixel');
      if (this.gl) fail('UNSUPPORTED', 'WebGL2 fallback does not implement this identity attachment');
      const generation = this.current.generation, pixels = await this.download(true, x, y), id = new DataView(pixels.buffer).getUint32(0, true);
      if (id !== 0 && id !== 1) fail('RENDER', 'Actual identity attachment contained an unsupported identity');
      return Object.freeze({ generation, ref: id === 0 ? null : copyRef(this.cpu.frame.primitives[0].entry.ref) });
    } catch (cause) { this.terminal(cause); throw cause; }
    finally { if (entered) this.busy = false; }
  }
  select(input: PrimitiveSceneRef | null): UpdateResult {
    try {
      this.live(); if (this.busy) fail('BUSY', 'Selection refused during pending operation');
      if (input === null) this.currentSelection = null;
      else {
        const data = own(input, ['modelId', 'geometryId'], 'Selection');
        if (typeof data.modelId !== 'string' || typeof data.geometryId !== 'string') fail('INPUT', 'Selection identity requires strings');
        const ref = { modelId: data.modelId, geometryId: data.geometryId };
        if (!sameRef(ref, this.cpu.frame.primitives[0].entry.ref)) fail('PROFILE', 'Selection is outside the admitted qualified Surface');
        this.currentSelection = copyRef(ref);
      }
      return { ok: true };
    } catch (cause) { return { ok: false, error: cause instanceof Error ? cause : wrap('INPUT', 'Selection refused', cause) }; }
  }
  dispose(): void {
    if (this.current.state === 'disposed') return;
    this.current.state = 'disposed'; this.currentSelection = null;
    const failures: unknown[] = [];
    try { failures.push(...this.releaseOwned()); } catch (cause) { failures.push(cause); }
    try { this.canvas.removeEventListener('webglcontextlost', this.loss); } catch (cause) { failures.push(cause); }
    const gl = this.gl; this.gl = null;
    try { gl?.dispose(); } catch (cause) { failures.push(cause); }
    try { this.context?.unconfigure(); } catch (cause) { failures.push(cause); }
    try { this.device?.destroy(); } catch (cause) { failures.push(cause); }
    if (failures.length)
      throw wrap('RENDER', 'Viewport disposal cleanup refused', new AggregateError(failures));
  }
}
function canvasElement(input: unknown): asserts input is HTMLCanvasElement {
  if (typeof HTMLCanvasElement === 'undefined' || !(input instanceof HTMLCanvasElement)) fail('INPUT', 'Backend requires an actual current-realm HTMLCanvasElement');
  dimensions(input.width, input.height);
}
/** Opt-in only: startup fallback is distinct from terminal device loss. */
export async function mountPrimitiveBackendViewport(canvas: HTMLCanvasElement, input: unknown,
  options: PrimitiveBackendOptions): Promise<PrimitiveBackendViewport> {
  canvasElement(canvas);
  const data = own(options, ['backend', 'fallbackCanvas'], 'Backend options');
  if (data.backend !== 'webgpu' && data.backend !== 'webgl2' && data.backend !== 'auto') fail('INPUT', 'Unsupported backend mode');
  if (data.fallbackCanvas !== null) { canvasElement(data.fallbackCanvas); if (data.fallbackCanvas === canvas) fail('INPUT', 'Fallback canvas must be distinct'); }
  const width = canvas.width, height = canvas.height;
  const prepared = prepareWebGPUPrimitiveFrame(input, width, height);
  const fallback = async (target: HTMLCanvasElement, reason: string | null): Promise<PrimitiveBackendViewport> => {
    if (canvas.width !== width || canvas.height !== height) fail('STATE', 'Host changed canvas dimensions during mount');
    target.width = width; target.height = height;
    const viewport = new BackendViewport(target, prepared, 'webgl2', null, null, '', reason, null);
    try { await viewport.initialize(); return viewport; }
    catch (cause) {
      try { viewport.dispose(); }
      catch (cleanup) { throw wrap('RENDER', 'Fallback initialization and cleanup refused', new AggregateError([cause, cleanup])); }
      throw cause;
    }
  };
  if (data.backend === 'webgl2') return fallback(canvas, null);
  let device: GPUDeviceHandle | null = null, context: GPUCanvasHandle | null = null;
  try {
    const platform = (navigator as Navigator & { gpu?: GPUPlatformHandle }).gpu;
    if (!platform) fail('UNSUPPORTED', 'navigator.gpu unavailable');
    const adapter = await bounded(platform.requestAdapter(), 'GPU adapter request');
    if (!adapter) fail('UNSUPPORTED', 'No admitted WebGPU adapter');
    device = await bounded(adapter.requestDevice({ requiredFeatures: [] }), 'GPU device request', late => late.destroy());
    const limits = readLimits(device), format = platform.getPreferredCanvasFormat();
    if (format !== 'rgba8unorm' && format !== 'bgra8unorm') fail('UNSUPPORTED', 'Preferred canvas format outside unorm first profile');
    if (canvas.width !== width || canvas.height !== height) fail('STATE', 'Host changed canvas dimensions during mount');
    context = canvas.getContext('webgpu') as unknown as GPUCanvasHandle | null;
    if (!context) fail('INIT', 'Cannot acquire WebGPU canvas context');
    const viewport = new BackendViewport(canvas, prepared, 'webgpu', device, context, format, null, limits);
    await viewport.initialize(); return viewport;
  } catch (cause) {
    context?.unconfigure(); device?.destroy();
    if (data.backend !== 'auto') throw cause instanceof PrimitiveBackendError ? cause : wrap('INIT', 'WebGPU initialization failed', cause);
    const target = context === null ? canvas : data.fallbackCanvas as HTMLCanvasElement | null;
    if (target === null) throw wrap('INIT', 'WebGPU context acquired; startup fallback requires explicit fresh canvas', cause);
    return fallback(target, (cause instanceof Error ? cause.message : 'WebGPU initialization refused').slice(0, 1024));
  }
}
