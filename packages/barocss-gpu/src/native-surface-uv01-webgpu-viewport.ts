import { prepareNativeSurfaceUV01Frame } from './native-surface-uv01-frame.js';
import type { PreparedNativeSurfaceUV01Frame, NativeSurfaceUV01FrameRequest,
  NativeSurfaceUV01FrameResources } from './native-surface-uv01-frame.js';
import { copyGpuData, freezeGpuData } from './gpu-data.js';
import type { PrimitiveSceneRef } from './primitive-scene-renderer.js';
import type { UpdateResult } from './renderer.js';
import type { GPUBufferHandle, GPUTextureHandle, GPUPipelineHandle, GPUDeviceHandle,
  GPUPlatformHandle, GPUCanvasHandle } from './webgpu-platform.js';
import { webgpuViewportCanvasClaims as claims } from './webgpu-canvas-claims.js';

/** Required-WebGPU route diagnostics; provider diagnostics remain the exact FRAME cause. */
export const NativeSurfaceUV01WebGPUDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', FRAME: 'FRAME', BUDGET: 'BUDGET', UNSUPPORTED: 'UNSUPPORTED', INIT: 'INIT',
  DEVICE_LOST: 'DEVICE_LOST', RENDER: 'RENDER', STATE: 'STATE', BUSY: 'BUSY',
} as const);
export type NativeSurfaceUV01WebGPUDiagnosticCode = typeof NativeSurfaceUV01WebGPUDiagnosticCode[keyof typeof NativeSurfaceUV01WebGPUDiagnosticCode];
export class NativeSurfaceUV01WebGPUError extends Error {
  constructor(readonly code: NativeSurfaceUV01WebGPUDiagnosticCode, message: string, ...cause: [] | [unknown]) {
    super(message.slice(0, 1024), cause.length ? { cause: cause[0] } : undefined);
    this.name = 'NativeSurfaceUV01WebGPUError';
  }
}
export interface NativeSurfaceUV01WebGPUOptions { readonly width: number; readonly height: number }
export interface NativeSurfaceUV01WebGPULimits {
  readonly maxTextureDimension2D: number; readonly maxBufferSize: number; readonly maxUniformBufferBindingSize: number;
  readonly maxColorAttachments: number; readonly maxColorAttachmentBytesPerSample: number;
  readonly maxVertexBuffers: number; readonly maxVertexAttributes: number; readonly maxBindGroups: number;
  readonly maxVertexBufferArrayStride: number; readonly maxUniformBuffersPerShaderStage: number;
  readonly maxBindingsPerBindGroup: number;
}
export interface NativeSurfaceUV01WebGPUStatus {
  readonly backend: 'webgpu'; readonly profile: 'source0-native-surface-uv01-webgpu-v0';
  readonly state: 'ready' | 'lost' | 'failed' | 'disposed'; readonly generation: number;
  readonly width: number; readonly height: number; readonly limits: NativeSurfaceUV01WebGPULimits;
  readonly resources: Readonly<NativeSurfaceUV01FrameResources>;
}
export interface NativeSurfaceUV01WebGPUPick { readonly generation: number; readonly ref: PrimitiveSceneRef | null }

