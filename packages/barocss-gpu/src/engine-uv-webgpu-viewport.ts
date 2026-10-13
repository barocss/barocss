import { EngineUVWebGPUError, prepareEngineUVWebGPUFrame, validateEngineUVWebGPUOptions,
  copyEngineUVWebGPUOriginals, validateEngineUVWebGPURef, assertEngineUVWebGPUResidency } from './engine-uv-webgpu-frame.js';
import type { PreparedEngineUVWebGPUFrame, EngineUVWebGPUOriginals, EngineUVWebGPURef,
  EngineUVWebGPUStatus, EngineUVWebGPUResources, EngineUVWebGPUDiagnosticCode } from './engine-uv-webgpu-frame.js';
import type { UpdateResult } from './renderer.js';
import type { GPUBufferHandle, GPUTextureHandle, GPUPipelineHandle, GPUDeviceHandle,
  GPUPlatformHandle, GPUCanvasHandle } from './webgpu-platform.js';

export interface EngineUVTextureWebGPUViewport {
  readonly canvas: HTMLCanvasElement;
  readonly originals: EngineUVWebGPUOriginals;
  readonly selected: EngineUVWebGPURef | null;
  readonly status: EngineUVWebGPUStatus;
  updateFrame(scene: unknown, texture: unknown, material: unknown): Promise<UpdateResult>;
  resize(width: number, height: number): Promise<UpdateResult>;
  readPixels(): Promise<Uint8Array>;
  pick(x: number, y: number): Promise<{ generation: number; ref: EngineUVWebGPURef | null }>;
  select(ref: EngineUVWebGPURef | null): UpdateResult;
  dispose(): void;
}

const WAIT_MS = 10000;
const BUFFER_COPY_DST = 8, MAP_READ = 1, VERTEX = 32, INDEX = 16, UNIFORM = 64;
const COPY_SRC = 1, TEXTURE_COPY_DST = 2, TEXTURE_BINDING = 4, RENDER_ATTACHMENT = 16;
const LIMIT_KEYS = ['maxTextureDimension2D', 'maxBufferSize', 'maxUniformBufferBindingSize',
  'maxColorAttachments', 'maxColorAttachmentBytesPerSample', 'maxVertexBuffers', 'maxVertexAttributes',
  'maxBindGroups', 'maxVertexBufferArrayStride', 'maxSampledTexturesPerShaderStage',
  'maxSamplersPerShaderStage', 'maxUniformBuffersPerShaderStage', 'maxBindingsPerBindGroup'] as const;
