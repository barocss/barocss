import { MultiSurfaceWebGPUError, prepareMultiSurfaceWebGPUFrame, validateMultiSurfaceWebGPUOptions,
  validateMultiSurfaceWebGPURef, copyMultiSurfaceWebGPUFrame, assertMultiSurfaceWebGPUResidency } from './multi-surface-webgpu-frame.js';
import type { PreparedMultiSurfaceWebGPUFrame, MultiSurfaceWebGPUOptions, MultiSurfaceWebGPUStatus,
  MultiSurfaceWebGPULimits, MultiSurfaceWebGPUResources, MultiSurfaceWebGPUPick,
  MultiSurfaceWebGPUDiagnosticCode } from './multi-surface-webgpu-frame.js';
import type { PrimitiveSceneCpuFrameV0 } from './primitive-frame-preflight.js';
import type { PrimitiveSceneRef } from './primitive-scene-renderer.js';
import type { UpdateResult } from './renderer.js';
import type { GPUBufferHandle, GPUTextureHandle, GPUPipelineHandle, GPUDeviceHandle,
  GPUPlatformHandle, GPUCanvasHandle } from './webgpu-platform.js';
import { webgpuViewportCanvasClaims as claims } from './webgpu-canvas-claims.js';

export interface MultiSurfaceWebGPUViewport {
  readonly canvas: HTMLCanvasElement;
  readonly frame: PrimitiveSceneCpuFrameV0;
  readonly selected: PrimitiveSceneRef | null;
  readonly status: MultiSurfaceWebGPUStatus;
  updateFrame(input: unknown): Promise<UpdateResult>;
  resize(width: number, height: number): Promise<UpdateResult>;
  readPixels(): Promise<Uint8Array>;
  pick(x: number, y: number): Promise<MultiSurfaceWebGPUPick>;
  select(ref: PrimitiveSceneRef | null): UpdateResult;
  dispose(): void;
}

const WAIT_MS = 10000, COPY_DST = 8, VERTEX = 32, INDEX = 16, UNIFORM = 64, MAP_READ = 1;
const TEXTURE_COPY_SRC = 1, TEXTURE_COPY_DST = 2, RENDER_ATTACHMENT = 16;
const requirements: MultiSurfaceWebGPULimits = {
  maxTextureDimension2D: 1024, maxBufferSize: 4194304, maxUniformBufferBindingSize: 160,
  maxColorAttachments: 2, maxColorAttachmentBytesPerSample: 8, maxVertexBuffers: 2,
  maxVertexAttributes: 2, maxBindGroups: 1, maxVertexBufferArrayStride: 12,
};
function fail(code: MultiSurfaceWebGPUDiagnosticCode, message: string): never { throw new MultiSurfaceWebGPUError(code, message); }
function owned(cause: unknown, code: MultiSurfaceWebGPUDiagnosticCode, message: string): MultiSurfaceWebGPUError {
  return cause instanceof MultiSurfaceWebGPUError ? cause : new MultiSurfaceWebGPUError(code, message, cause);
}
function aggregate(errors: unknown[]): AggregateError {
  const result = new AggregateError(errors); Object.freeze(result.errors); return result;
}
function combined(primary: unknown, failures: unknown[], message: string): MultiSurfaceWebGPUError {
  return new MultiSurfaceWebGPUError('RENDER', message, aggregate([primary, ...failures]));
}
function same(a: PrimitiveSceneRef, b: PrimitiveSceneRef): boolean { return a.modelId === b.modelId && a.geometryId === b.geometryId; }
function refCopy(ref: PrimitiveSceneRef | null): PrimitiveSceneRef | null {
  return ref === null ? null : Object.freeze({ modelId: ref.modelId, geometryId: ref.geometryId });
}
function limits(device: GPUDeviceHandle): MultiSurfaceWebGPULimits {
  const result = {} as { -readonly [Key in keyof MultiSurfaceWebGPULimits]: number };
  for (const key of Object.keys(requirements) as (keyof MultiSurfaceWebGPULimits)[]) {
    const value = device.limits[key];
    if (!Number.isSafeInteger(value) || value < requirements[key]) fail('UNSUPPORTED', 'Insufficient device limit: ' + key);
    result[key] = value;
  }
  return Object.freeze(result);
}
function zeroResources(): MultiSurfaceWebGPUResources {
  return Object.freeze({ geometryBytes: 0, uniformBytes: 0, colorIdentityBytes: 0, depthTexels: 0,
    depthBudgetBytes: 0, chargedBytes: 0, readbackBytes: 0, buffers: 0, textures: 0, bindGroups: 0, pipelines: 0 });
}
interface Draw { pipeline: GPUPipelineHandle; group: object; position: GPUBufferHandle; normal: GPUBufferHandle; index: GPUBufferHandle; count: number }
interface Candidate {
  prepared: PreparedMultiSurfaceWebGPUFrame; buffers: GPUBufferHandle[]; textures: GPUTextureHandle[];
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
function mountWait<T>(promise: Promise<T>, late?: (value: T) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    let expired = false;
    const timer = setTimeout(() => { expired = true; reject(new MultiSurfaceWebGPUError('STATE', 'Initialization exceeded10s; remount required')); }, WAIT_MS);
    promise.then(value => { clearTimeout(timer); if (expired) { try { late?.(value); } catch { /* Late ownership never escapes. */ } } else resolve(value); },
      cause => { clearTimeout(timer); if (!expired) reject(cause); });
  });
}

