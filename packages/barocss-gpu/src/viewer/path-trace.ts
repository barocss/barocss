// Offscreen progressive compute rendering. A session owns an immutable scene/camera snapshot and its GPU resources.
import { BufferUsage, MapMode, TextureUsage, type BindGroup, type Buffer, type Device, type Pipeline, type Texture } from './gpu.js';
import { Camera } from './camera.js';
import { linear, packOutput, parseColor, type Background, type Environment, type Light } from './lights.js';
import { normalize, type Vec3 } from './math.js';
import { ImageTexture, type Mesh } from './scene.js';
import { traceMapPixels, traceScene, traceSize } from './path-trace-scene.js';
import { pathTraceDisplayWGSL, pathTraceWGSL } from './shaders/path-trace.js';
import { ViewerError } from './viewer-error.js';

export interface PathTraceOptions {
  /** Output backing pixels, independent of the interactive canvas. Defaults to that canvas's size. */
  width?: number; height?: number;
  /** Maximum surface bounces, 1–16 (default 6); finite-depth transport, with Russian roulette after bounce 3. */
  bounces?: number;
}
export interface PathTraceImage { width: number; height: number; data: Uint8Array }
export interface TraceSnapshot { meshes: readonly Mesh[]; camera: Camera; environment: Environment; lights: readonly Light[]; background: Background; width: number; height: number; clipped: boolean }

/** Frozen still. start() samples until stop(); sample() permits deterministic, bounded batches for tools and tests. */
export class PathTraceSession {
  private dead = false;
  private active = false;
  private epoch = 0;
  private count = 0;
  private tail: Promise<unknown> = Promise.resolve();
  private readonly buffers: Buffer[] = [];
  private atlas!: Texture;
  private target!: Texture;
  private params!: Buffer;
  private options!: Buffer;
  private tracePipeline!: Pipeline;
  private displayPipeline!: Pipeline;
  private traceGroup!: BindGroup;
  private displayGroup!: BindGroup;
  private block!: Float32Array;
  private constructor(private readonly device: Device, readonly width: number, readonly height: number, private readonly removed: (session: PathTraceSession) => void) {}
  get samples(): number { return this.count; }
  get running(): boolean { return this.active; }

