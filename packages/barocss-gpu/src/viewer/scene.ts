// The viewer's scene objects (R2c: moved out of viewer.ts as they were, viewer.ts the facade): materials and their
// options, image textures, geometry kept on the CPU and its GPU buffers, meshes and their object blocks.
import { ViewerError } from './viewer-error.js';
import type { MeshCost } from './viewer.js';
import { transformBox, unionBox, type Box3 } from './bounds.js';
import { prepareScalars, segmentInstances, vertexColors, fillVertexColors, type PreparedGeometry } from './geometry.js';
import { BufferUsage, type BindGroup, type Buffer, type Device, type Texture } from './gpu.js';
import { linear, parseColor, type Color } from './lights.js';
import { identity, multiply, normalMatrixInto, srgbToLinear, type Mat4, type Vec3 } from './math.js';
import { type SurfaceShader } from './shaders.js';
import type { Viewer } from './viewer.js';
export { ViewerError, type ViewerErrorCode } from './viewer-error.js';

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
  /** Lines dashed: on and off lengths in CSS pixels, from each segment's start (default solid; G7). */
  lineDash?: readonly [number, number] | null;
  /** Hidden parts' dash lengths in CSS pixels. Omitted: use lineDash; null: solid. */
  lineHiddenDash?: readonly [number, number] | null;
  /** Lines drawn over the whole scene, not hidden by surfaces (default false: they test depth; G7). */
  lineOver?: boolean;
  /** Depth-tested lines' hidden parts drawn too, at this share of their opacity (0 – 1, default 0: not drawn; G7). */
  lineHidden?: number;
  /** Draw surface/cap depth without colour (default true). Picking and clipping remain enabled. */
  colorWrite?: boolean;
  /** Points' size (diameter or side) in CSS pixels (default 4; G8). lineOver and lineHidden apply to points too. */
  pointSize?: number;
  /** Points drawn as discs (default) or squares (G8). */
  pointShape?: 'circle' | 'square';
  /** A border inside each point's edge (G8): its width in CSS pixels and colour (sRGB); a point's own alpha 0 leaves a ring. */
  pointBorder?: { width: number; color: Color } | null;
  /**
   * A shadow catcher: draws nothing but the shadow of the shadow-casting light, in the colour (default
   * black) and as dark as the opacity — a ground under a model, say.
   */
  shadowOnly?: boolean;
  /** A colour map (Viewer.createTexture), multiplied into the colour through the geometry's uvs. */
  map?: ImageTexture | null;
  /**
   * Drawn a little in front of the surfaces it lies on (G12: an overlay sharing faces with a body, such as a proposal's
   * added or removed material) — the opposite of the surfaces' own depth bias. Default false.
   */
  decal?: boolean;
  /** Alpha cutout: pixels whose alpha (colour × map) is below this (0 – 1) are not drawn — leaves, grilles, decals with holes; 0: off. */
  alphaCutoff?: number;
  /**
   * A shader material: WGSL that computes the base colour per pixel (then lit, unless unlit). The
   * expression is a vec3<f32> of linear colour with uv, world, normal and materialParams (an
   * array<vec4<f32>, 4> named slot: 64 bytes, from params) in scope; declarations may define helpers
   * and their own struct MaterialParams of that size; aliases name uv, world or normal otherwise.
   */
  shader?: ShaderMaterial | null;
  /** A surface finish (G15a): relief and roughness made per pixel from the mesh's own coordinates; none by default. */
  finish?: SurfaceFinish | null;
  /** A clear lacquer over the surface (G15a, paint): 0 none – 1, its own roughness (default 0.08). */
  clearcoat?: number;
  clearcoatRoughness?: number;
  /** An oil film's thin-film tint on the reflections (G15a): 0 none – 1. */
  film?: number;
}
/**
 * A surface finish (G15a), from the mesh's own coordinates (its transform's frame, so the pattern stays on the part as it
 * moves): cast and sand-cast grain, machined lines across `axis`, turned rings about `axis` through `origin`, brushed
 * streaks along `axis`, a knurl's diamonds round `axis`, a blasted surface's pits. Machined, turned and brushed also stretch
 * the highlights across their marks (anisotropic reflection).
 */
