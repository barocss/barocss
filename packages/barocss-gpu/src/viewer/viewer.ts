// One WebGPU renderer for a canvas: it owns the device and the canvas context, keeps geometry in long-
// lived buffers and every pipeline it needs, renders on demand (one frame per animation frame at most),
// follows the canvas size and pixel ratio, and recreates its device and re-uploads the scene when the
// device is lost. Meshes carry a transform and a material; lights and the camera are plain data.
import { boxCenter, boxInFrustum, boxRadius, frustumPlanes, transformBox, unionBox, type Box3 } from './bounds.js';
import { Camera } from './camera.js';
import { OrbitControls, type OrbitOptions } from './controls.js';
import { prepareGeometry, rayTriangles, segmentInstances, vertexColors, type GeometryInput, type PreparedGeometry } from './geometry.js';
import { BufferUsage, MapMode, TextureUsage, gpuOf, type BindGroup, type Buffer, type CanvasContext, type Device, type Pipeline, type RenderPass, type Texture } from './gpu.js';
import { defaultLights, directionalLights, linear, packFrame, packOutput, parseColor, type Background, type Color, type Environment, type GridFrame, type Light, type ShadowFrame } from './lights.js';
import { add, cross, dot, identity, invert, lookAt, multiply, normalMatrix, normalize, orthographic, scale, sub, transformDirection, transformPoint, type Mat4, type Vec3 } from './math.js';
import { FRAME_BYTES, MAX_OUTLINES, OBJECT_BYTES, OBJECT_STRIDE, OUTPUT_BYTES, gridWGSL, lineWGSL, outputWGSL, pickWGSL, surfaceWGSL } from './shaders.js';

export class ViewerError extends Error {
  constructor(readonly code: 'webgpu-unavailable' | 'no-adapter' | 'no-context' | 'shader' | 'pipeline' | 'disposed' | 'device-lost', message: string) { super(message); this.name = 'ViewerError'; }
}

export interface Material {
  color?: Color;
  /** 0 (clear) – 1 (opaque); below 1 the mesh is drawn after the opaque ones, back to front. */
  opacity?: number;
  metallic?: number;
  roughness?: number;
  /** Adds the base colour times this, unlit. */
  emissive?: number;
  /** Flat colour, no lighting. */
  unlit?: boolean;
  /** Draw back faces too (lit from their own side). */
  doubleSided?: boolean;
  /** Width of lines in CSS pixels (default 1). */
  lineWidth?: number;
}
export interface AddMeshOptions {
  material?: Material; transform?: ArrayLike<number>; visible?: boolean; pickable?: boolean; name?: string;
  /** Casts a shadow from the shadow-casting light (default true). */
  castShadow?: boolean;
  /** Darkened by shadows (default true). */
  receiveShadow?: boolean;
}

export class Geometry {
  /** @internal Triangles: positions, normals, colours, indices. Lines: positions holds the segment instances. */
  gpu: { positions: Buffer; normals: Buffer | null; colors: Buffer | null; indices: Buffer | null; device: Device } | null = null;
  disposed = false;
  constructor(readonly data: PreparedGeometry, private readonly owner: Viewer) {}
  get topology(): 'triangles' | 'lines' { return this.data.topology; }
  get bounds(): Box3 | null { return this.data.bounds; }
  /** Replace the vertex colours (sRGB, three or four per vertex): per-face highlights, say. */
  setColors(colors: ArrayLike<number> | null): void {
    this.data.colors = vertexColors(colors ?? undefined, this.data.vertexCount);
    if (this.gpu?.colors) this.gpu.device.queue.writeBuffer(this.gpu.colors, 0, this.data.colors);
    else if (this.gpu) this.gpu.device.queue.writeBuffer(this.gpu.positions, 0, new Uint8Array(segmentInstances(this.data)));
    this.owner.requestRender();
  }
  /** Release the GPU buffers (meshes using it stop drawing). */
  dispose(): void { this.disposed = true; this.release(); this.owner.requestRender(); }
  /** @internal */ release(): void {
    if (!this.gpu) return;
    this.gpu.positions.destroy(); this.gpu.normals?.destroy(); this.gpu.colors?.destroy(); this.gpu.indices?.destroy();
    this.gpu = null;
  }
}

export class Mesh {
  /** @internal */ slot = -1;
  /** @internal */ dirty = true;
  private worldBox: Box3 | null | undefined;
  private _transform: Mat4 = identity();
  private _material: Required<Omit<Material, 'color'>> & { color: Vec3 };
  private _visible: boolean;
  pickable: boolean;
  name: string | undefined;
  castShadow: boolean;
  private _receiveShadow: boolean;
  private _outline: Vec3 | null = null;
  /** @internal Which outline colour of the frame (1-based; 0 none). */
  outlineSlot = 0;
  /** Pick id (1-based; 0 is empty space). */
  readonly id: number;

  constructor(readonly geometry: Geometry, private readonly owner: Viewer, id: number, options: AddMeshOptions) {
    this.id = id;
    this._material = materialOf(options.material);
    this._visible = options.visible ?? true;
    this.pickable = options.pickable ?? true;
    this.castShadow = options.castShadow ?? true;
    this._receiveShadow = options.receiveShadow ?? true;
    this.name = options.name;
    if (options.transform) this.transform = options.transform;
  }

  get transform(): Mat4 { return this._transform; }
  set transform(m: ArrayLike<number>) {
    if (m.length !== 16) throw new RangeError('A transform has 16 numbers (column-major)');
    this._transform = Float64Array.from(m); this.worldBox = undefined; this.touch();
  }
  get material(): Readonly<Material> { return this._material; }
  set material(m: Material) { this._material = materialOf({ ...this._material, ...m }); this.touch(); }
  get visible(): boolean { return this._visible; }
  set visible(v: boolean) { this._visible = v; this.owner.requestRender(); }
  get transparent(): boolean { return this._material.opacity < 1; }
  get receiveShadow(): boolean { return this._receiveShadow; }
  set receiveShadow(v: boolean) { this._receiveShadow = v; this.touch(); }
  /** A selection outline around the visible part of the mesh (sRGB colour), or null. */
  get outline(): Vec3 | null { return this._outline; }
  set outline(c: Color | null) { this._outline = c === null ? null : parseColor(c); this.owner.requestRender(); }
  /** The world box of the mesh (its geometry box through its transform). */
  get bounds(): Box3 | null {
    if (this.worldBox === undefined) this.worldBox = this.geometry.bounds ? transformBox(this._transform, this.geometry.bounds) : null;
    return this.worldBox;
  }
  remove(): void { this.owner.remove(this); }
  private touch(): void { this.dirty = true; this.owner.requestRender(); }