  /** @internal The viewer owns creation and disposes sessions on device loss or shutdown. */
  static async create(device: Device, snapshot: TraceSnapshot, options: PathTraceOptions, removed: (session: PathTraceSession) => void): Promise<PathTraceSession> {
    const width = options.width ?? snapshot.width, height = options.height ?? snapshot.height, bounces = options.bounces ?? 6;
    traceSize(width, height, device.limits.maxTextureDimension2D);
    if (!Number.isInteger(bounces) || bounces < 1 || bounces > 16) throw new ViewerError('PATH_TRACE_UNSUPPORTED', 'Path tracing bounces must be an integer from 1 to 16');
    if (snapshot.clipped) throw new ViewerError('PATH_TRACE_UNSUPPORTED', 'Path tracing section clips and caps is not supported');
    const frozenCamera = new Camera(structuredClone(snapshot.camera.state())); frozenCamera.near = snapshot.camera.near;
    snapshot = { ...snapshot, camera: frozenCamera, environment: { ...structuredClone({ ...snapshot.environment, map: null }), map: snapshot.environment.map }, lights: structuredClone(snapshot.lights), background: structuredClone(snapshot.background) };
    const scene = traceScene(snapshot.meshes), env = snapshot.environment, maps = [...scene.maps];
    let envLayer = 0;
    if (env.map) {
      if (!(env.map instanceof ImageTexture) || env.map.disposed) throw new ViewerError('TEXTURE_INVALID', 'Path tracing needs a live viewer environment texture');
      let i = maps.indexOf(env.map); if (i < 0) { i = maps.length; maps.push(env.map); } envLayer = i + 1;
    }
    const atlasWidth = Math.max(1, ...maps.map(m => m.width)), atlasHeight = Math.max(1, ...maps.map(m => m.height));
    traceSize(atlasWidth, atlasHeight, device.limits.maxTextureDimension2D);
    if (maps.length + 1 > device.limits.maxTextureArrayLayers) throw new ViewerError('TEXTURE_INVALID', 'Too many path tracing texture layers');
    // Do the CPU image copies now; later source edits/disposal cannot change this still.
    const pixels = maps.map(m => traceMapPixels(m, atlasWidth, atlasHeight));
    const session = new PathTraceSession(device, width, height, removed);
    device.pushErrorScope('validation');
    let scope = true;
    try {
      const traceModule = device.createShaderModule({ code: pathTraceWGSL, label: 'path trace transport' });
      const displayModule = device.createShaderModule({ code: pathTraceDisplayWGSL, label: 'path trace denoise/output' });
      const diagnostics = await Promise.all([traceModule.getCompilationInfo(), displayModule.getCompilationInfo()]);
      const errors = diagnostics.flatMap(info => info.messages.filter(m => m.type === 'error').map(m => `${m.lineNum}: ${m.message}`));
      if (errors.length) throw new ViewerError('SHADER', errors.join('\n'));
      const [trace, display] = await Promise.all([
        device.createComputePipelineAsync({ label: 'viewer path trace', layout: 'auto', compute: { module: traceModule, entryPoint: 'trace' } }),
        device.createComputePipelineAsync({ label: 'viewer path trace denoise/output', layout: 'auto', compute: { module: displayModule, entryPoint: 'display' } }),
      ]);
      session.tracePipeline = trace; session.displayPipeline = display;
      const storage = (data: ArrayBuffer | Float32Array | number, label: string, uniform = false) => {
        const size = typeof data === 'number' ? data : data.byteLength;
        if (size > device.limits.maxBufferSize || (!uniform && size > device.limits.maxStorageBufferBindingSize)) throw new ViewerError('SIZE_INVALID', 'Path tracing data exceeds the device buffer limit');
        const b = device.createBuffer({ size: Math.max(16, size), usage: BufferUsage.COPY_DST | (uniform ? BufferUsage.UNIFORM : BufferUsage.STORAGE), label }); session.buffers.push(b);
        if (typeof data !== 'number') device.queue.writeBuffer(b, 0, data instanceof ArrayBuffer ? new Uint8Array(data) : data);
        return b;
      };
      const nodes = storage(scene.bvh.nodes, 'trace BVH nodes'), triangles = storage(scene.bvh.triangles, 'trace BVH triangles');
      const attributes = storage(scene.attributes, 'trace triangle attributes'), materials = storage(scene.materials, 'trace materials');
      const accumulation = storage(width * height * 16, 'trace accumulation'), guides = storage(width * height * 16, 'trace guides');
      const camera = new Camera(snapshot.camera.state()); camera.near = snapshot.camera.near;
      const basis = camera.basis(), aspect = width / height, half = camera.projection === 'perspective' ? Math.tan(camera.fovY * Math.PI / 360) : camera.halfHeight;
      const f = new Float32Array(36), u = new Uint32Array(f.buffer);
      const origin = camera.projection === 'perspective' ? camera.position : camera.position.map((v, i) => v + basis.forward[i] * camera.near);
      f.set([...origin, camera.projection === 'perspective' ? 1 : 0], 0);
      f.set([...basis.right, half * aspect], 4); f.set([...basis.up, half], 8); f.set([...basis.forward, 0], 12);
      f.set([...linear(parseColor(env.sky, [0.85, 0.9, 1])), env.ambient ?? 0.3], 16); f.set([...linear(parseColor(env.ground, [0.45, 0.42, 0.4])), 0], 20);
      u.set([width, height, 0, bounces], 24); f.set([envLayer, env.mapIntensity ?? 1, snapshot.lights.length, 0], 28); f.set([...normalize(camera.up), 0], 32);
      session.block = f; session.params = storage(f, 'trace camera', true);
      const lightData = new Float32Array(Math.max(1, snapshot.lights.length) * 16);
      snapshot.lights.forEach((l, i) => {
        const o = i * 16, pos: Vec3 = l.kind === 'directional' ? [0, 0, 0] : l.position, dir = l.kind === 'point' ? [0, 0, 0] : normalize(l.direction);
        lightData.set([...pos, l.kind === 'directional' ? 0 : l.kind === 'point' ? 1 : 2, ...dir, l.kind === 'directional' ? 0 : l.range ?? 0, ...linear(parseColor(l.color)), l.intensity ?? 1], o);
        if (l.kind === 'spot') { const outer = (l.angle ?? 30) * Math.PI / 180, inner = outer * (1 - Math.min(1, Math.max(0, l.penumbra ?? 0.2))); lightData.set([Math.max(Math.cos(inner), Math.cos(outer) + 1e-4), Math.cos(outer), 0, 0], o + 12); }
      });
      const lights = storage(lightData, 'trace lights');
      session.atlas = device.createTexture({ label: 'trace image atlas', size: [atlasWidth, atlasHeight, maps.length + 1], format: 'rgba8unorm-srgb', usage: TextureUsage.TEXTURE_BINDING | TextureUsage.COPY_DST });
      const white = new Uint8Array(atlasWidth * atlasHeight * 4).fill(255);
      for (const [i, data] of [white, ...pixels].entries()) device.queue.writeTexture({ texture: session.atlas, origin: [0, 0, i] }, data, { bytesPerRow: atlasWidth * 4 }, [atlasWidth, atlasHeight, 1]);
      session.traceGroup = device.createBindGroup({ layout: trace.getBindGroupLayout(0), entries: [...[nodes, triangles, attributes, materials, accumulation, guides, session.params, lights].map((b, binding) => ({ binding, resource: { buffer: b } })), { binding: 8, resource: session.atlas.createView({ dimension: '2d-array' }) }] });
      session.target = device.createTexture({ label: 'trace export', size: [width, height], format: 'rgba8unorm', usage: TextureUsage.STORAGE_BINDING | TextureUsage.COPY_SRC });
      const output = storage(packOutput(env, [], 0, snapshot.background), 'trace tone/grading', true);
      session.options = storage(new Uint32Array(4).buffer, 'trace denoiser options', true);
      session.displayGroup = device.createBindGroup({ layout: display.getBindGroupLayout(0), entries: [
        { binding: 0, resource: { buffer: accumulation } }, { binding: 1, resource: { buffer: guides } }, { binding: 2, resource: { buffer: output } },
        { binding: 3, resource: session.target.createView() }, { binding: 4, resource: { buffer: session.options } },
      ] });
      const error = await device.popErrorScope(); scope = false;
      if (error) throw new ViewerError('PIPELINE', error.message);
      return session;
    } catch (error) {
      try { if (scope) await device.popErrorScope(); } catch { /* Preserve the original pipeline/device failure. */ }
      finally { session.dispose(); }
      throw error;
    }
  }