export interface SurfaceFinish {
  kind: SurfaceFinishKind;
  /** The marks' size or pitch in the mesh's units (default 1). */
  scale?: number;
  /** How deep they look: 0 none – 1 (default 0.5). */
  strength?: number;
  /** Machined, turned, brushed, knurled: the direction (mesh frame; default its Z). */
  axis?: Vec3;
  /** Turned, knurled: a point on the axis (mesh frame; default its origin). */
  origin?: Vec3;
}
export type SurfaceFinishKind = 'cast' | 'sand-cast' | 'machined' | 'turned' | 'brushed' | 'knurled' | 'blasted';
/** The finish kinds in the order the shader numbers them from 1. */
export const SURFACE_FINISHES: readonly SurfaceFinishKind[] = ['cast', 'sand-cast', 'machined', 'turned', 'brushed', 'knurled', 'blasted'];
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
  /** @internal (`lighting`: as an environment, its prefiltered reflections and diffuse light — G15b.) */
  gpu: { texture: Texture; group: BindGroup; device: Device; sampler: object; lighting?: { specular: Texture; irradiance: Texture } } | null = null;
  disposed = false;
  constructor(readonly source: TextureSource, readonly options: Required<TextureOptions>, private readonly owner: Viewer) {}
  get width(): number { return this.source.width; }
  get height(): number { return this.source.height; }
  dispose(): void { this.disposed = true; this.gpu?.texture.destroy(); this.gpu?.lighting?.specular.destroy(); this.gpu?.lighting?.irradiance.destroy(); this.gpu = null; this.owner.requestRender(); }
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
  /** Its cap's colour (sRGB, times the material colour); default the clip plane's. */
  capColor?: Color | null;
  /** Hatch lines on its cap (G19.3; Mesh.capHatch); default none. */
  capHatch?: CapHatch | null;
  /** Counted in the scene's bounds — what fit() frames and the shadow and ground are sized to (default true; false for overlays, G7). */
  bounded?: boolean;
  /**
   * A closed solid: where the clip plane cuts it, its cut is filled with the plane's cap (default false). The cap is drawn
   * from the mesh's back faces seen through the cut, so an open mesh would show one where its inside shows.
   */
  cap?: boolean;
}
/** A clip plane: what is drawn of the meshes it clips is where dot(normal, p) ≥ offset; their caps in a colour (sRGB). */
export interface ClipPlane { normal: ArrayLike<number>; offset: number; cap?: Color }
/**
 * A colour map for a mesh's scalar field (G6): colours (sRGB) at values, at least two, rising; between them interpolated in
 * linear light, across the first's and the last's values (a 256-texel ramp). Below and above them the end colours, or
 * `below` / `above` when given; `missing` where the field has none (default mid grey); `bands` ≥ 2: that many flat steps.
 */
export interface ColorMap { stops: readonly (readonly [number, Color])[]; below?: Color | null; above?: Color | null; missing?: Color; bands?: number }
/** A colour map as the GPU takes it: its ramp's 256 sRGB texels and its 16 parameters (range, bands, missing, below, above). */
export function packColorMap(map: ColorMap): { ramp: Uint8Array; params: Float32Array } {
  const stops = map.stops.map(([v, c]) => [v, linear(parseColor(c))] as const);
  if (stops.length < 2 || stops.some(([v], i) => !Number.isFinite(v) || (i > 0 && !(v > stops[i - 1][0])))) throw new ViewerError('COLOR_MAP_INVALID', 'A colour map needs two or more stops at rising finite values');
  const lo = stops[0][0], hi = stops[stops.length - 1][0], ramp = new Uint8Array(256 * 4), encode = (x: number) => Math.round(Math.min(1, Math.max(0, x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055)) * 255);
  for (let i = 0; i < 256; i++) {
    const v = lo + ((hi - lo) * i) / 255;
    let k = 0; while (k < stops.length - 2 && v > stops[k + 1][0]) k++;
    const [va, ca] = stops[k], [vb, cb] = stops[k + 1], t = Math.min(1, Math.max(0, (v - va) / (vb - va)));
    for (let c = 0; c < 3; c++) ramp[4 * i + c] = encode(ca[c] + (cb[c] - ca[c]) * t);
    ramp[4 * i + 3] = 255;
  }
  const params = new Float32Array(16), bands = map.bands && map.bands >= 2 ? Math.floor(map.bands) : 0;
  params.set([lo, hi, bands, 0], 0);
  params.set([...linear(parseColor(map.missing, [0.5, 0.5, 0.5])), 1], 4);
  if (map.below) params.set([...linear(parseColor(map.below)), 1], 8);
  if (map.above) params.set([...linear(parseColor(map.above)), 1], 12);
  return { ramp, params };
}
export interface InstancesInput { transforms: ArrayLike<number>; colors?: ArrayLike<number> }