  /** @internal The object block (see Object in shaders.ts); lines carry their width in device pixels. */
  pack(into: Float32Array, at: number, pixelRatio: number): void {
    const f = into, m = this._material, o = at / 4;
    f.set(this._transform, o);
    f.set(normalMatrix(this._transform), o + 16);
    f.set([...linear(m.color), m.opacity], o + 32);
    if (this.geometry.topology === 'lines') f.set([m.lineWidth * pixelRatio, 0, 0, 1], o + 36);
    else f.set([m.metallic, m.roughness, m.emissive, m.unlit ? 1 : 0], o + 36);
    new Uint32Array(f.buffer).set([this.id, this.outlineSlot, this._receiveShadow ? 1 : 0, 0], o + 40);
  }
}

function materialOf(m: Material = {}): Required<Omit<Material, 'color'>> & { color: Vec3 } {
  return {
    color: parseColor(m.color, [0.8, 0.8, 0.8]), opacity: Math.min(1, Math.max(0, m.opacity ?? 1)),
    metallic: m.metallic ?? 0, roughness: m.roughness ?? 0.55, emissive: m.emissive ?? 0, unlit: m.unlit ?? false, doubleSided: m.doubleSided ?? false, lineWidth: m.lineWidth ?? 1,
  };
}

/** The ground grid on the plane across the camera's up axis. */
export interface GridOptions {
  visible?: boolean;
  /** Cell size; by default a power of ten fitted to the view distance. */
  cell?: number;
  /** Cells per major line (default 10). */
  major?: number;
  color?: Color;
  /** 0–1 (default 0.5). */
  opacity?: number;
  /** Offset of the plane along the up axis (default 0). */
  height?: number;
}

export type BackgroundInput = Color | { top: Color; bottom: Color } | 'transparent';
const backgroundOf = (b: BackgroundInput | undefined): Background => {
  if (b === 'transparent') return null;
  if (b && typeof b === 'object' && !Array.isArray(b) && 'top' in b) return { top: parseColor(b.top), bottom: parseColor(b.bottom) };
  const c = parseColor(b as Color | undefined, [0.12, 0.125, 0.135]);
  return { top: c, bottom: c };
};

export interface ViewerOptions {
  /** 4× multisampling (default true). */
  antialias?: boolean;
  /** Canvas background (sRGB): a colour, a vertical gradient, or 'transparent' (the page shows through). */
  background?: BackgroundInput;
  /** Device pixels per CSS pixel; default devicePixelRatio, capped at 2. */
  pixelRatio?: number;
  /** Orbit controls on the canvas (default true), with options. */
  controls?: boolean | OrbitOptions;
  lights?: Light[];
  environment?: Environment;
  camera?: Partial<Pick<Camera, 'projection' | 'position' | 'target' | 'up' | 'fovY'>>;
  /** A ground grid (default none). */
  grid?: boolean | GridOptions;
  /** GPU errors the browser reports outside any check (default: console.error). */
  onError?: (message: string) => void;
}

export interface PickHit {
  mesh: Mesh;
  /** World point under the pixel. */
  point: Vec3;
  /** The triangle of the mesh's geometry under the pixel, when a ray finds it. */
  triangle: number | null;
  /** That triangle's face id (GeometryInput.faces), when the geometry has them. */
  face: number | null;
  /** Reversed depth of the pixel (1 near, 0 far). */
  depth: number;
}

export interface LineHit {
  mesh: Mesh;
  /** The segment of the mesh's geometry nearest the point, and its id (GeometryInput.edges). */
  segment: number; edge: number | null;
  /** The nearest world point on the segment, and its distance from the point on screen (CSS pixels). */
  point: Vec3; distance: number;
}

export interface FrameStats { frames: number; drawCalls: number; culled: number; triangles: number; lines: number; deviceLosses: number; cpuMs: number }

type PipelineKey = 'lit' | 'lit2' | 'unlit' | 'unlit2' | 'litT' | 'lit2T' | 'unlitT' | 'unlit2T' | 'line' | 'lineT' | 'pick' | 'pick2' | 'mask' | 'mask2' | 'shadow' | 'grid' | 'output';
/** The scene target: linear, half float (blendable and multisampled everywhere). */
const SCENE_FORMAT = 'rgba16float';

const SAMPLES = 4;

export class Viewer {
  readonly camera: Camera;
  readonly controls: OrbitControls | null = null;
  lights: Light[];
  environment: Environment;
  readonly stats: FrameStats = { frames: 0, drawCalls: 0, culled: 0, triangles: 0, lines: 0, deviceLosses: 0, cpuMs: 0 };
  /** Selection outline width in CSS pixels. */
  outlineWidth = 2;
  /** The ground grid (change its fields, then requestRender). */
  grid: GridOptions = { visible: false };
  /** Shadow map size (texels per side) for the shadow-casting directional light. */
  shadowMapSize = 2048;
  /** Called after a lost device has been replaced and the scene re-uploaded. */
  onRecover: (() => void) | null = null;

  private device!: Device;
  private context!: CanvasContext;
  private format = 'bgra8unorm';
  private pipelines = new Map<PipelineKey, Pipeline>();
  private frameBuffer!: Buffer;
  private frameGroup!: BindGroup;
  private shadowFrameBuffer!: Buffer;
  private shadowFrameGroup!: BindGroup;
  private shadowSampler!: object;
  private emptyShadow!: Texture;
  private shadowMap: Texture | null = null;
  private objectBuffer!: Buffer;
  private objectGroup!: BindGroup;
  private objectCapacity = 0;
  private objectData = new Float32Array(0);
  private targets: { width: number; height: number; msaa: Texture | null; scene: Texture; depth: Texture; mask: Texture; maskDepth: Texture; output: BindGroup } | null = null;
  private outputBuffer!: Buffer;
  private pickTargets: { width: number; height: number; id: Texture; depth: Texture; z: Texture; read: Buffer } | null = null;
  private meshes: Mesh[] = [];
  private freeSlots: number[] = [];
  private nextSlot = 0;
  private nextId = 1;
  private geometries = new Set<Geometry>();
  private scheduled = 0;
  private waiters: (() => void)[] = [];
  private disposed = false;
  private recovering: Promise<void> | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private background: Background;
  private pixelRatio: number;

  private constructor(readonly canvas: HTMLCanvasElement, private readonly options: ViewerOptions) {
    this.camera = new Camera(options.camera);
    this.lights = options.lights ?? defaultLights();
    this.environment = options.environment ?? {};
    if (options.grid) this.grid = options.grid === true ? { visible: true } : { visible: true, ...options.grid };
    this.background = backgroundOf(options.background);
    this.pixelRatio = options.pixelRatio ?? Math.min(2, (globalThis as { devicePixelRatio?: number }).devicePixelRatio ?? 1);
  }

  /** Open a viewer on a canvas. Throws a ViewerError when WebGPU or a device is not available. */
  static async create(canvas: HTMLCanvasElement, options: ViewerOptions = {}): Promise<Viewer> {
    const v = new Viewer(canvas, options);
    await v.start();
    if (options.controls !== false) {
      const opts = typeof options.controls === 'object' ? options.controls : {};
      (v as { controls: OrbitControls | null }).controls = new OrbitControls(canvas, () => v.camera, () => v.requestRender(), { pointAt: (x, y) => v.pointAt(x, y), ...opts });
    }
    if (typeof ResizeObserver !== 'undefined') {
      v.resizeObserver = new ResizeObserver(() => v.resize());
      v.resizeObserver.observe(canvas);
    }
    v.resize();
    return v;
  }