function reflect<T>(action: () => T): T {
  try { return action(); } catch (cause) { throw new NativeSurfaceUV01WebGPUError('INPUT', 'Own data reflection refused', cause); }
}
function record(input: unknown, fields: readonly string[]): Record<string, unknown> {
  if (input === null || typeof input !== 'object' || reflect(() => Object.getPrototypeOf(input)) !== Object.prototype)
    fail('INPUT', 'Exact current-realm own plain data required');
  const keys = reflect(() => Reflect.ownKeys(input));
  if (keys.length !== fields.length || keys.some(key => typeof key !== 'string' || !fields.includes(key)))
    fail('INPUT', 'Fields must exactly match the contract');
  return Object.fromEntries(fields.map(name => {
    const descriptor = reflect(() => Object.getOwnPropertyDescriptor(input, name));
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) fail('INPUT', 'Fields require own enumerable data');
    return [name, descriptor.value];
  }));
}
function validateNativeSurfaceUV01WebGPUOptions(input: unknown): NativeSurfaceUV01WebGPUOptions {
  const data = record(input, ['width', 'height']);
  for (const size of [data.width, data.height]) {
    if (typeof size !== 'number' || !Number.isFinite(size) || !Number.isInteger(size)) fail('INPUT', 'Dimensions require finite integers');
    if (size < 1 || size > 1024) fail('BUDGET', 'Dimensions exceed 1..1024');
  }
  const width = data.width as number, height = data.height as number;
  if (width * height > 1048576) fail('BUDGET', 'Canvas pixel count exceeds 1048576');
  return Object.freeze({ width, height });
}
function validateNativeSurfaceUV01WebGPURef(input: unknown): PrimitiveSceneRef {
  const data = record(input, ['modelId', 'geometryId']);
  for (const value of Object.values(data)) {
    if (typeof value !== 'string' || !/^[A-Za-z_][A-Za-z0-9_.:-]{0,63}$/.test(value))
      fail('INPUT', 'Qualified references require bounded ASCII identifiers');
  }
  return Object.freeze({ modelId: data.modelId as string, geometryId: data.geometryId as string });
}
/** The real provider is invoked once, synchronously before the first device await. */
function prepare(input: unknown, width: number, height: number): PreparedNativeSurfaceUV01Frame {
  try { return prepareNativeSurfaceUV01Frame(input, width, height); }
  catch (cause) { throw new NativeSurfaceUV01WebGPUError('FRAME', 'Native Surface UV01 frame provider refused', cause); }
}
function assertResidency(accepted: PreparedNativeSurfaceUV01Frame | null, candidate: PreparedNativeSurfaceUV01Frame): void {
  if (candidate.resources.chargedBytes > 33554432 || candidate.resources.chargedBytes
    + (accepted?.resources.chargedBytes ?? 0)
    + Math.max(256, candidate.resources.readbackBytes, accepted?.resources.readbackBytes ?? 0) > 67108864)
    fail('BUDGET', 'Accepted plus candidate logical resources and maximum readback exceed budget');
}
function assertCandidateLimits(candidate: PreparedNativeSurfaceUV01Frame, actual: NativeSurfaceUV01WebGPULimits): void {
  if (candidate.viewport.width > actual.maxTextureDimension2D || candidate.viewport.height > actual.maxTextureDimension2D)
    fail('UNSUPPORTED', 'Candidate dimensions exceed actual device limits');
  if (Math.max(256, candidate.resources.readbackBytes) > actual.maxBufferSize)
    fail('UNSUPPORTED', 'Candidate readback exceeds actual buffer limit');
  for (const draw of candidate.draws) {
    for (const bytes of [draw.positions, draw.normals, draw.uv01, draw.indices,
      draw.uniforms.frame, draw.uniforms.material, draw.uniforms.draw]) {
      if (bytes.byteLength > actual.maxBufferSize) fail('UNSUPPORTED', 'Candidate upload exceeds actual buffer limit');
    }
  }
}

export interface NativeSurfaceUV01WebGPUViewport {
  readonly canvas: HTMLCanvasElement;
  readonly originals: NativeSurfaceUV01FrameRequest;
  readonly selected: PrimitiveSceneRef | null;
  readonly status: NativeSurfaceUV01WebGPUStatus;
  updateFrame(input: unknown): Promise<UpdateResult>;
  resize(width: number, height: number): Promise<UpdateResult>;
  readPixels(): Promise<Uint8Array>;
  pick(x: number, y: number): Promise<NativeSurfaceUV01WebGPUPick>;
  select(ref: PrimitiveSceneRef | null): UpdateResult;
  dispose(): void;
}

