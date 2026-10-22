// One WebGPU renderer for a canvas: it owns the device and the canvas context, keeps geometry in long-
// lived buffers and every pipeline it needs, renders on demand (one frame per animation frame at most),
// follows the canvas size and pixel ratio, and recreates its device and re-uploads the scene when the
// device is lost. Meshes carry a transform and a material; lights and the camera are plain data.
import { ATLAS_CELLS, ATLAS_SIZE, GLYPH_CELL, GlyphAtlas, layoutLabels, type LabelInput } from './glyphs.js';
import { boxCenter, boxInFrustum, boxRadius, frustumPlanes, growBox, screenRect, transformBox, unionBox, type Box3 } from './bounds.js';
import { Camera } from './camera.js';
import { OrbitControls, type OrbitOptions } from './controls.js';
import { clippedRay, clippedRayFull, localPlane, nearestPoint, pointInstances, sceneNear, sceneRay, sceneTree, type SceneTree, prepareGeometry, prepareScalars, scalarAt, segmentInstances, vertexColors, fillVertexColors, nearestSegment, type ClippedHit, type GeometryInput, type PreparedGeometry } from './geometry.js';
import { BufferUsage, MapMode, TextureUsage, gpuOf, type BindGroup, type Buffer, type CanvasContext, type Device, type Pipeline, type RenderPass, type Texture } from './gpu.js';
type View = ReturnType<Texture['createView']>;
import { defaultLights, directionalLights, linear, packFrame, packOutput, parseColor, type Background, type ClipFrame, type Color, type Environment, type GridFrame, type Light, type ShadowFrame } from './lights.js';
import { add, cross, dot, identity, invert, lookAt, multiply, normalMatrixInto, normalize, orthographic, scale, srgbToLinear, sub, transformPoint, type Mat4, type Vec3 } from './math.js';
import { FRAME_BYTES, MAX_CLIP_PLANES, MAX_OUTLINES, OBJECT_BYTES, OBJECT_STRIDE, OUTPUT_BYTES, capProbeSamplesWGSL, gridWGSL, labelWGSL, lineWGSL, mipWGSL, oitWGSL, pointWGSL, outputWGSL, pickWGSL, surfaceWGSL, type SurfaceShader } from './shaders.js';

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
  if (stops.length < 2 || stops.some(([v], i) => !Number.isFinite(v) || (i > 0 && !(v > stops[i - 1][0])))) throw new RangeError('A colour map needs two or more stops at rising finite values');
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
  /** `ownUVs` false: `uvs` is the viewer's shared zero buffer (the geometry has none; G13). */
  gpu: { positions: Buffer; normals: Buffer | null; colors: Buffer | null; uvs: Buffer | null; ownUVs?: boolean; indices: Buffer | null; device: Device; labels?: { count: number; atlas: number } } | null = null;
  disposed = false;
  constructor(readonly data: PreparedGeometry, private readonly owner: Viewer) {}
  get topology(): 'triangles' | 'lines' | 'points' | 'labels' { return this.data.topology; }
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
    if (input && this.geometry.topology !== 'triangles') throw new RangeError('Only triangle meshes can be instanced');
    this.instances?.buffer?.destroy();
    this.instances = input ? { ...packInstances(input), buffer: null, device: null } : null;
    this.worldBox = undefined;
    this.owner.sceneMoved();
    this.owner.requestRender();
  }
  get instanceCount(): number { return this.instances?.count ?? 1; }

  get transform(): Mat4 { return this._transform; }
  set transform(m: ArrayLike<number>) {
    if (m.length !== 16) throw new RangeError('A transform has 16 numbers (column-major)');
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
    if (p) { if (p.length > 16) throw new RangeError('A shader material has at most 16 params'); for (let i = 0; i < p.length; i++) out[i] = p[i]; }
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
    const u = packWords(f); u[o + 40] = this.id; u[o + 41] = this.outlineSlot; u[o + 42] = (this._receiveShadow ? 1 : 0) | (this._clipped ? 2 : 0); u[o + 43] = Math.round(m.alphaCutoff * 1000);
    // (A point's border colour where a surface's cap colour goes.)
    const capOrBorder = this.geometry.topology === 'points' ? m.pointBorder?.color ?? null : this._capColor;
    if (capOrBorder) { const c = linear(capOrBorder); f[o + 44] = c[0]; f[o + 45] = c[1]; f[o + 46] = c[2]; f[o + 47] = 1; } else f.fill(0, o + 44, o + 48);
    const h = this._capHatch;
    if (this.geometry.topology === 'lines') {
      const hiddenDash = m.lineHiddenDash === undefined ? m.lineDash : m.lineHiddenDash;
      f[o + 48] = (hiddenDash?.[0] ?? 0) * pixelRatio; f[o + 49] = (hiddenDash?.[1] ?? 0) * pixelRatio; f[o + 50] = 0; f[o + 51] = 0;
    } else if (h) { const a = (h.angle * Math.PI) / 180; f[o + 48] = Math.cos(a); f[o + 49] = Math.sin(a); f[o + 50] = h.spacing; f[o + 51] = 1; } else f.fill(0, o + 48, o + 52);
  }
}

/** Hatch lines on a cap (G19.3): `angle` in degrees in the cap plane (capHatchAxes), `spacing` in world units (> 0). */
export interface CapHatch { angle: number; spacing: number }
function hatchOf(h: CapHatch): CapHatch | null {
  return Number.isFinite(h.angle) && Number.isFinite(h.spacing) && h.spacing > 0 ? { angle: h.angle, spacing: h.spacing } : null;
}