function error(code: EngineUVWebGPUDiagnosticCode, detail: string): never { throw new EngineUVWebGPUError(code, detail); }
function wrapped(cause: unknown, code: EngineUVWebGPUDiagnosticCode, detail: string): EngineUVWebGPUError {
  return cause instanceof EngineUVWebGPUError ? cause : new EngineUVWebGPUError(code, detail, cause);
}
function copiedRef(ref: EngineUVWebGPURef | null): EngineUVWebGPURef | null { return ref === null ? null : Object.freeze({ ...ref }); }
function admittedCanvas(input: unknown): { canvas: HTMLCanvasElement; width: number; height: number } {
  try {
    if (!input || typeof input !== 'object' || typeof HTMLCanvasElement === 'undefined' || !(input instanceof HTMLCanvasElement))
      error('INPUT', 'Mount requires an actual current-realm HTMLCanvasElement');
    return { canvas: input, width: input.width, height: input.height };
  } catch (cause) { throw wrapped(cause, 'INPUT', 'Actual canvas admission refused'); }
}
function sameRef(a: EngineUVWebGPURef, b: EngineUVWebGPURef): boolean {
  return a.sceneId === b.sceneId && a.nodeId === b.nodeId && a.geometryId === b.geometryId;
}
function snapshotLimits(device: GPUDeviceHandle): Record<string, number> {
  const limits: Record<string, number> = {};
  for (const name of LIMIT_KEYS) {
    const value = device.limits[name];
    if (!Number.isSafeInteger(value) || value <= 0) error('UNSUPPORTED', 'Device limits require thirteen actual positive integers');
    limits[name] = value;
  }
  return Object.freeze(limits);
}
function requireLimits(limits: Record<string, number>, frame: PreparedEngineUVWebGPUFrame): void {
  let dimension = Math.max(frame.width, frame.height), buffer = Math.max(128, 256, frame.resources.readbackBytes);
  for (const geometry of frame.geometries) buffer = Math.max(buffer, geometry.positions.byteLength, geometry.uvs.byteLength, geometry.indices.byteLength);
  for (const texture of frame.joined.textures) dimension = Math.max(dimension, texture.texture.width, texture.texture.height);
  const required: Record<string, number> = { maxTextureDimension2D: dimension, maxBufferSize: buffer,
    maxUniformBufferBindingSize: 128, maxColorAttachments: 2, maxColorAttachmentBytesPerSample: 8,
    maxVertexBuffers: 2, maxVertexAttributes: 2, maxBindGroups: 3, maxVertexBufferArrayStride: 12,
    maxSampledTexturesPerShaderStage: 1, maxSamplersPerShaderStage: 1,
    maxUniformBuffersPerShaderStage: 2, maxBindingsPerBindGroup: 2 };
  for (const name of LIMIT_KEYS) if (limits[name] < required[name]) error('UNSUPPORTED', 'Actual device limit is insufficient: ' + name);
}
function zeroResources(): EngineUVWebGPUResources {
  return Object.freeze({ geometryBytes: 0, textureBytes: 0, uniformBytes: 0, colorIdentityBytes: 0,
    depthTexels: 0, depthBudgetBytes: 0, chargedBytes: 0, readbackBytes: 0,
    buffers: 0, textures: 0, bindGroups: 0, pipelines: 0 });
}
interface GeometryBuffers { position: GPUBufferHandle; uv: GPUBufferHandle; index: GPUBufferHandle; format: 'uint16' | 'uint32'; count: number }
interface MaterialObjects { pipeline: GPUPipelineHandle; frameGroup: object; textureGroup: object }
interface Candidate {
  frame: PreparedEngineUVWebGPUFrame; buffers: GPUBufferHandle[]; textures: GPUTextureHandle[];
  geometries: Map<string, GeometryBuffers>; materials: Map<string, MaterialObjects>; draws: Map<number, object>;
  modules: object[]; color: GPUTextureHandle | null; identity: GPUTextureHandle | null; depth: GPUTextureHandle | null;
  released: boolean;
}
interface Readback { buffer: GPUBufferHandle; released: boolean }
function release(candidate: Candidate | null): unknown[] {
  if (!candidate || candidate.released) return [];
  candidate.released = true;
  const failures: unknown[] = [];
  for (const buffer of candidate.buffers) try { buffer.destroy(); } catch (cause) { failures.push(cause); }
  for (const texture of candidate.textures) try { texture.destroy(); } catch (cause) { failures.push(cause); }
  candidate.buffers.length = 0; candidate.textures.length = 0; candidate.modules.length = 0;
  candidate.geometries.clear(); candidate.materials.clear(); candidate.draws.clear();
  candidate.color = null; candidate.identity = null; candidate.depth = null;
  return failures;
}
function releaseReadback(readback: Readback | null): unknown[] {
  if (!readback || readback.released) return [];
  readback.released = true;
  const failures: unknown[] = [];
  try { readback.buffer.unmap(); } catch (cause) { failures.push(cause); }
  try { readback.buffer.destroy(); } catch (cause) { failures.push(cause); }
  return failures;
}
/** Mount waits also own late devices, before any viewport can be returned. */
function mountWait<T>(promise: Promise<T>, late?: (value: T) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    let expired = false;
    const timer = setTimeout(() => { expired = true; reject(new EngineUVWebGPUError('STATE', 'Device initialization exceeded10s; remount required')); }, WAIT_MS);
    promise.then(value => { clearTimeout(timer); if (expired) { try { late?.(value); } catch { /* No late exception escapes. */ } } else resolve(value); },
      cause => { clearTimeout(timer); if (!expired) reject(cause); });
  });
}