const WAIT_MS = 10000, COPY_DST = 8, VERTEX = 32, INDEX = 16, UNIFORM = 64, MAP_READ = 1;
const TEXTURE_COPY_SRC = 1, TEXTURE_COPY_DST = 2, RENDER_ATTACHMENT = 16;
// Render-target cost is rgba8unorm(8) + r32uint(4), distinct from packed storage(4+4).
const requirements: NativeSurfaceUV01WebGPULimits = {
  maxTextureDimension2D: 1, maxBufferSize: 256, maxUniformBufferBindingSize: 160,
  maxColorAttachments: 2, maxColorAttachmentBytesPerSample: 12, maxVertexBuffers: 3,
  maxVertexAttributes: 3, maxBindGroups: 1, maxVertexBufferArrayStride: 12, maxUniformBuffersPerShaderStage: 3, maxBindingsPerBindGroup: 3,
};
function fail(code: NativeSurfaceUV01WebGPUDiagnosticCode, message: string): never { throw new NativeSurfaceUV01WebGPUError(code, message); }
function owned(cause: unknown, code: NativeSurfaceUV01WebGPUDiagnosticCode, message: string): NativeSurfaceUV01WebGPUError {
  return cause instanceof NativeSurfaceUV01WebGPUError ? cause : new NativeSurfaceUV01WebGPUError(code, message, cause);
}
function aggregate(errors: unknown[]): AggregateError {
  const result = new AggregateError(errors); Object.freeze(result.errors); return result;
}
function combined(primary: unknown, failures: unknown[], message: string): NativeSurfaceUV01WebGPUError {
  return new NativeSurfaceUV01WebGPUError('RENDER', message, aggregate([primary, ...failures]));
}
function same(a: PrimitiveSceneRef, b: PrimitiveSceneRef): boolean { return a.modelId === b.modelId && a.geometryId === b.geometryId; }
function refCopy(ref: PrimitiveSceneRef | null): PrimitiveSceneRef | null {
  return ref === null ? null : Object.freeze({ modelId: ref.modelId, geometryId: ref.geometryId });
}
function limits(device: GPUDeviceHandle): NativeSurfaceUV01WebGPULimits {
  const result = {} as { -readonly [Key in keyof NativeSurfaceUV01WebGPULimits]: number };
  for (const key of Object.keys(requirements) as (keyof NativeSurfaceUV01WebGPULimits)[]) {
    const value = device.limits[key];
    if (!Number.isSafeInteger(value) || value < requirements[key]) fail('UNSUPPORTED', 'Insufficient device limit: ' + key);
    result[key] = value;
  }
  return Object.freeze(result);
}
function zeroResources(): NativeSurfaceUV01FrameResources {
  return Object.freeze({ geometryBytes: 0, uniformBytes: 0, colorIdentityBytes: 0, depthTexels: 0,
    depthBudgetBytes: 0, chargedBytes: 0, readbackBytes: 0, buffers: 0, textures: 0, bindGroups: 0, pipelines: 0 });
}
interface Draw { pipeline: GPUPipelineHandle; group: object; position: GPUBufferHandle; normal: GPUBufferHandle; uv01: GPUBufferHandle; index: GPUBufferHandle; count: number }
interface Candidate {
  prepared: PreparedNativeSurfaceUV01Frame; buffers: GPUBufferHandle[]; textures: GPUTextureHandle[];
  draws: Draw[]; modules: object[]; released: boolean;
}
interface Readback { buffer: GPUBufferHandle; released: boolean }
function release(candidate: Candidate | null): unknown[] {
  if (!candidate || candidate.released) return [];
  candidate.released = true; const failures: unknown[] = [];
  for (const buffer of candidate.buffers) try { buffer.destroy(); } catch (cause) { failures.push(cause); }
  for (const texture of candidate.textures) try { texture.destroy(); } catch (cause) { failures.push(cause); }
  candidate.buffers.length = 0; candidate.textures.length = 0; candidate.draws.length = 0; candidate.modules.length = 0;
  return failures;
}
function releaseReadback(readback: Readback | null): unknown[] {
  if (!readback || readback.released) return [];
  readback.released = true; const failures: unknown[] = [];
  try { readback.buffer.unmap(); } catch (cause) { failures.push(cause); }
  try { readback.buffer.destroy(); } catch (cause) { failures.push(cause); }
  return failures;
}
/** Keep the timed-out error observable if destroying a device returned late also fails. */
function appendCleanup(error: NativeSurfaceUV01WebGPUError, failures: unknown[]): void {
  if (!failures.length) return;
  const causes = Object.hasOwn(error, 'cause') ? [error.cause, ...failures] : failures;
  Object.defineProperty(error, 'cause', { value: aggregate(causes), configurable: true, writable: true });
}
function mountWait<T>(promise: Promise<T>, late?: (value: T) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    let expired: NativeSurfaceUV01WebGPUError | null = null;
    const timer = setTimeout(() => {
      expired = new NativeSurfaceUV01WebGPUError('STATE', 'Initialization exceeded 10s; remount required'); reject(expired);
    }, WAIT_MS);
    promise.then(value => {
      clearTimeout(timer);
      if (expired) { try { late?.(value); } catch (cause) { appendCleanup(expired, [cause]); } }
      else resolve(value);
    }, cause => { clearTimeout(timer); if (!expired) reject(cause); });
  });
}