function materialOf(m: Material = {}): Required<Omit<Material, 'color' | 'map' | 'shader' | 'lineDash' | 'lineHiddenDash' | 'pointBorder'>> & { color: Vec3; map: ImageTexture | null; shader: ShaderMaterial | null; lineDash: readonly [number, number] | null; lineHiddenDash: readonly [number, number] | null | undefined; pointBorder: { width: number; color: Vec3 } | null } {
  const hiddenDash = m.lineHiddenDash;
  return {
    color: parseColor(m.color, m.shadowOnly ? [0, 0, 0] : [0.8, 0.8, 0.8]), opacity: Math.min(1, Math.max(0, m.opacity ?? 1)),
    colorWrite: m.colorWrite ?? true, lineHiddenDash: hiddenDash === undefined ? undefined : hiddenDash && hiddenDash[0] > 0 && hiddenDash[1] > 0 ? [hiddenDash[0], hiddenDash[1]] : null,
    metallic: m.metallic ?? 0, roughness: m.roughness ?? 0.55, emissive: m.emissive ?? 0, unlit: m.unlit ?? false, doubleSided: m.doubleSided ?? false, lineWidth: m.lineWidth ?? 1, lineDash: m.lineDash && m.lineDash[0] > 0 && m.lineDash[1] > 0 ? [m.lineDash[0], m.lineDash[1]] : null, lineOver: m.lineOver ?? false, lineHidden: Math.min(1, Math.max(0, m.lineHidden ?? 0)), decal: m.decal ?? false,
    pointSize: Math.max(0, m.pointSize ?? 4), pointShape: m.pointShape ?? 'circle', pointBorder: m.pointBorder && m.pointBorder.width > 0 ? { width: m.pointBorder.width, color: parseColor(m.pointBorder.color, [1, 1, 1]) } : null, shadowOnly: m.shadowOnly ?? false, map: m.map ?? null, shader: m.shader ?? null, alphaCutoff: Math.min(1, Math.max(0, m.alphaCutoff ?? 0)),
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
  /** The labels' font (G15), a CSS font family with an optional weight ("500 'IBM Plex Mono', monospace"): one the page already has. */
  labelFont?: string;
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
  /** On a cap: the index of its clip plane in clipPlanes (G19). */
  capPlane?: number;
  /** The mesh's scalar field at the point (G6: its triangle's, or its vertices' interpolated), when it has one; NaN where none. */
  scalar?: number;
}

export interface LineHit {
  mesh: Mesh;
  /** The segment of the mesh's geometry nearest the point, and its id (GeometryInput.edges). */
  segment: number; edge: number | null;
  /** The nearest world point on the segment, and its distance from the point on screen (CSS pixels). */
  point: Vec3; distance: number;
}

/**
 * A text label (G15): its text (lines split at '\n'), where it is, and how it looks. A screen label is `size` CSS pixels
 * high (default 12) whatever the zoom, placed by `align` (0–1 across and down its box; default its centre) and `offset`
 * (CSS pixels); with `plane` it lies on a plane in the world (along its right and up), `size` its height in world units.
 * `background`: a rounded box behind it, `padding` and `radius` in CSS pixels (scaled with a plane label), a 1-pixel border.
 */
export interface TextLabel {
  text: string;
  at: ArrayLike<number>;
  size?: number;
  color?: Color;
  align?: readonly [number, number];
  offset?: readonly [number, number];
  background?: { color: Color; opacity?: number; padding?: number; radius?: number; border?: Color | null } | null;
  plane?: { right: ArrayLike<number>; up: ArrayLike<number> } | null;
}

/** A point picked (G8): its mesh, its index (the geometry's element: its vertex, or its entry in indices), where it is, and its distance on screen (CSS pixels). */
export interface PointHit { mesh: Mesh; index: number; point: Vec3; distance: number }

export interface FrameStats { frames: number; drawCalls: number; culled: number; triangles: number; lines: number; points: number; deviceLosses: number; cpuMs: number }

/** Built-in pipelines by name; a shader material's are `shader<id>:<variant>`. */
type PipelineKey = string;
/** The scene target: linear, half float (blendable and multisampled everywhere). */
const SCENE_FORMAT = 'rgba16float';

const SAMPLES = 4;
/** G11's order-independent transparency: the accumulation (premultiplied colour × weight) and the revealage. */
const OIT_ACCUM = 'rgba16float', OIT_REVEAL = 'r16float';
/** Whether a mesh goes through the order-independent pass (G11): a see-through surface (a shadow catcher darkens, it stays). */
const oitSurface = (m: Mesh): boolean => m.geometry.topology === 'triangles' && m.transparent && !m.material.shadowOnly;

const sortKeys = new Map<Mesh, number>();
const pipelineIds = new Map<string, number>();
const pipelineOrder = (key: string): number => { let i = pipelineIds.get(key); if (i === undefined) { i = pipelineIds.size; pipelineIds.set(key, i); } return i; };
const byPipeline = (a: Mesh, b: Mesh): number => { const x = sortKeys.get(a)!, y = sortKeys.get(b)!; return x < y ? -1 : x > y ? 1 : 0; };
const farFirst = (a: { d: number }, b: { d: number }): number => b.d - a.d;
export class Viewer {
  readonly camera: Camera;
  readonly controls: OrbitControls | null = null;
  lights: Light[];
  environment: Environment;
  readonly stats: FrameStats = { frames: 0, drawCalls: 0, culled: 0, triangles: 0, lines: 0, points: 0, deviceLosses: 0, cpuMs: 0 };
  /** Selection outline width in CSS pixels. */
  outlineWidth = 2;
  /** The ground grid (change its fields, then requestRender). */
  grid: GridOptions = { visible: false };
  /** Shadow map size (texels per side) for the shadow-casting directional light. */
  shadowMapSize = 2048;
  /** Called after a lost device has been replaced and the scene re-uploaded. */
  onRecover: (() => void) | null = null;
  private clip: ClipFrame | null = null;
  /**
   * The clip plane (G2), or null: the meshes it clips are drawn, shadowed, picked and ray-cast only on its kept side. Read:
   * the clip as it is (with several planes, `normal` and `offset` are the first's; `planes` all of them).
   */
  get clipPlane(): Readonly<ClipFrame> | null { return this.clip; }
  set clipPlane(p: ClipPlane | null) { this.clipPlanes = p ? [p] : null; }
  /**
   * The clip planes (G19), or null: up to MAX_CLIP_PLANES (6), the meshes they clip drawn, shadowed, picked and ray-cast
   * only in the intersection of their kept sides (a box section: six), capped where they cut; the caps in the first
   * colour given.
   */
  get clipPlanes(): readonly Readonly<{ normal: Vec3; offset: number }>[] | null { return this.clip?.planes ?? null; }
  set clipPlanes(list: readonly ClipPlane[] | null) {
    if (!list || !list.length) { this.clip = null; this.requestRender(); return; }
    if (list.length > MAX_CLIP_PLANES) throw new RangeError(`At most ${MAX_CLIP_PLANES} clip planes`);
    const planes = list.map(p => {
      const l = Math.hypot(p.normal[0], p.normal[1], p.normal[2]);
      if (!(l > 0) || !Number.isFinite(l) || !Number.isFinite(p.offset)) throw new RangeError('A clip plane needs a normal and a finite offset');
      return { normal: [p.normal[0] / l, p.normal[1] / l, p.normal[2] / l] as Vec3, offset: p.offset / l };
    });
    this.clip = { normal: planes[0].normal, offset: planes[0].offset, cap: parseColor(list.find(p => p.cap)?.cap, [0.85, 0.7, 0.35]), planes, cutout: this._cutout };
    this.requestRender();
  }
  /**
   * Whether the clip planes cut out a corner (G20; default false): the meshes they clip kept on any plane's kept side —
   * what is removed the intersection of their cut-away sides (two planes a quarter, three an octant) — and capped where
   * the eye's ray leaves that removed corner inside a solid. False: kept on every plane's kept side (G19).
   */
  get clipCutout(): boolean { return this._cutout; }
  set clipCutout(v: boolean) {
    if (v === this._cutout) return;
    this._cutout = v;
    if (this.clip) this.clip = { ...this.clip, cutout: v };
    this.requestRender();
  }
  private _cutout = false;

  private device!: Device;
  private context!: CanvasContext;
  private format = 'bgra8unorm';
  private pipelines = new Map<PipelineKey, Pipeline>();
  private frameBuffer!: Buffer;
  private frameGroup!: BindGroup;
  private shadowFrameBuffer!: Buffer;
  private shadowFrameGroup!: BindGroup;
  /** The caps' probe from the light (G19.4; the shadow map's size, made while the planes cap a caster) and its group. */
  private lightProbe: Texture | null = null;
  private shadowCapGroup: BindGroup | null = null;
  private shadowSampler!: object;
  private emptyShadow!: Texture;
  /** A one-texel nearest front depth (none): what the frame bind groups hold where the caps' prepass target is not bound. */
  private emptyFront!: Texture;
  /** A one-pixel MSAA probe, bound when a pass must not sample its own probe attachment. */
  private emptyFrontSamples!: Texture;
  /** The frame bind group without the prepass target (for the prepass itself, which draws into it). */
  private frameGroupBare!: BindGroup;
  private shadowMap: Texture | null = null;
  private materialLayout!: object;
  private surfaceLayout!: object;
  /** The surface pipeline description for a shader module and variant (lit or not, two-sided, transparent). */
  private surfaceDescriptor!: (module: object, lit: boolean, two: boolean, transparent: boolean | 'oit', decal?: boolean) => object;
  /** Shader materials by their WGSL: an id and their module (made on first use). */
  private shaders = new Map<string, { id: number; module: object | null; device: Device | null }>();
  /** A shader material's surface WGSL (made once per material: the sort and the draw ask for it per mesh). */
  private shaderCode = new WeakMap<ShaderMaterial, string>();
  /** The scene's box while a frame is drawn (asked for by the shadow, occlusion and camera clip). */
  private frameBox: { box: Box3 | null } | null = null;
  /** What the shadow map was last drawn from (device, size, light view, each caster), as numbers: unchanged, it is kept. */
  private shadowDrawn = new Float64Array(0);
  private shadowNext = new Float64Array(0);
  private shadowDrawnLength = -1;
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
  /** The colour maps' ramp sampler (G6: linear, clamped). */
  private rampSampler!: object;
  private textures = new Set<ImageTexture>();
  /** The one identity instance plain meshes draw with. */
  private identityInstance!: Buffer;
  private objectBuffer!: Buffer;
  private objectGroup!: BindGroup;
  private objectCapacity = 0;
  private objectData = new Float32Array(0);
  // (Their views made once with them: a frame reuses them.)
  private targets: { width: number; height: number; msaa: Texture | null; scene: Texture; depth: Texture; mask: Texture; maskDepth: Texture; capFront: Texture; capFrontSamples: Texture | null; output: BindGroup; views: { msaa: View | null; scene: View; depth: View; mask: View; maskDepth: View; capFront: View; capFrontSamples: View | null } } | null = null;
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
    if (options.labelFont) this.atlas = new GlyphAtlas(options.labelFont);
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
    this.rampSampler = device.createSampler({ minFilter: 'linear', magFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' });
    this.atlasSampler = device.createSampler({ minFilter: 'linear', magFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' });
    this.mipPipelines.clear();
    const white = device.createTexture({ size: [1, 1], format: 'rgba8unorm', usage: TextureUsage.TEXTURE_BINDING | TextureUsage.COPY_DST, label: 'viewer white' });
    device.queue.writeTexture({ texture: white }, new Uint8Array([255, 255, 255, 255]), { bytesPerRow: 4 }, [1, 1]);
    this.zeroParams = device.createBuffer({ size: 64, usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST, label: 'viewer no params' });
    this.white = { texture: white, group: device.createBindGroup({ layout: this.materialLayout, entries: [{ binding: 0, resource: white.createView() }, { binding: 1, resource: this.mipSampler }, { binding: 2, resource: { buffer: this.zeroParams } }] }) };
    this.identityInstance = device.createBuffer({ size: INSTANCE_STRIDE, usage: BufferUsage.VERTEX | BufferUsage.COPY_DST, label: 'viewer identity instance' });
    device.queue.writeBuffer(this.identityInstance, 0, new Uint8Array(packInstances({ transforms: identity() }).data));
    this.emptyShadow = device.createTexture({ size: [1, 1], format: 'depth32float', usage: TextureUsage.TEXTURE_BINDING | TextureUsage.RENDER_ATTACHMENT, label: 'viewer no shadow' });
    this.emptyFront = device.createTexture({ size: [1, 1], format: 'rg32float', usage: TextureUsage.TEXTURE_BINDING | TextureUsage.COPY_DST, label: 'viewer no caps probe' });
    this.emptyFrontSamples = device.createTexture({ size: [1, 1], format: SCENE_FORMAT, sampleCount: SAMPLES, usage: TextureUsage.TEXTURE_BINDING | TextureUsage.RENDER_ATTACHMENT, label: 'viewer no caps samples' });
    this.shadowMap = null;
    // (The targets were the lost device's: made again, and bound, when next drawn.)
    this.targets = null; this.pickTargets = null; this.oit = null; this.atlasGpu = null;
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
    const group = (buffer: Buffer, map: Texture, depth: Texture, samples = this.emptyFrontSamples) => this.device.createBindGroup({ layout, entries: [{ binding: 0, resource: { buffer } }, { binding: 1, resource: map.createView() }, { binding: 2, resource: this.shadowSampler }, { binding: 3, resource: envView }, { binding: 4, resource: envSampler }, { binding: 5, resource: depth.createView() }, { binding: 6, resource: samples.createView() }] });
    this.frameGroup = group(this.frameBuffer, this.shadowMap ?? this.emptyShadow, front, this.targets?.capFrontSamples ?? this.emptyFrontSamples);
    this.frameGroupBare = group(this.frameBuffer, this.shadowMap ?? this.emptyShadow, this.emptyFront);
    this.shadowFrameGroup = group(this.shadowFrameBuffer, this.emptyShadow, this.emptyFront);
    this.shadowCapGroup = this.lightProbe ? group(this.shadowFrameBuffer, this.emptyShadow, this.lightProbe) : null;
  }

  private async createPipelines(): Promise<void> {
    const d = this.device;
    const modules = { surface: d.createShaderModule({ code: surfaceWGSL(), label: 'viewer surface' }), line: d.createShaderModule({ code: lineWGSL, label: 'viewer line' }), point: d.createShaderModule({ code: pointWGSL, label: 'viewer point' }), label: d.createShaderModule({ code: labelWGSL, label: 'viewer label' }), pick: d.createShaderModule({ code: pickWGSL, label: 'viewer pick' }) };
    const capModules = this.options.antialias === false ? { surface: modules.surface, probe: modules.pick } : {
      surface: d.createShaderModule({ code: surfaceWGSL(undefined, true), label: 'viewer cap samples' }),
      probe: d.createShaderModule({ code: capProbeSamplesWGSL, label: 'viewer cap probe samples' }),
    };
    for (const [name, m] of [...Object.entries(modules), ...Object.entries(capModules)]) {
      const errors = (await m.getCompilationInfo()).messages.filter(x => x.type === 'error');
      if (errors.length) throw new ViewerError('shader', `${name} shader: ${errors.map(e => `${e.lineNum}: ${e.message}`).join('; ')}`);
    }
    const frameLayout = d.createBindGroupLayout({ entries: [
      { binding: 0, visibility: 3, buffer: { type: 'uniform' } },
      { binding: 1, visibility: 2, texture: { sampleType: 'depth' } },
      { binding: 2, visibility: 2, sampler: { type: 'comparison' } },
      { binding: 3, visibility: 2, texture: { sampleType: 'float' } }, { binding: 4, visibility: 2, sampler: { type: 'filtering' } },
      { binding: 5, visibility: 2, texture: { sampleType: 'unfilterable-float' } },
      { binding: 6, visibility: 2, texture: { sampleType: 'unfilterable-float', multisampled: true } },
    ] });
    const objectLayout = d.createBindGroupLayout({ entries: [{ binding: 0, visibility: 3, buffer: { type: 'uniform', hasDynamicOffset: true, minBindingSize: OBJECT_BYTES } }] });
    const layout = d.createPipelineLayout({ bindGroupLayouts: [frameLayout, objectLayout] });
    // Surfaces add the material's colour map.
    this.materialLayout = d.createBindGroupLayout({ entries: [
      { binding: 0, visibility: 2, texture: { sampleType: 'float' } }, { binding: 1, visibility: 2, sampler: { type: 'filtering' } },
      { binding: 2, visibility: 2, buffer: { type: 'uniform', minBindingSize: 64 } },
    ] });
    const surfaceLayout = this.surfaceLayout = d.createPipelineLayout({ bindGroupLayouts: [frameLayout, objectLayout, this.materialLayout] });
    // Labels add the glyph atlas (G15).
    this.atlasLayout = d.createBindGroupLayout({ entries: [{ binding: 0, visibility: 2, texture: { sampleType: 'float' } }, { binding: 1, visibility: 2, sampler: { type: 'filtering' } }] });
    const labelLayout = d.createPipelineLayout({ bindGroupLayouts: [frameLayout, objectLayout, this.atlasLayout] });
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
    const make = (key: PipelineKey, desc: object) => d.createRenderPipelineAsync({ label: `viewer ${key}`, layout: /^(lit|unlit|catcher|depthOnly|depthCap)/.test(key) ? surfaceLayout : layout, ...desc }).then(p => { this.pipelines.set(key, p); });
    const jobs: Promise<void>[] = [];
    d.pushErrorScope('validation');
    // (G11's order-independent variant: the accumulation summed, the revealage multiplied, in any order.)
    const oitTargets = [{ format: OIT_ACCUM, blend: { color: { srcFactor: 'one', dstFactor: 'one' }, alpha: { srcFactor: 'one', dstFactor: 'one' } } },
      { format: OIT_REVEAL, blend: { color: { srcFactor: 'zero', dstFactor: 'one-minus-src' }, alpha: { srcFactor: 'zero', dstFactor: 'one-minus-src' } } }];
    this.surfaceDescriptor = (module, lit, two, t, decal = false) => ({
      vertex: vertex(module),
      fragment: t === 'oit' ? { module, entryPoint: lit ? 'fsLitOit' : 'fsUnlitOit', targets: oitTargets } : { module, entryPoint: lit ? 'fsLit' : 'fsUnlit', targets: [{ format: SCENE_FORMAT, ...(t ? { blend } : {}) }] },
      primitive: { topology: 'triangle-list', cullMode: two ? 'none' : 'back', frontFace: 'ccw' },
      // Faces sit a little behind lines drawn on them (reversed depth: lower is further); a decal a little in front (G12).
      depthStencil: { format: 'depth32float', depthWriteEnabled: !t, depthCompare: 'greater-equal', depthBias: decal ? 2 : -2, depthBiasSlopeScale: decal ? 1.5 : -1.5 },
      multisample: ms,
    });
    for (const lit of [true, false]) for (const two of [false, true]) for (const t of [false, true, 'oit' as const]) for (const decal of [false, true])
      jobs.push(make(`${lit ? 'lit' : 'unlit'}${two ? '2' : ''}${t === 'oit' ? 'O' : t ? 'T' : ''}${decal ? 'D' : ''}`, this.surfaceDescriptor(modules.surface, lit, two, t, decal)));
    // CAD line-only views: keep surface depth, including clipped faces, without painting a colour plane.
    for (const two of [false, true]) jobs.push(make(two ? 'depthOnly2' : 'depthOnly', {
      vertex: vertex(modules.surface),
      fragment: { module: modules.surface, entryPoint: 'fsUnlit', targets: [{ format: SCENE_FORMAT, writeMask: 0 }] },
      primitive: { topology: 'triangle-list', cullMode: two ? 'none' : 'back', frontFace: 'ccw' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'greater-equal', depthBias: -2, depthBiasSlopeScale: -1.5 },
      multisample: ms,
    }));
    const oitModule = d.createShaderModule({ code: oitWGSL, label: 'viewer oit' });
    jobs.push(d.createRenderPipelineAsync({
      label: 'viewer oit composite', layout: 'auto',
      vertex: { module: oitModule, entryPoint: 'vs' },
      fragment: { module: oitModule, entryPoint: 'fs', targets: [{ format: SCENE_FORMAT, blend }] },
      primitive: { topology: 'triangle-list' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: false, depthCompare: 'always' },
      multisample: ms,
    }).then(p => { this.pipelines.set('oitComposite', p); }));
    jobs.push(make('catcher', {
      vertex: vertex(modules.surface),
      fragment: { module: modules.surface, entryPoint: 'fsShadow', targets: [{ format: SCENE_FORMAT, blend }] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: false, depthCompare: 'greater-equal' },
      multisample: ms,
    }));
    for (const t of [false, true, 'over' as const, 'hidden' as const]) jobs.push(make(t === 'over' ? 'lineOver' : t === 'hidden' ? 'lineHidden' : t ? 'lineT' : 'line', {
      vertex: {
        module: modules.line, entryPoint: 'vs',
        buffers: [{ arrayStride: 32, stepMode: 'instance', attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x3' },
          { shaderLocation: 2, offset: 24, format: 'unorm8x4' }, { shaderLocation: 3, offset: 28, format: 'unorm8x4' },
        ] }],
      },
      fragment: { module: modules.line, entryPoint: t === 'hidden' ? 'fsHidden' : 'fs', targets: [{ format: SCENE_FORMAT, ...(t ? { blend } : {}) }] },
      primitive: { topology: 'triangle-list' },
      // Lines test depth but do not write it: no occlusion halos around them. (Over the scene: not tested; their hidden
      // parts: only behind a surface.)
      depthStencil: { format: 'depth32float', depthWriteEnabled: false, depthCompare: t === 'over' ? 'always' : t === 'hidden' ? 'less' : 'greater-equal' },
      multisample: ms,
    }));
    // Points (G8): a screen-space quad each, blended (their edges and borders are coverage); tested like lines, over the
    // scene, or only behind surfaces (their hidden parts).
    for (const k of ['point', 'pointOver', 'pointHidden'] as const) jobs.push(make(k, {
      vertex: {
        module: modules.point, entryPoint: 'vs',
        buffers: [{ arrayStride: 16, stepMode: 'instance', attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'unorm8x4' }] }],
      },
      fragment: { module: modules.point, entryPoint: k === 'pointHidden' ? 'fsHidden' : 'fs', targets: [{ format: SCENE_FORMAT, blend }] },
      primitive: { topology: 'triangle-list' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: false, depthCompare: k === 'pointOver' ? 'always' : k === 'pointHidden' ? 'less' : 'greater-equal' },
      multisample: ms,
    }));
    // Labels (G15): glyph and box quads, blended; tested like points, over the scene, or only behind surfaces.
    for (const k of ['label', 'labelOver', 'labelHidden'] as const) jobs.push(d.createRenderPipelineAsync({
      label: `viewer ${k}`, layout: labelLayout,
      vertex: {
        module: modules.label, entryPoint: 'vs',
        buffers: [{ arrayStride: 80, stepMode: 'instance', attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'unorm8x4' }, { shaderLocation: 2, offset: 16, format: 'float32x4' },
          { shaderLocation: 3, offset: 32, format: 'float32x4' }, { shaderLocation: 4, offset: 48, format: 'float32x4' }, { shaderLocation: 5, offset: 64, format: 'float32x4' },
        ] }],
      },
      fragment: { module: modules.label, entryPoint: k === 'labelHidden' ? 'fsHidden' : 'fs', targets: [{ format: SCENE_FORMAT, blend }] },
      primitive: { topology: 'triangle-list' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: false, depthCompare: k === 'labelOver' ? 'always' : k === 'labelHidden' ? 'less' : 'greater-equal' },
      multisample: ms,
    }).then(p => { this.pipelines.set(k, p); }));
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
    // Colour-mapped surfaces (G6): position, normal, instance, scalar (location 9); one- and two-sided.
    for (const two of [false, true]) jobs.push(make(two ? 'litMap2' : 'litMap', {
      vertex: { module: modules.surface, entryPoint: 'vsMap', buffers: [position, { arrayStride: 12, attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }] }, instance, { arrayStride: 4, attributes: [{ shaderLocation: 9, offset: 0, format: 'float32' }] }] },
      fragment: { module: modules.surface, entryPoint: 'fsMap', targets: [{ format: SCENE_FORMAT }] },
      primitive: { topology: 'triangle-list', cullMode: two ? 'none' : 'back', frontFace: 'ccw' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'greater-equal', depthBias: -2, depthBiasSlopeScale: -1.5 },
      multisample: ms,
    }));
    // Caps (G2): a kept back face seen through the cut, at the plane's depth (written by the fragment).
    for (const depthOnly of [false, true]) jobs.push(make(depthOnly ? 'depthCap' : 'litCap', {
      vertex: vertex(capModules.surface),
      fragment: { module: capModules.surface, entryPoint: 'fsCap', targets: [{ format: SCENE_FORMAT, ...(depthOnly ? { writeMask: 0 } : {}) }] },
      primitive: { topology: 'triangle-list', cullMode: 'front', frontFace: 'ccw' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'greater-equal' },
      multisample: ms,
    }));
    // (A see-through mesh's caps, G19.4: in the order-independent pass, tested against the opaque depth, none written.)
    jobs.push(make('oitCap', {
      vertex: vertex(capModules.surface),
      fragment: { module: capModules.surface, entryPoint: 'fsCapOit', targets: oitTargets },
      primitive: { topology: 'triangle-list', cullMode: 'front', frontFace: 'ccw' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: false, depthCompare: 'greater-equal' },
      multisample: ms,
    }));
    // (The caps' probe, G19: the capped meshes' faces, both sides, unclipped.)
    jobs.push(make('capFront', {
      vertex: positionOnly(modules.pick),
      fragment: { module: modules.pick, entryPoint: 'fsCapProbe', targets: [{ format: 'rg32float' }] },
      primitive: { topology: 'triangle-list', cullMode: 'none', frontFace: 'ccw' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'greater' },
    }));
    if (ms.count > 1) jobs.push(make('capFrontSamples', {
      vertex: positionOnly(capModules.probe),
      fragment: { module: capModules.probe, entryPoint: 'fsCapProbe', targets: [{ format: SCENE_FORMAT }] },
      primitive: { topology: 'triangle-list', cullMode: 'none', frontFace: 'ccw' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'greater' },
      multisample: ms,
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
    // (G19.4: the caps' probe from the light — the shadow map's depth, nearer smaller — and the caps into the shadow map.)
    jobs.push(make('shadowProbe', {
      vertex: positionOnly(modules.pick),
      fragment: { module: modules.pick, entryPoint: 'fsCapProbe', targets: [{ format: 'rg32float' }], constants: { nearer: -1 } },
      primitive: { topology: 'triangle-list', cullMode: 'none', frontFace: 'ccw' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less' },
    }));
    jobs.push(make('shadowCap', {
      vertex: positionOnly(modules.pick),
      fragment: { module: modules.pick, entryPoint: 'fsCapShadow', targets: [] },
      primitive: { topology: 'triangle-list', cullMode: 'front', frontFace: 'ccw' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less' },
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
    this.scene = null;
    this.requestRender();
    return m;
  }

  /** @internal A mesh moved (its transform or instances): the scene trees are made again at the next pick (G9). */
  sceneMoved(): void { this.scene = null; }
  /**
   * @internal Picks through the scene trees and large point meshes' hierarchies (G9, default); false: every mesh walked
   * in order, as before — the same answers (the test compares them), for tests.
   */
  accelerate = true;
  /** The scene trees (G9): the triangle meshes' world boxes (one an instance) for rays; the line and point meshes' for the pointer. */
  private scene: { rays: SceneTree; rayMesh: Mesh[]; rayInstance: Int32Array; marks: SceneTree; markMesh: Mesh[] } | null = null;
  private sceneTrees(): NonNullable<Viewer['scene']> {
    if (this.scene) return this.scene;
    const rayMesh: Mesh[] = [], rayInstance: number[] = [], rayBoxes: number[] = [], markMesh: Mesh[] = [], markBoxes: number[] = [];
    for (const m of this.meshes) {
      const b = m.geometry.data.bounds;
      if (!b) continue;
      if (m.geometry.topology === 'triangles') {
        for (let i = 0; i < m.instanceCount; i++) {
          const w = transformBox(this.instanceTransform(m, m.instances ? i : null), b);
          rayMesh.push(m); rayInstance.push(m.instances ? i : -1); rayBoxes.push(...w.min, ...w.max);
        }
      } else { const w = transformBox(m.transform, b); markMesh.push(m); markBoxes.push(...w.min, ...w.max); }
    }
    this.scene = { rays: sceneTree(Float64Array.from(rayBoxes), rayMesh.length), rayMesh, rayInstance: Int32Array.from(rayInstance), marks: sceneTree(Float64Array.from(markBoxes), markMesh.length), markMesh };
    return this.scene;
  }
  /**
   * The triangle leaves a world ray may hit before tmax, the earliest first (ties by leaf order): indices into the ray tree,
   * and for each the least parameter a hit on it can have — where the ray enters its box.
   */
  private rayLeaves(origin: Vec3, direction: Vec3, tmax: number): { leaves: number[]; ts: number[]; order: number[] } {
    // (Caps are not the leaves' — capHit finds them, G19 — so a leaf's least parameter is where the ray enters its box.)
    const S = this.sceneTrees(), n = sceneRay(S.rays, origin, direction, tmax, candLeaves, candTs), kept = n;
    candLeaves.length = kept; candTs.length = kept;
    candOrder.length = kept; for (let i = 0; i < kept; i++) candOrder[i] = i;
    candOrder.sort(byEntry);
    return { leaves: candLeaves, ts: candTs, order: candOrder };
  }

  remove(mesh: Mesh): void {
    const i = this.meshes.indexOf(mesh);
    if (i < 0) return;
    this.meshes.splice(i, 1);
    this.scene = null;
    this.freeSlots.push(mesh.slot);
    mesh.slot = -1;
    // Its own GPU buffers go with it (made again should it be drawn again).
    if (mesh.instances?.buffer) { mesh.instances.buffer.destroy(); mesh.instances.buffer = null; mesh.instances.device = null; }
    mesh.materialState?.params.destroy(); mesh.materialState = null;
    mesh.mapState?.params.destroy(); mesh.mapState?.texture.destroy(); mesh.mapState = null;
    this.requestRender();
  }

  /** @internal A disposed geometry: no longer kept (nor restored after a lost device). */
  forget(g: Geometry): void { this.geometries.delete(g); }

  /** Remove every mesh and release every geometry. */
  clear(): void {
    for (const m of this.meshes) m.slot = -1;
    this.meshes = []; this.freeSlots = []; this.nextSlot = 0; this.scene = null;
    for (const g of this.geometries) g.release();
    this.geometries.clear();
    this.requestRender();
  }

  get meshList(): readonly Mesh[] { return this.meshes; }

  /**
   * The box the camera's depth range must hold (G19): the scene's, and under clip planes every capped mesh's whole box —
   * its probe and caps are drawn from its faces cut away too (a box section inside a solid: the solid's far faces).
   */
  private depthBounds(): Box3 | null {
    const b = this.sceneBounds();
    if (!this.clip) return b;
    let out: Box3 | null = b ? { min: [b.min[0], b.min[1], b.min[2]], max: [b.max[0], b.max[1], b.max[2]] } : null;
    for (const m of this.meshes) {
      if (!m.visible || !m.bounded || m.geometry.disposed || !this.capped(m) || !m.bounds) continue;
      if (!out) out = { min: [m.bounds.min[0], m.bounds.min[1], m.bounds.min[2]], max: [m.bounds.max[0], m.bounds.max[1], m.bounds.max[2]] }; else growBox(out, m.bounds);
    }
    return out;
  }
  /** The box around every visible mesh (a clipped mesh's box cut by an axis-aligned clip plane, as a clipped copy's would be). */
  sceneBounds(): Box3 | null {
    if (this.frameBox) return this.frameBox.box;
    // (Grown in one box, G13: no box a mesh.)
    let b: Box3 | null = null;
    for (const m of this.meshes) {
      if (!m.visible || !m.bounded || m.geometry.disposed) continue;
      const x = this.clip && m.clipped ? clipBox(m.bounds, this.clip) : m.bounds;
      if (!x) continue;
      if (!b) b = { min: [x.min[0], x.min[1], x.min[2]], max: [x.max[0], x.max[1], x.max[2]] }; else growBox(b, x);
    }
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
      const decal = variant.endsWith('D'), v = decal ? variant.slice(0, -1) : variant;
      const lit = !v.startsWith('unlit'), two = v.includes('2'), t = v.endsWith('O') ? 'oit' as const : v.endsWith('T');
      this.pipelines.set(key, (this.device as unknown as { createRenderPipeline(d: object): Pipeline }).createRenderPipeline({ label: `viewer ${key}`, layout: this.surfaceLayout, ...this.surfaceDescriptor(entry.module, lit, two, t, decal) }));
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
    t?.msaa?.destroy(); t?.scene.destroy(); t?.depth.destroy(); t?.mask.destroy(); t?.maskDepth.destroy(); t?.capFront.destroy(); t?.capFrontSamples?.destroy();
    const samples = this.options.antialias === false ? 1 : SAMPLES;
    const msaa = samples > 1 ? this.device.createTexture({ size: [w, h], format: SCENE_FORMAT, sampleCount: samples, usage: TextureUsage.RENDER_ATTACHMENT, label: 'viewer msaa' }) : null;
    const scene = this.device.createTexture({ size: [w, h], format: SCENE_FORMAT, usage: TextureUsage.RENDER_ATTACHMENT | TextureUsage.TEXTURE_BINDING, label: 'viewer scene' });
    const depth = this.device.createTexture({ size: [w, h], format: 'depth32float', sampleCount: samples, usage: TextureUsage.RENDER_ATTACHMENT | TextureUsage.TEXTURE_BINDING, label: 'viewer depth' });
    const mask = this.device.createTexture({ size: [w, h], format: 'r32uint', usage: TextureUsage.RENDER_ATTACHMENT | TextureUsage.TEXTURE_BINDING, label: 'viewer outline mask' });
    const maskDepth = this.device.createTexture({ size: [w, h], format: 'depth32float', usage: TextureUsage.RENDER_ATTACHMENT, label: 'viewer outline depth' });
    const capFront = this.device.createTexture({ size: [w, h], format: 'rg32float', usage: TextureUsage.RENDER_ATTACHMENT | TextureUsage.TEXTURE_BINDING, label: 'viewer caps probe' });
    // The full MSAA probe is allocated only for a capped scene, not for ordinary unsectioned frames.
    const capFrontSamples = null;
    const views = { msaa: msaa ? msaa.createView() : null, scene: scene.createView(), depth: depth.createView(), mask: mask.createView(), maskDepth: maskDepth.createView(), capFront: capFront.createView(), capFrontSamples: null as View | null };
    const output = this.device.createBindGroup({ layout: this.pipelines.get('output')!.getBindGroupLayout(0), entries: [{ binding: 0, resource: scene.createView() }, { binding: 1, resource: { buffer: this.outputBuffer } }, { binding: 2, resource: mask.createView() }, { binding: 3, resource: depth.createView() }] });
    this.targets = { width: w, height: h, msaa, scene, depth, mask, maskDepth, capFront, capFrontSamples, output, views };
    // (The frame bind group holds the new prepass target.)
    this.bindFrames();
    return this.targets;
  }

  private ensureCapSamples(t: NonNullable<Viewer['targets']>): void {
    if (this.options.antialias === false || t.capFrontSamples) return;
    t.capFrontSamples = this.device.createTexture({ size: [t.width, t.height], format: SCENE_FORMAT, sampleCount: SAMPLES, usage: TextureUsage.RENDER_ATTACHMENT | TextureUsage.TEXTURE_BINDING, label: 'viewer caps probe samples' });
    t.views.capFrontSamples = t.capFrontSamples.createView();
    this.bindFrames();
  }

  /**
   * @internal See-through surfaces through the order-independent pass (G11, default); false: sorted far to near and
   * blended over, as before (the test compares them).
   */
  orderIndependent = true;
  /** @internal While the order-independent pass draws: transparent surfaces take their 'O' pipelines. */
  private oitDrawing = false;
  /** G11's targets: the accumulation and revealage (multisampled when the scene is) and their resolved copies, and the composite's bind group. */
  private oit: { width: number; height: number; accumMs: Texture | null; revealMs: Texture | null; accum: Texture; reveal: Texture; group: BindGroup; views: { accumMs: View | null; revealMs: View | null; accum: View; reveal: View } } | null = null;
  private ensureOit(): NonNullable<Viewer['oit']> {
    const w = this.canvas.width, h = this.canvas.height, o = this.oit;
    if (o && o.width === w && o.height === h) return o;
    o?.accumMs?.destroy(); o?.revealMs?.destroy(); o?.accum.destroy(); o?.reveal.destroy();
    const samples = this.options.antialias === false ? 1 : SAMPLES, ms = samples > 1;
    const tex = (format: string, count: number, label: string) => this.device.createTexture({ size: [w, h], format, sampleCount: count, usage: TextureUsage.RENDER_ATTACHMENT | (count === 1 ? TextureUsage.TEXTURE_BINDING : 0), label });
    const accumMs = ms ? tex(OIT_ACCUM, samples, 'viewer oit accum msaa') : null, revealMs = ms ? tex(OIT_REVEAL, samples, 'viewer oit reveal msaa') : null;
    const accum = tex(OIT_ACCUM, 1, 'viewer oit accum'), reveal = tex(OIT_REVEAL, 1, 'viewer oit reveal');
    const group = this.device.createBindGroup({ layout: this.pipelines.get('oitComposite')!.getBindGroupLayout(0), entries: [{ binding: 0, resource: accum.createView() }, { binding: 1, resource: reveal.createView() }] });
    this.oit = { width: w, height: h, accumMs, revealMs, accum, reveal, group, views: { accumMs: accumMs?.createView() ?? null, revealMs: revealMs?.createView() ?? null, accum: accum.createView(), reveal: reveal.createView() } };
    return this.oit;
  }

  /** A label geometry laid out against the glyph atlas (again when the atlas changes font, or the device is new). */
  private uploadLabels(g: Geometry): boolean {
    if (g.gpu && g.gpu.device === this.device && g.gpu.labels?.atlas === this.atlasVersion) return true;
    if (g.gpu) { g.gpu.positions.destroy(); g.gpu = null; }
    const { data, count } = layoutLabels(g.data.labels ?? [], this.atlas, packLabelColor);
    if (!count) return false;
    const b = this.device.createBuffer({ size: Math.max(16, data.byteLength), usage: BufferUsage.VERTEX | BufferUsage.COPY_DST, label: 'labels' });
    this.device.queue.writeBuffer(b, 0, data);
    g.gpu = { device: this.device, positions: b, normals: null, colors: null, uvs: null, indices: null, labels: { count, atlas: this.atlasVersion } };
    return true;
  }
  /** The labels' font (G15): a new one draws every glyph again, and lays every label out again. */
  get labelFont(): string { return this.atlas.font; }
  set labelFont(font: string) {
    if (font === this.atlas.font) return;
    this.atlas = new GlyphAtlas(font); this.atlasVersion++; this.atlasGpu = null; this.requestRender();
  }
  /** Draw every glyph again in the same font (a web font that has loaded since the first were drawn in its fallback). */
  redrawGlyphs(): void { this.atlas = new GlyphAtlas(this.atlas.font); this.atlasVersion++; this.atlasGpu = null; this.requestRender(); }
  private atlas = new GlyphAtlas("500 ui-monospace, 'SF Mono', Menlo, monospace");
  private atlasVersion = 1;
  private atlasLayout!: object;
  private atlasSampler!: object;
  private atlasGpu: { device: Device; texture: Texture; group: BindGroup; atlas: GlyphAtlas } | null = null;
  /** The atlas on the GPU: made for this device and atlas, the glyphs added since written into their cells. */
  private atlasGroup(): BindGroup {
    let a = this.atlasGpu;
    if (!a || a.device !== this.device || a.atlas !== this.atlas) {
      a?.texture.destroy();
      const texture = this.device.createTexture({ size: [ATLAS_SIZE, ATLAS_SIZE], format: 'r8unorm', usage: TextureUsage.TEXTURE_BINDING | TextureUsage.COPY_DST, label: 'viewer glyph atlas' });
      const group = this.device.createBindGroup({ layout: this.atlasLayout, entries: [{ binding: 0, resource: texture.createView() }, { binding: 1, resource: this.atlasSampler }] });
      a = this.atlasGpu = { device: this.device, texture, group, atlas: this.atlas };
      // (Every glyph drawn so far, into the new texture.)
      this.atlas.added = this.atlas.fields.map((_, i) => i);
    }
    for (const cell of this.atlas.added) this.device.queue.writeTexture({ texture: a.texture, origin: [(cell % ATLAS_CELLS) * GLYPH_CELL, Math.floor(cell / ATLAS_CELLS) * GLYPH_CELL] }, this.atlas.fields[cell], { bytesPerRow: GLYPH_CELL }, [GLYPH_CELL, GLYPH_CELL]);
    this.atlas.added.length = 0;
    return a.group;
  }
  /** Labels (G15): text anchored at world points — sized in CSS pixels, or laid on a plane in world units — as one mesh. */
  addLabels(labels: readonly TextLabel[], options: AddMeshOptions = {}): Mesh {
    // (White by default: a label shows its own colours.)
    return this.add({ positions: [], topology: 'labels', labels: labels.map(labelInput) }, { castShadow: false, pickable: false, ...options, material: { unlit: true, color: '#ffffff', ...options.material } });
  }

  /** Zero texture coordinates for n vertices, one buffer shared by the geometries without their own (G13), grown by doubling. */
  private zeroUV: { device: Device; buffer: Buffer; vertices: number } | null = null;
  private zeroUVs(n: number): Buffer {
    const z = this.zeroUV;
    if (z && z.device === this.device && z.vertices >= n) return z.buffer;
    // (A smaller one stays with the geometries bound to it — only the larger is made; zeros on creation.)
    const vertices = Math.max(65536, 2 ** Math.ceil(Math.log2(Math.max(1, n))));
    this.zeroUV = { device: this.device, vertices, buffer: this.device.createBuffer({ size: vertices * 8, usage: BufferUsage.VERTEX, label: 'viewer zero uvs' }) };
    return this.zeroUV.buffer;
  }

  private upload(g: Geometry): boolean {
    if (g.disposed) return false;
    if (g.data.topology === 'labels') return this.uploadLabels(g);
    if (g.gpu && g.gpu.device === this.device) return true;
    const d = this.device, data = g.data;
    const buffer = (src: ArrayBufferView, usage: number, label: string) => {
      const size = Math.max(4, Math.ceil(src.byteLength / 4) * 4), b = d.createBuffer({ size, usage: usage | BufferUsage.COPY_DST, label });
      if (src.byteLength % 4) { const padded = new Uint8Array(size); padded.set(new Uint8Array(src.buffer, src.byteOffset, src.byteLength)); d.queue.writeBuffer(b, 0, padded); }
      else if (src.byteLength) d.queue.writeBuffer(b, 0, src);
      return b;
    };
    g.gpu = data.topology !== 'triangles'
      ? { device: d, positions: buffer(new Uint8Array(data.topology === 'lines' ? segmentInstances(data) : pointInstances(data)), BufferUsage.VERTEX, data.topology), normals: null, colors: null, uvs: null, indices: null }
      : {
        device: d,
        positions: buffer(data.positions, BufferUsage.VERTEX, 'positions'), normals: buffer(data.normals, BufferUsage.VERTEX, 'normals'),
        colors: buffer(data.colors, BufferUsage.VERTEX, 'colors'), uvs: data.uvs ? buffer(data.uvs, BufferUsage.VERTEX, 'uvs') : this.zeroUVs(data.vertexCount), ownUVs: !!data.uvs, indices: data.indices ? buffer(data.indices, BufferUsage.INDEX, 'indices') : null,
      };
    return true;
  }

  /** The meshes to draw this frame: visible, uploaded and in the frustum; opaque first, then transparent back to front. */
  private visibleMeshes(viewProjection: Mat4): { opaque: Mesh[]; transparent: Mesh[]; culled: number } {
    // (The lists and the transparent meshes' entries kept from frame to frame, G13.)
    const planes = frustumPlanes(viewProjection), opaque = this.visOpaque, transparent = this.visEntries;
    opaque.length = 0; let entries = 0;
    let culled = 0;
    const eye = this.camera.position, forward = this.camera.basis().forward;
    for (const m of this.meshes) {
      if (!m.visible || !this.upload(m.geometry) || !m.geometry.data.elementCount) continue;
      const b = m.bounds;
      if (b && !boxInFrustum(planes, b)) { culled++; continue; }
      // (Lines over the scene after everything, transparent or not.)
      let d = 0;
      if (m.geometry.topology !== 'triangles' && m.material.lineOver) d = -1e300;
      else if (m.transparent) d = b ? ((b.min[0] + b.max[0]) / 2 - eye[0]) * forward[0] + ((b.min[1] + b.max[1]) / 2 - eye[1]) * forward[1] + ((b.min[2] + b.max[2]) / 2 - eye[2]) * forward[2] : 0;
      else { opaque.push(m); continue; }
      const e = transparent[entries] ??= { m, d }; e.m = m; e.d = d; entries++;
    }
    transparent.length = entries;
    // Opaque surfaces by pipeline (fewer state changes), then lines (they test depth but do not write
    // it, so they come after the surfaces), then transparent far to near.
    // (The keys in a map kept for the purpose, and comparators at module level: no closures a frame; PERF3 C17.)
    // (Numbers, G13: an id a pipeline key, lines and points after the surfaces — no string a mesh a frame.)
    sortKeys.clear(); for (const m of opaque) sortKeys.set(m, (m.geometry.topology !== 'triangles' ? 1e6 : 0) + pipelineOrder(this.pipelineKey(m, false)));
    opaque.sort(byPipeline); sortKeys.clear();
    transparent.sort(farFirst);
    const list = this.visTransparent; list.length = entries;
    for (let i = 0; i < entries; i++) list[i] = transparent[i].m;
    return { opaque, transparent: list, culled };
  }
  private visOpaque: Mesh[] = [];
  private visTransparent: Mesh[] = [];
  private visEntries: { m: Mesh; d: number }[] = [];

  private pipelineKey(m: Mesh, pick: boolean | 'mask'): PipelineKey {
    const mat = m.material, two = mat.doubleSided ? '2' : '', t = m.transparent ? (this.oitDrawing ? 'O' : 'T') : '';
    if (pick === 'mask') return (two ? 'mask2' : 'mask');
    if (pick) return (two ? 'pick2' : 'pick');
    if (m.geometry.topology === 'lines') return mat.lineOver ? 'lineOver' : (t ? 'lineT' : 'line');
    if (m.geometry.topology === 'points') return mat.lineOver ? 'pointOver' : 'point';
    if (m.geometry.topology === 'labels') return mat.lineOver ? 'labelOver' : 'label';
    if (!mat.colorWrite) return two ? 'depthOnly2' : 'depthOnly';
    if (mat.shadowOnly) return 'catcher';
    if (m.mapped) return two ? 'litMap2' : 'litMap';
    const variant = `${mat.unlit ? 'unlit' : 'lit'}${two}${t}${mat.decal ? 'D' : ''}`;
    return mat.shader ? this.shaderPipeline(mat.shader, variant) : variant;
  }

  /** The shadow-casting light's view of the scene: an orthographic box around it along the light. */
  private shadowFrame(): ShadowFrame | null {
    const light = directionalLights(this.lights).find(l => l.castShadow), scene = this.sceneBounds();
    if (!light || !scene) return null;
    const r = Math.max(boxRadius(scene), 1e-6), c = boxCenter(scene), d = normalize(light.direction);
    const up: Vec3 = Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0], eye = sub(c, scale(d, 2 * r));
    if (!cross(up, d).some(x => x !== 0)) return null;
    // (Its depth range holds the capped meshes' whole boxes too, as the camera's does — the caps' probe from the light
    // reads their faces cut away, G19.4; its breadth is the scene's.)
    let near = r * 0.9, far = r * 3.1;
    const deep = this.clip ? this.depthBounds() : null;
    if (deep) for (let i = 0; i < 8; i++) {
      const t = ((i & 1 ? deep.max[0] : deep.min[0]) - eye[0]) * d[0] + ((i & 2 ? deep.max[1] : deep.min[1]) - eye[1]) * d[1] + ((i & 4 ? deep.max[2] : deep.min[2]) - eye[2]) * d[2];
      if (t - r * 0.01 < near) near = Math.max(r * 1e-3, t - r * 0.01); if (t + r * 0.01 > far) far = t + r * 0.01;
    }
    const viewProjection = multiply(orthographic(r, r, near, far), lookAt(eye, c, up)), size = this.shadowMapSize;
    return { viewProjection, normalOffset: (2 * r / size) * 1.5, texel: 1 / size, bias: 0.0005, eye, direction: d };
  }

  /** The grid this frame: a power-of-ten cell fitted to the view distance unless one is set. */
  private gridFrame(): GridFrame | null {
    const g = this.grid;
    if (!g.visible) return null;
    const d = Math.max(this.camera.distance, 1e-9), cell = g.cell ?? Math.pow(10, Math.floor(Math.log10(d / 8)));
    return { cell, major: g.major ?? 10, fade: d * 6, height: g.height ?? 0, color: parseColor(g.color, [0.55, 0.56, 0.6]), opacity: g.opacity ?? 0.5 };
  }

  private writeUniforms(viewProjection: Mat4, shadow: ShadowFrame | null = null): void {
    // (Into the frame block kept for it, G13.)
    const vpt = frameViewport; vpt[0] = this.canvas.width; vpt[1] = this.canvas.height; vpt[2] = this.pixelRatio; const sb = this.sceneBounds(); vpt[3] = sb ? boxRadius(sb) : 0.866;
    this.device.queue.writeBuffer(this.frameBuffer, 0, packFrame(viewProjection, this.camera, this.lights, this.environment, shadow, vpt, this.gridFrame(), this.clip, frameBlock));
    if (shadow) {
      const f = packFrame(shadow.viewProjection, this.camera, [], this.environment, null, [1, 1, 1], null, this.clip);
      // (Seen from the light — orthographic, along its direction: the caps' entry into the kept region along its rays, G19.4.)
      if (shadow.eye && shadow.direction) { f[16] = shadow.eye[0]; f[17] = shadow.eye[1]; f[18] = shadow.eye[2]; f[19] = 0; f[20] = shadow.direction[0]; f[21] = shadow.direction[1]; f[22] = shadow.direction[2]; }
      this.device.queue.writeBuffer(this.shadowFrameBuffer, 0, f);
    }
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
    { dynamicOffset[0] = m.slot * OBJECT_STRIDE; pass.setBindGroup(1, this.objectGroup, dynamicOffset, 0, 1); }
    if (data.topology === 'lines') { pass.setVertexBuffer(0, g.positions); pass.draw(6, data.elementCount / 2); return; }
    if (data.topology === 'points') { pass.setVertexBuffer(0, g.positions); pass.draw(6, data.elementCount); return; }
    if (data.topology === 'labels') { pass.setBindGroup(2, this.atlasGroup()); pass.setVertexBuffer(0, g.positions); pass.draw(6, g.labels!.count); return; }
    if (!pick && m.mapped && m.material.colorWrite) { this.drawMapped(pass, m); return; }
    this.drawTriangles(pass, m, !pick);
  }

  /** A line or point mesh's parts behind the surfaces, faint (Material.lineHidden; G7, G8). */
  private drawHiddenLines(pass: RenderPass, m: Mesh, current: { pipeline?: Pipeline }): void {
    const t = m.geometry.topology, points = t === 'points', p = this.pipelines.get(t === 'labels' ? 'labelHidden' : points ? 'pointHidden' : 'lineHidden')!;
    if (current.pipeline !== p) { pass.setPipeline(p); current.pipeline = p; }
    if (t === 'labels') { { dynamicOffset[0] = m.slot * OBJECT_STRIDE; pass.setBindGroup(1, this.objectGroup, dynamicOffset, 0, 1); } pass.setBindGroup(2, this.atlasGroup()); pass.setVertexBuffer(0, m.geometry.gpu!.positions); pass.draw(6, m.geometry.gpu!.labels!.count); return; }
    { dynamicOffset[0] = m.slot * OBJECT_STRIDE; pass.setBindGroup(1, this.objectGroup, dynamicOffset, 0, 1); }
    pass.setVertexBuffer(0, m.geometry.gpu!.positions); pass.draw(6, points ? m.geometry.data.elementCount : m.geometry.data.elementCount / 2);
  }

  /** A colour-mapped mesh (G6): its field's buffers (a per-triangle field's own positions and normals, drawn unindexed) and its map's bind group. */
  private drawMapped(pass: RenderPass, m: Mesh): void {
    const g = m.geometry, data = g.data, f = data.scalars!, base = g.gpu!, n = m.instanceCount;
    let s = g.scalarGpu;
    if (!s || s.device !== this.device) {
      const buf = (src: Float32Array, label: string) => { const b = this.device.createBuffer({ size: Math.max(4, src.byteLength), usage: BufferUsage.VERTEX | BufferUsage.COPY_DST, label }); this.device.queue.writeBuffer(b, 0, src); return b; };
      s = g.scalarGpu = { device: this.device, values: buf(f.draw.values, 'scalars'), positions: f.draw.positions ? buf(f.draw.positions, 'scalar positions') : null, normals: f.draw.normals ? buf(f.draw.normals, 'scalar normals') : null };
    }
    pass.setVertexBuffer(0, s.positions ?? base.positions); pass.setVertexBuffer(1, s.normals ?? base.normals!); pass.setVertexBuffer(2, this.instanceBuffer(m)); pass.setVertexBuffer(3, s.values);
    pass.setBindGroup(2, this.mapGroup2(m));
    if (f.per === 'triangle') pass.draw(data.elementCount, n);
    else if (base.indices) { pass.setIndexBuffer(base.indices, data.indices instanceof Uint16Array ? 'uint16' : 'uint32'); pass.drawIndexed(data.elementCount, n); }
    else pass.draw(data.elementCount, n);
  }
  /** A mesh's colour-map bind group: its ramp (sRGB texels, filtered) and its parameters, made when the map or device changes. */
  private mapGroup2(m: Mesh): BindGroup {
    const packed = m.packedMap!, st = m.mapState;
    if (st && st.device === this.device && st.map === packed) return st.group;
    st?.texture.destroy(); st?.params.destroy();
    const texture = this.device.createTexture({ size: [256, 1], format: 'rgba8unorm-srgb', usage: TextureUsage.TEXTURE_BINDING | TextureUsage.COPY_DST, label: 'viewer colour map' });
    this.device.queue.writeTexture({ texture }, packed.ramp, { bytesPerRow: 1024 }, [256, 1]);
    const params = this.device.createBuffer({ size: 64, usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST, label: 'viewer colour map params' });
    this.device.queue.writeBuffer(params, 0, packed.params);
    const group = this.device.createBindGroup({ layout: this.materialLayout, entries: [{ binding: 0, resource: texture.createView() }, { binding: 1, resource: this.rampSampler }, { binding: 2, resource: { buffer: params } }] });
    m.mapState = { device: this.device, map: packed, texture, params, group };
    return group;
  }

  /** Whether a mesh's cut is capped this frame: a clip plane, an opaque closed triangle mesh it clips. */
  private capped(m: Mesh): boolean { return !!this.clip && m.cap && m.clipped && m.geometry.topology === 'triangles' && !m.transparent; }
  /** A see-through mesh capped (G19.4, a ghost): its caps in the order-independent pass (none in the sorted one). */
  private ghostCapped(m: Mesh): boolean { return !!this.clip && this.orderIndependent && m.cap && m.clipped && oitSurface(m); }
  /** In the caps' probe: the opaque capped meshes and the see-through ones (whose entry it is inside decides either's cap). */
  private probed(m: Mesh): boolean { return this.capped(m) || this.ghostCapped(m); }
  /**
   * The caps' probe (G19, in place of G2's front-depth prepass): the capped meshes' faces, unclipped, the nearest beyond
   * each pixel's entry into the kept region — its depth and whether a back face, read by the caps: the entry is inside a
   * solid where that first surface after it is the solid's back face. Only while the planes cap one; `scissor`: the
   * pick's pixel.
   */
  private drawCapFront(enc: ReturnType<Device['createCommandEncoder']>, opaque: readonly Mesh[], transparent: readonly Mesh[], scissor: [number, number] | null): void {
    if (!this.clip || (!opaque.some(m => this.capped(m)) && !transparent.some(m => this.ghostCapped(m)))) return;
    const t = this.ensureTargets();
    if (!scissor) this.ensureCapSamples(t);
    // Keep the single-sample probe for picks and outline masks. Scene caps additionally read their
    // own sample's probe: a pixel-centre winner cannot describe both sides of a covered back-face edge.
    for (const samples of [false, true]) {
      if (samples && (scissor || !t.views.capFrontSamples)) continue;
      const pass = enc.beginRenderPass({
        colorAttachments: [{ view: samples ? t.views.capFrontSamples! : t.views.capFront, clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' }],
        depthStencilAttachment: { view: samples ? t.views.depth : t.views.maskDepth, depthClearValue: 0, depthLoadOp: 'clear', depthStoreOp: 'discard' },
      });
      if (scissor) pass.setScissorRect(scissor[0], scissor[1], 1, 1);
      pass.setBindGroup(0, this.frameGroupBare);
      pass.setPipeline(this.pipelines.get(samples ? 'capFrontSamples' : 'capFront')!);
      for (const list of [opaque, transparent]) for (const m of list) {
        if (!this.probed(m) || !this.upload(m.geometry)) continue;
        { dynamicOffset[0] = m.slot * OBJECT_STRIDE; pass.setBindGroup(1, this.objectGroup, dynamicOffset, 0, 1); }
        this.drawTriangles(pass, m, false);
      }
      pass.end();
    }
  }
  /**
   * The caps' probe from the shadow-casting light (G19.4): as drawCapFront, the capped casters' faces unclipped, the
   * nearest beyond each texel's entry into the kept region along the light — in the shadow map's depth (cleared and drawn
   * again by the shadow pass after it), read by the caps drawn into the shadow map.
   */
  private drawLightProbe(enc: ReturnType<Device['createCommandEncoder']>, casters: readonly Mesh[]): void {
    const size = this.shadowMapSize;
    if (!this.lightProbe || this.lightProbe.width !== size) {
      this.lightProbe?.destroy();
      this.lightProbe = this.device.createTexture({ size: [size, size], format: 'rg32float', usage: TextureUsage.RENDER_ATTACHMENT | TextureUsage.TEXTURE_BINDING, label: 'viewer caps probe from the light' });
      this.bindFrames();
    }
    const pass = enc.beginRenderPass({
      colorAttachments: [{ view: this.lightProbe.createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' }],
      depthStencilAttachment: { view: this.shadowMap!.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'discard' },
    });
    pass.setBindGroup(0, this.shadowFrameGroup);
    pass.setPipeline(this.pipelines.get('shadowProbe')!);
    for (const m of casters) {
      if (!this.capped(m) || !this.upload(m.geometry)) continue;
      { dynamicOffset[0] = m.slot * OBJECT_STRIDE; pass.setBindGroup(1, this.objectGroup, dynamicOffset, 0, 1); }
      this.drawTriangles(pass, m, false);
    }
    pass.end();
  }
  /** The caps of the opaque meshes in a pass ('litCap' in the scene, 'capMask', 'capPick'): their count. */
  private drawCaps(pass: RenderPass, list: readonly Mesh[], current: { pipeline?: Pipeline }, key: 'litCap' | 'capMask' | 'capPick'): number {
    if (!this.clip) return 0;
    let n = 0;
    for (const m of list) {
      if (key === 'capPick' ? (!this.probed(m) || (m.pickTransparent ?? m.transparent) || !m.pickable) : !this.capped(m)) continue;
      const p = this.pipelines.get(key === 'litCap' && !m.material.colorWrite ? 'depthCap' : key)!;
      if (current.pipeline !== p) { pass.setPipeline(p); current.pipeline = p; }
      { dynamicOffset[0] = m.slot * OBJECT_STRIDE; pass.setBindGroup(1, this.objectGroup, dynamicOffset, 0, 1); }
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
    // (The key in a typed array kept from frame to frame, grown when needed — G13: an array of numbers emptied and
    // filled again each frame was its own new store, 70 KiB a frame for 240 casters.)
    const need = 3 + 4 + viewProjection.length + casters.length * 20;
    if (this.shadowNext.length < need) this.shadowNext = new Float64Array(need * 2);
    const k = this.shadowNext;
    let n = 0;
    k[n++] = this.idOf(this.device); k[n++] = this.shadowMapSize;
    // (The clip plane changes what casts.)
    if (this.clip) { k[n++] = this.clip.planes.length * (this.clip.cutout ? -1 : 1); for (const p of this.clip.planes) { k[n++] = p.normal[0]; k[n++] = p.normal[1]; k[n++] = p.normal[2]; k[n++] = p.offset; } } else k[n++] = 0;
    for (let i = 0; i < viewProjection.length; i++) k[n++] = viewProjection[i];
    for (const m of casters) { k[n++] = m.slot * 2 + (this.capped(m) ? 1 : 0); k[n++] = this.idOf(m.geometry); k[n++] = m.geometry.gpu ? 1 : 0; k[n++] = m.instances ? this.idOf(m.instances) : 0; const t = m.transform; for (let i = 0; i < t.length; i++) k[n++] = t[i]; }
    const was = this.shadowDrawn;
    let same = this.shadowDrawnLength === n;
    for (let i = 0; same && i < n; i++) same = was[i] === k[i];
    if (same) return false;
    this.shadowDrawn = k; this.shadowNext = was; this.shadowDrawnLength = n;
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
    const outlineArea = outlines.length ? this.outlineRect(vp) : null;
    const shadow = this.shadowFrame();
    if (shadow && (!this.shadowMap || this.shadowMap.width !== this.shadowMapSize)) {
      this.shadowMap?.destroy();
      this.shadowMap = this.device.createTexture({ size: [this.shadowMapSize, this.shadowMapSize], format: 'depth32float', usage: TextureUsage.RENDER_ATTACHMENT | TextureUsage.TEXTURE_BINDING, label: 'viewer shadow map' });
      this.bindFrames();
      this.shadowDrawnLength = -1;
    }
    const env = this.environment.map instanceof ImageTexture && !this.environment.map.disposed ? this.environment.map : null;
    if (env !== this.boundEnv || (env && !env.gpu)) this.bindFrames();
    this.writeUniforms(vp, shadow);
    this.device.queue.writeBuffer(this.outputBuffer, 0, new Uint8Array(packOutput(this.environment, outlines, this.outlineWidth * this.pixelRatio, this.background, this.occlusionFrame(), outlineArea)));
    const targets = this.ensureTargets(), out = this.context.getCurrentTexture(), sceneView = targets.views.scene;
    const enc = this.device.createCommandEncoder();
    // (The shadow map is drawn again only when the light's view or a caster changed.)
    const casters = this.casterList; casters.length = 0;
    if (shadow) for (const m of this.meshes) if (m.visible && m.castShadow && !m.transparent && m.geometry.topology === 'triangles') casters.push(m);
    if (shadow && this.shadowMap && this.shadowChanged(shadow.viewProjection, casters)) {
      // (G19.4: the capped casters' caps too — first the probe from the light, into the shadow map's own depth.)
      const capping = this.clip ? casters.some(m => this.capped(m)) : false;
      if (capping) this.drawLightProbe(enc, casters);
      // Every shadow caster, in view or not.
      const sp = enc.beginRenderPass({ colorAttachments: [], depthStencilAttachment: { view: this.shadowMap.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' } });
      sp.setBindGroup(0, capping && this.shadowCapGroup ? this.shadowCapGroup : this.shadowFrameGroup);
      sp.setPipeline(this.pipelines.get('shadow')!);
      for (const m of casters) {
        if (!this.upload(m.geometry)) continue;
        sp.setBindGroup(1, this.objectGroup, [m.slot * OBJECT_STRIDE]);
        this.drawTriangles(sp, m, false);
      }
      if (capping && this.shadowCapGroup) {
        sp.setPipeline(this.pipelines.get('shadowCap')!);
        for (const m of casters) {
          if (!this.capped(m) || !m.geometry.gpu) continue;
          sp.setBindGroup(1, this.objectGroup, [m.slot * OBJECT_STRIDE]);
          this.drawTriangles(sp, m, false);
        }
      }
      sp.end();
    }
    this.drawCapFront(enc, opaque, transparent, null);
    // (G11: with a see-through surface in view, three passes — the opaque scene kept multisampled; the see-through
    // surfaces into the accumulation and revealage, in any order; their composite, then the see-through lines and points
    // over it. Without one, one pass as before.)
    let oit = false;
    if (this.orderIndependent) for (const m of transparent) if (oitSurface(m)) { oit = true; break; }
    const pass = enc.beginRenderPass({
      colorAttachments: [{ view: targets.views.msaa ?? sceneView, resolveTarget: targets.msaa && !oit ? sceneView : undefined, clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: targets.msaa && !oit ? 'discard' : 'store' }],
      // (The depth is kept for ambient occlusion in the output pass; the background is put in there too.)
      depthStencilAttachment: { view: targets.views.depth, depthClearValue: 0, depthLoadOp: 'clear', depthStoreOp: 'store' },
    });
    pass.setBindGroup(0, this.frameGroup);
    const current: { pipeline?: Pipeline } = {};
    let tris = 0, lines = 0, points = 0;
    // Opaque surfaces and their caps, the grid (tested against them), then lines and transparent meshes over it.
    let opaqueDone = false, caps = 0;
    for (const list of [opaque, transparent]) for (const m of list) {
      // (In the order-independent frame the transparent list waits for its passes, but for shadow catchers: they darken the ground.)
      if (oit && list === transparent && !m.material.shadowOnly) continue;
      if (!opaqueDone && (m.geometry.topology !== 'triangles' || m.transparent)) { caps = this.drawCaps(pass, opaque, current, 'litCap'); if (this.grid.visible) this.drawGrid(pass, current); opaqueDone = true; }
      this.drawMesh(pass, m, current, false);
      if (m.geometry.topology !== 'triangles' && (m.material.lineHidden ?? 0) > 0 && !m.material.lineOver) this.drawHiddenLines(pass, m, current);
      if (m.geometry.topology === 'lines') lines += m.geometry.data.elementCount / 2; else if (m.geometry.topology === 'points') points += m.geometry.data.elementCount; else if (m.geometry.topology === 'triangles') tris += (m.geometry.data.elementCount / 3) * m.instanceCount;
    }
    if (!opaqueDone) { caps = this.drawCaps(pass, opaque, current, 'litCap'); if (this.grid.visible) this.drawGrid(pass, current); }
    pass.end();
    if (oit) {
      const o = this.ensureOit();
      const op = enc.beginRenderPass({
        colorAttachments: [
          { view: o.views.accumMs ?? o.views.accum, resolveTarget: o.accumMs ? o.views.accum : undefined, clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: o.accumMs ? 'discard' : 'store' },
          { view: o.views.revealMs ?? o.views.reveal, resolveTarget: o.revealMs ? o.views.reveal : undefined, clearValue: { r: 1, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: o.revealMs ? 'discard' : 'store' },
        ],
        depthStencilAttachment: { view: targets.views.depth, depthLoadOp: 'load', depthStoreOp: 'store' },
      });
      op.setBindGroup(0, this.frameGroup);
      const cur: { pipeline?: Pipeline } = {};
      this.oitDrawing = true;
      try { for (const m of transparent) if (oitSurface(m)) { this.drawMesh(op, m, cur, false); tris += (m.geometry.data.elementCount / 3) * m.instanceCount; } } finally { this.oitDrawing = false; }
      // (G19.4: the see-through meshes' caps, weighted in with their surfaces.)
      if (this.clip) for (const m of transparent) {
        if (!this.ghostCapped(m) || !m.geometry.gpu) continue;
        const p = this.pipelines.get('oitCap')!;
        if (cur.pipeline !== p) { op.setPipeline(p); cur.pipeline = p; }
        { dynamicOffset[0] = m.slot * OBJECT_STRIDE; op.setBindGroup(1, this.objectGroup, dynamicOffset, 0, 1); }
        this.drawTriangles(op, m, true);
        caps++;
      }
      op.end();
      const cp = enc.beginRenderPass({
        colorAttachments: [{ view: targets.views.msaa ?? sceneView, resolveTarget: targets.msaa ? sceneView : undefined, loadOp: 'load', storeOp: targets.msaa ? 'discard' : 'store' }],
        depthStencilAttachment: { view: targets.views.depth, depthLoadOp: 'load', depthStoreOp: 'store' },
      });
      cp.setPipeline(this.pipelines.get('oitComposite')!); cp.setBindGroup(0, o.group); cp.draw(3);
      cp.setBindGroup(0, this.frameGroup);
      const cc: { pipeline?: Pipeline } = {};
      for (const m of transparent) {
        if (m.geometry.topology === 'triangles') continue;
        this.drawMesh(cp, m, cc, false);
        if ((m.material.lineHidden ?? 0) > 0 && !m.material.lineOver) this.drawHiddenLines(cp, m, cc);
        if (m.geometry.topology === 'lines') lines += m.geometry.data.elementCount / 2; else if (m.geometry.topology === 'points') points += m.geometry.data.elementCount;
      }
      cp.end();
    }
    if (outlines.length) {
      // The outline mask: every opaque surface hides what is behind it; outlined meshes write their number.
      const mask = enc.beginRenderPass({
        colorAttachments: [{ view: targets.views.mask, clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' }],
        depthStencilAttachment: { view: targets.views.maskDepth, depthClearValue: 0, depthLoadOp: 'clear', depthStoreOp: 'discard' },
      });
      mask.setBindGroup(0, this.frameGroup);
      // (G13: only where the outline can be — the output reads the mask within that rectangle alone — so only the
      // meshes whose screen box meets it, scissored to it.)
      const W = this.canvas.width, H = this.canvas.height, a = outlineArea;
      if (a) {
        const x0 = Math.max(0, Math.floor(a[0])), y0 = Math.max(0, Math.floor(a[1])), x1 = Math.min(W, Math.ceil(a[2]) + 1), y1 = Math.min(H, Math.ceil(a[3]) + 1);
        if (x1 > x0 && y1 > y0) mask.setScissorRect(x0, y0, x1 - x0, y1 - y0);
      }
      const cur: { pipeline?: Pipeline } = {};
      for (const list of [opaque, transparent]) for (const m of list) {
        if (m.geometry.topology !== 'triangles' || (m.transparent && !m.outlineSlot)) continue;
        if (a && !m.outlineSlot && m.bounds && boxMissesRect(vp, m.bounds, a, W, H)) continue;
        this.drawMesh(mask, m, cur, 'mask');
      }
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
    Object.assign(this.stats, { frames: this.stats.frames + 1, drawCalls: opaque.length + transparent.length + caps, culled, triangles: tris, lines, points });
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
    c.clip(this.depthBounds());
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
    this.drawCapFront(enc, opaque, transparent, [px, py]);
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
    this.drawCaps(pass, transparent, current, 'capPick');
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
    const ray = this.camera.ray(ndcX, ndcY, this.aspect), c = this.capHit(ray.origin, ray.direction);
    const hit = this.meshRay(mesh, mesh.instances ? instance : null, ray.origin, ray.direction);
    // A cut-out can keep this mesh's front before its cap. Compare their parameters on the same pixel ray, as
    // raycast does: the nearer surface wins, a tie is the cap's. The GPU's float32 depth still supplies the point.
    const onCap = !!c && c.mesh === mesh && (c.instance ?? 0) === (mesh.instances ? instance : 0) && (!hit || c.t <= hit.t);
    const faces = mesh.geometry.data.faces, tri = !onCap && hit ? hit.triangle : null;
    return { mesh, point, triangle: tri, face: tri !== null && faces ? faces[tri] : null, instance: mesh.instances ? instance : null, depth, cap: onCap, ...(onCap ? { capPlane: c!.plane } : {}), ...this.scalarHit(mesh, mesh.instances ? instance : null, tri, point) };
  }

  /**
   * A world ray against a mesh (or one of its instances): the nearest hit in the clip planes' kept region (caps are
   * capHit's). Its parameter is the world ray's.
   */
  private meshRay(m: Mesh, instance: number | null, origin: Vec3, direction: Vec3): ClippedHit | null {
    const clip = this.clip && m.clipped ? this.clip : null;
    // (Cut open, a single-sided mesh without a cap shows no inside: the ray passes its back faces, as the draw culls them.)
    return clippedRay(m.geometry.data, this.instanceTransform(m, instance), origin, direction, clip, false, !clip || (this.probed(m) && !(m.pickTransparent ?? m.transparent)) || m.material.doubleSided === true);
  }
  /**
   * The cap a world ray meets (G19), as the probe and the cap pass draw it: where the ray comes into the clip planes'
   * kept region, when the first surface after that among the capped meshes (their faces unclipped, every instance) is a
   * back face — that mesh's (instance's) cap, on the plane it came in through; a back face wins a tie. Null: none.
   */
  private capHit(origin: Vec3, direction: Vec3): { mesh: Mesh; instance: number | null; t: number; plane: number } | null {
    if (!this.clip) return null;
    let first: { mesh: Mesh; instance: number | null; t: number; back: boolean; entry: number; plane: number } | null = null;
    for (const m of this.meshes) {
      if (!m.visible || m.geometry.disposed || !this.probed(m)) continue;
      for (let i = 0; i < m.instanceCount; i++) {
        const instance = m.instances ? i : null, r = clippedRayFull(m.geometry.data, this.instanceTransform(m, instance), origin, direction, this.clip, true, true);
        if (!r.beyond) continue;
        const b = r.beyond, tie = first ? Math.abs(b.t - first.t) <= 1e-9 * (1 + Math.abs(b.t)) : false;
        if (!first || (b.t < first.t && !tie) || (tie && b.back && !first.back)) first = { mesh: m, instance, t: b.t, back: b.back, entry: r.entry, plane: r.plane };
      }
    }
    // (A see-through mesh's cap is drawn, not picked — as its surface in the order-independent pass.)
    return first && first.back && !(first.mesh.pickTransparent ?? first.mesh.transparent) ? { mesh: first.mesh, instance: first.instance, t: first.entry, plane: first.plane } : null;
  }

  /** A hit's scalar (G6): the field at the point in the mesh's own space, when it has one and a triangle was hit. */
  private scalarHit(m: Mesh, instance: number | null, triangle: number | null, point: Vec3): { scalar?: number } {
    if (!m.geometry.data.scalars || triangle === null) return {};
    return { scalar: scalarAt(m.geometry.data, triangle, transformPoint(invert(this.instanceTransform(m, instance)), point)) };
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
    let best: { mesh: Mesh; triangle: number | null; t: number; instance: number | null; cap: boolean; plane?: number; leaf: number } | null = null;
    if (this.accelerate) {
      // (Through the scene tree: the leaves the ray enters, nearest entry first, until one starts past the best hit; the
      // nearest hit, ties to the earliest mesh and instance — the walk's answer.)
      const S = this.sceneTrees(), { leaves, ts, order } = this.rayLeaves(ray.origin, ray.direction, Infinity);
      for (const k of order) {
        if (best && ts[k] > best.t) break;
        const leaf = leaves[k], m = S.rayMesh[leaf];
        if (!m.visible || !m.pickable || m.geometry.disposed) continue;
        const instance = S.rayInstance[leaf] < 0 ? null : S.rayInstance[leaf], hit = this.meshRay(m, instance, ray.origin, ray.direction);
        if (hit && (!best || hit.t < best.t || (hit.t === best.t && leaf < best.leaf))) best = { mesh: m, triangle: hit.triangle, t: hit.t, instance, cap: hit.cap, plane: hit.plane, leaf };
      }
    } else for (const m of this.meshes) {
      if (!m.visible || !m.pickable || m.geometry.topology !== 'triangles' || m.geometry.disposed) continue;
      for (let i = 0; i < m.instanceCount; i++) {
        const instance = m.instances ? i : null, hit = this.meshRay(m, instance, ray.origin, ray.direction);
        if (hit && (!best || hit.t < best.t)) best = { mesh: m, triangle: hit.triangle, t: hit.t, instance, cap: hit.cap, plane: hit.plane, leaf: 0 };
      }
    }
    // (The cap the ray meets, when nearer: G19 — a tie is the cap's, as the cap pass is drawn after the surfaces.)
    const cap = this.capHit(ray.origin, ray.direction);
    if (cap && cap.mesh.pickable && (!best || cap.t <= best.t)) best = { mesh: cap.mesh, triangle: null, t: cap.t, instance: cap.instance, cap: true, plane: cap.plane, leaf: 0 };
    if (!best) return null;
    const point = add(ray.origin, scale(ray.direction, best.t)), faces = best.mesh.geometry.data.faces;
    const v = transformPoint(this.camera.viewProjection(this.aspect), point);
    return { mesh: best.mesh, point, triangle: best.triangle, face: best.triangle !== null && faces ? faces[best.triangle] : null, instance: best.instance, depth: v[2], cap: best.cap, ...(best.cap ? { capPlane: best.plane ?? 0 } : {}), ...this.scalarHit(best.mesh, best.instance, best.triangle, point) };
  }

  /**
   * The line segment drawn nearest a point of the canvas (CSS pixels), within radius pixels. Lines are
   * thin, so this is a screen-space search, not a pixel read. A segment whose nearest point a surface hides (an opaque
   * mesh more than about a pixel and a half in front of it along the eye's ray: what the depth test hides) is passed
   * over for the next nearest (G3); `throughSurfaces` finds it anyway. Only the parts of segments on the clip plane's
   * kept side are found, and only what the plane keeps hides them. Lines drawn over the scene (Material.lineOver) are
   * never hidden unless respectSurfaceDepth explicitly keeps surface occlusion for display-only wireframe lines.
   */
  pickLine(x: number, y: number, radius = 6, options: { throughSurfaces?: boolean; respectSurfaceDepth?: boolean } = {}): LineHit | null {
    this.alive();
    const cw = this.canvas.clientWidth || this.canvas.width, ch = this.canvas.clientHeight || this.canvas.height;
    this.clipCamera();
    const vp = this.camera.viewProjection(this.aspect);
    let best: LineHit | null = null;
    for (const m of this.markCandidates(vp, x, y, cw, ch, radius, 'lines')) {
      if (!m.visible || !m.pickable || m.geometry.topology !== 'lines' || m.geometry.disposed) continue;
      const M = multiply(vp, m.transform), g = m.geometry.data, P = g.positions, I = g.indices;
      // A mesh wholly in front of the eye whose box lands farther than the radius from the point: none of its segments can be nearer.
      if (g.bounds && screenBoxMisses(M, g.bounds, x, y, cw, ch, radius)) continue;
      // (Every segment, or for a large geometry those its segment boxes do not rule out: the same answer, ties to the lowest.)
      // (The clip plane in the mesh's own space: only the kept parts of its segments.)
      const plane = this.clip && m.clipped ? localPlane(m.transform, this.clip) : null;
      hiddenSegments.clear();
      for (let tries = 0; tries < MAX_HIDDEN_SEGMENTS; tries++) {
        const hit = nearestSegment(g, M, x, y, cw, ch, radius, best ? best.distance : Infinity, plane, hiddenSegments);
        if (!hit) break;
        const ia = I ? I[2 * hit.segment] : 2 * hit.segment, ib = I ? I[2 * hit.segment + 1] : 2 * hit.segment + 1;
        const A = transformPoint(m.transform, [P[3 * ia], P[3 * ia + 1], P[3 * ia + 2]]), B = transformPoint(m.transform, [P[3 * ib], P[3 * ib + 1], P[3 * ib + 2]]);
        const point = add(A, scale(sub(B, A), hit.s));
        // (Hidden: the next nearest of this mesh's segments, the hidden one left out.)
        if (!options.throughSurfaces && (options.respectSurfaceDepth || !m.material.lineOver) && this.hidden(point)) { hiddenSegments.add(hit.segment); continue; }
        best = { mesh: m, segment: hit.segment, edge: g.edges ? g.edges[hit.segment] : null, point, distance: hit.distance };
        break;
      }
    }
    return best;
  }

  /**
   * The point drawn nearest a position of the canvas (CSS pixels, G8): among the visible, pickable point meshes, the one
   * whose centre is nearest, within `radius` pixels past the point's own half size. As pickLine: a point an opaque surface
   * hides is passed over for the next nearest (unless `throughSurfaces`, or its material draws it over the scene), and only
   * points on the clip plane's kept side are found. A brute-force screen search a mesh, its box checked first.
   */
  pickPoint(x: number, y: number, radius = 6, options: { throughSurfaces?: boolean } = {}): PointHit | null {
    this.alive();
    const cw = this.canvas.clientWidth || this.canvas.width, ch = this.canvas.clientHeight || this.canvas.height;
    this.clipCamera();
    const vp = this.camera.viewProjection(this.aspect);
    let best: PointHit | null = null;
    let half = 0;
    if (this.accelerate) for (const m of this.sceneTrees().markMesh) if (m.geometry.topology === 'points' && m.material.pointSize! / 2 > half) half = m.material.pointSize! / 2;
    for (const m of this.markCandidates(vp, x, y, cw, ch, radius + half, 'points')) {
      if (!m.visible || !m.pickable || m.geometry.topology !== 'points' || m.geometry.disposed) continue;
      const M = multiply(vp, m.transform), g = m.geometry.data, P = g.positions, I = g.indices, reach = radius + m.material.pointSize! / 2;
      if (g.bounds && screenBoxMisses(M, g.bounds, x, y, cw, ch, reach)) continue;
      const plane = this.clip && m.clipped ? localPlane(m.transform, this.clip) : null;
      hiddenSegments.clear();
      for (let tries = 0; tries < MAX_HIDDEN_SEGMENTS; tries++) {
        const hit = nearestPoint(g, M, x, y, cw, ch, reach, best ? best.distance : Infinity, plane, hiddenSegments, this.accelerate);
        if (!hit) break;
        const a = I ? I[hit.index] : hit.index, point = transformPoint(m.transform, [P[3 * a], P[3 * a + 1], P[3 * a + 2]]);
        if (!options.throughSurfaces && !m.material.lineOver && this.hidden(point)) { hiddenSegments.add(hit.index); continue; }
        best = { mesh: m, index: hit.index, point, distance: hit.distance };
        break;
      }
    }
    return best;
  }

  /**
   * The line or point meshes whose box lands within `reach` pixels of (x, y), in the order they were added (G9: through the
   * scene tree; without acceleration, every mesh) — the per-mesh search then runs on these as before.
   */
  private markCandidates(vp: Mat4, x: number, y: number, cw: number, ch: number, reach: number, _kind: 'lines' | 'points'): readonly Mesh[] {
    if (!this.accelerate) return this.meshes;
    const S = this.sceneTrees(), n = sceneNear(S.marks, vp, x, y, cw, ch, reach, candLeaves);
    candLeaves.length = n; candLeaves.sort(ascending);
    markOut.length = 0; for (let k = 0; k < n; k++) markOut.push(S.markMesh[candLeaves[k]]);
    return markOut;
  }

  /**
   * Whether an opaque surface hides a world point (G3): the eye's ray to it hits a visible, opaque triangle mesh (its
   * instances, the clip plane's kept side and caps) more than about a pixel and a half before it — lines are drawn over the
   * surface they lie on, and slightly behind it they still show, as the depth test's bias lets them.
   */
  private hidden(p: Vec3): boolean {
    const v = transformPoint(this.camera.viewProjection(this.aspect), p), ray = this.camera.ray(v[0], v[1], this.aspect);
    const d = ray.direction, dd = dot(d, d), t = dot(sub(p, ray.origin), d) / dd;
    // (A pixel in world units at the point's depth, over the ray's length: the slack, in the ray's parameter.)
    const c = this.camera, h = this.canvas.clientHeight || this.canvas.height;
    const pixel = (c.projection === 'perspective' ? 2 * Math.tan((c.fovY * Math.PI) / 360) * Math.sqrt(dd) * t : 2 * c.halfHeight) / Math.max(1, h);
    const before = t - (1.5 * pixel) / Math.sqrt(dd);
    // (A cap in front of it hides it too, G19.)
    const cap = this.capHit(ray.origin, d);
    if (cap && cap.t < before) return true;
    if (this.accelerate) {
      const S = this.sceneTrees(), { leaves } = this.rayLeaves(ray.origin, d, before);
      for (let k = 0; k < leaves.length; k++) {
        const leaf = leaves[k], m = S.rayMesh[leaf];
        if (!m.visible || (m.pickTransparent ?? m.transparent) || m.geometry.disposed) continue;
        const hit = this.meshRay(m, S.rayInstance[leaf] < 0 ? null : S.rayInstance[leaf], ray.origin, d);
        if (hit && hit.t < before) return true;
      }
      return false;
    }
    for (const m of this.meshes) {
      if (!m.visible || (m.pickTransparent ?? m.transparent) || m.geometry.topology !== 'triangles' || m.geometry.disposed) continue;
      for (let i = 0; i < m.instanceCount; i++) {
        const hit = this.meshRay(m, m.instances ? i : null, ray.origin, d);
        if (hit && hit.t < before) return true;
      }
    }
    return false;
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
    for (const m of this.meshes) { m.instances?.buffer?.destroy(); m.materialState?.params.destroy(); m.mapState?.params.destroy(); m.mapState?.texture.destroy(); }
    this.geometries.clear(); this.meshes = [];
    this.targets?.msaa?.destroy(); this.targets?.scene.destroy(); this.targets?.depth.destroy();
    if (this.pickTargets) { this.pickTargets.id.destroy(); this.pickTargets.z.destroy(); this.pickTargets.instance.destroy(); this.pickTargets.depth.destroy(); this.pickTargets.read.destroy(); }
    this.frameBuffer?.destroy(); this.objectBuffer?.destroy(); this.outputBuffer?.destroy(); this.shadowFrameBuffer?.destroy();
    this.targets?.mask.destroy(); this.targets?.maskDepth.destroy(); this.targets?.capFront.destroy(); this.targets?.capFrontSamples?.destroy(); this.emptyFront?.destroy(); this.emptyFrontSamples?.destroy(); this.lightProbe?.destroy();
    this.shadowMap?.destroy(); this.emptyShadow?.destroy(); this.identityInstance?.destroy(); this.white?.texture.destroy(); this.zeroParams?.destroy();
    for (const t of this.textures) t.dispose();
    this.textures.clear();
    this.context?.unconfigure();
    this.device?.destroy();
    for (const f of this.waiters.splice(0)) f();
  }
}

/** A box cut by a clip plane along an axis (dot(n, p) ≥ offset, n ±x, ±y or ±z); null when it is wholly cut away; as it is for another plane. */
/** A box cut by the clip planes that are axis-aligned (each of `planes`, else the one); the others leave it. A cut-out leaves it (G20). */
export function clipBox(b: Box3 | null, c: { normal: ArrayLike<number>; offset: number; planes?: readonly { normal: ArrayLike<number>; offset: number }[]; cutout?: boolean }): Box3 | null {
  if (!b) return b;
  const min = [b.min[0], b.min[1], b.min[2]], max = [b.max[0], b.max[1], b.max[2]], list = c.planes ?? [c];
  // (A cut-out, G20: the box itself — a corner taken off leaves its extent — or none when the removed corner holds all of
  // it: every corner of the box on every plane's cut-away side, R convex.)
  if (c.cutout) {
    for (let i = 0; i < 8; i++) {
      const x = i & 1 ? max[0] : min[0], y = i & 2 ? max[1] : min[1], z = i & 4 ? max[2] : min[2];
      if (list.some(p => p.normal[0] * x + p.normal[1] * y + p.normal[2] * z >= p.offset)) return b;
    }
    return null;
  }
  let cut = false;
  for (let i = 0; i < list.length; i++) {
    const n = list[i].normal, k = Math.abs(n[0]) === 1 ? 0 : Math.abs(n[1]) === 1 ? 1 : Math.abs(n[2]) === 1 ? 2 : -1;
    if (k < 0) continue;
    cut = true;
    if (n[k] > 0) min[k] = Math.max(min[k], list[i].offset); else max[k] = Math.min(max[k], -list[i].offset);
    if (min[k] > max[k]) return null;
  }
  // (No axis plane: the box itself.)
  return cut ? { min: min as unknown as Vec3, max: max as unknown as Vec3 } : b;
}

 /** The segments of a mesh found hidden during one line pick (kept from pick to pick), and how many are tried. */
const hiddenSegments = new Set<number>();
/** A label's colour (sRGB, 0–1, three or four numbers) as linear RGBA8 in one word (G15). */
function packLabelColor(c: readonly number[] | undefined, alpha: number): number {
  const r = c ?? [1, 1, 1], a = Math.max(0, Math.min(1, (c && c.length > 3 ? c[3] : 1) * alpha));
  const byte = (v: number) => Math.max(0, Math.min(255, Math.round(srgbToLinear(v) * 255)));
  return (byte(r[0]) | (byte(r[1]) << 8) | (byte(r[2]) << 16) | (Math.round(a * 255) << 24)) >>> 0;
}
/** A label of the public API (colours as Color) as the layout reads it (sRGB numbers). */
function labelInput(l: TextLabel): LabelInput {
  const bg = l.background;
  return {
    text: l.text, at: l.at, size: l.size, align: l.align, offset: l.offset, plane: l.plane ?? null,
    color: l.color === undefined ? undefined : [...parseColor(l.color)],
    background: bg ? { color: [...parseColor(bg.color)], opacity: bg.opacity, padding: bg.padding, radius: bg.radius, border: bg.border ? [...parseColor(bg.border)] : null } : null,
  };
}
/** Whether a box wholly in front of the eye lands on screen (device pixels, w × h) clear of a rectangle (x0, y0, x1, y1). */
function boxMissesRect(m: ArrayLike<number>, b: Box3, r: readonly number[], w: number, h: number): boolean {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < 8; i++) {
    const x = i & 1 ? b.max[0] : b.min[0], y = i & 2 ? b.max[1] : b.min[1], z = i & 4 ? b.max[2] : b.min[2];
    const cw = m[3] * x + m[7] * y + m[11] * z + m[15]; if (!(cw > 1e-9)) return false;
    const sx = ((m[0] * x + m[4] * y + m[8] * z + m[12]) / cw * 0.5 + 0.5) * w, sy = (0.5 - (m[1] * x + m[5] * y + m[9] * z + m[13]) / cw * 0.5) * h;
    if (sx < x0) x0 = sx; if (sx > x1) x1 = sx; if (sy < y0) y0 = sy; if (sy > y1) y1 = sy;
  }
  return x1 < r[0] || x0 > r[2] || y1 < r[1] || y0 > r[3];
}
// (G13: scratch kept across frames — the object block's normal matrix, its 32-bit words, a draw's dynamic offset.)
const packNormal = new Float64Array(16), dynamicOffset = new Uint32Array(1), frameBlock = new Float32Array(FRAME_BYTES / 4), frameViewport = [1, 1, 1, 0];
const packViews = new WeakMap<ArrayBuffer, Uint32Array>();
const packWords = (f: Float32Array): Uint32Array => { let u = packViews.get(f.buffer as ArrayBuffer); if (!u) { u = new Uint32Array(f.buffer); packViews.set(f.buffer as ArrayBuffer, u); } return u; };
// (The scene trees' candidates, reused a pick: leaves, where a ray enters them, their order by entry; G9.)
const candLeaves: number[] = [], candTs: number[] = [], candOrder: number[] = [], markOut: Mesh[] = [];
const byEntry = (a: number, b: number): number => candTs[a] - candTs[b] || candLeaves[a] - candLeaves[b];
const ascending = (a: number, b: number): number => a - b;
/** Whether a box wholly in front of the eye lands on screen farther than `reach` pixels from a point (CSS): nothing in it can be nearer. */
function screenBoxMisses(M: ArrayLike<number>, bx: Box3, x: number, y: number, cw: number, ch: number, reach: number): boolean {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let c = 0; c < 8; c++) {
    const px = c & 1 ? bx.max[0] : bx.min[0], py = c & 2 ? bx.max[1] : bx.min[1], pz = c & 4 ? bx.max[2] : bx.min[2];
    const w = M[3] * px + M[7] * py + M[11] * pz + M[15]; if (w < 1e-6) return false;
    const sxp = ((M[0] * px + M[4] * py + M[8] * pz + M[12]) / w * 0.5 + 0.5) * cw, syp = (0.5 - (M[1] * px + M[5] * py + M[9] * pz + M[13]) / w * 0.5) * ch;
    x0 = Math.min(x0, sxp); x1 = Math.max(x1, sxp); y0 = Math.min(y0, syp); y1 = Math.max(y1, syp);
  }
  return x < x0 - reach || x > x1 + reach || y < y0 - reach || y > y1 + reach;
}
const MAX_HIDDEN_SEGMENTS = 16;

export const createViewer = (canvas: HTMLCanvasElement, options?: ViewerOptions): Promise<Viewer> => Viewer.create(canvas, options);