class MultiSurfaceViewport implements MultiSurfaceWebGPUViewport {
  private accepted: Candidate | null = null;
  private candidate: Candidate | null = null;
  private readback: Readback | null = null;
  private selection: PrimitiveSceneRef | null = null;
  private state: MultiSurfaceWebGPUStatus['state'] = 'ready';
  private generation = 0;
  private busy = false;
  private epoch = 0;
  private configured = false;
  private destroyed = false;
  private expectedWidth: number;
  private expectedHeight: number;
  private terminalError: MultiSurfaceWebGPUError | null = null;
  private readonly waits = new Set<(cause: MultiSurfaceWebGPUError) => void>();
  constructor(readonly canvas: HTMLCanvasElement, private cpu: PreparedMultiSurfaceWebGPUFrame,
    private readonly device: GPUDeviceHandle, private readonly context: GPUCanvasHandle,
    private readonly actualLimits: MultiSurfaceWebGPULimits) {
    this.expectedWidth = canvas.width; this.expectedHeight = canvas.height;
    void device.lost.then(info => this.lost(info), cause => this.lost(cause));
  }
  get frame(): PrimitiveSceneCpuFrameV0 { return copyMultiSurfaceWebGPUFrame(this.cpu); }
  get selected(): PrimitiveSceneRef | null { return refCopy(this.selection); }
  get status(): MultiSurfaceWebGPUStatus {
    return Object.freeze({ backend: 'webgpu', profile: 'qualified-multiple-surface-wgsl-v0', state: this.state,
      generation: this.generation, width: this.cpu.width, height: this.cpu.height,
      limits: Object.freeze({ ...this.actualLimits }),
      resources: this.accepted === null ? zeroResources() : Object.freeze({ ...this.cpu.resources }) });
  }
  private live(): void {
    if (this.state === 'lost') throw this.terminalError ?? new MultiSurfaceWebGPUError('DEVICE_LOST', 'Device lost; explicit remount required');
    if (this.state !== 'ready') fail('STATE', 'Viewport is ' + this.state + '; explicit remount required');
    if (this.canvas.width !== this.expectedWidth || this.canvas.height !== this.expectedHeight)
      fail('STATE', 'Host changed backing dimensions outside resize');
  }
  private enter(): number { this.live(); if (this.busy) fail('BUSY', 'One asynchronous operation is pending'); this.busy = true; return this.epoch; }
  private check(epoch: number): void {
    if (epoch !== this.epoch || this.state !== 'ready') throw this.terminalError ?? new MultiSurfaceWebGPUError('STATE', 'Operation invalidated');
    this.live();
  }
  private invalidate(): void {
    this.epoch++;
    const error = this.terminalError ?? new MultiSurfaceWebGPUError('STATE', 'Viewport is ' + this.state);
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
  private terminal(primary: MultiSurfaceWebGPUError): MultiSurfaceWebGPUError {
    if (this.state !== 'ready') return this.terminalError ?? primary;
    this.state = 'failed'; this.terminalError = primary; this.invalidate();
    const failures = [...this.releaseOwned(), ...this.releaseDevice()];
    if (failures.length) this.terminalError = combined(primary, failures, 'Failure and terminal cleanup refused');
    return this.terminalError;
  }
  private lost(witness: unknown): void {
    if (this.state !== 'ready') return;
    this.state = 'lost'; this.terminalError = new MultiSurfaceWebGPUError('DEVICE_LOST', 'Actual device loss; explicit remount required', witness);
    this.invalidate(); const failures = [...this.releaseOwned(), ...this.releaseDevice()];
    if (failures.length) this.terminalError = new MultiSurfaceWebGPUError('DEVICE_LOST', 'Device loss and cleanup refused', aggregate([this.terminalError, ...failures]));
  }
  private lateFailure(failures: unknown[]): void {
    if (failures.length) this.terminalError = this.state === 'lost'
      ? new MultiSurfaceWebGPUError('DEVICE_LOST', 'Device loss and late cleanup refused', aggregate([this.terminalError, ...failures]))
      : combined(this.terminalError, failures, 'Late owned cleanup refused');
  }
  private wait<T>(promise: Promise<T>, epoch: number, label: string, late?: (value: T) => void): Promise<T> {
    return new Promise((resolve, reject) => {
      let closed = false;
      const close = (): void => { closed = true; clearTimeout(timer); this.waits.delete(cancel); };
      const cancel = (cause: MultiSurfaceWebGPUError): void => { if (!closed) { close(); reject(cause); } };
      const timer = setTimeout(() => {
        if (closed) return;
        close(); reject(this.terminal(new MultiSurfaceWebGPUError('STATE', label + ' exceeded10s; remount required')));
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
    if (epoch !== this.epoch || this.state !== 'ready') { void Promise.all(pops); throw failed ? primary : this.terminalError; }
    const outcomes = await this.wait(Promise.all(pops), epoch, 'Device error scopes');
    const failures = outcomes.filter(value => value.failure).map(value => value.cause);
    if (failed) { if (failures.length) throw combined(primary, failures, 'Operation and actual GPU scope refused'); throw primary; }
    if (failures.length) throw new MultiSurfaceWebGPUError('RENDER', 'Actual GPU scope refused', failures.length === 1 ? failures[0] : aggregate(failures));
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
        if (cause instanceof MultiSurfaceWebGPUError && (cause.code === 'STATE' || cause.code === 'DEVICE_LOST')) throw cause;
        throw new MultiSurfaceWebGPUError('UNSUPPORTED', 'Actual canvas refused fixed RGBA8 configuration', cause);
      }
      await this.replace(this.cpu, epoch);
    } catch (cause) { throw this.terminal(owned(cause, 'INIT', 'WebGPU initialization refused')); }
    finally { this.busy = false; }
  }
  private upload(candidate: Candidate, bytes: Uint8Array, usage: number): GPUBufferHandle {
    const buffer = this.device.createBuffer({ size: bytes.byteLength, usage: usage | COPY_DST });
    candidate.buffers.push(buffer); this.device.queue.writeBuffer(buffer, 0, bytes); return buffer;
  }
  private async create(prepared: PreparedMultiSurfaceWebGPUFrame, epoch: number): Promise<Candidate> {
    const candidate: Candidate = { prepared, buffers: [], textures: [], draws: [], modules: [], released: false };
    this.candidate = candidate;
    const layout = this.device.createBindGroupLayout({ entries: [
      { binding: 0, visibility: 3, buffer: { type: 'uniform', minBindingSize: 160 } },
      { binding: 1, visibility: 2, buffer: { type: 'uniform', minBindingSize: 64 } },
    ] });
    const pipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [layout] });
    for (const draw of prepared.draws) {
      this.check(epoch);
      const module = this.device.createShaderModule({ code: draw.wgsl }); candidate.modules.push(module);
      const compilation = await this.wait(module.getCompilationInfo(), epoch, 'WGSL compilation');
      if (compilation.messages.some(message => message.type === 'error')) throw new MultiSurfaceWebGPUError('RENDER', 'Actual WGSL compilation refused', compilation);
      const pipeline = await this.wait(this.device.createRenderPipelineAsync({ layout: pipelineLayout,
        vertex: { module, entryPoint: 'vertexMain', buffers: [
          { arrayStride: 12, stepMode: 'vertex', attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
          { arrayStride: 12, stepMode: 'vertex', attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }] },
        ] }, fragment: { module, entryPoint: 'fragmentMain', targets: [{ format: 'rgba8unorm' }, { format: 'r32uint' }] },
        primitive: { topology: 'triangle-list', cullMode: 'none' },
        depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' }, multisample: { count: 1 },
      }), epoch, 'Pipeline creation');
      const position = this.upload(candidate, draw.positions, VERTEX), normal = this.upload(candidate, draw.normals, VERTEX);
      const index = this.upload(candidate, draw.indices, INDEX), frame = this.upload(candidate, draw.frameUniforms, UNIFORM);
      const material = this.upload(candidate, draw.materialUniforms, UNIFORM);
      const group = this.device.createBindGroup({ layout, entries: [
        { binding: 0, resource: { buffer: frame } }, { binding: 1, resource: { buffer: material } },
      ] });
      candidate.draws.push({ pipeline, group, position, normal, index, count: draw.indexCount });
    }
    for (const format of ['rgba8unorm', 'r32uint', 'depth24plus']) {
      const texture = this.device.createTexture({ size: { width: prepared.width, height: prepared.height, depthOrArrayLayers: 1 },
        format, usage: format === 'depth24plus' ? RENDER_ATTACHMENT : RENDER_ATTACHMENT | TEXTURE_COPY_SRC });
      candidate.textures.push(texture);
    }
    const encoder = this.device.createCommandEncoder(), background = prepared.background;
    const pass = encoder.beginRenderPass({ colorAttachments: [
      { view: candidate.textures[0].createView(), clearValue: { r: background[0], g: background[1], b: background[2], a: 1 }, loadOp: 'clear', storeOp: 'store' },
      { view: candidate.textures[1].createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' },
    ], depthStencilAttachment: { view: candidate.textures[2].createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' } });
    for (const draw of candidate.draws) {
      pass.setPipeline(draw.pipeline); pass.setBindGroup(0, draw.group);
      pass.setVertexBuffer(0, draw.position); pass.setVertexBuffer(1, draw.normal);
      pass.setIndexBuffer(draw.index, 'uint16'); pass.drawIndexed(draw.count);
    }
    pass.end(); this.device.queue.submit([encoder.finish()]);
    await this.wait(this.device.queue.onSubmittedWorkDone(), epoch, 'Render submission'); return candidate;
  }
  private async present(candidate: Candidate, epoch: number): Promise<void> {
    const encoder = this.device.createCommandEncoder();
    encoder.copyTextureToTexture({ texture: candidate.textures[0] }, { texture: this.context.getCurrentTexture() },
      { width: candidate.prepared.width, height: candidate.prepared.height, depthOrArrayLayers: 1 });
    this.device.queue.submit([encoder.finish()]); await this.wait(this.device.queue.onSubmittedWorkDone(), epoch, 'Presentation');
  }
  private async replace(prepared: PreparedMultiSurfaceWebGPUFrame, epoch: number): Promise<void> {
    assertMultiSurfaceWebGPUResidency(this.accepted?.prepared ?? null, prepared);
    const oldWidth = this.expectedWidth, oldHeight = this.expectedHeight;
    let presentationAttempted = false, committed = false;
    try {
      const candidate = await this.scoped(epoch, () => this.create(prepared, epoch)); this.check(epoch);
      presentationAttempted = true; this.canvas.width = prepared.width; this.canvas.height = prepared.height;
      this.expectedWidth = prepared.width; this.expectedHeight = prepared.height;
      await this.scoped(epoch, () => this.present(candidate, epoch)); this.check(epoch);
      const previous = this.accepted; this.accepted = candidate; this.candidate = null;
      this.cpu = prepared; this.generation++; committed = true;
      if (this.selection && !prepared.draws.some(draw => same(draw.ref, this.selection!))) this.selection = null;
      const failures = release(previous);
      if (failures.length) throw this.terminal(new MultiSurfaceWebGPUError('RENDER', 'Accepted replacement cleanup refused', aggregate(failures)));
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
      const prepared = prepareMultiSurfaceWebGPUFrame(input, this.cpu.width, this.cpu.height);
      await this.replace(prepared, epoch); return { ok: true };
    } catch (cause) { return { ok: false, error: owned(cause, 'RENDER', 'Frame update refused') }; }
    finally { if (entered) this.busy = false; }
  }
  async resize(width: number, height: number): Promise<UpdateResult> {
    let entered = false;
    try {
      const epoch = this.enter(); entered = true;
      const prepared = prepareMultiSurfaceWebGPUFrame(this.cpu.frame, width, height);
      await this.replace(prepared, epoch); return { ok: true };
    } catch (cause) { return { ok: false, error: owned(cause, 'RENDER', 'Resize refused') }; }
    finally { if (entered) this.busy = false; }
  }
  private async download(identity: boolean, epoch: number, x = 0, y = 0): Promise<Uint8Array> {
    const accepted = this.accepted!;
    const width = identity ? 1 : this.cpu.width, height = identity ? 1 : this.cpu.height;
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
      const padded = new Uint8Array(actual.buffer.getMappedRange()); result = new Uint8Array(width * height * 4);
      for (let row = 0; row < height; row++) result.set(padded.subarray(row * rowBytes, row * rowBytes + width * 4), row * width * 4);
    } catch (cause) { failed = true; primary = owned(cause, 'RENDER', 'Readback refused'); }
    const failures = releaseReadback(readback); if (this.readback === readback) this.readback = null;
    if (failures.length) throw this.terminal(failed ? combined(primary, failures, 'Readback and cleanup refused')
      : new MultiSurfaceWebGPUError('RENDER', 'Readback cleanup refused', aggregate(failures)));
    if (failed) throw primary; return result!;
  }
  async readPixels(): Promise<Uint8Array> {
    let entered = false;
    try { const epoch = this.enter(); entered = true; return await this.download(false, epoch); }
    finally { if (entered) this.busy = false; }
  }
  async pick(x: number, y: number): Promise<MultiSurfaceWebGPUPick> {
    let entered = false;
    try {
      const epoch = this.enter(); entered = true;
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= this.cpu.width || y >= this.cpu.height)
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
      const ref = input === null ? null : validateMultiSurfaceWebGPURef(input);
      if (ref !== null && !this.cpu.draws.some(draw => same(draw.ref, ref))) fail('PROFILE', 'Selection is outside the admitted full reference set');
      this.selection = refCopy(ref); return { ok: true };
    } catch (cause) { return { ok: false, error: owned(cause, 'INPUT', 'Selection refused') }; }
  }
  dispose(): void {
    if (this.state === 'disposed') return;
    this.state = 'disposed'; this.invalidate(); this.selection = null;
    const failures = [...this.releaseOwned(), ...this.releaseDevice()];
    if (failures.length) throw new MultiSurfaceWebGPUError('RENDER', 'Disposal cleanup refused', aggregate(failures));
  }
  /** Mount has no returned caller; collect cleanup without replacing its primary. */
  abandonMount(primary: MultiSurfaceWebGPUError): MultiSurfaceWebGPUError {
    this.state = 'disposed'; this.invalidate(); this.selection = null;
    const failures = [...this.releaseOwned(), ...this.releaseDevice()];
    return failures.length ? combined(primary, failures, 'Mount and cleanup refused') : primary;
  }
}

/** Required WebGPU route; originals are admitted synchronously before any device await. */
export async function mountMultiSurfaceWebGPUViewport(canvas: HTMLCanvasElement, input: unknown,
  options: MultiSurfaceWebGPUOptions): Promise<MultiSurfaceWebGPUViewport> {
  const dimensions = validateMultiSurfaceWebGPUOptions(options);
  const prepared = prepareMultiSurfaceWebGPUFrame(input, dimensions.width, dimensions.height);
  if (typeof HTMLCanvasElement === 'undefined' || !(canvas instanceof HTMLCanvasElement)) fail('INPUT', 'Actual current-realm HTMLCanvasElement required');
  if (claims.has(canvas)) fail('STATE', 'Canvas already claimed by a WebGPU viewport');
  const oldWidth = canvas.width, oldHeight = canvas.height;
  claims.add(canvas);
  let device: GPUDeviceHandle | null = null, context: GPUCanvasHandle | null = null, viewport: MultiSurfaceViewport | null = null;
  try {
    const platform = (navigator as Navigator & { gpu?: GPUPlatformHandle }).gpu;
    if (!platform) fail('UNSUPPORTED', 'navigator.gpu unavailable; explicit host fallback required');
    const adapter = await mountWait(platform.requestAdapter());
    if (!adapter) fail('UNSUPPORTED', 'No admitted WebGPU adapter');
    device = await mountWait(adapter.requestDevice({ requiredFeatures: [] }), late => late.destroy());
    const actualLimits = limits(device);
    if (canvas.width !== oldWidth || canvas.height !== oldHeight) fail('STATE', 'Host changed backing dimensions during mount');
    context = canvas.getContext('webgpu') as unknown as GPUCanvasHandle | null;
    if (!context) fail('INIT', 'Cannot acquire actual WebGPU canvas context');
    viewport = new MultiSurfaceViewport(canvas, prepared, device, context, actualLimits);
    await viewport.initialize(); return viewport;
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