  private async start(): Promise<void> {
    const gpu = gpuOf();
    if (!gpu) throw new ViewerError('webgpu-unavailable', 'WebGPU is not available in this browser');
    const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new ViewerError('no-adapter', 'No WebGPU adapter');
    const device = await adapter.requestDevice();
    const context = this.canvas.getContext('webgpu') as unknown as CanvasContext | null;
    if (!context) throw new ViewerError('no-context', 'The canvas has no WebGPU context (is it used by another context?)');
    this.device = device; this.context = context; this.format = gpu.getPreferredCanvasFormat();
    device.onuncapturederror = e => this.report(e.error.message);
    context.configure({ device, format: this.format, alphaMode: this.background ? 'opaque' : 'premultiplied', usage: TextureUsage.RENDER_ATTACHMENT | TextureUsage.COPY_SRC });
    await this.createPipelines();
    this.outputBuffer = device.createBuffer({ size: OUTPUT_BYTES, usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST, label: 'viewer output' });
    this.frameBuffer = device.createBuffer({ size: FRAME_BYTES, usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST, label: 'viewer frame' });
    this.shadowFrameBuffer = device.createBuffer({ size: FRAME_BYTES, usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST, label: 'viewer shadow frame' });
    this.shadowSampler = (device as unknown as { createSampler(d: object): object }).createSampler({ compare: 'less', magFilter: 'linear', minFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' });
    this.emptyShadow = device.createTexture({ size: [1, 1], format: 'depth32float', usage: TextureUsage.TEXTURE_BINDING | TextureUsage.RENDER_ATTACHMENT, label: 'viewer no shadow' });
    this.shadowMap = null;
    this.bindFrames();
    this.objectCapacity = 0; this.growObjects(Math.max(64, this.nextSlot));
    this.targets = null; this.pickTargets = null;
    for (const m of this.meshes) m.dirty = true;
    device.lost.then(info => { if (!this.disposed && this.device === device) this.lose(info.message); });
  }

  /** The frame bind groups: the scene's samples the shadow map; the shadow pass's must not. */
  private bindFrames(): void {
    const layout = this.pipelines.get('lit')!.getBindGroupLayout(0);
    const group = (buffer: Buffer, map: Texture) => this.device.createBindGroup({ layout, entries: [{ binding: 0, resource: { buffer } }, { binding: 1, resource: map.createView() }, { binding: 2, resource: this.shadowSampler }] });
    this.frameGroup = group(this.frameBuffer, this.shadowMap ?? this.emptyShadow);
    this.shadowFrameGroup = group(this.shadowFrameBuffer, this.emptyShadow);
  }

  private async createPipelines(): Promise<void> {
    const d = this.device;
    const modules = { surface: d.createShaderModule({ code: surfaceWGSL, label: 'viewer surface' }), line: d.createShaderModule({ code: lineWGSL, label: 'viewer line' }), pick: d.createShaderModule({ code: pickWGSL, label: 'viewer pick' }) };
    for (const [name, m] of Object.entries(modules)) {
      const errors = (await m.getCompilationInfo()).messages.filter(x => x.type === 'error');
      if (errors.length) throw new ViewerError('shader', `${name} shader: ${errors.map(e => `${e.lineNum}: ${e.message}`).join('; ')}`);
    }
    const frameLayout = d.createBindGroupLayout({ entries: [
      { binding: 0, visibility: 3, buffer: { type: 'uniform' } },
      { binding: 1, visibility: 2, texture: { sampleType: 'depth' } },
      { binding: 2, visibility: 2, sampler: { type: 'comparison' } },
    ] });
    const objectLayout = d.createBindGroupLayout({ entries: [{ binding: 0, visibility: 3, buffer: { type: 'uniform', hasDynamicOffset: true, minBindingSize: OBJECT_BYTES } }] });
    const layout = d.createPipelineLayout({ bindGroupLayouts: [frameLayout, objectLayout] });
    const vertex = (module: object, all: boolean) => ({
      module, entryPoint: 'vs',
      buffers: [
        { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
        ...(all ? [{ arrayStride: 12, attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }] }] : []),
        { arrayStride: 4, attributes: [{ shaderLocation: 2, offset: 0, format: 'unorm8x4' }] },
      ],
    });
    // Premultiplied colour over the target.
    const blend = { color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' } };
    const ms = { count: this.options.antialias === false ? 1 : SAMPLES };
    const make = (key: PipelineKey, desc: object) => d.createRenderPipelineAsync({ label: `viewer ${key}`, layout, ...desc }).then(p => { this.pipelines.set(key, p); });
    const jobs: Promise<void>[] = [];
    d.pushErrorScope('validation');
    for (const lit of [true, false]) for (const two of [false, true]) for (const t of [false, true]) {
      const key = `${lit ? 'lit' : 'unlit'}${two ? '2' : ''}${t ? 'T' : ''}` as PipelineKey;
      jobs.push(make(key, {
        vertex: vertex(modules.surface, true),
        fragment: { module: modules.surface, entryPoint: lit ? 'fsLit' : 'fsUnlit', targets: [{ format: SCENE_FORMAT, ...(t ? { blend } : {}) }] },
        primitive: { topology: 'triangle-list', cullMode: two ? 'none' : 'back', frontFace: 'ccw' },
        // Faces sit a little behind lines drawn on them (reversed depth: lower is further).
        depthStencil: { format: 'depth32float', depthWriteEnabled: !t, depthCompare: 'greater-equal', depthBias: -2, depthBiasSlopeScale: -1.5 },
        multisample: ms,
      }));
    }
    for (const t of [false, true]) jobs.push(make(t ? 'lineT' : 'line', {
      vertex: {
        module: modules.line, entryPoint: 'vs',
        buffers: [{ arrayStride: 32, stepMode: 'instance', attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x3' },
          { shaderLocation: 2, offset: 24, format: 'unorm8x4' }, { shaderLocation: 3, offset: 28, format: 'unorm8x4' },
        ] }],
      },
      fragment: { module: modules.line, entryPoint: 'fs', targets: [{ format: SCENE_FORMAT, ...(t ? { blend } : {}) }] },
      primitive: { topology: 'triangle-list' },
      // Lines test depth but do not write it: no occlusion halos around them.
      depthStencil: { format: 'depth32float', depthWriteEnabled: false, depthCompare: 'greater-equal' },
      multisample: ms,
    }));
    for (const two of [false, true]) jobs.push(make(two ? 'pick2' : 'pick', {
      vertex: { module: modules.pick, entryPoint: 'vs', buffers: [{ arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] }] },
      fragment: { module: modules.pick, entryPoint: 'fs', targets: [{ format: 'r32uint' }, { format: 'r32float' }] },
      primitive: { topology: 'triangle-list', cullMode: two ? 'none' : 'back' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'greater' },
    }));
    const gridModule = d.createShaderModule({ code: gridWGSL, label: 'viewer grid' });
    jobs.push(make('grid', {
      vertex: { module: gridModule, entryPoint: 'vs' },
      fragment: { module: gridModule, entryPoint: 'fs', targets: [{ format: SCENE_FORMAT, blend }] },
      primitive: { topology: 'triangle-list' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: false, depthCompare: 'greater-equal' },
      multisample: ms,
    }));
    jobs.push(make('shadow', {
      vertex: { module: modules.pick, entryPoint: 'vs', buffers: [{ arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] }] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less', depthBias: 2, depthBiasSlopeScale: 2 },
    }));
    for (const two of [false, true]) jobs.push(make(two ? 'mask2' : 'mask', {
      vertex: { module: modules.pick, entryPoint: 'vs', buffers: [{ arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] }] },
      fragment: { module: modules.pick, entryPoint: 'fsMask', targets: [{ format: 'r32uint' }] },
      primitive: { topology: 'triangle-list', cullMode: two ? 'none' : 'back' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'greater' },
    }));
    const output = d.createShaderModule({ code: outputWGSL(this.options.antialias !== false), label: 'viewer output' });
    jobs.push(d.createRenderPipelineAsync({
      label: 'viewer output', layout: 'auto',
      vertex: { module: output, entryPoint: 'vs' },
      fragment: { module: output, entryPoint: 'fs', targets: [{ format: this.format }] },
      primitive: { topology: 'triangle-list' },
    }).then(p => { this.pipelines.set('output', p); }));
    const results = await Promise.allSettled(jobs);
    const scope = await d.popErrorScope();
    const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failed || scope) throw new ViewerError('pipeline', String(failed ? (failed.reason as Error)?.message ?? failed.reason : scope!.message));
  }

  private growObjects(slots: number): void {
    if (slots <= this.objectCapacity) return;
    const cap = Math.max(slots, this.objectCapacity * 2);
    this.objectBuffer?.destroy();
    this.objectBuffer = this.device.createBuffer({ size: cap * OBJECT_STRIDE, usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST, label: 'viewer objects' });
    this.objectGroup = this.device.createBindGroup({ layout: this.pipelines.get('lit')!.getBindGroupLayout(1), entries: [{ binding: 0, resource: { buffer: this.objectBuffer, size: OBJECT_BYTES } }] });
    const data = new Float32Array((cap * OBJECT_STRIDE) / 4);
    data.set(this.objectData.subarray(0, Math.min(this.objectData.length, data.length)));
    this.objectData = data; this.objectCapacity = cap;
    for (const m of this.meshes) m.dirty = true;
  }

  // ---- Scene -------------------------------------------------------------------------------------

  /** Upload geometry once; any number of meshes can draw it. */
  createGeometry(input: GeometryInput): Geometry {
    this.alive();
    const g = new Geometry(prepareGeometry(input), this);
    this.geometries.add(g);
    return g;
  }

  /** Add a mesh drawing a geometry (or geometry input) with a material and transform. */
  add(geometry: Geometry | GeometryInput, options: AddMeshOptions = {}): Mesh {
    this.alive();
    const g = geometry instanceof Geometry ? geometry : this.createGeometry(geometry);
    const m = new Mesh(g, this, this.nextId++, options);
    m.slot = this.freeSlots.pop() ?? this.nextSlot++;
    this.growObjects(this.nextSlot);
    this.meshes.push(m);
    this.requestRender();
    return m;
  }

  remove(mesh: Mesh): void {
    const i = this.meshes.indexOf(mesh);
    if (i < 0) return;
    this.meshes.splice(i, 1);
    this.freeSlots.push(mesh.slot);
    mesh.slot = -1;
    this.requestRender();
  }

  /** Remove every mesh and release every geometry. */
  clear(): void {
    for (const m of this.meshes) m.slot = -1;
    this.meshes = []; this.freeSlots = []; this.nextSlot = 0;
    for (const g of this.geometries) g.release();
    this.geometries.clear();
    this.requestRender();
  }

  get meshList(): readonly Mesh[] { return this.meshes; }

  /** The box around every visible mesh. */
  sceneBounds(): Box3 | null {
    let b: Box3 | null = null;
    for (const m of this.meshes) if (m.visible && !m.geometry.disposed) b = unionBox(b, m.bounds);
    return b;
  }

  /** Frame a box (default: the scene) in the view. */
  fit(box: Box3 | null = this.sceneBounds()): void {
    if (box) this.camera.fit(box, this.aspect);
    this.requestRender();
  }

  /** A new background; switching to or from 'transparent' takes effect after the next device setup. */
  setBackground(background: BackgroundInput): void { this.background = backgroundOf(background); this.requestRender(); }

  // ---- Size and frames ----------------------------------------------------------------------------

  get aspect(): number { return this.canvas.width / Math.max(1, this.canvas.height); }

  /** Match the canvas backing store to its CSS size times the pixel ratio. */
  resize(pixelRatio = this.pixelRatio): void {
    if (pixelRatio !== this.pixelRatio) for (const m of this.meshes) m.dirty = true;
    this.pixelRatio = pixelRatio;
    const max = this.device?.limits.maxTextureDimension2D ?? 8192;
    const w = Math.max(1, Math.min(max, Math.round((this.canvas.clientWidth || this.canvas.width) * pixelRatio)));
    const h = Math.max(1, Math.min(max, Math.round((this.canvas.clientHeight || this.canvas.height) * pixelRatio)));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.requestRender();
  }

  /** Draw on the next animation frame (several requests make one frame). */
  requestRender(): void {
    if (this.scheduled || this.disposed) return;
    const raf = (globalThis as { requestAnimationFrame?: (f: () => void) => number }).requestAnimationFrame;
    const run = () => { this.scheduled = 0; this.render(); };
    this.scheduled = raf ? raf(run) : (setTimeout(run, 0) as unknown as number);
  }

  /** Resolves once the next frame has been drawn and the GPU has finished it. */
  frame(): Promise<void> {
    return new Promise(resolve => { this.waiters.push(resolve); this.requestRender(); });
  }

  /** Draw now. */
  render(): void {
    if (this.disposed || this.recovering) return;
    const t0 = performance.now();
    this.draw(null);
    this.stats.cpuMs = performance.now() - t0;
    const waiters = this.waiters.splice(0);
    if (waiters.length) this.device.queue.onSubmittedWorkDone().then(() => waiters.forEach(f => f()), () => waiters.forEach(f => f()));
  }

  private ensureTargets(): NonNullable<Viewer['targets']> {
    const w = this.canvas.width, h = this.canvas.height, t = this.targets;
    if (t && t.width === w && t.height === h) return t;
    t?.msaa?.destroy(); t?.scene.destroy(); t?.depth.destroy(); t?.mask.destroy(); t?.maskDepth.destroy();
    const samples = this.options.antialias === false ? 1 : SAMPLES;
    const msaa = samples > 1 ? this.device.createTexture({ size: [w, h], format: SCENE_FORMAT, sampleCount: samples, usage: TextureUsage.RENDER_ATTACHMENT, label: 'viewer msaa' }) : null;
    const scene = this.device.createTexture({ size: [w, h], format: SCENE_FORMAT, usage: TextureUsage.RENDER_ATTACHMENT | TextureUsage.TEXTURE_BINDING, label: 'viewer scene' });
    const depth = this.device.createTexture({ size: [w, h], format: 'depth32float', sampleCount: samples, usage: TextureUsage.RENDER_ATTACHMENT | TextureUsage.TEXTURE_BINDING, label: 'viewer depth' });
    const mask = this.device.createTexture({ size: [w, h], format: 'r32uint', usage: TextureUsage.RENDER_ATTACHMENT | TextureUsage.TEXTURE_BINDING, label: 'viewer outline mask' });
    const maskDepth = this.device.createTexture({ size: [w, h], format: 'depth32float', usage: TextureUsage.RENDER_ATTACHMENT, label: 'viewer outline depth' });
    const output = this.device.createBindGroup({ layout: this.pipelines.get('output')!.getBindGroupLayout(0), entries: [{ binding: 0, resource: scene.createView() }, { binding: 1, resource: { buffer: this.outputBuffer } }, { binding: 2, resource: mask.createView() }, { binding: 3, resource: depth.createView() }] });
    this.targets = { width: w, height: h, msaa, scene, depth, mask, maskDepth, output };
    return this.targets;
  }

  private upload(g: Geometry): boolean {
    if (g.disposed) return false;
    if (g.gpu && g.gpu.device === this.device) return true;
    const d = this.device, data = g.data;
    const buffer = (src: ArrayBufferView, usage: number, label: string) => {
      const size = Math.max(4, Math.ceil(src.byteLength / 4) * 4), b = d.createBuffer({ size, usage: usage | BufferUsage.COPY_DST, label });
      if (src.byteLength % 4) { const padded = new Uint8Array(size); padded.set(new Uint8Array(src.buffer, src.byteOffset, src.byteLength)); d.queue.writeBuffer(b, 0, padded); }
      else if (src.byteLength) d.queue.writeBuffer(b, 0, src);
      return b;
    };
    g.gpu = data.topology === 'lines'
      ? { device: d, positions: buffer(new Uint8Array(segmentInstances(data)), BufferUsage.VERTEX, 'segments'), normals: null, colors: null, indices: null }
      : {
        device: d,
        positions: buffer(data.positions, BufferUsage.VERTEX, 'positions'), normals: buffer(data.normals, BufferUsage.VERTEX, 'normals'),
        colors: buffer(data.colors, BufferUsage.VERTEX, 'colors'), indices: data.indices ? buffer(data.indices, BufferUsage.INDEX, 'indices') : null,
      };
    return true;
  }

  /** The meshes to draw this frame: visible, uploaded and in the frustum; opaque first, then transparent back to front. */
  private visibleMeshes(viewProjection: Mat4): { opaque: Mesh[]; transparent: Mesh[]; culled: number } {
    const planes = frustumPlanes(viewProjection), opaque: Mesh[] = [], transparent: { m: Mesh; d: number }[] = [];
    let culled = 0;
    const eye = this.camera.position, forward = this.camera.basis().forward;
    for (const m of this.meshes) {
      if (!m.visible || !this.upload(m.geometry) || !m.geometry.data.elementCount) continue;
      const b = m.bounds;
      if (b && !boxInFrustum(planes, b)) { culled++; continue; }
      if (m.transparent) {
        const c = b ? [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2] as Vec3 : eye;
        transparent.push({ m, d: dot(sub(c, eye), forward) });
      } else opaque.push(m);
    }
    // Opaque surfaces by pipeline (fewer state changes), then lines (they test depth but do not write
    // it, so they come after the surfaces), then transparent far to near.
    const key = (m: Mesh) => (m.geometry.topology === 'lines' ? '1' : '0') + this.pipelineKey(m, false);
    opaque.sort((a, b) => key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0);
    transparent.sort((a, b) => b.d - a.d);
    return { opaque, transparent: transparent.map(t => t.m), culled };
  }

  private pipelineKey(m: Mesh, pick: boolean | 'mask'): PipelineKey {
    const mat = m.material, two = mat.doubleSided ? '2' : '', t = m.transparent ? 'T' : '';
    if (pick === 'mask') return (two ? 'mask2' : 'mask');
    if (pick) return (two ? 'pick2' : 'pick');
    if (m.geometry.topology === 'lines') return (t ? 'lineT' : 'line');
    return `${mat.unlit ? 'unlit' : 'lit'}${two}${t}` as PipelineKey;
  }

  /** The shadow-casting light's view of the scene: an orthographic box around it along the light. */
  private shadowFrame(): ShadowFrame | null {
    const light = directionalLights(this.lights).find(l => l.castShadow), scene = this.sceneBounds();
    if (!light || !scene) return null;
    const r = Math.max(boxRadius(scene), 1e-6), c = boxCenter(scene), d = normalize(light.direction);
    const up: Vec3 = Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0], eye = sub(c, scale(d, 2 * r));
    if (!cross(up, d).some(x => x !== 0)) return null;
    const viewProjection = multiply(orthographic(r, r, r * 0.9, r * 3.1), lookAt(eye, c, up)), size = this.shadowMapSize;
    return { viewProjection, normalOffset: (2 * r / size) * 1.5, texel: 1 / size, bias: 0.0005 };
  }

  /** The grid this frame: a power-of-ten cell fitted to the view distance unless one is set. */
  private gridFrame(): GridFrame | null {
    const g = this.grid;
    if (!g.visible) return null;
    const d = Math.max(this.camera.distance, 1e-9), cell = g.cell ?? Math.pow(10, Math.floor(Math.log10(d / 8)));
    return { cell, major: g.major ?? 10, fade: d * 6, height: g.height ?? 0, color: parseColor(g.color, [0.55, 0.56, 0.6]), opacity: g.opacity ?? 0.5 };
  }

  private writeUniforms(viewProjection: Mat4, shadow: ShadowFrame | null = null): void {
    this.device.queue.writeBuffer(this.frameBuffer, 0, packFrame(viewProjection, this.camera, this.lights, this.environment, shadow, [this.canvas.width, this.canvas.height, this.pixelRatio], this.gridFrame()));
    if (shadow) this.device.queue.writeBuffer(this.shadowFrameBuffer, 0, packFrame(shadow.viewProjection, this.camera, [], this.environment));
    let lo = Infinity, hi = -1;
    for (const m of this.meshes) if (m.dirty) {
      m.pack(this.objectData, m.slot * OBJECT_STRIDE, this.pixelRatio);
      m.dirty = false; lo = Math.min(lo, m.slot); hi = Math.max(hi, m.slot);
    }
    if (hi >= 0) this.device.queue.writeBuffer(this.objectBuffer, lo * OBJECT_STRIDE, this.objectData, (lo * OBJECT_STRIDE) / 4, ((hi - lo) * OBJECT_STRIDE + OBJECT_BYTES) / 4);
  }

  private drawMesh(pass: RenderPass, m: Mesh, current: { pipeline?: Pipeline }, pick: boolean | 'mask'): void {
    const p = this.pipelines.get(this.pipelineKey(m, pick))!, g = m.geometry.gpu!, data = m.geometry.data;
    if (current.pipeline !== p) { pass.setPipeline(p); current.pipeline = p; }
    pass.setBindGroup(1, this.objectGroup, [m.slot * OBJECT_STRIDE]);
    pass.setVertexBuffer(0, g.positions);
    if (data.topology === 'lines') { pass.draw(6, data.elementCount / 2); return; }
    if (!pick) { pass.setVertexBuffer(1, g.normals!); pass.setVertexBuffer(2, g.colors!); }
    if (g.indices) { pass.setIndexBuffer(g.indices, data.indices instanceof Uint16Array ? 'uint16' : 'uint32'); pass.drawIndexed(data.elementCount); }
    else pass.draw(data.elementCount);
  }

  /** Number each distinct outline colour of the frame (up to MAX_OUTLINES; later ones share the last). */
  private outlineColors(): Vec3[] {
    const colors: Vec3[] = [], key = (c: Vec3) => c.join(',');
    for (const m of this.meshes) {
      let slot = 0;
      if (m.outline && m.visible) {
        let i = colors.findIndex(c => key(c) === key(m.outline!));
        if (i < 0 && colors.length < MAX_OUTLINES) { colors.push(m.outline); i = colors.length - 1; }
        slot = (i < 0 ? colors.length - 1 : i) + 1;
      }
      if (slot !== m.outlineSlot) { m.outlineSlot = slot; m.dirty = true; }
    }
    return colors;
  }

  private draw(capture: Buffer | null): void {
    const vp = this.prepareCamera();
    const { opaque, transparent, culled } = this.visibleMeshes(vp);
    const outlines = this.outlineColors();
    const shadow = this.shadowFrame();
    if (shadow && (!this.shadowMap || this.shadowMap.width !== this.shadowMapSize)) {
      this.shadowMap?.destroy();
      this.shadowMap = this.device.createTexture({ size: [this.shadowMapSize, this.shadowMapSize], format: 'depth32float', usage: TextureUsage.RENDER_ATTACHMENT | TextureUsage.TEXTURE_BINDING, label: 'viewer shadow map' });
      this.bindFrames();
    }
    this.writeUniforms(vp, shadow);
    this.device.queue.writeBuffer(this.outputBuffer, 0, new Uint8Array(packOutput(this.environment, outlines, this.outlineWidth * this.pixelRatio, this.background, this.occlusionFrame())));
    const targets = this.ensureTargets(), out = this.context.getCurrentTexture(), sceneView = targets.scene.createView();
    const enc = this.device.createCommandEncoder();
    if (shadow && this.shadowMap) {
      // Every shadow caster, in view or not.
      const sp = enc.beginRenderPass({ colorAttachments: [], depthStencilAttachment: { view: this.shadowMap.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' } });
      sp.setBindGroup(0, this.shadowFrameGroup);
      sp.setPipeline(this.pipelines.get('shadow')!);
      for (const m of this.meshes) {
        if (!m.visible || !m.castShadow || m.transparent || m.geometry.topology !== 'triangles' || !this.upload(m.geometry)) continue;
        const g = m.geometry.gpu!, data = m.geometry.data;
        sp.setBindGroup(1, this.objectGroup, [m.slot * OBJECT_STRIDE]);
        sp.setVertexBuffer(0, g.positions);
        if (g.indices) { sp.setIndexBuffer(g.indices, data.indices instanceof Uint16Array ? 'uint16' : 'uint32'); sp.drawIndexed(data.elementCount); } else sp.draw(data.elementCount);
      }
      sp.end();
    }
    const pass = enc.beginRenderPass({
      colorAttachments: [{ view: targets.msaa ? targets.msaa.createView() : sceneView, resolveTarget: targets.msaa ? sceneView : undefined, clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: targets.msaa ? 'discard' : 'store' }],
      // (The depth is kept for ambient occlusion in the output pass; the background is put in there too.)
      depthStencilAttachment: { view: targets.depth.createView(), depthClearValue: 0, depthLoadOp: 'clear', depthStoreOp: 'store' },
    });
    pass.setBindGroup(0, this.frameGroup);
    const current: { pipeline?: Pipeline } = {};
    let tris = 0, lines = 0;
    // Opaque surfaces, the grid (tested against them), then lines and transparent meshes over it.
    let gridDrawn = !this.grid.visible;
    const grid = () => { pass.setPipeline(this.pipelines.get('grid')!); pass.setBindGroup(1, this.objectGroup, [0]); current.pipeline = undefined; pass.draw(3); gridDrawn = true; };
    for (const m of [...opaque, ...transparent]) {
      if (!gridDrawn && (m.geometry.topology === 'lines' || m.transparent)) grid();
      this.drawMesh(pass, m, current, false);
      if (m.geometry.topology === 'lines') lines += m.geometry.data.elementCount / 2; else tris += m.geometry.data.elementCount / 3;
    }
    if (!gridDrawn) grid();
    pass.end();
    if (outlines.length) {
      // The outline mask: every opaque surface hides what is behind it; outlined meshes write their number.
      const mask = enc.beginRenderPass({
        colorAttachments: [{ view: targets.mask.createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' }],
        depthStencilAttachment: { view: targets.maskDepth.createView(), depthClearValue: 0, depthLoadOp: 'clear', depthStoreOp: 'discard' },
      });
      mask.setBindGroup(0, this.frameGroup);
      const cur: { pipeline?: Pipeline } = {};
      for (const m of [...opaque, ...transparent]) if (m.geometry.topology === 'triangles' && (!m.transparent || m.outlineSlot)) this.drawMesh(mask, m, cur, 'mask');
      mask.end();
    }
    const show = enc.beginRenderPass({ colorAttachments: [{ view: out.createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' }] });
    show.setPipeline(this.pipelines.get('output')!);
    show.setBindGroup(0, targets.output);
    show.draw(3);
    show.end();
    if (capture) enc.copyTextureToBuffer({ texture: out }, { buffer: capture, bytesPerRow: Math.ceil((out.width * 4) / 256) * 256 }, [out.width, out.height]);
    this.device.queue.submit([enc.finish()]);
    Object.assign(this.stats, { frames: this.stats.frames + 1, drawCalls: opaque.length + transparent.length, culled, triangles: tris, lines });
  }

  private occlusionFrame() {
    const ao = this.environment.ambientOcclusion, scene = this.sceneBounds();
    if (!ao || !scene) return null;
    const proj = this.camera.projectionMatrix(this.aspect);
    return { inverseProjection: invert(proj), radius: ao.radius ?? boxRadius(scene) / 12, pixelsPerUnit: proj[5] * this.canvas.height / 2, perspective: this.camera.projection === 'perspective' };
  }

  private prepareCamera(): Mat4 {
    this.clipCamera();
    return this.camera.viewProjection(this.aspect);
  }

  /** Clip planes around the scene, and out to the grid's fade distance when the grid shows. */
  private clipCamera(): void {
    const c = this.camera;
    c.clip(this.sceneBounds());
    const g = this.gridFrame();
    if (!g) return;
    if (c.projection === 'perspective') c.near = Math.min(c.near, Math.max(c.distance * 1e-3, 1e-6));
    else { c.near = Math.min(c.near, -g.fade); c.far = Math.max(c.far, g.fade); }
  }

  // ---- Reading back ------------------------------------------------------------------------------

  /** Draw a frame and read it back: RGBA bytes, rows top to bottom. */
  async capture(): Promise<{ width: number; height: number; data: Uint8Array }> {
    this.alive();
    const w = this.canvas.width, h = this.canvas.height, row = Math.ceil((w * 4) / 256) * 256;
    const buf = this.device.createBuffer({ size: row * h, usage: BufferUsage.MAP_READ | BufferUsage.COPY_DST, label: 'viewer capture' });
    try {
      this.draw(buf);
      await buf.mapAsync(MapMode.READ);
      const src = new Uint8Array(buf.getMappedRange()), data = new Uint8Array(w * h * 4), bgra = this.format.startsWith('bgra');
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const s = y * row + x * 4, d = (y * w + x) * 4;
        data[d] = src[s + (bgra ? 2 : 0)]; data[d + 1] = src[s + 1]; data[d + 2] = src[s + (bgra ? 0 : 2)]; data[d + 3] = src[s + 3];
      }
      buf.unmap();
      return { width: w, height: h, data };
    } finally { buf.destroy(); }
  }

  /**
   * What is under a point of the canvas (CSS pixels from its top-left): the mesh, the world point and
   * the triangle. Draws only that pixel of an id and depth target and reads it back.
   */
  pick(x: number, y: number): Promise<PickHit | null> {
    // One read buffer: picks run one after another.
    const run = this.picking.then(() => this.pickNow(x, y));
    this.picking = run.catch(() => undefined);
    return run;
  }
  private picking: Promise<unknown> = Promise.resolve();

  private async pickNow(x: number, y: number): Promise<PickHit | null> {
    this.alive();
    const px = Math.floor((x / Math.max(1, this.canvas.clientWidth || this.canvas.width)) * this.canvas.width);
    const py = Math.floor((y / Math.max(1, this.canvas.clientHeight || this.canvas.height)) * this.canvas.height);
    if (px < 0 || py < 0 || px >= this.canvas.width || py >= this.canvas.height) return null;
    const vp = this.prepareCamera();
    const { opaque, transparent } = this.visibleMeshes(vp);
    this.writeUniforms(vp);
    const t = this.ensurePickTargets(), enc = this.device.createCommandEncoder();
    const pass = enc.beginRenderPass({
      colorAttachments: [
        { view: t.id.createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' },
        { view: t.z.createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' },
      ],
      depthStencilAttachment: { view: t.depth.createView(), depthClearValue: 0, depthLoadOp: 'clear', depthStoreOp: 'discard' },
    });
    pass.setScissorRect(px, py, 1, 1);
    pass.setBindGroup(0, this.frameGroup);
    const current: { pipeline?: Pipeline } = {};
    for (const m of [...opaque, ...transparent]) if (m.pickable && m.geometry.topology === 'triangles') this.drawMesh(pass, m, current, true);
    pass.end();
    enc.copyTextureToBuffer({ texture: t.id, origin: [px, py] }, { buffer: t.read, bytesPerRow: 256 }, [1, 1]);
    enc.copyTextureToBuffer({ texture: t.z, origin: [px, py] }, { buffer: t.read, offset: 256, bytesPerRow: 256 }, [1, 1]);
    this.device.queue.submit([enc.finish()]);
    const read = t.read;
    await read.mapAsync(MapMode.READ);
    const id = new Uint32Array(read.getMappedRange(0, 4))[0], depth = new Float32Array(read.getMappedRange(256, 4))[0];
    read.unmap();
    const mesh = id ? this.meshes.find(m => m.id === id) : undefined;
    if (!mesh) return null;
    const ndcX = ((px + 0.5) / this.canvas.width) * 2 - 1, ndcY = 1 - ((py + 0.5) / this.canvas.height) * 2;
    const point = this.camera.unproject(ndcX, ndcY, depth, this.aspect);
    // The triangle: a ray through the pixel in the mesh's own space.
    const ray = this.camera.ray(ndcX, ndcY, this.aspect), inv = invert(mesh.transform);
    const hit = rayTriangles(mesh.geometry.data, transformPoint(inv, ray.origin), transformDirection(inv, ray.direction));
    const faces = mesh.geometry.data.faces;
    return { mesh, point, triangle: hit ? hit.triangle : null, face: hit && faces ? faces[hit.triangle] : null, depth };
  }

  private ensurePickTargets() {
    const w = this.canvas.width, h = this.canvas.height, t = this.pickTargets;
    if (t && t.width === w && t.height === h) return t;
    if (t) { t.id.destroy(); t.depth.destroy(); t.z.destroy(); t.read.destroy(); }
    const tex = (format: string, label: string) => this.device.createTexture({ size: [w, h], format, usage: TextureUsage.RENDER_ATTACHMENT | TextureUsage.COPY_SRC, label });
    this.pickTargets = {
      width: w, height: h, id: tex('r32uint', 'pick id'), z: tex('r32float', 'pick depth'),
      depth: this.device.createTexture({ size: [w, h], format: 'depth32float', usage: TextureUsage.RENDER_ATTACHMENT, label: 'pick z-buffer' }),
      read: this.device.createBuffer({ size: 512, usage: BufferUsage.MAP_READ | BufferUsage.COPY_DST, label: 'pick read' }),
    };
    return this.pickTargets;
  }

  /**
   * What is under a point of the canvas (CSS pixels), found on the CPU at once: a ray against the
   * triangles of every visible, pickable mesh (pick() reads the GPU instead and waits for it).
   */
  raycast(x: number, y: number): PickHit | null {
    this.alive();
    const cw = this.canvas.clientWidth || this.canvas.width, ch = this.canvas.clientHeight || this.canvas.height;
    this.clipCamera();
    const ray = this.camera.ray((x / cw) * 2 - 1, 1 - (y / ch) * 2, this.aspect);
    let best: { mesh: Mesh; triangle: number; t: number } | null = null;
    for (const m of this.meshes) {
      if (!m.visible || !m.pickable || m.geometry.topology !== 'triangles' || m.geometry.disposed) continue;
      // A ray in the mesh's own space keeps its parameter: distances compare across meshes.
      const inv = invert(m.transform);
      const hit = rayTriangles(m.geometry.data, transformPoint(inv, ray.origin), transformDirection(inv, ray.direction));
      if (hit && (!best || hit.t < best.t)) best = { mesh: m, triangle: hit.triangle, t: hit.t };
    }
    if (!best) return null;
    const point = add(ray.origin, scale(ray.direction, best.t)), faces = best.mesh.geometry.data.faces;
    const v = transformPoint(this.camera.viewProjection(this.aspect), point);
    return { mesh: best.mesh, point, triangle: best.triangle, face: faces ? faces[best.triangle] : null, depth: v[2] };
  }

  /**
   * The line segment drawn nearest a point of the canvas (CSS pixels), within radius pixels. Lines are
   * thin, so this is a screen-space search, not a pixel read; it does not test whether a surface hides them.
   */
  pickLine(x: number, y: number, radius = 6): LineHit | null {
    this.alive();
    const cw = this.canvas.clientWidth || this.canvas.width, ch = this.canvas.clientHeight || this.canvas.height;
    this.clipCamera();
    const vp = this.camera.viewProjection(this.aspect);
    let best: LineHit | null = null;
    for (const m of this.meshes) {
      if (!m.visible || !m.pickable || m.geometry.topology !== 'lines' || m.geometry.disposed) continue;
      const M = multiply(vp, m.transform), g = m.geometry.data, P = g.positions, I = g.indices;
      const clip = (i: number) => {
        const px = P[3 * i], py = P[3 * i + 1], pz = P[3 * i + 2];
        return [M[0] * px + M[4] * py + M[8] * pz + M[12], M[1] * px + M[5] * py + M[9] * pz + M[13], M[3] * px + M[7] * py + M[11] * pz + M[15]];
      };
      for (let sgm = 0; sgm < g.elementCount / 2; sgm++) {
        const ia = I ? I[2 * sgm] : 2 * sgm, ib = I ? I[2 * sgm + 1] : 2 * sgm + 1;
        let a = clip(ia), b = clip(ib), s0 = 0, s1 = 1;
        const eps = 1e-6;
        if (a[2] < eps && b[2] < eps) continue;
        // Clip to the space in front of the eye, keeping the 3D parameters of the kept ends.
        if (a[2] < eps) { const k = (eps - a[2]) / (b[2] - a[2]); a = a.map((v, j) => v + (b[j] - v) * k); s0 = k; }
        if (b[2] < eps) { const k = (eps - b[2]) / (a[2] - b[2]); b = b.map((v, j) => v + (a[j] - v) * k); s1 = 1 - k; }
        const sx = (c: number[]) => (c[0] / c[2] * 0.5 + 0.5) * cw, sy = (c: number[]) => (0.5 - c[1] / c[2] * 0.5) * ch;
        const ax = sx(a), ay = sy(a), dx = sx(b) - ax, dy = sy(b) - ay, l2 = dx * dx + dy * dy;
        const t = l2 > 0 ? Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
        const dist = Math.hypot(x - (ax + dx * t), y - (ay + dy * t));
        if (dist > radius || (best && dist >= best.distance)) continue;
        // Screen parameter → segment parameter (perspective-correct), then the world point.
        const u = (t * a[2]) / ((1 - t) * b[2] + t * a[2] || 1), s = s0 + (s1 - s0) * u;
        const A = transformPoint(m.transform, [P[3 * ia], P[3 * ia + 1], P[3 * ia + 2]]), B = transformPoint(m.transform, [P[3 * ib], P[3 * ib + 1], P[3 * ib + 2]]);
        best = { mesh: m, segment: sgm, edge: g.edges ? g.edges[sgm] : null, point: add(A, scale(sub(B, A), s)), distance: dist };
      }
    }
    return best;
  }

  /** The world point under a pixel, or where the view ray meets the plane through the target (zoom to cursor). */
  async pointAt(x: number, y: number): Promise<Vec3> {
    const hit = await this.pick(x, y).catch(() => null);
    if (hit) return hit.point;
    const ndcX = (x / Math.max(1, this.canvas.clientWidth || this.canvas.width)) * 2 - 1, ndcY = 1 - (y / Math.max(1, this.canvas.clientHeight || this.canvas.height)) * 2;
    const ray = this.camera.ray(ndcX, ndcY, this.aspect), n = this.camera.basis().forward;
    const den = dot(ray.direction, n);
    if (Math.abs(den) < 1e-9) return this.camera.target;
    return add(ray.origin, scale(ray.direction, dot(sub(this.camera.target, ray.origin), n) / den));
  }

  // ---- Device loss and disposal -------------------------------------------------------------------

  private lose(message: string): void {
    this.stats.deviceLosses++;
    for (const g of this.geometries) g.gpu = null;
    this.recovering = (async () => {
      try {
        this.context.unconfigure();
        await this.start();
      } catch (e) {
        this.report(`Device lost (${message}) and could not be recreated: ${(e as Error).message}`);
        return;
      } finally { this.recovering = null; }
      this.requestRender();
      this.onRecover?.();
    })();
  }

  /** @internal For tests: wait for a device-loss recovery in progress. */
  get recovery(): Promise<void> | null { return this.recovering; }
  /** @internal For tests: destroy the device as a loss would. */
  loseDeviceForTesting(): void { this.device.destroy(); }

  private report(message: string): void {
    if (this.options.onError) this.options.onError(message);
    else console.error('[barocss viewer]', message); // eslint-disable-line no-console
  }

  private alive(): void { if (this.disposed) throw new ViewerError('disposed', 'The viewer has been disposed'); }

  /** Release the device, every buffer and texture, and the canvas listeners. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.controls?.dispose();
    this.resizeObserver?.disconnect();
    const cancel = (globalThis as { cancelAnimationFrame?: (h: number) => void }).cancelAnimationFrame;
    if (this.scheduled) cancel?.(this.scheduled);
    for (const g of this.geometries) g.release();
    this.geometries.clear(); this.meshes = [];
    this.targets?.msaa?.destroy(); this.targets?.scene.destroy(); this.targets?.depth.destroy();
    if (this.pickTargets) { this.pickTargets.id.destroy(); this.pickTargets.z.destroy(); this.pickTargets.depth.destroy(); this.pickTargets.read.destroy(); }
    this.frameBuffer?.destroy(); this.objectBuffer?.destroy(); this.outputBuffer?.destroy(); this.shadowFrameBuffer?.destroy();
    this.shadowMap?.destroy(); this.emptyShadow?.destroy();
    this.context?.unconfigure();
    this.device?.destroy();
    for (const f of this.waiters.splice(0)) f();
  }
}

export const createViewer = (canvas: HTMLCanvasElement, options?: ViewerOptions): Promise<Viewer> => Viewer.create(canvas, options);