/** Bytes per instance: a 4×4 transform and an RGBA8 colour (see Instance in shaders.ts). */
/** @internal (R2c: used by the viewer too.) */
export const INSTANCE_STRIDE = 68;
/** @internal (R2c: used by the viewer too.) */
export function packInstances(input: InstancesInput): { count: number; data: ArrayBuffer; matrices: Float64Array[] } {
  const t = input.transforms, count = t.length / 16;
  if (!Number.isInteger(count) || count < 1) throw new ViewerError('INSTANCES_INVALID', 'instances.transforms must hold 16 numbers per instance');
  const data = new ArrayBuffer(count * INSTANCE_STRIDE), f = new DataView(data), matrices: Float64Array[] = [];
  const k = input.colors ? (input.colors.length === count * 4 ? 4 : input.colors.length === count * 3 ? 3 : 0) : 0;
  if (input.colors && !k) throw new ViewerError('INSTANCES_INVALID', 'instances.colors must hold three or four numbers per instance');
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
  /** `ownUVs` false: `uvs` is the viewer's shared zero buffer (the geometry has none; G13). */
  gpu: { positions: Buffer; normals: Buffer | null; colors: Buffer | null; uvs: Buffer | null; ownUVs?: boolean; indices: Buffer | null; device: Device; labels?: { count: number; atlas: number } } | null = null;
  disposed = false;
  constructor(readonly data: PreparedGeometry, private readonly owner: Viewer) {}
  get topology(): 'triangles' | 'lines' | 'points' | 'labels' { return this.data.topology; }
  get bounds(): Box3 | null { return this.data.bounds; }
  /** Replace the vertex colours (sRGB, three or four per vertex): per-face highlights, say. */
  setColors(colors: ArrayLike<number> | null): void {
    if (this.data.contour) throw new ViewerError('GEOMETRY_INVALID', 'A contour has no vertex colours');
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
    if (this.data.topology !== 'triangles') throw new ViewerError('GEOMETRY_INVALID', 'Only triangle geometry has a colour range');
    fillVertexColors(this.data.colors, first, count, color);
    if (this.gpu?.colors && count) this.gpu.device.queue.writeBuffer(this.gpu.colors, 4 * first, this.data.colors, 4 * first, 4 * count);
    this.owner.requestRender();
  }
  /** Replace the texture coordinates (two per vertex) of a triangle geometry: a colour map's placement. */
  setUVs(uvs: ArrayLike<number>): void {
    if (this.data.topology !== 'triangles') throw new ViewerError('GEOMETRY_INVALID', 'Only triangle geometry has texture coordinates');
    if (uvs.length !== this.data.vertexCount * 2) throw new ViewerError('GEOMETRY_INVALID', 'uvs must hold two numbers per vertex');
    this.data.uvs = Float32Array.from(uvs);
    // (Drawn with the shared zeros until now: its own buffer from here.)
    if (this.gpu && !this.gpu.ownUVs) { this.gpu.uvs = this.gpu.device.createBuffer({ size: Math.max(4, this.data.uvs.byteLength), usage: BufferUsage.VERTEX | BufferUsage.COPY_DST, label: 'uvs' }); this.gpu.ownUVs = true; }
    if (this.gpu?.uvs) this.gpu.device.queue.writeBuffer(this.gpu.uvs, 0, this.data.uvs);
    this.owner.requestRender();
  }
  /**
   * A scalar field for a colour map (G6): one value per vertex (interpolated) or per triangle (drawn flat), NaN where there
   * is none; null removes it. Meshes with a colour map show it (Mesh.colorMap); picks read it (PickHit.scalar).
   */
  setScalars(values: ArrayLike<number> | null, per: 'vertex' | 'triangle' = 'vertex'): void {
    this.data.scalars = values ? prepareScalars(this.data, values, per) : null;
    this.releaseScalars();
    this.owner.requestRender();
  }
  /** @internal The field's GPU buffers (made on first draw, and again after a device loss or a new field). */
  scalarGpu: { device: Device; positions: Buffer | null; normals: Buffer | null; values: Buffer } | null = null;
  /** @internal */ releaseScalars(): void {
    const s = this.scalarGpu; if (!s) return;
    s.positions?.destroy(); s.normals?.destroy(); s.values.destroy(); this.scalarGpu = null;
  }
  /** Release the GPU buffers (meshes using it stop drawing). */
  dispose(): void { this.disposed = true; this.release(); this.owner.forget(this); this.owner.requestRender(); }
  /** @internal */ release(): void {
    this.releaseScalars();
    if (!this.gpu) return;
    this.gpu.positions.destroy(); this.gpu.normals?.destroy(); this.gpu.colors?.destroy(); if (this.gpu.ownUVs) this.gpu.uvs?.destroy(); this.gpu.indices?.destroy();
    this.gpu = null;
  }
}

