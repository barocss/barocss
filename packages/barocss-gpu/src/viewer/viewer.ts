// One WebGPU renderer for a canvas: it owns the device and the canvas context, keeps geometry in long-
// lived buffers and every pipeline it needs, renders on demand (one frame per animation frame at most),
// follows the canvas size and pixel ratio, and recreates its device and re-uploads the scene when the
// device is lost. Meshes carry a transform and a material; lights and the camera are plain data.
import { boxCenter, boxInFrustum, boxRadius, frustumPlanes, screenRect, transformBox, unionBox, type Box3 } from './bounds.js';
import { Camera } from './camera.js';
import { OrbitControls, type OrbitOptions } from './controls.js';
import { clippedRay, localPlane, prepareGeometry, segmentInstances, vertexColors, fillVertexColors, nearestSegment, type ClippedHit, type GeometryInput, type PreparedGeometry } from './geometry.js';
import { BufferUsage, MapMode, TextureUsage, gpuOf, type BindGroup, type Buffer, type CanvasContext, type Device, type Pipeline, type RenderPass, type Texture } from './gpu.js';
type View = ReturnType<Texture['createView']>;
import { defaultLights, directionalLights, linear, packFrame, packOutput, parseColor, type Background, type ClipFrame, type Color, type Environment, type GridFrame, type Light, type ShadowFrame } from './lights.js';
import { add, cross, dot, identity, invert, lookAt, multiply, normalMatrix, normalize, orthographic, scale, srgbToLinear, sub, transformPoint, type Mat4, type Vec3 } from './math.js';
import { FRAME_BYTES, MAX_OUTLINES, OBJECT_BYTES, OBJECT_STRIDE, OUTPUT_BYTES, gridWGSL, lineWGSL, mipWGSL, outputWGSL, pickWGSL, surfaceWGSL, type SurfaceShader } from './shaders.js';

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
  /**
   * A shadow catcher: draws nothing but the shadow of the shadow-casting light, in the colour (default
   * black) and as dark as the opacity — a ground under a model, say.
   */
  shadowOnly?: boolean;
  /** A colour map (Viewer.createTexture), multiplied into the colour through the geometry's uvs. */
  map?: ImageTexture | null;
  /** Alpha cutout: pixels whose alpha (colour × map) is below this (0 – 1) are not drawn — leaves, grilles, decals with holes; 0: off. */
  alphaCutoff?: number;
  /**
   * A shader material: WGSL that computes the base colour per pixel (then lit, unless unlit). The
   * expression is a vec3<f32> of linear colour with uv, world, normal and materialParams (an
   * array<vec4<f32>, 4> named slot: 64 bytes, from params) in scope; declarations may define helpers
   * and their own struct MaterialParams of that size; aliases name uv, world or normal otherwise.
   */
  shader?: ShaderMaterial | null;
}
export interface ShaderMaterial extends SurfaceShader {
  /** Up to 16 numbers for materialParams. */
  params?: ArrayLike<number>;
}

/** Pixels for a texture: an image, a canvas or a bitmap, or RGBA bytes rows top to bottom. */
export type TextureSource = ImageBitmap | HTMLImageElement | HTMLCanvasElement | OffscreenCanvas | { width: number; height: number; data: Uint8Array | Uint8ClampedArray };
export interface TextureOptions {
  /** Colour data in sRGB (default true); false for data maps. */
  srgb?: boolean;
  /** A mip chain filtered down from the image (default true). */
  mipmaps?: boolean;
  wrap?: 'repeat' | 'clamp';
  filter?: 'linear' | 'nearest';
}

/** A texture the viewer keeps (with its source, to upload again after a device loss). */
export class ImageTexture {
  /** @internal */ gpu: { texture: Texture; group: BindGroup; device: Device; sampler: object } | null = null;
  disposed = false;
  constructor(readonly source: TextureSource, readonly options: Required<TextureOptions>, private readonly owner: Viewer) {}
  get width(): number { return this.source.width; }
  get height(): number { return this.source.height; }
  dispose(): void { this.disposed = true; this.gpu?.texture.destroy(); this.gpu = null; this.owner.requestRender(); }
}
export interface AddMeshOptions {
  material?: Material; transform?: ArrayLike<number>; visible?: boolean; pickable?: boolean; name?: string;
  /** Casts a shadow from the shadow-casting light (default true). */
  castShadow?: boolean;
  /** Darkened by shadows (default true). */
  receiveShadow?: boolean;
  /** Many copies in one draw: a transform each (16 numbers, column-major) and optionally a colour each (sRGB, 3 or 4 numbers). */
  instances?: InstancesInput;
  /** Cut by the viewer's clip plane when one is set (default true). */
  clipped?: boolean;
  /**
   * A closed solid: where the clip plane cuts it, its cut is filled with the plane's cap (default false). The cap is drawn
   * from the mesh's back faces seen through the cut, so an open mesh would show one where its inside shows.
   */
  cap?: boolean;
}
/** A clip plane: what is drawn of the meshes it clips is where dot(normal, p) ≥ offset; their caps in a colour (sRGB). */
export interface ClipPlane { normal: ArrayLike<number>; offset: number; cap?: Color }
export interface InstancesInput { transforms: ArrayLike<number>; colors?: ArrayLike<number> }

/** Bytes per instance: a 4×4 transform and an RGBA8 colour (see Instance in shaders.ts). */
const INSTANCE_STRIDE = 68;
function packInstances(input: InstancesInput): { count: number; data: ArrayBuffer; matrices: Float64Array[] } {
  const t = input.transforms, count = t.length / 16;
  if (!Number.isInteger(count) || count < 1) throw new RangeError('instances.transforms must hold 16 numbers per instance');
  const data = new ArrayBuffer(count * INSTANCE_STRIDE), f = new DataView(data), matrices: Float64Array[] = [];
  const k = input.colors ? (input.colors.length === count * 4 ? 4 : input.colors.length === count * 3 ? 3 : 0) : 0;
  if (input.colors && !k) throw new RangeError('instances.colors must hold three or four numbers per instance');
  for (let i = 0; i < count; i++) {
    const m = Float64Array.from({ length: 16 }, (_, j) => t[i * 16 + j]);
    matrices.push(m);
    for (let j = 0; j < 16; j++) f.setFloat32(i * INSTANCE_STRIDE + j * 4, m[j], true);
    for (let j = 0; j < 4; j++) {
      const c = input.colors ? (j < 3 ? srgbToLinear(Math.min(1, Math.max(0, input.colors[i * k + j]))) : k === 4 ? input.colors[i * k + 3] : 1) : 1;
      f.setUint8(i * INSTANCE_STRIDE + 64 + j, Math.round(Math.min(1, Math.max(0, c)) * 255));
    }
  }
  return { count, data, matrices };
}

export class Geometry {
  /** @internal Triangles: positions, normals, colours, indices. Lines: positions holds the segment instances. */
  gpu: { positions: Buffer; normals: Buffer | null; colors: Buffer | null; uvs: Buffer | null; indices: Buffer | null; device: Device } | null = null;
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
  /**
   * One colour (sRGB, three or four numbers) on vertices `first` … `first + count − 1` of a triangle geometry, and only
   * that range sent to the GPU: a face's highlight changed without re-sending the rest of the colours.
   */
  fillColors(first: number, count: number, color: ArrayLike<number>): void {
    if (this.data.topology !== 'triangles') throw new RangeError('Only triangle geometry has a colour range');
    fillVertexColors(this.data.colors, first, count, color);
    if (this.gpu?.colors && count) this.gpu.device.queue.writeBuffer(this.gpu.colors, 4 * first, this.data.colors, 4 * first, 4 * count);
    this.owner.requestRender();
  }
  /** Replace the texture coordinates (two per vertex) of a triangle geometry: a colour map's placement. */
  setUVs(uvs: ArrayLike<number>): void {
    if (this.data.topology !== 'triangles') throw new RangeError('Only triangle geometry has texture coordinates');
    if (uvs.length !== this.data.vertexCount * 2) throw new RangeError('uvs must hold two numbers per vertex');
    this.data.uvs = Float32Array.from(uvs);
    if (this.gpu?.uvs) this.gpu.device.queue.writeBuffer(this.gpu.uvs, 0, this.data.uvs);
    this.owner.requestRender();
  }
  /** Release the GPU buffers (meshes using it stop drawing). */
  dispose(): void { this.disposed = true; this.release(); this.owner.forget(this); this.owner.requestRender(); }
  /** @internal */ release(): void {
    if (!this.gpu) return;
    this.gpu.positions.destroy(); this.gpu.normals?.destroy(); this.gpu.colors?.destroy(); this.gpu.uvs?.destroy(); this.gpu.indices?.destroy();
    this.gpu = null;
  }
}