  private alive(): void { if (this.dead) throw new ViewerError('DISPOSED', 'The path tracing session has been disposed'); }
  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const next = this.tail.then(() => { this.alive(); return work(); }); this.tail = next.catch(() => undefined); return next;
  }
  private one(): Promise<number> {
    return this.enqueue(async () => {
      if (this.count >= 16777215) throw new ViewerError('PATH_TRACE_UNSUPPORTED', 'Path tracing reached its f32 sample count limit');
      new Uint32Array(this.block.buffer)[26] = this.count; this.device.queue.writeBuffer(this.params, 0, this.block);
      const enc = this.device.createCommandEncoder(), pass = enc.beginComputePass({ label: 'progressive still sample' });
      pass.setPipeline(this.tracePipeline); pass.setBindGroup(0, this.traceGroup); pass.dispatchWorkgroups(Math.ceil(this.width / 8), Math.ceil(this.height / 8)); pass.end();
      this.device.queue.submit([enc.finish()]); await this.device.queue.onSubmittedWorkDone(); this.alive(); return ++this.count;
    });
  }
  async sample(count = 1): Promise<number> {
    this.alive(); if (this.active) throw new ViewerError('PATH_TRACE_BUSY', 'Stop progressive rendering before manual sampling');
    if (!Number.isInteger(count) || count < 1 || count > 64) throw new ViewerError('PATH_TRACE_UNSUPPORTED', 'A manual sample batch must contain 1 to 64 samples');
    for (let i = 0; i < count; i++) await this.one(); return this.count;
  }
  async start(onProgress?: (samples: number) => void): Promise<void> {
    this.alive(); if (this.active) throw new ViewerError('PATH_TRACE_BUSY', 'Progressive rendering is already running');
    this.active = true; const epoch = ++this.epoch;
    try { while (this.active && !this.dead && this.epoch === epoch) { await this.one(); if (this.active && !this.dead && this.epoch === epoch) onProgress?.(this.count); await new Promise<void>(resolve => setTimeout(resolve, 0)); } }
    finally { if (this.epoch === epoch) this.active = false; }
  }
  stop(): void { this.active = false; this.epoch++; }
  capture(denoise = true): Promise<PathTraceImage> {
    return this.enqueue(async () => {
      if (!this.count) throw new ViewerError('PATH_TRACE_BUSY', 'Sample the still before capturing it');
      this.device.queue.writeBuffer(this.options, 0, new Uint32Array([denoise ? 1 : 0, 0, 0, 0]));
      const row = Math.ceil(this.width * 4 / 256) * 256;
      const read = this.device.createBuffer({ size: row * this.height, usage: BufferUsage.COPY_DST | BufferUsage.MAP_READ, label: 'trace PNG readback' });
      try {
        const enc = this.device.createCommandEncoder(), pass = enc.beginComputePass({ label: 'trace denoise and output' });
        pass.setPipeline(this.displayPipeline); pass.setBindGroup(0, this.displayGroup); pass.dispatchWorkgroups(Math.ceil(this.width / 8), Math.ceil(this.height / 8)); pass.end();
        enc.copyTextureToBuffer({ texture: this.target }, { buffer: read, bytesPerRow: row }, [this.width, this.height]); this.device.queue.submit([enc.finish()]);
        await read.mapAsync(MapMode.READ); this.alive();
        const src = new Uint8Array(read.getMappedRange()), data = new Uint8Array(this.width * this.height * 4);
        for (let y = 0; y < this.height; y++) data.set(src.subarray(y * row, y * row + this.width * 4), y * this.width * 4);
        read.unmap(); return { width: this.width, height: this.height, data };
      } finally { read.destroy(); }
    });
  }
  dispose(): void {
    if (this.dead) return; this.dead = true; this.stop();
    for (const b of this.buffers) b.destroy(); this.buffers.length = 0;
    this.atlas?.destroy(); this.target?.destroy(); this.removed(this);
  }
}