export class Mesh {
  /** Picking opacity classification, independent of display-only fades; null follows the material. */
  pickTransparent: boolean | null = null;
  /** @internal */ slot = -1;
  /** @internal */ dirty = true;
  private worldBox: Box3 | null | undefined;
  private _transform: Mat4 = identity();
  private _material: ReturnType<typeof materialOf>;
  private _params: Float32Array | null = null;
  private _visible: boolean;
  pickable: boolean;
  name: string | undefined;
  castShadow: boolean;
  /** Counted in the scene's bounds (AddMeshOptions.bounded). */
  bounded: boolean;
  private _receiveShadow: boolean;
  private _outline: Vec3 | null = null;
  private _clipped: boolean;
  /** Filled where the clip plane cuts it (a closed solid; AddMeshOptions.cap). */
  cap: boolean;
  private _capColor: Vec3 | null = null;
  private _capHatch: CapHatch | null = null;
  private _colorMap: (ColorMap & { packed: { ramp: Uint8Array; params: Float32Array } }) | null = null;
  /** @internal A colour map's bind group (its ramp and parameters), for the device and map it was made for. */
  mapState: { device: Device; map: object; texture: Texture; params: Buffer; group: BindGroup } | null = null;
  /** @internal Instances: their count, packed data, transforms, and the GPU buffer (null: not uploaded). */
  instances: { count: number; data: ArrayBuffer; matrices: Float64Array[]; buffer: Buffer | null; device: Device | null } | null = null;
  /** @internal Which outline colour of the frame (1-based; 0 none). */
  outlineSlot = 0;
  /** @internal A shader material's bind group (its map and its own parameters), for the device and inputs it was made for. */
  materialState: { device: Device; map: ImageTexture | null; params: Buffer; group: BindGroup; data: Float32Array } | null = null;
  /** @internal Its frame cost record while the viewer counts (Viewer.costs, O10), made when first drawn counting. */
  cost: MeshCost | null = null;
  /** Pick id (1-based; 0 is empty space). */
  readonly id: number;