export class Mesh {
  /** @internal */ slot = -1;
  /** @internal */ dirty = true;
  private worldBox: Box3 | null | undefined;
  private _transform: Mat4 = identity();
  private _material: Required<Omit<Material, 'color' | 'map' | 'shader'>> & { color: Vec3; map: ImageTexture | null; shader: ShaderMaterial | null };
  private _params: Float32Array | null = null;
  private _visible: boolean;
  pickable: boolean;
  name: string | undefined;
  castShadow: boolean;
  private _receiveShadow: boolean;
  private _outline: Vec3 | null = null;
  private _clipped: boolean;
  /** Filled where the clip plane cuts it (a closed solid; AddMeshOptions.cap). */
  cap: boolean;
  /** @internal Instances: their count, packed data, transforms, and the GPU buffer (null: not uploaded). */
  instances: { count: number; data: ArrayBuffer; matrices: Float64Array[]; buffer: Buffer | null; device: Device | null } | null = null;
  /** @internal Which outline colour of the frame (1-based; 0 none). */
  outlineSlot = 0;
  /** @internal A shader material's bind group (its map and its own parameters), for the device and inputs it was made for. */
  materialState: { device: Device; map: ImageTexture | null; params: Buffer; group: BindGroup; data: Float32Array } | null = null;
  /** Pick id (1-based; 0 is empty space). */
  readonly id: number;

  constructor(readonly geometry: Geometry, private readonly owner: Viewer, id: number, options: AddMeshOptions) {
    this.id = id;
    this._material = materialOf(options.material);
    this._visible = options.visible ?? true;
    this.pickable = options.pickable ?? true;
    this.castShadow = options.castShadow ?? true;
    this._receiveShadow = options.receiveShadow ?? true;
    this._clipped = options.clipped ?? true;
    this.cap = options.cap ?? false;
    this.name = options.name;
    if (options.transform) this.transform = options.transform;
    if (options.instances) this.setInstances(options.instances);
  }

  /** Copies of the mesh, each with its own transform (after the mesh's) and colour; null: a single mesh. */
  setInstances(input: InstancesInput | null): void {
    if (input && this.geometry.topology !== 'triangles') throw new RangeError('Only triangle meshes can be instanced');
    this.instances?.buffer?.destroy();
    this.instances = input ? { ...packInstances(input), buffer: null, device: null } : null;
    this.worldBox = undefined;
    this.owner.requestRender();
  }
  get instanceCount(): number { return this.instances?.count ?? 1; }

  get transform(): Mat4 { return this._transform; }
  set transform(m: ArrayLike<number>) {
    if (m.length !== 16) throw new RangeError('A transform has 16 numbers (column-major)');
    this._transform = Float64Array.from(m); this.worldBox = undefined; this.touch();
  }
  get material(): Readonly<Material> { return this._material; }
  set material(m: Material) { this._material = materialOf({ ...this._material, ...m }); this._params = null; this.touch(); }
  /**
   * @internal The 64 bytes of a shader material's parameters: the same array while they stay the same (they
   * are read every frame, so a params array changed in place is still seen), a new one when they change.
   */
  shaderParams(): Float32Array {
    const p = this._material.shader?.params, have = this._params;
    if (have) {
      let same = !p || p.length <= 16;
      for (let i = 0; same && i < 16; i++) same = have[i] === Math.fround(p && i < p.length ? p[i] : 0);
      if (same) return have;
    }
    const out = new Float32Array(16);
    if (p) { if (p.length > 16) throw new RangeError('A shader material has at most 16 params'); for (let i = 0; i < p.length; i++) out[i] = p[i]; }
    return this._params = out;
  }
  get visible(): boolean { return this._visible; }
  set visible(v: boolean) { this._visible = v; this.owner.requestRender(); }
  get transparent(): boolean { return this._material.opacity < 1 || this._material.shadowOnly; }
  /** Cut by the viewer's clip plane (when one is set). */
  get clipped(): boolean { return this._clipped; }
  set clipped(v: boolean) { if (v !== this._clipped) { this._clipped = v; this.touch(); } }
  get receiveShadow(): boolean { return this._receiveShadow; }
  set receiveShadow(v: boolean) { this._receiveShadow = v; this.touch(); }
  /** A selection outline around the visible part of the mesh (sRGB colour), or null. */
  get outline(): Vec3 | null { return this._outline; }
  set outline(c: Color | null) { this._outline = c === null ? null : parseColor(c); this.owner.requestRender(); }
  /** The world box of the mesh (its geometry box through its transform). */
  get bounds(): Box3 | null {
    if (this.worldBox === undefined) {
      const g = this.geometry.bounds;
      this.worldBox = !g ? null : this.instances ? this.instances.matrices.reduce<Box3 | null>((b, m) => unionBox(b, transformBox(multiply(this._transform, m), g)), null) : transformBox(this._transform, g);
    }
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
    new Uint32Array(f.buffer).set([this.id, this.outlineSlot, (this._receiveShadow ? 1 : 0) | (this._clipped ? 2 : 0), Math.round(m.alphaCutoff * 1000)], o + 40);
  }
}