class NativeSurfaceViewport implements NativeSurfaceUV01WebGPUViewport {
  private accepted: Candidate | null = null;
  private candidate: Candidate | null = null;
  private readback: Readback | null = null;
  private selection: PrimitiveSceneRef | null = null;
  private state: NativeSurfaceUV01WebGPUStatus['state'] = 'ready';
  private generation = 0;
  private busy = false;
  private epoch = 0;
  private configured = false;
  private destroyed = false;
  private expectedWidth: number;
  private expectedHeight: number;
  private terminalError: NativeSurfaceUV01WebGPUError | null = null;
  private readonly waits = new Set<(cause: NativeSurfaceUV01WebGPUError) => void>();
  constructor(readonly canvas: HTMLCanvasElement, private cpu: PreparedNativeSurfaceUV01Frame,
    private readonly device: GPUDeviceHandle, private readonly context: GPUCanvasHandle,
    private readonly actualLimits: NativeSurfaceUV01WebGPULimits) {
    this.expectedWidth = canvas.width; this.expectedHeight = canvas.height;
    void device.lost.then(info => this.lost(info), cause => this.lost(cause));
  }
  get originals(): NativeSurfaceUV01FrameRequest { return freezeGpuData(copyGpuData(this.cpu.request)); }
  get selected(): PrimitiveSceneRef | null { return refCopy(this.selection); }
  get status(): NativeSurfaceUV01WebGPUStatus {
    return Object.freeze({ backend: 'webgpu', profile: 'source0-native-surface-uv01-webgpu-v0', state: this.state,
      generation: this.generation, width: this.cpu.viewport.width, height: this.cpu.viewport.height,
      limits: Object.freeze({ ...this.actualLimits }),
      resources: this.accepted === null ? zeroResources() : Object.freeze({ ...this.cpu.resources }) });
  }
  private live(): void {
    if (this.state === 'lost') throw this.terminalError ?? new NativeSurfaceUV01WebGPUError('DEVICE_LOST', 'Device lost; explicit remount required');
    if (this.state !== 'ready') fail('STATE', 'Viewport is ' + this.state + '; explicit remount required');
    if (this.canvas.width !== this.expectedWidth || this.canvas.height !== this.expectedHeight)
      fail('STATE', 'Host changed backing dimensions outside resize');
  }
  private enter(): number { this.live(); if (this.busy) fail('BUSY', 'One asynchronous operation is pending'); this.busy = true; return this.epoch; }
  private check(epoch: number): void {
    if (epoch !== this.epoch || this.state !== 'ready') throw this.terminalError ?? new NativeSurfaceUV01WebGPUError('STATE', 'Operation invalidated');
    this.live();
  }
  private invalidate(): void {
    this.epoch++;
    const error = this.terminalError ?? new NativeSurfaceUV01WebGPUError('STATE', 'Viewport is ' + this.state);
    for (const cancel of [...this.waits]) cancel(error);
  }
  private releaseOwned(): unknown[] {
    const failures = [...release(this.accepted), ...release(this.candidate), ...releaseReadback(this.readback)];
    this.accepted = null; this.candidate = null; this.readback = null; return failures;
  }
  private releaseDevice(): unknown[] {
    const failures: unknown[] = [];
    if (this.configured) { this.configured = false; try { this.context.unconfigure(); } catch (cause) { failures.push(cause); } }
    if (!this.destroyed) { this.destroyed = true; try { this.device.destroy(); } catch (cause) { failures.push(cause); } }
    claims.delete(this.canvas); return failures;
  }
  private terminal(primary: NativeSurfaceUV01WebGPUError): NativeSurfaceUV01WebGPUError {
    if (this.state !== 'ready') return this.terminalError ?? primary;
    this.state = 'failed'; this.terminalError = primary;
    const failures = [...this.releaseOwned(), ...this.releaseDevice()];
    if (failures.length) this.terminalError = combined(primary, failures, 'Failure and terminal cleanup refused');
    this.invalidate(); return this.terminalError;
  }
  private lost(witness: unknown): void {
    if (this.state !== 'ready') return;
    this.state = 'lost'; this.terminalError = new NativeSurfaceUV01WebGPUError('DEVICE_LOST', 'Actual device loss; explicit remount required', witness);
    const failures = [...this.releaseOwned(), ...this.releaseDevice()];
    if (failures.length) this.terminalError = new NativeSurfaceUV01WebGPUError('DEVICE_LOST', 'Device loss and cleanup refused', aggregate([this.terminalError, ...failures]));
    this.invalidate();
  }
  private lateFailure(failures: unknown[]): void {
    if (!failures.length) return;
    if (!this.terminalError) this.terminalError = new NativeSurfaceUV01WebGPUError('RENDER', 'Late owned cleanup refused');
    appendCleanup(this.terminalError, failures);
  }
  private wait<T>(promise: Promise<T>, epoch: number, label: string, late?: (value: T) => void): Promise<T> {
    return new Promise((resolve, reject) => {
      let closed = false;
      const close = (): void => { closed = true; clearTimeout(timer); this.waits.delete(cancel); };
      const cancel = (cause: NativeSurfaceUV01WebGPUError): void => { if (!closed) { close(); reject(cause); } };
      const timer = setTimeout(() => {
        if (closed) return;
        close(); reject(this.terminal(new NativeSurfaceUV01WebGPUError('STATE', label + ' exceeded10s; remount required')));
      }, WAIT_MS);
      this.waits.add(cancel);
      promise.then(value => {
        if (closed) { try { late?.(value); } catch (cause) { this.lateFailure([cause]); } return; }
        close(); try { this.check(epoch); resolve(value); } catch (cause) { reject(cause); }
      }, cause => { if (!closed) { close(); reject(cause); } });
    });
  }
  private async scoped<T>(epoch: number, operation: () => Promise<T>): Promise<T> {
    this.check(epoch);
    let pushed = 0, failed = false, primary: unknown, result: T | undefined;
    try {
      for (const filter of ['out-of-memory', 'internal', 'validation']) { this.device.pushErrorScope(filter); pushed++; }
      result = await operation();
    } catch (cause) { failed = true; primary = cause; }
    const pops: Promise<{ failure: boolean; cause: unknown }>[] = [];
    for (let index = 0; index < pushed; index++) {
      try { pops.push(this.device.popErrorScope().then(value => ({ failure: value !== null, cause: value }), cause => ({ failure: true, cause }))); }
      catch (cause) { pops.push(Promise.resolve({ failure: true, cause })); }
    }
    if (epoch !== this.epoch || this.state !== 'ready') {
      void Promise.all(pops).then(outcomes => this.lateFailure(outcomes.filter(value => value.failure).map(value => value.cause)));
      if (failed && primary !== this.terminalError) this.lateFailure([primary]);
      throw this.terminalError ?? primary;
    }
    let outcomes: { failure: boolean; cause: unknown }[];
    try { outcomes = await this.wait(Promise.all(pops), epoch, 'Device error scopes', values =>
      this.lateFailure(values.filter(value => value.failure).map(value => value.cause))); }
    catch (cause) { if (failed && cause !== primary && cause instanceof NativeSurfaceUV01WebGPUError) appendCleanup(cause, [primary]); throw cause; }
    const failures = outcomes.filter(value => value.failure).map(value => value.cause);
    if (failed) { if (failures.length) throw combined(primary, failures, 'Operation and actual GPU scope refused'); throw primary; }
    if (failures.length) throw new NativeSurfaceUV01WebGPUError('RENDER', 'Actual GPU scope refused', failures.length === 1 ? failures[0] : aggregate(failures));
    this.check(epoch); return result as T;
  }
  async initialize(): Promise<void> {
    const epoch = this.enter();
    try {
      try {
        await this.scoped(epoch, async () => {
          this.configured = true;
          this.context.configure({ device: this.device, format: 'rgba8unorm', alphaMode: 'opaque', colorSpace: 'srgb', usage: RENDER_ATTACHMENT | TEXTURE_COPY_DST });
        });
      } catch (cause) {
        if (cause instanceof NativeSurfaceUV01WebGPUError && (cause.code === 'STATE' || cause.code === 'DEVICE_LOST')) throw cause;
        throw new NativeSurfaceUV01WebGPUError('UNSUPPORTED', 'Actual canvas refused fixed RGBA8 configuration', cause);
      }
      await this.replace(this.cpu, epoch); this.check(epoch);
    } catch (cause) { throw this.terminal(owned(cause, 'INIT', 'WebGPU initialization refused')); }
    finally { this.busy = false; }
  }
  private upload(candidate: Candidate, bytes: Uint8Array, usage: number): GPUBufferHandle {
    const buffer = this.device.createBuffer({ size: bytes.byteLength, usage: usage | COPY_DST });
    candidate.buffers.push(buffer); this.device.queue.writeBuffer(buffer, 0, bytes); return buffer;
  }
  private async create(prepared: PreparedNativeSurfaceUV01Frame, epoch: number): Promise<Candidate> {
    const candidate: Candidate = { prepared, buffers: [], textures: [], draws: [], modules: [], released: false };
    this.candidate = candidate;
    const layout = this.device.createBindGroupLayout({ entries: [
      { binding: 0, visibility: 3, buffer: { type: 'uniform', minBindingSize: 160 } },
      { binding: 1, visibility: 2, buffer: { type: 'uniform', minBindingSize: 64 } },
      { binding: 2, visibility: 2, buffer: { type: 'uniform', minBindingSize: 16 } },
    ] });
    const pipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [layout] });
    for (const draw of prepared.draws) {
      this.check(epoch);
      const module = this.device.createShaderModule({ code: draw.program.code }); candidate.modules.push(module);
      const compilation = await this.wait(module.getCompilationInfo(), epoch, 'WGSL compilation');
      if (compilation.messages.some(message => message.type === 'error')) throw new NativeSurfaceUV01WebGPUError('RENDER', 'Actual WGSL compilation refused', compilation);
      const pipeline = await this.wait(this.device.createRenderPipelineAsync({ layout: pipelineLayout,
        vertex: { module, entryPoint: draw.program.entryPoints.vertex, buffers: [
          { arrayStride: 12, stepMode: 'vertex', attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
          { arrayStride: 12, stepMode: 'vertex', attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }] },
          { arrayStride: 8, stepMode: 'vertex', attributes: [{ shaderLocation: 2, offset: 0, format: 'float32x2' }] },
        ] }, fragment: { module, entryPoint: draw.program.entryPoints.fragment, targets: [{ format: 'rgba8unorm' }, { format: 'r32uint' }] },
        primitive: { topology: 'triangle-list', cullMode: 'none' },
        depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' }, multisample: { count: 1 },
      }), epoch, 'Pipeline creation');
      const position = this.upload(candidate, draw.positions, VERTEX), normal = this.upload(candidate, draw.normals, VERTEX);
      const uv01 = this.upload(candidate, draw.uv01, VERTEX), index = this.upload(candidate, draw.indices, INDEX);
      const frame = this.upload(candidate, draw.uniforms.frame, UNIFORM), material = this.upload(candidate, draw.uniforms.material, UNIFORM);
      const identity = this.upload(candidate, draw.uniforms.draw, UNIFORM);
      const group = this.device.createBindGroup({ layout, entries: [
        { binding: 0, resource: { buffer: frame } }, { binding: 1, resource: { buffer: material } },
        { binding: 2, resource: { buffer: identity } },
      ] });
      candidate.draws.push({ pipeline, group, position, normal, uv01, index, count: draw.indexCount });
    }
    for (const format of ['rgba8unorm', 'r32uint', 'depth24plus']) {
      const texture = this.device.createTexture({ size: { width: prepared.viewport.width, height: prepared.viewport.height, depthOrArrayLayers: 1 },
        format, usage: format === 'depth24plus' ? RENDER_ATTACHMENT : RENDER_ATTACHMENT | TEXTURE_COPY_SRC });
      candidate.textures.push(texture);
    }
    const encoder = this.device.createCommandEncoder(), background = prepared.request.options.background;
    const pass = encoder.beginRenderPass({ colorAttachments: [
      { view: candidate.textures[0].createView(), clearValue: { r: background[0], g: background[1], b: background[2], a: 1 }, loadOp: 'clear', storeOp: 'store' },
      { view: candidate.textures[1].createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' },
    ], depthStencilAttachment: { view: candidate.textures[2].createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' } });
    for (const draw of candidate.draws) {
      pass.setPipeline(draw.pipeline); pass.setBindGroup(0, draw.group);
      pass.setVertexBuffer(0, draw.position); pass.setVertexBuffer(1, draw.normal); pass.setVertexBuffer(2, draw.uv01);
      pass.setIndexBuffer(draw.index, 'uint16'); pass.drawIndexed(draw.count);
    }
    pass.end(); this.device.queue.submit([encoder.finish()]);
    await this.wait(this.device.queue.onSubmittedWorkDone(), epoch, 'Render submission'); return candidate;
  }
  private async present(candidate: Candidate, epoch: number): Promise<void> {
    const encoder = this.device.createCommandEncoder();
    encoder.copyTextureToTexture({ texture: candidate.textures[0] }, { texture: this.context.getCurrentTexture() },
      { width: candidate.prepared.viewport.width, height: candidate.prepared.viewport.height, depthOrArrayLayers: 1 });
    this.device.queue.submit([encoder.finish()]); await this.wait(this.device.queue.onSubmittedWorkDone(), epoch, 'Presentation');
  }
  private async replace(prepared: PreparedNativeSurfaceUV01Frame, epoch: number): Promise<void> {
    assertResidency(this.accepted?.prepared ?? null, prepared);
    assertCandidateLimits(prepared, this.actualLimits);
    const oldWidth = this.expectedWidth, oldHeight = this.expectedHeight;
    let presentationAttempted = false, committed = false;
    try {
      const candidate = await this.scoped(epoch, () => this.create(prepared, epoch)); this.check(epoch);
      presentationAttempted = true; this.canvas.width = prepared.viewport.width; this.canvas.height = prepared.viewport.height;
      this.expectedWidth = prepared.viewport.width; this.expectedHeight = prepared.viewport.height;
      await this.scoped(epoch, () => this.present(candidate, epoch)); this.check(epoch);
      const previous = this.accepted; this.accepted = candidate; this.candidate = null;
      this.cpu = prepared; this.generation++; committed = true;
      if (this.selection && !prepared.draws.some(draw => same(draw.ref, this.selection!))) this.selection = null;
      const failures = release(previous);
      if (failures.length) throw this.terminal(new NativeSurfaceUV01WebGPUError('RENDER', 'Accepted replacement cleanup refused', aggregate(failures)));
    } catch (cause) {
      let primary = owned(cause, 'RENDER', 'Candidate replacement refused');
      if (!committed && presentationAttempted && this.state === 'ready') {
        try {
          this.canvas.width = oldWidth; this.canvas.height = oldHeight; this.expectedWidth = oldWidth; this.expectedHeight = oldHeight;
          if (this.accepted) await this.scoped(epoch, () => this.present(this.accepted!, epoch));
        } catch (recovery) { primary = this.terminal(combined(primary, [recovery], 'Presentation and accepted recovery refused')); }
      }
      const failures = release(this.candidate); this.candidate = null;
      if (failures.length) primary = this.terminal(combined(primary, failures, 'Candidate refusal and cleanup refused'));
      throw primary;
    }
  }
  async updateFrame(input: unknown): Promise<UpdateResult> {
    let entered = false;
    try {
      const epoch = this.enter(); entered = true;
      const prepared = prepare(input, this.cpu.viewport.width, this.cpu.viewport.height);
      await this.replace(prepared, epoch); this.check(epoch); return { ok: true };
    } catch (cause) { return { ok: false, error: owned(cause, 'RENDER', 'Frame update refused') }; }
    finally { if (entered) this.busy = false; }
  }
  async resize(width: number, height: number): Promise<UpdateResult> {
    let entered = false;
    try {
      const epoch = this.enter(); entered = true;
      const prepared = prepare(this.cpu.request, width, height);
      await this.replace(prepared, epoch); this.check(epoch); return { ok: true };
    } catch (cause) { return { ok: false, error: owned(cause, 'RENDER', 'Resize refused') }; }
    finally { if (entered) this.busy = false; }
  }
  private async download(identity: boolean, epoch: number, x = 0, y = 0): Promise<Uint8Array> {
    const accepted = this.accepted!;
    const width = identity ? 1 : this.cpu.viewport.width, height = identity ? 1 : this.cpu.viewport.height;
    const rowBytes = Math.ceil(width * 4 / 256) * 256;
    let readback: Readback | null = null, result: Uint8Array | undefined, failed = false, primary: unknown;
    try {
      await this.scoped(epoch, async () => {
        readback = { buffer: this.device.createBuffer({ size: rowBytes * height, usage: MAP_READ | COPY_DST }), released: false };
        this.readback = readback;
        const encoder = this.device.createCommandEncoder();
        encoder.copyTextureToBuffer({ texture: accepted.textures[identity ? 1 : 0], origin: { x, y, z: 0 } },
          { buffer: readback.buffer, bytesPerRow: rowBytes, rowsPerImage: height }, { width, height, depthOrArrayLayers: 1 });
        this.device.queue.submit([encoder.finish()]); await this.wait(this.device.queue.onSubmittedWorkDone(), epoch, 'Readback submission');
      });
      const actual = readback as Readback | null;
      if (!actual) fail('RENDER', 'Readback allocation did not complete');
      await this.wait(actual.buffer.mapAsync(1), epoch, 'Readback mapping', () => {
        try { actual.buffer.unmap(); } catch (cause) { this.lateFailure([cause]); }
      });
      this.check(epoch);
      const padded = new Uint8Array(actual.buffer.getMappedRange());
      if (padded.byteLength !== rowBytes * height) fail('RENDER', 'Mapped readback size disagrees with the requested buffer');
      result = new Uint8Array(width * height * 4);
      for (let row = 0; row < height; row++) result.set(padded.subarray(row * rowBytes, row * rowBytes + width * 4), row * width * 4);
    } catch (cause) { failed = true; primary = owned(cause, 'RENDER', 'Readback refused'); }
    const failures = releaseReadback(readback); if (this.readback === readback) this.readback = null;
    if (failures.length) throw this.terminal(failed ? combined(primary, failures, 'Readback and cleanup refused')
      : new NativeSurfaceUV01WebGPUError('RENDER', 'Readback cleanup refused', aggregate(failures)));
    if (failed) throw primary; return result!;
  }
  async readPixels(): Promise<Uint8Array> {
    let entered = false;
    try { const epoch = this.enter(); entered = true; return await this.download(false, epoch); }
    finally { if (entered) this.busy = false; }
  }
  async pick(x: number, y: number): Promise<NativeSurfaceUV01WebGPUPick> {
    let entered = false;
    try {
      const epoch = this.enter(); entered = true;
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= this.cpu.viewport.width || y >= this.cpu.viewport.height)
        fail('INPUT', 'Pick requires a bounded integer top-left backing pixel');
      const generation = this.generation, bytes = await this.download(true, epoch, x, y);
      const identity = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, true);
      if (identity > this.cpu.draws.length) fail('RENDER', 'Actual identity is outside the admitted Surface list');
      return Object.freeze({ generation, ref: identity === 0 ? null : refCopy(this.cpu.draws[identity - 1].ref) });
    } finally { if (entered) this.busy = false; }
  }
  select(input: PrimitiveSceneRef | null): UpdateResult {
    try {
      this.live(); if (this.busy) fail('BUSY', 'Selection refused during pending operation');
      const ref = input === null ? null : validateNativeSurfaceUV01WebGPURef(input);
      if (ref !== null && !this.cpu.draws.some(draw => same(draw.ref, ref))) fail('INPUT', 'Selection is outside the admitted full reference set');
      this.selection = refCopy(ref); return { ok: true };
    } catch (cause) { return { ok: false, error: owned(cause, 'INPUT', 'Selection refused') }; }
  }
  dispose(): void {
    if (this.state === 'disposed') return;
    this.state = 'disposed'; this.selection = null;
    this.terminalError ??= new NativeSurfaceUV01WebGPUError('STATE', 'Viewport disposed; operation invalidated');
    const failures = [...this.releaseOwned(), ...this.releaseDevice()];
    if (failures.length) this.terminalError = combined(this.terminalError, failures, 'Disposal cleanup refused');
    this.invalidate();
    if (failures.length) throw this.terminalError;
  }
  finishMount(): void { this.live(); }
  /** Mount has no returned caller; collect cleanup without replacing its primary. */
  abandonMount(primary: NativeSurfaceUV01WebGPUError): NativeSurfaceUV01WebGPUError {
    this.state = 'disposed'; this.selection = null;
    const failures = [...this.releaseOwned(), ...this.releaseDevice()];
    this.terminalError = failures.length ? combined(primary, failures, 'Mount and cleanup refused') : primary;
    this.invalidate(); return this.terminalError;
  }
}