  constructor(readonly geometry: Geometry, private readonly owner: Viewer, id: number, options: AddMeshOptions) {
    this.id = id;
    this._material = materialOf(options.material);
    this._visible = options.visible ?? true;
    this.pickable = options.pickable ?? true;
    this.castShadow = options.castShadow ?? true;
    this.bounded = options.bounded ?? true;
    this._receiveShadow = options.receiveShadow ?? true;
    this._clipped = options.clipped ?? true;
    this.cap = options.cap ?? false;
    if (options.capColor) this._capColor = parseColor(options.capColor);
    if (options.capHatch) this._capHatch = hatchOf(options.capHatch);
    this.name = options.name;
    if (options.transform) this.transform = options.transform;
    if (options.instances) this.setInstances(options.instances);
  }

  /** Copies of the mesh, each with its own transform (after the mesh's) and colour; null: a single mesh. */
  setInstances(input: InstancesInput | null): void {
    if (input && this.geometry.topology !== 'triangles') throw new ViewerError('INSTANCES_INVALID', 'Only triangle meshes can be instanced');
    const next = input ? { ...packInstances(input), buffer: null, device: null } : null;
    this.instances?.buffer?.destroy();
    this.instances = next;
    this.worldBox = undefined;
    this.owner.sceneMoved();
    this.owner.requestRender();
  }
  get instanceCount(): number { return this.instances?.count ?? 1; }