function materialOf(m: Material = {}): Required<Omit<Material, 'color' | 'map' | 'shader'>> & { color: Vec3; map: ImageTexture | null; shader: ShaderMaterial | null } {
  return {
    color: parseColor(m.color, m.shadowOnly ? [0, 0, 0] : [0.8, 0.8, 0.8]), opacity: Math.min(1, Math.max(0, m.opacity ?? 1)),
    metallic: m.metallic ?? 0, roughness: m.roughness ?? 0.55, emissive: m.emissive ?? 0, unlit: m.unlit ?? false, doubleSided: m.doubleSided ?? false, lineWidth: m.lineWidth ?? 1, shadowOnly: m.shadowOnly ?? false, map: m.map ?? null, shader: m.shader ?? null, alphaCutoff: Math.min(1, Math.max(0, m.alphaCutoff ?? 0)),
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
  /** Follow the canvas's CSS size (default true); false: the application sets the backing size with setSize. */
  autoResize?: boolean;
  /** GPU errors the browser reports outside any check (default: console.error). */
  onError?: (message: string) => void;
  /**
   * Host-driven frames: the viewer asks the host for a frame (a mesh, light or size changed) instead of scheduling its
   * own, and the host calls render() once in its own animation frame. An application that renders the viewer in its
   * frame loop then draws one frame per animation frame, not its own and the viewer's (PERF3 A2).
   */
  onRequestRender?: () => void;
}

export interface PickHit {
  mesh: Mesh;
  /** World point under the pixel. */
  point: Vec3;
  /** The triangle of the mesh's geometry under the pixel, when a ray finds it. */
  triangle: number | null;
  /** That triangle's face id (GeometryInput.faces), when the geometry has them. */
  face: number | null;
  /** Which instance, for an instanced mesh. */
  instance: number | null;
  /** Reversed depth of the pixel (1 near, 0 far). */
  depth: number;
  /** On the clip plane's cap of the mesh (triangle and face are null then). */
  cap?: boolean;
}

export interface LineHit {
  mesh: Mesh;
  /** The segment of the mesh's geometry nearest the point, and its id (GeometryInput.edges). */
  segment: number; edge: number | null;
  /** The nearest world point on the segment, and its distance from the point on screen (CSS pixels). */
  point: Vec3; distance: number;
}

export interface FrameStats { frames: number; drawCalls: number; culled: number; triangles: number; lines: number; deviceLosses: number; cpuMs: number }

/** Built-in pipelines by name; a shader material's are `shader<id>:<variant>`. */
type PipelineKey = string;
/** The scene target: linear, half float (blendable and multisampled everywhere). */
const SCENE_FORMAT = 'rgba16float';

const SAMPLES = 4;

const sortKeys = new Map<Mesh, string>();
const byPipeline = (a: Mesh, b: Mesh): number => { const x = sortKeys.get(a)!, y = sortKeys.get(b)!; return x < y ? -1 : x > y ? 1 : 0; };
const farFirst = (a: { d: number }, b: { d: number }): number => b.d - a.d;
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
  private clip: ClipFrame | null = null;
  /** The clip plane (G2), or null: the meshes it clips are drawn, shadowed, picked and ray-cast only on its kept side. */
  get clipPlane(): Readonly<ClipFrame> | null { return this.clip; }
  set clipPlane(p: ClipPlane | null) {
    if (!p) { this.clip = null; this.requestRender(); return; }
    const l = Math.hypot(p.normal[0], p.normal[1], p.normal[2]);
    if (!(l > 0) || !Number.isFinite(p.offset)) throw new RangeError('A clip plane needs a normal and a finite offset');
    this.clip = { normal: [p.normal[0] / l, p.normal[1] / l, p.normal[2] / l], offset: p.offset / l, cap: parseColor(p.cap, [0.85, 0.7, 0.35]) };
    this.requestRender();
  }

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
  /** A one-texel nearest front depth (none): what the frame bind groups hold where the caps' prepass target is not bound. */
  private emptyFront!: Texture;
  /** The frame bind group without the prepass target (for the prepass itself, which draws into it). */
  private frameGroupBare!: BindGroup;
  private shadowMap: Texture | null = null;
  private materialLayout!: object;
  private surfaceLayout!: object;
  /** The surface pipeline description for a shader module and variant (lit or not, two-sided, transparent). */
  private surfaceDescriptor!: (module: object, lit: boolean, two: boolean, transparent: boolean) => object;
  /** Shader materials by their WGSL: an id and their module (made on first use). */
  private shaders = new Map<string, { id: number; module: object | null; device: Device | null }>();
  /** A shader material's surface WGSL (made once per material: the sort and the draw ask for it per mesh). */
  private shaderCode = new WeakMap<ShaderMaterial, string>();
  /** The scene's box while a frame is drawn (asked for by the shadow, occlusion and camera clip). */
  private frameBox: { box: Box3 | null } | null = null;
  /** What the shadow map was last drawn from (device, size, light view, each caster), as numbers: unchanged, it is kept. */
  private shadowDrawn: number[] = [];
  private shadowNext: number[] = [];
  /** The frame's shadow casters (a list kept from frame to frame). */
  private casterList: Mesh[] = [];
  private ids = new WeakMap<object, number>();
  private nextObjectId = 1;
  private idOf(o: object): number { let i = this.ids.get(o); if (i === undefined) { i = this.nextObjectId++; this.ids.set(o, i); } return i; }
  private zeroParams!: Buffer;
  /** A white texel: the colour map of a material without one. */
  private white!: { texture: Texture; group: BindGroup };
  /** The environment map the frame bind groups were made with. */
  private boundEnv: ImageTexture | null = null;
  private mipPipelines = new Map<string, Pipeline>();
  private mipSampler!: object;
  private textures = new Set<ImageTexture>();
  /** The one identity instance plain meshes draw with. */
  private identityInstance!: Buffer;
  private objectBuffer!: Buffer;
  private objectGroup!: BindGroup;
  private objectCapacity = 0;
  private objectData = new Float32Array(0);
  // (Their views made once with them: a frame reuses them.)
  private targets: { width: number; height: number; msaa: Texture | null; scene: Texture; depth: Texture; mask: Texture; maskDepth: Texture; capFront: Texture; output: BindGroup; views: { msaa: View | null; scene: View; depth: View; mask: View; maskDepth: View; capFront: View } } | null = null;
  private outputBuffer!: Buffer;
  private pickTargets: { width: number; height: number; id: Texture; depth: Texture; z: Texture; instance: Texture; read: Buffer; views: { id: View; z: View; instance: View; depth: View } } | null = null;
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
    if (options.autoResize !== false && typeof ResizeObserver !== 'undefined') {
      v.resizeObserver = new ResizeObserver(() => v.resize());
      v.resizeObserver.observe(canvas);
    }
    if (options.autoResize !== false) v.resize();
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
    this.mipSampler = device.createSampler({ minFilter: 'linear', magFilter: 'linear' });
    this.mipPipelines.clear();
    const white = device.createTexture({ size: [1, 1], format: 'rgba8unorm', usage: TextureUsage.TEXTURE_BINDING | TextureUsage.COPY_DST, label: 'viewer white' });
    device.queue.writeTexture({ texture: white }, new Uint8Array([255, 255, 255, 255]), { bytesPerRow: 4 }, [1, 1]);
    this.zeroParams = device.createBuffer({ size: 64, usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST, label: 'viewer no params' });
    this.white = { texture: white, group: device.createBindGroup({ layout: this.materialLayout, entries: [{ binding: 0, resource: white.createView() }, { binding: 1, resource: this.mipSampler }, { binding: 2, resource: { buffer: this.zeroParams } }] }) };
    this.identityInstance = device.createBuffer({ size: INSTANCE_STRIDE, usage: BufferUsage.VERTEX | BufferUsage.COPY_DST, label: 'viewer identity instance' });
    device.queue.writeBuffer(this.identityInstance, 0, new Uint8Array(packInstances({ transforms: identity() }).data));
    this.emptyShadow = device.createTexture({ size: [1, 1], format: 'depth32float', usage: TextureUsage.TEXTURE_BINDING | TextureUsage.RENDER_ATTACHMENT, label: 'viewer no shadow' });
    this.emptyFront = device.createTexture({ size: [1, 1], format: 'r32float', usage: TextureUsage.TEXTURE_BINDING | TextureUsage.COPY_DST, label: 'viewer no front depth' });
    this.shadowMap = null;
    // (The targets were the lost device's: made again, and bound, when next drawn.)
    this.targets = null; this.pickTargets = null;
    this.bindFrames();
    this.objectCapacity = 0; this.growObjects(Math.max(64, this.nextSlot));
    for (const m of this.meshes) m.dirty = true;
    device.lost.then(info => { if (!this.disposed && this.device === device) this.lose(info.message); });
  }

  /** The frame bind groups: the scene's samples the shadow map; the shadow pass's must not. */
  private bindFrames(): void {
    const layout = this.pipelines.get('lit')!.getBindGroupLayout(0);
    // The environment map (uploaded with its mips as any map), or the white texel.
    const env = this.environment.map instanceof ImageTexture && !this.environment.map.disposed ? this.environment.map : null;
    if (env) this.mapGroup(env);
    this.boundEnv = env;
    const envView = env?.gpu ? env.gpu.texture.createView() : this.white.texture.createView(), envSampler = env?.gpu ? env.gpu.sampler : this.mipSampler;
    // (The caps' prepass target where the targets exist; the scene's group must not hold it while the prepass draws into it.)
    const front = this.targets?.capFront ?? this.emptyFront;
    const group = (buffer: Buffer, map: Texture, depth: Texture) => this.device.createBindGroup({ layout, entries: [{ binding: 0, resource: { buffer } }, { binding: 1, resource: map.createView() }, { binding: 2, resource: this.shadowSampler }, { binding: 3, resource: envView }, { binding: 4, resource: envSampler }, { binding: 5, resource: depth.createView() }] });
    this.frameGroup = group(this.frameBuffer, this.shadowMap ?? this.emptyShadow, front);
    this.frameGroupBare = group(this.frameBuffer, this.shadowMap ?? this.emptyShadow, this.emptyFront);
    this.shadowFrameGroup = group(this.shadowFrameBuffer, this.emptyShadow, this.emptyFront);
  }

  private async createPipelines(): Promise<void> {
    const d = this.device;
    const modules = { surface: d.createShaderModule({ code: surfaceWGSL(), label: 'viewer surface' }), line: d.createShaderModule({ code: lineWGSL, label: 'viewer line' }), pick: d.createShaderModule({ code: pickWGSL, label: 'viewer pick' }) };
    for (const [name, m] of Object.entries(modules)) {
      const errors = (await m.getCompilationInfo()).messages.filter(x => x.type === 'error');
      if (errors.length) throw new ViewerError('shader', `${name} shader: ${errors.map(e => `${e.lineNum}: ${e.message}`).join('; ')}`);
    }
    const frameLayout = d.createBindGroupLayout({ entries: [
      { binding: 0, visibility: 3, buffer: { type: 'uniform' } },
      { binding: 1, visibility: 2, texture: { sampleType: 'depth' } },
      { binding: 2, visibility: 2, sampler: { type: 'comparison' } },
      { binding: 3, visibility: 2, texture: { sampleType: 'float' } }, { binding: 4, visibility: 2, sampler: { type: 'filtering' } },
      { binding: 5, visibility: 2, texture: { sampleType: 'unfilterable-float' } },
    ] });
    const objectLayout = d.createBindGroupLayout({ entries: [{ binding: 0, visibility: 3, buffer: { type: 'uniform', hasDynamicOffset: true, minBindingSize: OBJECT_BYTES } }] });
    const layout = d.createPipelineLayout({ bindGroupLayouts: [frameLayout, objectLayout] });
    // Surfaces add the material's colour map.
    this.materialLayout = d.createBindGroupLayout({ entries: [
      { binding: 0, visibility: 2, texture: { sampleType: 'float' } }, { binding: 1, visibility: 2, sampler: { type: 'filtering' } },
      { binding: 2, visibility: 2, buffer: { type: 'uniform', minBindingSize: 64 } },
    ] });
    const surfaceLayout = this.surfaceLayout = d.createPipelineLayout({ bindGroupLayouts: [frameLayout, objectLayout, this.materialLayout] });
    const instance = { arrayStride: INSTANCE_STRIDE, stepMode: 'instance', attributes: [
      ...[0, 1, 2, 3].map(k => ({ shaderLocation: 3 + k, offset: k * 16, format: 'float32x4' })), { shaderLocation: 7, offset: 64, format: 'unorm8x4' },
    ] };
    const position = { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] };
    // Surfaces: position, normal, colour, instance. Pick, mask and shadow passes: position, instance.
    const vertex = (module: object) => ({
      module, entryPoint: 'vs',
      buffers: [position, { arrayStride: 12, attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }] }, { arrayStride: 4, attributes: [{ shaderLocation: 2, offset: 0, format: 'unorm8x4' }] }, instance,
        { arrayStride: 8, attributes: [{ shaderLocation: 8, offset: 0, format: 'float32x2' }] }],
    });
    const positionOnly = (module: object) => ({ module, entryPoint: 'vs', buffers: [position, instance] });
    // Premultiplied colour over the target.
    const blend = { color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' } };
    const ms = { count: this.options.antialias === false ? 1 : SAMPLES };
    const make = (key: PipelineKey, desc: object) => d.createRenderPipelineAsync({ label: `viewer ${key}`, layout: /^(lit|unlit|catcher)/.test(key) ? surfaceLayout : layout, ...desc }).then(p => { this.pipelines.set(key, p); });
    const jobs: Promise<void>[] = [];
    d.pushErrorScope('validation');
    this.surfaceDescriptor = (module, lit, two, t) => ({
      vertex: vertex(module),
      fragment: { module, entryPoint: lit ? 'fsLit' : 'fsUnlit', targets: [{ format: SCENE_FORMAT, ...(t ? { blend } : {}) }] },
      primitive: { topology: 'triangle-list', cullMode: two ? 'none' : 'back', frontFace: 'ccw' },
      // Faces sit a little behind lines drawn on them (reversed depth: lower is further).
      depthStencil: { format: 'depth32float', depthWriteEnabled: !t, depthCompare: 'greater-equal', depthBias: -2, depthBiasSlopeScale: -1.5 },
      multisample: ms,
    });
    for (const lit of [true, false]) for (const two of [false, true]) for (const t of [false, true])
      jobs.push(make(`${lit ? 'lit' : 'unlit'}${two ? '2' : ''}${t ? 'T' : ''}`, this.surfaceDescriptor(modules.surface, lit, two, t)));
    jobs.push(make('catcher', {
      vertex: vertex(modules.surface),
      fragment: { module: modules.surface, entryPoint: 'fsShadow', targets: [{ format: SCENE_FORMAT, blend }] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: false, depthCompare: 'greater-equal' },
      multisample: ms,
    }));
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
      vertex: positionOnly(modules.pick),
      fragment: { module: modules.pick, entryPoint: 'fs', targets: [{ format: 'r32uint' }, { format: 'r32float' }, { format: 'r32uint' }] },
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
    // Caps (G2): a kept back face seen through the cut, at the plane's depth (written by the fragment).
    jobs.push(make('litCap', {
      vertex: vertex(modules.surface),
      fragment: { module: modules.surface, entryPoint: 'fsCap', targets: [{ format: SCENE_FORMAT }] },
      primitive: { topology: 'triangle-list', cullMode: 'front', frontFace: 'ccw' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'greater-equal' },
      multisample: ms,
    }));
    jobs.push(make('capFront', {
      vertex: positionOnly(modules.pick),
      fragment: { module: modules.pick, entryPoint: 'fsFront', targets: [{ format: 'r32float' }] },
      primitive: { topology: 'triangle-list', cullMode: 'back', frontFace: 'ccw' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'greater' },
    }));
    jobs.push(make('capPick', {
      vertex: positionOnly(modules.pick),
      fragment: { module: modules.pick, entryPoint: 'fsCapPick', targets: [{ format: 'r32uint' }, { format: 'r32float' }, { format: 'r32uint' }] },
      primitive: { topology: 'triangle-list', cullMode: 'front', frontFace: 'ccw' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'greater' },
    }));
    jobs.push(make('capMask', {
      vertex: positionOnly(modules.pick),
      fragment: { module: modules.pick, entryPoint: 'fsCapMask', targets: [{ format: 'r32uint' }] },
      primitive: { topology: 'triangle-list', cullMode: 'front', frontFace: 'ccw' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'greater' },
    }));
    jobs.push(make('shadow', {
      vertex: positionOnly(modules.pick),
      // (Depth only; the fragment drops what the clip plane cuts away.)
      fragment: { module: modules.pick, entryPoint: 'fsDepth', targets: [] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less', depthBias: 2, depthBiasSlopeScale: 2 },
    }));
    for (const two of [false, true]) jobs.push(make(two ? 'mask2' : 'mask', {
      vertex: positionOnly(modules.pick),
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
    // Its own GPU buffers go with it (made again should it be drawn again).
    if (mesh.instances?.buffer) { mesh.instances.buffer.destroy(); mesh.instances.buffer = null; mesh.instances.device = null; }
    mesh.materialState?.params.destroy(); mesh.materialState = null;
    this.requestRender();
  }

  /** @internal A disposed geometry: no longer kept (nor restored after a lost device). */
  forget(g: Geometry): void { this.geometries.delete(g); }

  /** Remove every mesh and release every geometry. */
  clear(): void {
    for (const m of this.meshes) m.slot = -1;
    this.meshes = []; this.freeSlots = []; this.nextSlot = 0;
    for (const g of this.geometries) g.release();
    this.geometries.clear();
    this.requestRender();
  }

  get meshList(): readonly Mesh[] { return this.meshes; }

  /** The box around every visible mesh (a clipped mesh's box cut by an axis-aligned clip plane, as a clipped copy's would be). */
  sceneBounds(): Box3 | null {
    if (this.frameBox) return this.frameBox.box;
    let b: Box3 | null = null;
    for (const m of this.meshes) if (m.visible && !m.geometry.disposed) b = unionBox(b, this.clip && m.clipped ? clipBox(m.bounds, this.clip) : m.bounds);
    return b;
  }

  /** Frame a box (default: the scene) in the view. */
  fit(box: Box3 | null = this.sceneBounds()): void {
    if (box) this.camera.fit(box, this.aspect);
    this.requestRender();
  }

  /** A new background; switching to or from 'transparent' takes effect after the next device setup. */
  setBackground(background: BackgroundInput): void { this.background = backgroundOf(background); this.requestRender(); }

  /** A texture from an image, canvas, bitmap or RGBA bytes, for Material.map. */
  createTexture(source: TextureSource, options: TextureOptions = {}): ImageTexture {
    this.alive();
    if (!(source.width > 0 && source.height > 0)) throw new RangeError('A texture needs a width and height');
    if ('data' in source && source.data.length !== source.width * source.height * 4) throw new RangeError('Texture data must hold width × height RGBA bytes');
    const t = new ImageTexture(source, { srgb: options.srgb ?? true, mipmaps: options.mipmaps ?? true, wrap: options.wrap ?? 'repeat', filter: options.filter ?? 'linear' }, this);
    this.textures.add(t);
    return t;
  }

  /** The material bind group of a colour map: uploaded (with its mips) on first use and after a device loss. */
  private mapGroup(map: ImageTexture | null): BindGroup {
    if (!map || map.disposed) return this.white.group;
    if (map.gpu && map.gpu.device === this.device) return map.gpu.group;
    const o = map.options, src = map.source, w = src.width, h = src.height, format = o.srgb ? 'rgba8unorm-srgb' : 'rgba8unorm';
    const levels = o.mipmaps ? Math.floor(Math.log2(Math.max(w, h))) + 1 : 1;
    const texture = this.device.createTexture({ size: [w, h], format, mipLevelCount: levels, usage: TextureUsage.TEXTURE_BINDING | TextureUsage.COPY_DST | TextureUsage.RENDER_ATTACHMENT, label: 'viewer map' });
    if ('data' in src) this.device.queue.writeTexture({ texture }, src.data, { bytesPerRow: w * 4 }, [w, h]);
    else this.device.queue.copyExternalImageToTexture({ source: src }, { texture }, [w, h]);
    if (levels > 1) this.generateMips(texture, format, levels);
    const sampler = this.device.createSampler({
      addressModeU: o.wrap === 'repeat' ? 'repeat' : 'clamp-to-edge', addressModeV: o.wrap === 'repeat' ? 'repeat' : 'clamp-to-edge',
      magFilter: o.filter, minFilter: o.filter, mipmapFilter: o.filter, ...(o.filter === 'linear' && o.mipmaps ? { maxAnisotropy: 8 } : {}),
    });
    const group = this.device.createBindGroup({ layout: this.materialLayout, entries: [{ binding: 0, resource: texture.createView() }, { binding: 1, resource: sampler }, { binding: 2, resource: { buffer: this.zeroParams } }] });
    map.gpu = { texture, group, device: this.device, sampler };
    return group;
  }

  /** A mesh's material bind group: its map's (or the white texel's), with its shader params when it has a shader. */
  private materialGroup(m: Mesh): BindGroup {
    const mat = m.material;
    if (!mat.shader) { m.materialState?.params.destroy(); m.materialState = null; return this.mapGroup(mat.map ?? null); }
    const map = mat.map && !mat.map.disposed ? mat.map : null, data = m.shaderParams(), st = m.materialState;
    if (st && st.device === this.device && st.map === map) {
      if (st.data !== data) { this.device.queue.writeBuffer(st.params, 0, data); st.data = data; }
      return st.group;
    }
    st?.params.destroy();
    this.mapGroup(map);
    const params = this.device.createBuffer({ size: 64, usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST, label: 'viewer shader params' });
    this.device.queue.writeBuffer(params, 0, data);
    const view = map?.gpu ? map.gpu.texture.createView() : this.white.texture.createView(), sampler = map?.gpu ? map.gpu.sampler : this.mipSampler;
    const group = this.device.createBindGroup({ layout: this.materialLayout, entries: [{ binding: 0, resource: view }, { binding: 1, resource: sampler }, { binding: 2, resource: { buffer: params } }] });
    m.materialState = { device: this.device, map, params, group, data };
    return group;
  }

  /** A shader material's pipeline for a variant: its module compiled on first use (errors reported, not thrown). */
  private shaderPipeline(shader: ShaderMaterial, variant: string): PipelineKey {
    let code = this.shaderCode.get(shader);
    if (code === undefined) { code = surfaceWGSL(shader); this.shaderCode.set(shader, code); }
    let entry = this.shaders.get(code);
    if (!entry) { entry = { id: this.shaders.size + 1, module: null, device: null }; this.shaders.set(code, entry); }
    const key = `shader${entry.id}:${variant}`;
    if (entry.device !== this.device || !entry.module) {
      entry.module = this.device.createShaderModule({ code, label: `viewer shader material ${entry.id}` });
      entry.device = this.device;
      (entry.module as { getCompilationInfo(): Promise<{ messages: readonly { type: string; message: string; lineNum: number }[] }> }).getCompilationInfo().then(info => {
        const errors = info.messages.filter(x => x.type === 'error');
        if (errors.length) this.report(`Shader material ${entry!.id}: ${errors.map(e => `${e.lineNum}: ${e.message}`).join('; ')}`);
      }, () => undefined);
      for (const k of [...this.pipelines.keys()]) if (k.startsWith(`shader${entry.id}:`)) this.pipelines.delete(k);
    }
    if (!this.pipelines.has(key)) {
      const lit = !variant.startsWith('unlit'), two = variant.includes('2'), t = variant.endsWith('T');
      this.pipelines.set(key, (this.device as unknown as { createRenderPipeline(d: object): Pipeline }).createRenderPipeline({ label: `viewer ${key}`, layout: this.surfaceLayout, ...this.surfaceDescriptor(entry.module, lit, two, t) }));
    }
    return key;
  }

  /** Fill a texture's mip levels, each a filtered half of the one above. */
  private generateMips(texture: Texture, format: string, levels: number): void {
    let pipeline = this.mipPipelines.get(format);
    if (!pipeline) {
      const module = this.device.createShaderModule({ code: mipWGSL, label: 'viewer mips' });
      // (Synchronous creation: mips are made while drawing.)
      pipeline = (this.device as unknown as { createRenderPipeline(d: object): Pipeline }).createRenderPipeline({
        label: 'viewer mips', layout: 'auto', vertex: { module, entryPoint: 'vs' }, fragment: { module, entryPoint: 'fs', targets: [{ format }] }, primitive: { topology: 'triangle-list' },
      });
      this.mipPipelines.set(format, pipeline);
    }
    const enc = this.device.createCommandEncoder();
    for (let level = 1; level < levels; level++) {
      const group = this.device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
        { binding: 0, resource: texture.createView({ baseMipLevel: level - 1, mipLevelCount: 1 }) }, { binding: 1, resource: this.mipSampler },
      ] });
      const pass = enc.beginRenderPass({ colorAttachments: [{ view: texture.createView({ baseMipLevel: level, mipLevelCount: 1 }), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 0 } }] });
      pass.setPipeline(pipeline); pass.setBindGroup(0, group); pass.draw(3); pass.end();
    }
    this.device.queue.submit([enc.finish()]);
  }

  // ---- Size and frames ----------------------------------------------------------------------------

  get aspect(): number { return this.canvas.width / Math.max(1, this.canvas.height); }

  /** Match the canvas backing store to its CSS size times the pixel ratio. */
  resize(pixelRatio = this.pixelRatio): void {
    const ratio = pixelRatio !== this.pixelRatio;
    if (ratio) for (const m of this.meshes) m.dirty = true;
    this.pixelRatio = pixelRatio;
    const max = this.device?.limits.maxTextureDimension2D ?? 8192;
    const w = Math.max(1, Math.min(max, Math.round((this.canvas.clientWidth || this.canvas.width) * pixelRatio)));
    const h = Math.max(1, Math.min(max, Math.round((this.canvas.clientHeight || this.canvas.height) * pixelRatio)));
    const sized = this.canvas.width !== w || this.canvas.height !== h;
    if (sized) { this.canvas.width = w; this.canvas.height = h; }
    // (Unchanged, nothing to draw again: a caller that resizes before each render() draws once.)
    if (sized || ratio) this.requestRender();
  }

  /** Set the canvas backing size in device pixels (with autoResize false; capped at the device's texture size). */
  setSize(width: number, height: number): void {
    const max = this.device?.limits.maxTextureDimension2D ?? 8192;
    if (!(width >= 1 && height >= 1)) throw new RangeError('A backing size is at least 1 × 1');
    const w = Math.min(max, Math.round(width)), h = Math.min(max, Math.round(height));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.requestRender();
  }

  /** Whether the viewer can draw: not disposed and not replacing a lost device. */
  get ready(): boolean { return !this.disposed && !this.recovering; }

  /** The frame callback, made once (not a closure a request; PERF3 C17). */
  private readonly scheduledRun = (): void => { this.scheduled = 0; this.render(); };
  /** Draw on the next animation frame (several requests make one frame). */
  requestRender(): void {
    if (this.disposed) return;
    if (this.options.onRequestRender) { this.options.onRequestRender(); return; }
    if (this.scheduled) return;
    const raf = (globalThis as { requestAnimationFrame?: (f: () => void) => number }).requestAnimationFrame;
    this.scheduled = raf ? raf(this.scheduledRun) : (setTimeout(this.scheduledRun, 0) as unknown as number);
  }

  private cancelScheduled(): void {
    if (!this.scheduled) return;
    const cancel = (globalThis as { cancelAnimationFrame?: (h: number) => void }).cancelAnimationFrame;
    if ((globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame && cancel) cancel(this.scheduled); else clearTimeout(this.scheduled);
    this.scheduled = 0;
  }

  /** Resolves once the next frame has been drawn and the GPU has finished it. */
  frame(): Promise<void> {
    return new Promise(resolve => { this.waiters.push(resolve); this.requestRender(); });
  }

  /** Draw now (a frame already asked for is drawn by this one). */
  render(): void {
    if (this.disposed || this.recovering) return;
    this.cancelScheduled();
    const t0 = performance.now();
    this.draw(null);
    this.stats.cpuMs = performance.now() - t0;
    const waiters = this.waiters.splice(0);
    if (waiters.length) this.device.queue.onSubmittedWorkDone().then(() => waiters.forEach(f => f()), () => waiters.forEach(f => f()));
  }

  private ensureTargets(): NonNullable<Viewer['targets']> {
    const w = this.canvas.width, h = this.canvas.height, t = this.targets;
    if (t && t.width === w && t.height === h) return t;
    t?.msaa?.destroy(); t?.scene.destroy(); t?.depth.destroy(); t?.mask.destroy(); t?.maskDepth.destroy(); t?.capFront.destroy();
    const samples = this.options.antialias === false ? 1 : SAMPLES;
    const msaa = samples > 1 ? this.device.createTexture({ size: [w, h], format: SCENE_FORMAT, sampleCount: samples, usage: TextureUsage.RENDER_ATTACHMENT, label: 'viewer msaa' }) : null;
    const scene = this.device.createTexture({ size: [w, h], format: SCENE_FORMAT, usage: TextureUsage.RENDER_ATTACHMENT | TextureUsage.TEXTURE_BINDING, label: 'viewer scene' });
    const depth = this.device.createTexture({ size: [w, h], format: 'depth32float', sampleCount: samples, usage: TextureUsage.RENDER_ATTACHMENT | TextureUsage.TEXTURE_BINDING, label: 'viewer depth' });
    const mask = this.device.createTexture({ size: [w, h], format: 'r32uint', usage: TextureUsage.RENDER_ATTACHMENT | TextureUsage.TEXTURE_BINDING, label: 'viewer outline mask' });
    const maskDepth = this.device.createTexture({ size: [w, h], format: 'depth32float', usage: TextureUsage.RENDER_ATTACHMENT, label: 'viewer outline depth' });
    const capFront = this.device.createTexture({ size: [w, h], format: 'r32float', usage: TextureUsage.RENDER_ATTACHMENT | TextureUsage.TEXTURE_BINDING, label: 'viewer cap front depth' });
    const views = { msaa: msaa ? msaa.createView() : null, scene: scene.createView(), depth: depth.createView(), mask: mask.createView(), maskDepth: maskDepth.createView(), capFront: capFront.createView() };
    const output = this.device.createBindGroup({ layout: this.pipelines.get('output')!.getBindGroupLayout(0), entries: [{ binding: 0, resource: scene.createView() }, { binding: 1, resource: { buffer: this.outputBuffer } }, { binding: 2, resource: mask.createView() }, { binding: 3, resource: depth.createView() }] });
    this.targets = { width: w, height: h, msaa, scene, depth, mask, maskDepth, capFront, output, views };
    // (The frame bind group holds the new prepass target.)
    this.bindFrames();
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
      ? { device: d, positions: buffer(new Uint8Array(segmentInstances(data)), BufferUsage.VERTEX, 'segments'), normals: null, colors: null, uvs: null, indices: null }
      : {
        device: d,
        positions: buffer(data.positions, BufferUsage.VERTEX, 'positions'), normals: buffer(data.normals, BufferUsage.VERTEX, 'normals'),
        colors: buffer(data.colors, BufferUsage.VERTEX, 'colors'), uvs: buffer(data.uvs, BufferUsage.VERTEX, 'uvs'), indices: data.indices ? buffer(data.indices, BufferUsage.INDEX, 'indices') : null,
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
    // (The keys in a map kept for the purpose, and comparators at module level: no closures a frame; PERF3 C17.)
    sortKeys.clear(); for (const m of opaque) sortKeys.set(m, (m.geometry.topology === 'lines' ? '1' : '0') + this.pipelineKey(m, false));
    opaque.sort(byPipeline); sortKeys.clear();
    transparent.sort(farFirst);
    return { opaque, transparent: transparent.map(t => t.m), culled };
  }

  private pipelineKey(m: Mesh, pick: boolean | 'mask'): PipelineKey {
    const mat = m.material, two = mat.doubleSided ? '2' : '', t = m.transparent ? 'T' : '';
    if (pick === 'mask') return (two ? 'mask2' : 'mask');
    if (pick) return (two ? 'pick2' : 'pick');
    if (m.geometry.topology === 'lines') return (t ? 'lineT' : 'line');
    if (mat.shadowOnly) return 'catcher';
    const variant = `${mat.unlit ? 'unlit' : 'lit'}${two}${t}`;
    return mat.shader ? this.shaderPipeline(mat.shader, variant) : variant;
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
    this.device.queue.writeBuffer(this.frameBuffer, 0, packFrame(viewProjection, this.camera, this.lights, this.environment, shadow, [this.canvas.width, this.canvas.height, this.pixelRatio], this.gridFrame(), this.clip));
    if (shadow) this.device.queue.writeBuffer(this.shadowFrameBuffer, 0, packFrame(shadow.viewProjection, this.camera, [], this.environment, null, [1, 1, 1], null, this.clip));
    let lo = Infinity, hi = -1;
    for (const m of this.meshes) if (m.dirty) {
      m.pack(this.objectData, m.slot * OBJECT_STRIDE, this.pixelRatio);
      m.dirty = false; lo = Math.min(lo, m.slot); hi = Math.max(hi, m.slot);
    }
    if (hi >= 0) this.device.queue.writeBuffer(this.objectBuffer, lo * OBJECT_STRIDE, this.objectData, (lo * OBJECT_STRIDE) / 4, ((hi - lo) * OBJECT_STRIDE + OBJECT_BYTES) / 4);
  }

  /** A mesh's instance buffer (uploaded on first use and after a device loss), or the identity instance. */
  private instanceBuffer(m: Mesh): Buffer {
    const inst = m.instances;
    if (!inst) return this.identityInstance;
    if (!inst.buffer || inst.device !== this.device) {
      inst.buffer = this.device.createBuffer({ size: inst.data.byteLength, usage: BufferUsage.VERTEX | BufferUsage.COPY_DST, label: 'viewer instances' });
      this.device.queue.writeBuffer(inst.buffer, 0, new Uint8Array(inst.data));
      inst.device = this.device;
    }
    return inst.buffer;
  }

  /** Draw a mesh's triangles: surfaces with every attribute, the other passes with positions and instances. */
  private drawTriangles(pass: RenderPass, m: Mesh, full: boolean): void {
    const g = m.geometry.gpu!, data = m.geometry.data, n = m.instanceCount;
    pass.setVertexBuffer(0, g.positions);
    if (full) {
      pass.setVertexBuffer(1, g.normals!); pass.setVertexBuffer(2, g.colors!); pass.setVertexBuffer(3, this.instanceBuffer(m)); pass.setVertexBuffer(4, g.uvs!);
      pass.setBindGroup(2, this.materialGroup(m));
    }
    else pass.setVertexBuffer(1, this.instanceBuffer(m));
    if (g.indices) { pass.setIndexBuffer(g.indices, data.indices instanceof Uint16Array ? 'uint16' : 'uint32'); pass.drawIndexed(data.elementCount, n); }
    else pass.draw(data.elementCount, n);
  }

  private drawMesh(pass: RenderPass, m: Mesh, current: { pipeline?: Pipeline }, pick: boolean | 'mask'): void {
    const p = this.pipelines.get(this.pipelineKey(m, pick))!, g = m.geometry.gpu!, data = m.geometry.data;
    if (current.pipeline !== p) { pass.setPipeline(p); current.pipeline = p; }
    pass.setBindGroup(1, this.objectGroup, [m.slot * OBJECT_STRIDE]);
    if (data.topology === 'lines') { pass.setVertexBuffer(0, g.positions); pass.draw(6, data.elementCount / 2); return; }
    this.drawTriangles(pass, m, !pick);
  }

  /** Whether a mesh's cut is capped this frame: a clip plane, an opaque closed triangle mesh it clips. */
  private capped(m: Mesh): boolean { return !!this.clip && m.cap && m.clipped && m.geometry.topology === 'triangles' && !m.transparent; }
  /**
   * The caps' prepass (G2): every opaque surface's nearest kept front depth, read by the caps — a back face behind one is
   * not seen through the cut. Only while a plane caps one of them; `scissor`: the pick's pixel.
   */
  private drawCapFront(enc: ReturnType<Device['createCommandEncoder']>, opaque: readonly Mesh[], scissor: [number, number] | null): void {
    if (!this.clip || !opaque.some(m => this.capped(m))) return;
    const t = this.ensureTargets();
    const pass = enc.beginRenderPass({
      colorAttachments: [{ view: t.views.capFront, clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' }],
      depthStencilAttachment: { view: t.views.maskDepth, depthClearValue: 0, depthLoadOp: 'clear', depthStoreOp: 'discard' },
    });
    if (scissor) pass.setScissorRect(scissor[0], scissor[1], 1, 1);
    pass.setBindGroup(0, this.frameGroupBare);
    pass.setPipeline(this.pipelines.get('capFront')!);
    for (const m of opaque) {
      if (m.geometry.topology !== 'triangles') continue;
      pass.setBindGroup(1, this.objectGroup, [m.slot * OBJECT_STRIDE]);
      this.drawTriangles(pass, m, false);
    }
    pass.end();
  }
  /** The caps of the opaque meshes in a pass ('litCap' in the scene, 'capMask', 'capPick'): their count. */
  private drawCaps(pass: RenderPass, list: readonly Mesh[], current: { pipeline?: Pipeline }, key: 'litCap' | 'capMask' | 'capPick'): number {
    if (!this.clip) return 0;
    let n = 0;
    for (const m of list) {
      if (!this.capped(m) || (key === 'capPick' && !m.pickable)) continue;
      const p = this.pipelines.get(key)!;
      if (current.pipeline !== p) { pass.setPipeline(p); current.pipeline = p; }
      pass.setBindGroup(1, this.objectGroup, [m.slot * OBJECT_STRIDE]);
      this.drawTriangles(pass, m, key === 'litCap');
      n++;
    }
    return n;
  }

  /** The grid, drawn in the main pass after the opaque surfaces. */
  private drawGrid(pass: RenderPass, current: { pipeline?: Pipeline }): void {
    pass.setPipeline(this.pipelines.get('grid')!); pass.setBindGroup(1, this.objectGroup, [0]); current.pipeline = undefined; pass.draw(3);
  }
  /** Whether the shadow map must be drawn again: the light's view or a caster changed since it was (recorded when so). */
  private shadowChanged(viewProjection: ArrayLike<number>, casters: readonly Mesh[]): boolean {
    const k = this.shadowNext; k.length = 0;
    k.push(this.idOf(this.device), this.shadowMapSize);
    // (The clip plane changes what casts.)
    if (this.clip) k.push(1, ...this.clip.normal, this.clip.offset); else k.push(0);
    for (let i = 0; i < viewProjection.length; i++) k.push(viewProjection[i]);
    for (const m of casters) { k.push(m.slot, this.idOf(m.geometry), m.geometry.gpu ? 1 : 0, m.instances ? this.idOf(m.instances) : 0); for (let i = 0; i < m.transform.length; i++) k.push(m.transform[i]); }
    const was = this.shadowDrawn;
    let same = was.length === k.length;
    for (let i = 0; same && i < k.length; i++) same = was[i] === k[i];
    if (same) return false;
    this.shadowDrawn = k; this.shadowNext = was;
    return true;
  }
  /** Number each distinct outline colour of the frame (up to MAX_OUTLINES; later ones share the last). */
  private outlineColors(): Vec3[] {
    const colors: Vec3[] = [];
    for (const m of this.meshes) {
      let slot = 0;
      if (m.outline && m.visible) {
        const o = m.outline; let i = -1;
        for (let k = 0; k < colors.length && i < 0; k++) if (colors[k][0] === o[0] && colors[k][1] === o[1] && colors[k][2] === o[2]) i = k;
        if (i < 0 && colors.length < MAX_OUTLINES) { colors.push(m.outline); i = colors.length - 1; }
        slot = (i < 0 ? colors.length - 1 : i) + 1;
      }
      if (slot !== m.outlineSlot) { m.outlineSlot = slot; m.dirty = true; }
    }
    return colors;
  }

  /**
   * Where the outlines can be this frame (device pixels): the outlined meshes' screen box, widened by the outline's
   * reach and a pixel, or null (anywhere) when one reaches behind the eye. The output pass searches the mask only there.
   */
  private outlineRect(vp: Mat4): number[] | null {
    const boxes: Box3[] = [];
    for (const m of this.meshes) if (m.outlineSlot && m.visible && m.geometry.topology === 'triangles') { const b = m.bounds; if (!b) return null; boxes.push(b); }
    const r = boxes.length ? screenRect(vp, boxes, this.canvas.width, this.canvas.height) : null;
    if (!r) return null;
    const reach = Math.ceil(this.outlineWidth * this.pixelRatio + 0.5) + 2;
    return [r[0] - reach, r[1] - reach, r[2] + reach, r[3] + reach];
  }
  private draw(capture: Buffer | null): void {
    this.frameBox = null; this.frameBox = { box: this.sceneBounds() };
    try { this.drawFrame(capture); } finally { this.frameBox = null; }
  }
  private drawFrame(capture: Buffer | null): void {
    const vp = this.prepareCamera();
    const { opaque, transparent, culled } = this.visibleMeshes(vp);
    const outlines = this.outlineColors();
    const shadow = this.shadowFrame();
    if (shadow && (!this.shadowMap || this.shadowMap.width !== this.shadowMapSize)) {
      this.shadowMap?.destroy();
      this.shadowMap = this.device.createTexture({ size: [this.shadowMapSize, this.shadowMapSize], format: 'depth32float', usage: TextureUsage.RENDER_ATTACHMENT | TextureUsage.TEXTURE_BINDING, label: 'viewer shadow map' });
      this.bindFrames();
      this.shadowDrawn.length = 0;
    }
    const env = this.environment.map instanceof ImageTexture && !this.environment.map.disposed ? this.environment.map : null;
    if (env !== this.boundEnv || (env && !env.gpu)) this.bindFrames();
    this.writeUniforms(vp, shadow);
    this.device.queue.writeBuffer(this.outputBuffer, 0, new Uint8Array(packOutput(this.environment, outlines, this.outlineWidth * this.pixelRatio, this.background, this.occlusionFrame(), outlines.length ? this.outlineRect(vp) : null)));
    const targets = this.ensureTargets(), out = this.context.getCurrentTexture(), sceneView = targets.views.scene;
    const enc = this.device.createCommandEncoder();
    // (The shadow map is drawn again only when the light's view or a caster changed.)
    const casters = this.casterList; casters.length = 0;
    if (shadow) for (const m of this.meshes) if (m.visible && m.castShadow && !m.transparent && m.geometry.topology === 'triangles') casters.push(m);
    if (shadow && this.shadowMap && this.shadowChanged(shadow.viewProjection, casters)) {
      // Every shadow caster, in view or not.
      const sp = enc.beginRenderPass({ colorAttachments: [], depthStencilAttachment: { view: this.shadowMap.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' } });
      sp.setBindGroup(0, this.shadowFrameGroup);
      sp.setPipeline(this.pipelines.get('shadow')!);
      for (const m of this.meshes) {
        if (!m.visible || !m.castShadow || m.transparent || m.geometry.topology !== 'triangles' || !this.upload(m.geometry)) continue;
        sp.setBindGroup(1, this.objectGroup, [m.slot * OBJECT_STRIDE]);
        this.drawTriangles(sp, m, false);
      }
      sp.end();
    }
    this.drawCapFront(enc, opaque, null);
    const pass = enc.beginRenderPass({
      colorAttachments: [{ view: targets.views.msaa ?? sceneView, resolveTarget: targets.msaa ? sceneView : undefined, clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: targets.msaa ? 'discard' : 'store' }],
      // (The depth is kept for ambient occlusion in the output pass; the background is put in there too.)
      depthStencilAttachment: { view: targets.views.depth, depthClearValue: 0, depthLoadOp: 'clear', depthStoreOp: 'store' },
    });
    pass.setBindGroup(0, this.frameGroup);
    const current: { pipeline?: Pipeline } = {};
    let tris = 0, lines = 0;
    // Opaque surfaces and their caps, the grid (tested against them), then lines and transparent meshes over it.
    let opaqueDone = false, caps = 0;
    for (const list of [opaque, transparent]) for (const m of list) {
      if (!opaqueDone && (m.geometry.topology === 'lines' || m.transparent)) { caps = this.drawCaps(pass, opaque, current, 'litCap'); if (this.grid.visible) this.drawGrid(pass, current); opaqueDone = true; }
      this.drawMesh(pass, m, current, false);
      if (m.geometry.topology === 'lines') lines += m.geometry.data.elementCount / 2; else tris += (m.geometry.data.elementCount / 3) * m.instanceCount;
    }
    if (!opaqueDone) { caps = this.drawCaps(pass, opaque, current, 'litCap'); if (this.grid.visible) this.drawGrid(pass, current); }
    pass.end();
    if (outlines.length) {
      // The outline mask: every opaque surface hides what is behind it; outlined meshes write their number.
      const mask = enc.beginRenderPass({
        colorAttachments: [{ view: targets.views.mask, clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' }],
        depthStencilAttachment: { view: targets.views.maskDepth, depthClearValue: 0, depthLoadOp: 'clear', depthStoreOp: 'discard' },
      });
      mask.setBindGroup(0, this.frameGroup);
      const cur: { pipeline?: Pipeline } = {};
      for (const list of [opaque, transparent]) for (const m of list) if (m.geometry.topology === 'triangles' && (!m.transparent || m.outlineSlot)) this.drawMesh(mask, m, cur, 'mask');
      // (Caps hide what is behind them, and carry their mesh's outline.)
      this.drawCaps(mask, opaque, cur, 'capMask');
      mask.end();
    }
    const show = enc.beginRenderPass({ colorAttachments: [{ view: out.createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' }] });
    show.setPipeline(this.pipelines.get('output')!);
    show.setBindGroup(0, targets.output);
    show.draw(3);
    show.end();
    if (capture) enc.copyTextureToBuffer({ texture: out }, { buffer: capture, bytesPerRow: Math.ceil((out.width * 4) / 256) * 256 }, [out.width, out.height]);
    this.device.queue.submit([enc.finish()]);
    Object.assign(this.stats, { frames: this.stats.frames + 1, drawCalls: opaque.length + transparent.length + caps, culled, triangles: tris, lines });
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
    this.drawCapFront(enc, opaque, [px, py]);
    const pass = enc.beginRenderPass({
      colorAttachments: [
        { view: t.views.id, clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' },
        { view: t.views.z, clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' },
        { view: t.views.instance, clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' },
      ],
      depthStencilAttachment: { view: t.views.depth, depthClearValue: 0, depthLoadOp: 'clear', depthStoreOp: 'discard' },
    });
    pass.setScissorRect(px, py, 1, 1);
    pass.setBindGroup(0, this.frameGroup);
    const current: { pipeline?: Pipeline } = {};
    for (const list of [opaque, transparent]) for (const m of list) if (m.pickable && m.geometry.topology === 'triangles') this.drawMesh(pass, m, current, true);
    this.drawCaps(pass, opaque, current, 'capPick');
    pass.end();
    enc.copyTextureToBuffer({ texture: t.id, origin: [px, py] }, { buffer: t.read, bytesPerRow: 256 }, [1, 1]);
    enc.copyTextureToBuffer({ texture: t.z, origin: [px, py] }, { buffer: t.read, offset: 256, bytesPerRow: 256 }, [1, 1]);
    enc.copyTextureToBuffer({ texture: t.instance, origin: [px, py] }, { buffer: t.read, offset: 512, bytesPerRow: 256 }, [1, 1]);
    this.device.queue.submit([enc.finish()]);
    const read = t.read;
    await read.mapAsync(MapMode.READ);
    const id = new Uint32Array(read.getMappedRange(0, 4))[0], depth = new Float32Array(read.getMappedRange(256, 4))[0], instance = new Uint32Array(read.getMappedRange(512, 4))[0];
    read.unmap();
    const mesh = id ? this.meshes.find(m => m.id === id) : undefined;
    if (!mesh) return null;
    const ndcX = ((px + 0.5) / this.canvas.width) * 2 - 1, ndcY = 1 - ((py + 0.5) / this.canvas.height) * 2;
    const point = this.camera.unproject(ndcX, ndcY, depth, this.aspect);
    // The triangle: a ray through the pixel in the (instance's) own space (on the cap: none).
    const ray = this.camera.ray(ndcX, ndcY, this.aspect), hit = this.meshRay(mesh, mesh.instances ? instance : null, ray.origin, ray.direction);
    const faces = mesh.geometry.data.faces, tri = hit ? hit.triangle : null;
    return { mesh, point, triangle: tri, face: tri !== null && faces ? faces[tri] : null, instance: mesh.instances ? instance : null, depth, cap: !!hit?.cap };
  }

  /**
   * A world ray against a mesh (or one of its instances): the nearest hit on the clip plane's kept side, or its cap where
   * the ray comes in through the cut to a back face (as the cap pass draws it). Its parameter is the world ray's.
   */
  private meshRay(m: Mesh, instance: number | null, origin: Vec3, direction: Vec3): ClippedHit | null {
    const clip = this.clip && m.clipped ? this.clip : null;
    // (Cut open, a single-sided mesh without a cap shows no inside: the ray passes its back faces, as the draw culls them.)
    return clippedRay(m.geometry.data, this.instanceTransform(m, instance), origin, direction, clip, this.capped(m), !clip || this.capped(m) || m.material.doubleSided === true);
  }

  /** The world transform of a mesh, or of one of its instances. */
  private instanceTransform(m: Mesh, instance: number | null): Mat4 {
    return instance === null || !m.instances ? m.transform : multiply(m.transform, m.instances.matrices[instance]);
  }

  private ensurePickTargets() {
    const w = this.canvas.width, h = this.canvas.height, t = this.pickTargets;
    if (t && t.width === w && t.height === h) return t;
    if (t) { t.id.destroy(); t.depth.destroy(); t.z.destroy(); t.instance.destroy(); t.read.destroy(); }
    const tex = (format: string, label: string) => this.device.createTexture({ size: [w, h], format, usage: TextureUsage.RENDER_ATTACHMENT | TextureUsage.COPY_SRC, label });
    const id = tex('r32uint', 'pick id'), z = tex('r32float', 'pick depth'), instance = tex('r32uint', 'pick instance');
    const depth = this.device.createTexture({ size: [w, h], format: 'depth32float', usage: TextureUsage.RENDER_ATTACHMENT, label: 'pick z-buffer' });
    this.pickTargets = {
      width: w, height: h, id, z, instance, depth,
      read: this.device.createBuffer({ size: 768, usage: BufferUsage.MAP_READ | BufferUsage.COPY_DST, label: 'pick read' }),
      views: { id: id.createView(), z: z.createView(), instance: instance.createView(), depth: depth.createView() },
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
    let best: { mesh: Mesh; triangle: number | null; t: number; instance: number | null; cap: boolean } | null = null;
    for (const m of this.meshes) {
      if (!m.visible || !m.pickable || m.geometry.topology !== 'triangles' || m.geometry.disposed) continue;
      for (let i = 0; i < m.instanceCount; i++) {
        const instance = m.instances ? i : null, hit = this.meshRay(m, instance, ray.origin, ray.direction);
        if (hit && (!best || hit.t < best.t)) best = { mesh: m, triangle: hit.triangle, t: hit.t, instance, cap: hit.cap };
      }
    }
    if (!best) return null;
    const point = add(ray.origin, scale(ray.direction, best.t)), faces = best.mesh.geometry.data.faces;
    const v = transformPoint(this.camera.viewProjection(this.aspect), point);
    return { mesh: best.mesh, point, triangle: best.triangle, face: best.triangle !== null && faces ? faces[best.triangle] : null, instance: best.instance, depth: v[2], cap: best.cap };
  }

  /**
   * The line segment drawn nearest a point of the canvas (CSS pixels), within radius pixels. Lines are
   * thin, so this is a screen-space search, not a pixel read; it does not test whether a surface hides them. Only the
   * parts of segments on the clip plane's kept side are found.
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
      // A mesh wholly in front of the eye whose box lands farther than the radius from the point: none of its segments can be nearer.
      const bx = g.bounds;
      if (bx) {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, front = true;
        for (let c = 0; c < 8 && front; c++) {
          const px = c & 1 ? bx.max[0] : bx.min[0], py = c & 2 ? bx.max[1] : bx.min[1], pz = c & 4 ? bx.max[2] : bx.min[2];
          const w = M[3] * px + M[7] * py + M[11] * pz + M[15]; if (w < 1e-6) { front = false; break; }
          const sxp = ((M[0] * px + M[4] * py + M[8] * pz + M[12]) / w * 0.5 + 0.5) * cw, syp = (0.5 - (M[1] * px + M[5] * py + M[9] * pz + M[13]) / w * 0.5) * ch;
          x0 = Math.min(x0, sxp); x1 = Math.max(x1, sxp); y0 = Math.min(y0, syp); y1 = Math.max(y1, syp);
        }
        if (front && (x < x0 - radius || x > x1 + radius || y < y0 - radius || y > y1 + radius)) continue;
      }
      // (Every segment, or for a large geometry those its segment boxes do not rule out: the same answer, ties to the lowest.)
      // (The clip plane in the mesh's own space: only the kept parts of its segments.)
      const hit = nearestSegment(g, M, x, y, cw, ch, radius, best ? best.distance : Infinity, this.clip && m.clipped ? localPlane(m.transform, this.clip) : null);
      if (!hit) continue;
      const ia = I ? I[2 * hit.segment] : 2 * hit.segment, ib = I ? I[2 * hit.segment + 1] : 2 * hit.segment + 1;
      const A = transformPoint(m.transform, [P[3 * ia], P[3 * ia + 1], P[3 * ia + 2]]), B = transformPoint(m.transform, [P[3 * ib], P[3 * ib + 1], P[3 * ib + 2]]);
      best = { mesh: m, segment: hit.segment, edge: g.edges ? g.edges[hit.segment] : null, point: add(A, scale(sub(B, A), hit.s)), distance: hit.distance };
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
    this.cancelScheduled();
    for (const g of this.geometries) g.release();
    for (const m of this.meshes) { m.instances?.buffer?.destroy(); m.materialState?.params.destroy(); }
    this.geometries.clear(); this.meshes = [];
    this.targets?.msaa?.destroy(); this.targets?.scene.destroy(); this.targets?.depth.destroy();
    if (this.pickTargets) { this.pickTargets.id.destroy(); this.pickTargets.z.destroy(); this.pickTargets.instance.destroy(); this.pickTargets.depth.destroy(); this.pickTargets.read.destroy(); }
    this.frameBuffer?.destroy(); this.objectBuffer?.destroy(); this.outputBuffer?.destroy(); this.shadowFrameBuffer?.destroy();
    this.targets?.mask.destroy(); this.targets?.maskDepth.destroy(); this.targets?.capFront.destroy(); this.emptyFront?.destroy();
    this.shadowMap?.destroy(); this.emptyShadow?.destroy(); this.identityInstance?.destroy(); this.white?.texture.destroy(); this.zeroParams?.destroy();
    for (const t of this.textures) t.dispose();
    this.textures.clear();
    this.context?.unconfigure();
    this.device?.destroy();
    for (const f of this.waiters.splice(0)) f();
  }
}

/** A box cut by a clip plane along an axis (dot(n, p) ≥ offset, n ±x, ±y or ±z); null when it is wholly cut away; as it is for another plane. */
export function clipBox(b: Box3 | null, c: { normal: ArrayLike<number>; offset: number }): Box3 | null {
  if (!b) return b;
  const n = c.normal, k = Math.abs(n[0]) === 1 ? 0 : Math.abs(n[1]) === 1 ? 1 : Math.abs(n[2]) === 1 ? 2 : -1;
  if (k < 0) return b;
  const min = [b.min[0], b.min[1], b.min[2]], max = [b.max[0], b.max[1], b.max[2]];
  if (n[k] > 0) min[k] = Math.max(min[k], c.offset); else max[k] = Math.min(max[k], -c.offset);
  return min[k] > max[k] ? null : { min: min as unknown as Vec3, max: max as unknown as Vec3 };
}

export const createViewer = (canvas: HTMLCanvasElement, options?: ViewerOptions): Promise<Viewer> => Viewer.create(canvas, options);