/** Only this facade escapes: TS-private fields are not a runtime buffer boundary. */
function publicViewport(viewport: NativeSurfaceViewport): NativeSurfaceUV01WebGPUViewport {
  return Object.freeze({
    canvas: viewport.canvas,
    get originals() { return viewport.originals; },
    get selected() { return viewport.selected; },
    get status() { return viewport.status; },
    updateFrame: (input: unknown) => viewport.updateFrame(input),
    resize: (width: number, height: number) => viewport.resize(width, height),
    readPixels: () => viewport.readPixels(),
    pick: (x: number, y: number) => viewport.pick(x, y),
    select: (ref: PrimitiveSceneRef | null) => viewport.select(ref),
    dispose: () => viewport.dispose(),
  });
}

/** Required WebGPU route; originals are admitted synchronously before any device await. */
export async function mountNativeSurfaceUV01WebGPUViewport(canvas: HTMLCanvasElement, input: unknown,
  options: NativeSurfaceUV01WebGPUOptions): Promise<NativeSurfaceUV01WebGPUViewport> {
  const dimensions = validateNativeSurfaceUV01WebGPUOptions(options);
  const prepared = prepare(input, dimensions.width, dimensions.height);
  if (typeof HTMLCanvasElement === 'undefined' || !(canvas instanceof HTMLCanvasElement)) fail('INPUT', 'Actual current-realm HTMLCanvasElement required');
  if (claims.has(canvas)) fail('STATE', 'Canvas already claimed by a WebGPU viewport');
  const oldWidth = canvas.width, oldHeight = canvas.height;
  claims.add(canvas);
  let device: GPUDeviceHandle | null = null, context: GPUCanvasHandle | null = null, viewport: NativeSurfaceViewport | null = null;
  try {
    const platform = (globalThis.navigator as (Navigator & { gpu?: GPUPlatformHandle }) | undefined)?.gpu;
    if (!platform) fail('UNSUPPORTED', 'navigator.gpu unavailable; this route requires WebGPU');
    const adapter = await mountWait(platform.requestAdapter());
    if (!adapter) fail('UNSUPPORTED', 'No admitted WebGPU adapter');
    device = await mountWait(adapter.requestDevice({ requiredFeatures: [] }), late => {
      void late.lost.catch(() => { /* A late device has no viewport observer. */ }); late.destroy();
    });
    // Mount may refuse limits/context before constructing its loss observer.
    void device.lost.catch(() => { /* The viewport below owns terminal loss when admitted. */ });
    const actualLimits = limits(device);
    assertCandidateLimits(prepared, actualLimits);
    if (canvas.width !== oldWidth || canvas.height !== oldHeight) fail('STATE', 'Host changed backing dimensions during mount');
    context = canvas.getContext('webgpu') as unknown as GPUCanvasHandle | null;
    if (!context) fail('INIT', 'Cannot acquire actual WebGPU canvas context');
    viewport = new NativeSurfaceViewport(canvas, prepared, device, context, actualLimits);
    await viewport.initialize(); viewport.finishMount(); return publicViewport(viewport);
  } catch (cause) {
    const primary = owned(cause, 'INIT', 'WebGPU mount refused'), failures: unknown[] = [];
    if (viewport) throw viewport.abandonMount(primary);
    else {
      if (context) try { context.unconfigure(); } catch (cleanup) { failures.push(cleanup); }
      if (device) try { device.destroy(); } catch (cleanup) { failures.push(cleanup); }
      claims.delete(canvas);
    }
    if (failures.length) throw combined(primary, failures, 'Mount and cleanup refused'); throw primary;
  }
}