  get transform(): Mat4 { return this._transform; }
  set transform(m: ArrayLike<number>) {
    if (m.length !== 16) throw new ViewerError('TRANSFORM_INVALID', 'A transform has 16 numbers (column-major)');
    this._transform = Float64Array.from(m); this.worldBox = undefined; this.owner.sceneMoved(); this.touch();
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
    if (p) { if (p.length > 16) throw new ViewerError('MATERIAL_INVALID', 'A shader material has at most 16 params'); for (let i = 0; i < p.length; i++) out[i] = p[i]; }
    return this._params = out;
  }
  get visible(): boolean { return this._visible; }
  set visible(v: boolean) { this._visible = v; this.owner.requestRender(); }
  get transparent(): boolean { return this._material.colorWrite && (this._material.opacity < 1 || this._material.shadowOnly); }
  /**
   * Its cap's colour (sRGB), times its material colour — as a face of it in that colour would be lit — or null: the clip
   * plane's own cap colour (G2b).
   */
  get capColor(): Vec3 | null { return this._capColor; }
  set capColor(c: Color | null) {
    const next = c === null ? null : parseColor(c), had = this._capColor;
    if (next === had || (next && had && next[0] === had[0] && next[1] === had[1] && next[2] === had[2])) return;
    this._capColor = next; this.touch();
  }
  /**
   * Hatch lines on its cap (G19.3), or null: lines 1 CSS pixel wide in its cap's colour × 0.45, `spacing` world units
   * apart, at `angle` degrees in the cap plane from its u axis toward its v (capHatchAxes) — fixed in the world, so a
   * part's cap keeps its hatch as the camera moves and parts at different angles read apart.
   */
  get capHatch(): CapHatch | null { return this._capHatch; }
  set capHatch(h: CapHatch | null) {
    const next = h ? hatchOf(h) : null, had = this._capHatch;
    if (next === had || (next && had && next.angle === had.angle && next.spacing === had.spacing)) return;
    this._capHatch = next; this.touch();
  }
  /**
   * A colour map of its geometry's scalar field (G6; Geometry.setScalars) in place of its material's colour, lit as the
   * surface (flat when unlit), or null for the material again. Without a field the material shows.
   */
  get colorMap(): ColorMap | null { return this._colorMap; }
  set colorMap(map: ColorMap | null) { this._colorMap = map ? { ...map, packed: packColorMap(map) } : null; this.owner.requestRender(); }
  /** @internal Whether it draws its colour map: one set, a field on its triangles, opaque. */
  get mapped(): boolean { return !!this._colorMap && !!this.geometry.data.scalars && this.geometry.topology === 'triangles' && !this.transparent; }
  /** @internal */ get packedMap(): { ramp: Uint8Array; params: Float32Array } | null { return this._colorMap?.packed ?? null; }
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
    // (G13: written in place — a scratch normal matrix, the colour by its parts.)
    f.set(this._transform, o);
    f.set(normalMatrixInto(packNormal, this._transform), o + 16);
    f[o + 32] = srgbToLinear(m.color[0]); f[o + 33] = srgbToLinear(m.color[1]); f[o + 34] = srgbToLinear(m.color[2]); f[o + 35] = m.opacity;
    if (this.geometry.topology === 'lines') { f[o + 36] = m.lineWidth * pixelRatio; f[o + 37] = (m.lineDash?.[0] ?? 0) * pixelRatio; f[o + 38] = (m.lineDash?.[1] ?? 0) * pixelRatio; f[o + 39] = m.lineHidden; }
    else if (this.geometry.topology === 'labels') { f[o + 36] = 0; f[o + 37] = 0; f[o + 38] = 0; f[o + 39] = m.lineHidden; }
    else if (this.geometry.topology === 'points') { f[o + 36] = m.pointSize * pixelRatio; f[o + 37] = (m.pointBorder?.width ?? 0) * pixelRatio; f[o + 38] = m.pointShape === 'square' ? 0 : 1; f[o + 39] = m.lineHidden; }
    else { f[o + 36] = m.metallic; f[o + 37] = m.roughness; f[o + 38] = m.emissive; f[o + 39] = m.unlit ? 1 : 0; }
    const u = packWords(f); u[o + 40] = this.id; u[o + 41] = this.outlineSlot; u[o + 42] = (this._receiveShadow ? 1 : 0) | (this._clipped ? 2 : 0) | (((this.slot % 65535) + 1) << 16); u[o + 43] = Math.round(m.alphaCutoff * 1000);
    // (A point's border colour where a surface's cap colour goes.)
    const capOrBorder = this.geometry.topology === 'points' ? m.pointBorder?.color ?? null : this._capColor;
    if (capOrBorder) { const c = linear(capOrBorder); f[o + 44] = c[0]; f[o + 45] = c[1]; f[o + 46] = c[2]; f[o + 47] = 1; } else f.fill(0, o + 44, o + 48);
    const h = this._capHatch;
    if (this.geometry.topology === 'lines') {
      const hiddenDash = m.lineHiddenDash === undefined ? m.lineDash : m.lineHiddenDash;
      f[o + 48] = (hiddenDash?.[0] ?? 0) * pixelRatio; f[o + 49] = (hiddenDash?.[1] ?? 0) * pixelRatio; f[o + 50] = 0; f[o + 51] = 0;
    } else if (h) { const a = (h.angle * Math.PI) / 180; f[o + 48] = Math.cos(a); f[o + 49] = Math.sin(a); f[o + 50] = h.spacing; f[o + 51] = 1; } else f.fill(0, o + 48, o + 52);
    // (G15a: the finish — kind from 1, scale, strength, clearcoat; axis and the coat's roughness; origin and the oil film.
    // Surfaces only; zeros otherwise.)
    const fin = m.finish, surface = this.geometry.topology === 'triangles';
    if (surface && (fin || m.clearcoat > 0 || m.film > 0)) {
      f[o + 52] = fin ? SURFACE_FINISHES.indexOf(fin.kind) + 1 : 0; f[o + 53] = fin?.scale ?? 1; f[o + 54] = fin?.strength ?? 0; f[o + 55] = m.clearcoat;
      const ax = fin?.axis ?? [0, 0, 1], og = fin?.origin ?? [0, 0, 0];
      f[o + 56] = ax[0]; f[o + 57] = ax[1]; f[o + 58] = ax[2]; f[o + 59] = m.clearcoatRoughness;
      f[o + 60] = og[0]; f[o + 61] = og[1]; f[o + 62] = og[2]; f[o + 63] = m.film;
    } else f.fill(0, o + 52, o + 64);
  }
}