class EngineUVViewport implements EngineUVTextureWebGPUViewport {
  private accepted: Candidate | null = null;
  private candidate: Candidate | null = null;
  private readback: Readback | null = null;
  private selectedRef: EngineUVWebGPURef | null = null;
  private state: EngineUVWebGPUStatus['state'] = 'ready';
  private generation = 0;
  private busy = false;
  private epoch = 0;
  private terminalError: EngineUVWebGPUError | null = null;
  private readonly waits = new Set<(cause: EngineUVWebGPUError) => void>();
  private layouts: object[] = [];
  private pipelineLayout: object | null = null;
  private sampler: object | null = null;
  private configured = false;
  private deviceDestroyed = false;
  private expectedWidth: number;
  private expectedHeight: number;
  constructor(readonly canvas: HTMLCanvasElement, private cpu: PreparedEngineUVWebGPUFrame,
    private readonly device: GPUDeviceHandle, private readonly context: GPUCanvasHandle,
    private readonly limits: Record<string, number>) {
    this.expectedWidth = canvas.width; this.expectedHeight = canvas.height;
    void device.lost.then(info => {
      if (this.state === 'disposed' || this.state === 'failed' || this.state === 'lost') return;
      this.state = 'lost'; this.terminalError = new EngineUVWebGPUError('DEVICE_LOST', 'Actual WebGPU device was lost; explicit remount required', info);
      this.invalidate();
      const failures = [...this.releaseOwned(), ...this.releaseDevice()];
      if (failures.length)
        this.terminalError = new EngineUVWebGPUError('DEVICE_LOST', 'Actual device loss and cleanup refused', new AggregateError([this.terminalError, ...failures]));
    }, cause => {
      if (this.state === 'ready') this.failTerminal(new EngineUVWebGPUError('DEVICE_LOST', 'Actual device loss observation rejected', cause));
    });
  }
  get originals(): EngineUVWebGPUOriginals { return copyEngineUVWebGPUOriginals(this.cpu); }
  get selected(): EngineUVWebGPURef | null { return copiedRef(this.selectedRef); }
  get status(): EngineUVWebGPUStatus {
    return Object.freeze({ backend: 'webgpu', profile: 'engine-opaque-unlit-uv-texture-program-wgsl-v0',
      state: this.state, generation: this.generation, width: this.cpu.width, height: this.cpu.height,
      limits: Object.freeze({ ...this.limits }), resources: this.accepted === null ? zeroResources() : Object.freeze({ ...this.cpu.resources }) });
  }
  private live(): void {
    if (this.state !== 'ready') error('STATE', 'Viewport is ' + this.state + '; explicit remount required');
    if (this.canvas.width !== this.expectedWidth || this.canvas.height !== this.expectedHeight)
      error('STATE', 'Host changed backing dimensions outside resize; explicit remount required');
  }
  private enter(): number {
    if (this.state !== 'ready') error('STATE', 'Viewport is ' + this.state + '; explicit remount required');
    if (this.busy) error('BUSY', 'One asynchronous operation is already pending');
    this.live(); this.busy = true; return this.epoch;
  }
  private check(epoch: number): void {
    if (epoch !== this.epoch || this.state !== 'ready') throw this.terminalError ?? new EngineUVWebGPUError('STATE', 'Operation was invalidated; explicit remount required');
  }
  private invalidate(): void {
    this.epoch++;
    const cause = this.terminalError ?? new EngineUVWebGPUError('STATE', 'Viewport is ' + this.state);
    for (const cancel of [...this.waits]) cancel(cause);
  }
  private releaseOwned(): unknown[] {
    const failures = [...release(this.accepted), ...release(this.candidate), ...releaseReadback(this.readback)];
    this.accepted = null; this.candidate = null; this.readback = null;
    this.layouts.length = 0; this.pipelineLayout = null; this.sampler = null;
    return failures;
  }
  private releaseDevice(): unknown[] {
    const failures: unknown[] = [];
    if (this.configured) { this.configured = false; try { this.context.unconfigure(); } catch (cause) { failures.push(cause); } }
    if (!this.deviceDestroyed) { this.deviceDestroyed = true; try { this.device.destroy(); } catch (cause) { failures.push(cause); } }
    return failures;
  }
  private failTerminal(cause: EngineUVWebGPUError): void {
    if (this.state !== 'ready') return;
    this.state = 'failed'; this.terminalError = cause; this.invalidate();
    const failures = [...this.releaseOwned(), ...this.releaseDevice()];
    if (failures.length) this.terminalError = new EngineUVWebGPUError('RENDER', 'Terminal cleanup also refused', new AggregateError([cause, ...failures]));
  }
  private wait<T>(promise: Promise<T>, epoch: number, label: string, late?: (value: T) => void): Promise<T> {
    return new Promise((resolve, reject) => {
      let closed = false;
      const close = (): void => { closed = true; clearTimeout(timer); this.waits.delete(cancel); };
      const cancel = (cause: EngineUVWebGPUError): void => { if (!closed) { close(); reject(cause); } };
      const timer = setTimeout(() => {
        if (closed) return;
        const cause = new EngineUVWebGPUError('STATE', label + ' exceeded10s; explicit remount required');
        close(); this.failTerminal(cause); reject(cause);
      }, WAIT_MS);
      this.waits.add(cancel);
      promise.then(value => {
        if (closed) { try { late?.(value); } catch { /* Terminal work cannot escape or commit. */ } return; }
        close(); try { this.check(epoch); resolve(value); } catch (cause) { reject(cause); }
      }, cause => { if (!closed) { close(); reject(cause); } });
    });
  }
  private async scoped<T>(epoch: number, operation: () => Promise<T>): Promise<T> {
    this.check(epoch);
    let pushed = 0, failed = false, original: unknown, result: T | undefined;
    try {
      for (const filter of ['out-of-memory', 'internal', 'validation']) { this.device.pushErrorScope(filter); pushed++; }
      result = await operation();
    } catch (cause) { failed = true; original = cause; }
    // Pop synchronously in reverse scope order; every returned promise has a rejection handler.
    const pops: Promise<{ error?: { message: string } | null; rejected?: true; cause?: unknown }>[] = [];
    for (let i = 0; i < pushed; i++) {
      try { pops.push(this.device.popErrorScope().then(value => ({ error: value }), cause => ({ rejected: true as const, cause }))); }
      catch (cause) { pops.push(Promise.resolve({ rejected: true, cause })); }
    }
    if (this.state !== 'ready' || epoch !== this.epoch) { void Promise.all(pops); throw failed ? original : this.terminalError ?? new EngineUVWebGPUError('STATE', 'Scopes were invalidated'); }
    const outcomes = await this.wait(Promise.all(pops), epoch, 'Device error scopes');
    const scopeFailures = outcomes.filter(value => value.rejected || value.error !== null && value.error !== undefined)
      .map(value => value.rejected ? value.cause : value.error);
    if (failed) {
      if (scopeFailures.length) throw new EngineUVWebGPUError('RENDER', 'Operation and actual device scope refused', new AggregateError([original, ...scopeFailures]));
      throw original;
    }
    if (scopeFailures.length) throw new EngineUVWebGPUError('RENDER', 'Actual device error scope refused', scopeFailures.length === 1 ? scopeFailures[0] : new AggregateError(scopeFailures));
    this.check(epoch); return result as T;
  }
  async initialize(): Promise<void> {
    const epoch = this.enter();
    try {
      await this.scoped(epoch, async () => {
        this.live();
        this.configured = true;
        this.context.configure({ device: this.device, format: 'rgba8unorm', alphaMode: 'opaque', colorSpace: 'srgb', usage: RENDER_ATTACHMENT | TEXTURE_COPY_DST });
        this.layouts = [
          this.device.createBindGroupLayout({ entries: [
            { binding: 0, visibility: 1, buffer: { type: 'uniform', minBindingSize: 128 } },
            { binding: 1, visibility: 2, buffer: { type: 'uniform', minBindingSize: 64 } },
          ] }),
          this.device.createBindGroupLayout({ entries: [
            { binding: 0, visibility: 2, texture: { sampleType: 'float', viewDimension: '2d', multisampled: false } },
            { binding: 1, visibility: 2, sampler: { type: 'filtering' } },
          ] }),
          this.device.createBindGroupLayout({ entries: [{ binding: 0, visibility: 3, buffer: { type: 'uniform', minBindingSize: 80 } }] }),
        ];
        this.pipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: this.layouts });
        this.sampler = this.device.createSampler({ addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge',
          magFilter: 'nearest', minFilter: 'nearest', mipmapFilter: 'nearest', lodMinClamp: 0, lodMaxClamp: 0 });
      });
      await this.replace(this.cpu, epoch);
    } catch (cause) { this.dispose(); throw wrapped(cause, 'INIT', 'Actual WebGPU initialization refused'); }
    finally { this.busy = false; }
  }
  private upload(candidate: Candidate, bytes: Uint8Array, usage: number): GPUBufferHandle {
    const buffer = this.device.createBuffer({ size: bytes.byteLength, usage: usage | BUFFER_COPY_DST });
    candidate.buffers.push(buffer); this.device.queue.writeBuffer(buffer, 0, bytes); return buffer;
  }
  private target(candidate: Candidate, format: string, usage: number): GPUTextureHandle {
    const texture = this.device.createTexture({ size: { width: candidate.frame.width, height: candidate.frame.height, depthOrArrayLayers: 1 }, format, usage });
    candidate.textures.push(texture); return texture;
  }
  private async create(frame: PreparedEngineUVWebGPUFrame, epoch: number): Promise<Candidate> {
    const candidate: Candidate = { frame, buffers: [], textures: [], geometries: new Map(), materials: new Map(), draws: new Map(), modules: [], color: null, identity: null, depth: null, released: false };
    this.candidate = candidate;
    const frameBuffer = this.upload(candidate, frame.frameUniforms, UNIFORM);
    for (const geometry of frame.geometries) candidate.geometries.set(geometry.geometryId, {
      position: this.upload(candidate, geometry.positions, VERTEX), uv: this.upload(candidate, geometry.uvs, VERTEX),
      index: this.upload(candidate, geometry.indices, INDEX), format: geometry.indexFormat, count: geometry.indexCount,
    });
    const textures = new Map<string, GPUTextureHandle>();
    for (const source of frame.joined.textures) {
      const texture = this.device.createTexture({ size: { width: source.texture.width, height: source.texture.height, depthOrArrayLayers: 1 },
        format: 'rgba8unorm', dimension: '2d', mipLevelCount: 1, sampleCount: 1, usage: TEXTURE_BINDING | TEXTURE_COPY_DST });
      candidate.textures.push(texture); textures.set(source.texture.id, texture);
      this.device.queue.writeTexture({ texture, mipLevel: 0, origin: { x: 0, y: 0, z: 0 } }, source.pixels,
        { offset: 0, bytesPerRow: source.texture.width * 4, rowsPerImage: source.texture.height },
        { width: source.texture.width, height: source.texture.height, depthOrArrayLayers: 1 });
    }
    for (const material of frame.materials) {
      const module = this.device.createShaderModule({ code: material.program.code }); candidate.modules.push(module);
      const info = await this.wait(module.getCompilationInfo(), epoch, 'Shader compilation');
      if (info.messages.some(message => message.type === 'error')) throw new EngineUVWebGPUError('RENDER', 'Actual WGSL compilation refused', info);
      const pipeline = await this.wait(this.device.createRenderPipelineAsync({ layout: this.pipelineLayout,
        vertex: { module, entryPoint: material.program.entryPoints.vertex, buffers: [
          { arrayStride: 12, stepMode: 'vertex', attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
          { arrayStride: 8, stepMode: 'vertex', attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x2' }] },
        ] }, fragment: { module, entryPoint: material.program.entryPoints.fragment, targets: [{ format: 'rgba8unorm' }, { format: 'r32uint' }] },
        primitive: { topology: 'triangle-list', cullMode: 'none' }, depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' }, multisample: { count: 1 },
      }), epoch, 'Pipeline creation');
      const materialBuffer = this.upload(candidate, material.uniforms, UNIFORM), texture = textures.get(material.textureId);
      if (!texture) error('REFERENCE', 'Admitted authored texture resource is missing');
      candidate.materials.set(material.materialId, { pipeline,
        frameGroup: this.device.createBindGroup({ layout: this.layouts[0], entries: [
          { binding: 0, resource: { buffer: frameBuffer } }, { binding: 1, resource: { buffer: materialBuffer } },
        ] }), textureGroup: this.device.createBindGroup({ layout: this.layouts[1], entries: [
          { binding: 0, resource: texture.createView() }, { binding: 1, resource: this.sampler },
        ] }),
      });
    }
    for (const draw of frame.draws) candidate.draws.set(draw.identity, this.device.createBindGroup({ layout: this.layouts[2], entries: [
      { binding: 0, resource: { buffer: this.upload(candidate, draw.uniforms, UNIFORM) } },
    ] }));
    candidate.color = this.target(candidate, 'rgba8unorm', RENDER_ATTACHMENT | COPY_SRC);
    candidate.identity = this.target(candidate, 'r32uint', RENDER_ATTACHMENT | COPY_SRC);
    candidate.depth = this.target(candidate, 'depth24plus', RENDER_ATTACHMENT);
    const encoder = this.device.createCommandEncoder(), background = frame.background;
    const pass = encoder.beginRenderPass({ colorAttachments: [
      { view: candidate.color.createView(), clearValue: { r: background[0], g: background[1], b: background[2], a: 1 }, loadOp: 'clear', storeOp: 'store' },
      { view: candidate.identity.createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' },
    ], depthStencilAttachment: { view: candidate.depth.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' } });
    for (const draw of frame.draws) {
      const material = candidate.materials.get(draw.materialId), geometry = candidate.geometries.get(draw.geometryId), group = candidate.draws.get(draw.identity);
      if (!material || !geometry || !group) error('REFERENCE', 'Admitted visible draw resource is missing');
      pass.setPipeline(material.pipeline); pass.setBindGroup(0, material.frameGroup); pass.setBindGroup(1, material.textureGroup); pass.setBindGroup(2, group);
      pass.setVertexBuffer(0, geometry.position); pass.setVertexBuffer(1, geometry.uv); pass.setIndexBuffer(geometry.index, geometry.format); pass.drawIndexed(geometry.count);
    }
    pass.end(); this.device.queue.submit([encoder.finish()]);
    await this.wait(this.device.queue.onSubmittedWorkDone(), epoch, 'Candidate rendering');
    this.check(epoch); return candidate;
  }
  private async present(candidate: Candidate, epoch: number): Promise<void> {
    if (!candidate.color || candidate.released) error('STATE', 'Presentation resource was released');
    const encoder = this.device.createCommandEncoder();
    encoder.copyTextureToTexture({ texture: candidate.color }, { texture: this.context.getCurrentTexture() },
      { width: candidate.frame.width, height: candidate.frame.height, depthOrArrayLayers: 1 });
    this.device.queue.submit([encoder.finish()]); await this.wait(this.device.queue.onSubmittedWorkDone(), epoch, 'Canvas presentation');
  }
  private async replace(frame: PreparedEngineUVWebGPUFrame, epoch: number): Promise<void> {
    assertEngineUVWebGPUResidency(this.accepted?.frame ?? null, frame); requireLimits(this.limits, frame);
    const oldWidth = this.expectedWidth, oldHeight = this.expectedHeight;
    let presentationAttempted = false;
    try {
      const candidate = await this.scoped(epoch, () => this.create(frame, epoch));
      this.live(); presentationAttempted = true;
      this.canvas.width = frame.width; this.canvas.height = frame.height;
      await this.scoped(epoch, () => this.present(candidate, epoch)); this.check(epoch);
      if (this.canvas.width !== frame.width || this.canvas.height !== frame.height)
        error('STATE', 'Host changed candidate dimensions during presentation');
      const previous = this.accepted;
      this.accepted = candidate; this.candidate = null; this.cpu = frame;
      this.expectedWidth = frame.width; this.expectedHeight = frame.height; this.generation++;
      if (this.selectedRef && !frame.draws.some(draw => sameRef(draw.ref, this.selectedRef!))) this.selectedRef = null;
      const failures = release(previous);
      if (failures.length) { const cause = new EngineUVWebGPUError('RENDER', 'Previous candidate cleanup refused', new AggregateError(failures)); this.failTerminal(cause); throw cause; }
    } catch (cause) {
      let failure = wrapped(cause, 'RENDER', 'Candidate rendering or presentation refused');
      if (presentationAttempted && this.state === 'ready' && epoch === this.epoch) {
        try {
          this.canvas.width = oldWidth; this.canvas.height = oldHeight;
          if (this.accepted) await this.scoped(epoch, () => this.present(this.accepted!, epoch));
          this.check(epoch);
          if (this.canvas.width !== oldWidth || this.canvas.height !== oldHeight)
            error('STATE', 'Host changed accepted dimensions during presentation recovery');
        } catch (recovery) {
          failure = new EngineUVWebGPUError('RENDER', 'Presentation and accepted recovery refused', new AggregateError([failure, recovery]));
          this.failTerminal(failure);
        }
      }
      const failures = release(this.candidate); this.candidate = null;
      if (failures.length) { failure = new EngineUVWebGPUError('RENDER', 'Candidate cleanup also refused', new AggregateError([failure, ...failures])); this.failTerminal(failure); }
      throw failure;
    }
  }
  async updateFrame(scene: unknown, texture: unknown, material: unknown): Promise<UpdateResult> {
    let entered = false;
    try { const epoch = this.enter(); entered = true; const frame = prepareEngineUVWebGPUFrame(scene, texture, material, this.cpu.width, this.cpu.height); await this.replace(frame, epoch); return { ok: true }; }
    catch (cause) { return { ok: false, error: wrapped(cause, 'RENDER', 'Frame update refused') }; }
    finally { if (entered) this.busy = false; }
  }
  async resize(width: number, height: number): Promise<UpdateResult> {
    let entered = false;
    try {
      const epoch = this.enter(); entered = true;
      const options = validateEngineUVWebGPUOptions({ width, height }), originals = this.originals;
      const frame = prepareEngineUVWebGPUFrame(originals.scene, originals.textureBindings, originals.materialBindings, options.width, options.height);
      await this.replace(frame, epoch); return { ok: true };
    } catch (cause) { return { ok: false, error: wrapped(cause, 'RENDER', 'Resize refused') }; }
    finally { if (entered) this.busy = false; }
  }
  private async download(epoch: number, identity: boolean, x = 0, y = 0): Promise<Uint8Array> {
    const accepted = this.accepted;
    if (!accepted || !accepted.color || !accepted.identity) error('STATE', 'No accepted render attachment');
    const width = identity ? 1 : accepted.frame.width, height = identity ? 1 : accepted.frame.height;
    const rowBytes = Math.ceil(width * 4 / 256) * 256;
    let readback: Readback | null = null, failed = false, original: unknown;
    let pixelsResult: Uint8Array | undefined, cleanupFailure: EngineUVWebGPUError | undefined;
    try {
      await this.scoped(epoch, async () => {
        const buffer = this.device.createBuffer({ size: rowBytes * height, usage: MAP_READ | BUFFER_COPY_DST });
        readback = { buffer, released: false }; this.readback = readback;
        const encoder = this.device.createCommandEncoder();
        encoder.copyTextureToBuffer({ texture: identity ? accepted.identity : accepted.color, origin: { x, y, z: 0 } },
          { buffer, bytesPerRow: rowBytes, rowsPerImage: height }, { width, height, depthOrArrayLayers: 1 });
        this.device.queue.submit([encoder.finish()]); await this.wait(this.device.queue.onSubmittedWorkDone(), epoch, 'Readback submission');
        await this.wait(buffer.mapAsync(MAP_READ), epoch, 'Readback mapping', () => { releaseReadback(readback); });
      });
      this.check(epoch); this.live();
      const mapped = readback as Readback | null;
      if (!mapped || mapped.released) error('STATE', 'Readback was invalidated');
      const padded = new Uint8Array(mapped.buffer.getMappedRange()), pixels = new Uint8Array(width * height * 4);
      for (let row = 0; row < height; row++) pixels.set(padded.subarray(row * rowBytes, row * rowBytes + width * 4), row * width * 4);
      pixelsResult = pixels;
    } catch (cause) {
      failed = true; original = cause;
    } finally {
      const failures = releaseReadback(readback); if (this.readback === readback) this.readback = null;
      if (failures.length) {
        cleanupFailure = new EngineUVWebGPUError('RENDER', 'Readback cleanup refused', new AggregateError(failed ? [original, ...failures] : failures));
        this.failTerminal(cleanupFailure);
      }
    }
    if (cleanupFailure) throw cleanupFailure;
    if (failed) throw original;
    if (!pixelsResult) error('STATE', 'Readback produced no pixels');
    return pixelsResult;
  }
  async readPixels(): Promise<Uint8Array> {
    let entered = false;
    try {
      const epoch = this.enter(); entered = true; const pixels = await this.download(epoch, false);
      this.check(epoch); this.live(); return pixels;
    }
    catch (cause) { throw wrapped(cause, 'RENDER', 'Actual pixel readback refused'); }
    finally { if (entered) this.busy = false; }
  }
  async pick(x: number, y: number): Promise<{ generation: number; ref: EngineUVWebGPURef | null }> {
    let entered = false;
    try {
      const epoch = this.enter(); entered = true;
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= this.cpu.width || y >= this.cpu.height)
        error('INPUT', 'Pick requires an integer top-left backing pixel');
      const generation = this.generation, pixels = await this.download(epoch, true, x, y);
      this.check(epoch); this.live();
      const token = new DataView(pixels.buffer, pixels.byteOffset, pixels.byteLength).getUint32(0, true);
      const draw = token === 0 ? null : this.cpu.draws.find(candidate => candidate.identity === token);
      if (token !== 0 && !draw) error('RENDER', 'Actual identity attachment contained an unknown token');
      return Object.freeze({ generation, ref: copiedRef(draw?.ref ?? null) });
    } catch (cause) { throw wrapped(cause, 'RENDER', 'Actual identity readback refused'); }
    finally { if (entered) this.busy = false; }
  }
  select(input: unknown): UpdateResult {
    try {
      if (this.state !== 'ready') error('STATE', 'Viewport is ' + this.state + '; explicit remount required');
      if (this.busy) error('BUSY', 'Selection refused during pending operation'); this.live();
      const ref = input === null ? null : validateEngineUVWebGPURef(input);
      if (ref && !this.cpu.draws.some(draw => sameRef(draw.ref, ref))) error('REFERENCE', 'Selection must match an accepted visible source draw');
      this.selectedRef = copiedRef(ref); return { ok: true };
    } catch (cause) { return { ok: false, error: wrapped(cause, 'INPUT', 'Selection refused') }; }
  }
  dispose(): void {
    if (this.state === 'disposed') return;
    this.state = 'disposed'; this.terminalError = new EngineUVWebGPUError('STATE', 'Viewport was disposed');
    this.invalidate(); this.releaseOwned(); this.releaseDevice(); this.selectedRef = null;
  }
}

/** Required native WebGPU only. Original admission precedes every device await. */
export async function mountEngineUVTextureWebGPUViewport(
  canvasInput: unknown, sceneInput: unknown, textureInput: unknown, materialInput: unknown, optionsInput: unknown,
): Promise<EngineUVTextureWebGPUViewport> {
  const options = validateEngineUVWebGPUOptions(optionsInput);
  const frame = prepareEngineUVWebGPUFrame(sceneInput, textureInput, materialInput, options.width, options.height);
  const { canvas, width: initialWidth, height: initialHeight } = admittedCanvas(canvasInput);
  let device: GPUDeviceHandle | null = null, context: GPUCanvasHandle | null = null, viewport: EngineUVViewport | null = null;
  try {
    const platform = (navigator as Navigator & { gpu?: GPUPlatformHandle }).gpu;
    if (!platform) error('UNSUPPORTED', 'Actual navigator.gpu is unavailable; no generic fallback');
    const adapter = await mountWait(platform.requestAdapter());
    if (!adapter) error('UNSUPPORTED', 'No actual WebGPU adapter; no generic fallback');
    device = await mountWait(adapter.requestDevice({ requiredFeatures: [] }), late => late.destroy());
    const limits = snapshotLimits(device); requireLimits(limits, frame);
    if (canvas.width !== initialWidth || canvas.height !== initialHeight) error('STATE', 'Host changed canvas backing dimensions during mount');
    context = canvas.getContext('webgpu') as unknown as GPUCanvasHandle | null;
    if (!context) error('INIT', 'Actual WebGPU canvas context is unavailable');
    viewport = new EngineUVViewport(canvas, frame, device, context, limits);
    await viewport.initialize(); return viewport;
  } catch (cause) {
    if (viewport) viewport.dispose();
    else { try { context?.unconfigure(); } catch { /* Preserve original mount error. */ } try { device?.destroy(); } catch { /* Preserve original mount error. */ } }
    throw wrapped(cause, 'INIT', 'Actual WebGPU mount refused');
  }
}