/** Hatch lines on a cap (G19.3): `angle` in degrees in the cap plane (capHatchAxes), `spacing` in world units (> 0). */
export interface CapHatch { angle: number; spacing: number }
/** @internal (R2c: used by the viewer too.) */
export function hatchOf(h: CapHatch): CapHatch | null {
  return Number.isFinite(h.angle) && Number.isFinite(h.spacing) && h.spacing > 0 ? { angle: h.angle, spacing: h.spacing } : null;
}

/** @internal (R2c: used by the viewer too.) */
export function materialOf(m: Material = {}): Required<Omit<Material, 'color' | 'map' | 'shader' | 'lineDash' | 'lineHiddenDash' | 'pointBorder' | 'finish'>> & { color: Vec3; map: ImageTexture | null; shader: ShaderMaterial | null; lineDash: readonly [number, number] | null; lineHiddenDash: readonly [number, number] | null | undefined; pointBorder: { width: number; color: Vec3 } | null; finish: Required<SurfaceFinish> | null } {
  const hiddenDash = m.lineHiddenDash;
  return {
    color: parseColor(m.color, m.shadowOnly ? [0, 0, 0] : [0.8, 0.8, 0.8]), opacity: Math.min(1, Math.max(0, m.opacity ?? 1)),
    colorWrite: m.colorWrite ?? true, lineHiddenDash: hiddenDash === undefined ? undefined : hiddenDash && hiddenDash[0] > 0 && hiddenDash[1] > 0 ? [hiddenDash[0], hiddenDash[1]] : null,
    metallic: m.metallic ?? 0, roughness: m.roughness ?? 0.55, emissive: m.emissive ?? 0, unlit: m.unlit ?? false, doubleSided: m.doubleSided ?? false, lineWidth: m.lineWidth ?? 1, lineDash: m.lineDash && m.lineDash[0] > 0 && m.lineDash[1] > 0 ? [m.lineDash[0], m.lineDash[1]] : null, lineOver: m.lineOver ?? false, lineHidden: Math.min(1, Math.max(0, m.lineHidden ?? 0)), decal: m.decal ?? false,
    pointSize: Math.max(0, m.pointSize ?? 4), pointShape: m.pointShape ?? 'circle', pointBorder: m.pointBorder && m.pointBorder.width > 0 ? { width: m.pointBorder.width, color: parseColor(m.pointBorder.color, [1, 1, 1]) } : null, shadowOnly: m.shadowOnly ?? false, map: m.map ?? null, shader: m.shader ?? null, alphaCutoff: Math.min(1, Math.max(0, m.alphaCutoff ?? 0)),
    finish: finishOf(m.finish), clearcoat: unit(m.clearcoat), clearcoatRoughness: Math.min(1, Math.max(0.02, m.clearcoatRoughness ?? 0.08)), film: unit(m.film),
  };
}
const unit = (v: number | undefined) => Number.isFinite(v) ? Math.min(1, Math.max(0, v!)) : 0;
/** A finish as packed: known kind, positive scale, strength 0–1, a unit axis (Z when none or zero). */
function finishOf(f: SurfaceFinish | null | undefined): Required<SurfaceFinish> | null {
  if (!f || !SURFACE_FINISHES.includes(f.kind)) return null;
  const a = f.axis ?? [0, 0, 1], l = Math.hypot(a[0], a[1], a[2]);
  return { kind: f.kind, scale: Number.isFinite(f.scale) && f.scale! > 0 ? f.scale! : 1, strength: f.strength === undefined ? 0.5 : unit(f.strength),
    axis: l > 1e-12 && Number.isFinite(l) ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 1], origin: f.origin && f.origin.every(Number.isFinite) ? [f.origin[0], f.origin[1], f.origin[2]] : [0, 0, 0] };
}


// (G13: scratch kept across frames — the object block's normal matrix and its 32-bit words.)
const packNormal = new Float64Array(16);
const packViews = new WeakMap<ArrayBuffer, Uint32Array>();
const packWords = (f: Float32Array): Uint32Array => { let u = packViews.get(f.buffer as ArrayBuffer); if (!u) { u = new Uint32Array(f.buffer); packViews.set(f.buffer as ArrayBuffer, u); } return u; };
