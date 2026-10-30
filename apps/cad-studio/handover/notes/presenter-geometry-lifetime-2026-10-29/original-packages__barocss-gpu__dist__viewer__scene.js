// The viewer's scene objects (R2c: moved out of viewer.ts as they were, viewer.ts the facade): materials and their
// options, image textures, geometry kept on the CPU and its GPU buffers, meshes and their object blocks.
import { ViewerError } from './viewer-error.js';
import { transformBox, unionBox } from './bounds.js';
import { prepareScalars, segmentInstances, vertexColors, fillVertexColors } from './geometry.js';
import { BufferUsage } from './gpu.js';
import { linear, parseColor } from './lights.js';
import { identity, multiply, normalMatrixInto, srgbToLinear } from './math.js';
export { ViewerError } from './viewer-error.js';
/** The finish kinds in the order the shader numbers them from 1. */
export const SURFACE_FINISHES = ['cast', 'sand-cast', 'machined', 'turned', 'brushed', 'knurled', 'blasted'];
/** A texture the viewer keeps (with its source, to upload again after a device loss). */
export class ImageTexture {
    source;
    options;
    owner;
    /** @internal (`lighting`: as an environment, its prefiltered reflections and diffuse light — G15b.) */
    gpu = null;
    disposed = false;
    constructor(source, options, owner) {
        this.source = source;
        this.options = options;
        this.owner = owner;
    }
    get width() { return this.source.width; }
    get height() { return this.source.height; }
    dispose() { this.disposed = true; this.gpu?.texture.destroy(); this.gpu?.lighting?.specular.destroy(); this.gpu?.lighting?.irradiance.destroy(); this.gpu = null; this.owner.requestRender(); }
}
/** A colour map as the GPU takes it: its ramp's 256 sRGB texels and its 16 parameters (range, bands, missing, below, above). */
export function packColorMap(map) {
    const stops = map.stops.map(([v, c]) => [v, linear(parseColor(c))]);
    if (stops.length < 2 || stops.some(([v], i) => !Number.isFinite(v) || (i > 0 && !(v > stops[i - 1][0]))))
        throw new ViewerError('COLOR_MAP_INVALID', 'A colour map needs two or more stops at rising finite values');
    const lo = stops[0][0], hi = stops[stops.length - 1][0], ramp = new Uint8Array(256 * 4), encode = (x) => Math.round(Math.min(1, Math.max(0, x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055)) * 255);
    for (let i = 0; i < 256; i++) {
        const v = lo + ((hi - lo) * i) / 255;
        let k = 0;
        while (k < stops.length - 2 && v > stops[k + 1][0])
            k++;
        const [va, ca] = stops[k], [vb, cb] = stops[k + 1], t = Math.min(1, Math.max(0, (v - va) / (vb - va)));
        for (let c = 0; c < 3; c++)
            ramp[4 * i + c] = encode(ca[c] + (cb[c] - ca[c]) * t);
        ramp[4 * i + 3] = 255;
    }
    const params = new Float32Array(16), bands = map.bands && map.bands >= 2 ? Math.floor(map.bands) : 0;
    params.set([lo, hi, bands, 0], 0);
    params.set([...linear(parseColor(map.missing, [0.5, 0.5, 0.5])), 1], 4);
    if (map.below)
        params.set([...linear(parseColor(map.below)), 1], 8);
    if (map.above)
        params.set([...linear(parseColor(map.above)), 1], 12);
    return { ramp, params };
}
/** Bytes per instance: a 4×4 transform and an RGBA8 colour (see Instance in shaders.ts). */
/** @internal (R2c: used by the viewer too.) */
export const INSTANCE_STRIDE = 68;
/** @internal (R2c: used by the viewer too.) */
export function packInstances(input) {
    const t = input.transforms, count = t.length / 16;
    if (!Number.isInteger(count) || count < 1)
        throw new ViewerError('INSTANCES_INVALID', 'instances.transforms must hold 16 numbers per instance');
    const data = new ArrayBuffer(count * INSTANCE_STRIDE), f = new DataView(data), matrices = [];
    const k = input.colors ? (input.colors.length === count * 4 ? 4 : input.colors.length === count * 3 ? 3 : 0) : 0;
    if (input.colors && !k)
        throw new ViewerError('INSTANCES_INVALID', 'instances.colors must hold three or four numbers per instance');
    for (let i = 0; i < count; i++) {
        const m = Float64Array.from({ length: 16 }, (_, j) => t[i * 16 + j]);
        matrices.push(m);
        for (let j = 0; j < 16; j++)
            f.setFloat32(i * INSTANCE_STRIDE + j * 4, m[j], true);
        for (let j = 0; j < 4; j++) {
            const c = input.colors ? (j < 3 ? srgbToLinear(Math.min(1, Math.max(0, input.colors[i * k + j]))) : k === 4 ? input.colors[i * k + 3] : 1) : 1;
            f.setUint8(i * INSTANCE_STRIDE + 64 + j, Math.round(Math.min(1, Math.max(0, c)) * 255));
        }
    }
    return { count, data, matrices };
}
export class Geometry {
    data;
    owner;
    /** @internal Triangles: positions, normals, colours, indices. Lines: positions holds the segment instances. */
    /** `ownUVs` false: `uvs` is the viewer's shared zero buffer (the geometry has none; G13). */
    gpu = null;
    disposed = false;
    constructor(data, owner) {
        this.data = data;
        this.owner = owner;
    }
    get topology() { return this.data.topology; }
    get bounds() { return this.data.bounds; }
    /** Replace the vertex colours (sRGB, three or four per vertex): per-face highlights, say. */
    setColors(colors) {
        if (this.data.contour)
            throw new ViewerError('GEOMETRY_INVALID', 'A contour has no vertex colours');
        this.data.colors = vertexColors(colors ?? undefined, this.data.vertexCount);
        if (this.gpu?.colors)
            this.gpu.device.queue.writeBuffer(this.gpu.colors, 0, this.data.colors);
        else if (this.gpu)
            this.gpu.device.queue.writeBuffer(this.gpu.positions, 0, new Uint8Array(segmentInstances(this.data)));
        this.owner.requestRender();
    }
    /**
     * One colour (sRGB, three or four numbers) on vertices `first` … `first + count − 1` of a triangle geometry, and only
     * that range sent to the GPU: a face's highlight changed without re-sending the rest of the colours.
     */
    fillColors(first, count, color) {
        if (this.data.topology !== 'triangles')
            throw new ViewerError('GEOMETRY_INVALID', 'Only triangle geometry has a colour range');
        fillVertexColors(this.data.colors, first, count, color);
        if (this.gpu?.colors && count)
            this.gpu.device.queue.writeBuffer(this.gpu.colors, 4 * first, this.data.colors, 4 * first, 4 * count);
        this.owner.requestRender();
    }
    /** Replace the texture coordinates (two per vertex) of a triangle geometry: a colour map's placement. */
    setUVs(uvs) {
        if (this.data.topology !== 'triangles')
            throw new ViewerError('GEOMETRY_INVALID', 'Only triangle geometry has texture coordinates');
        if (uvs.length !== this.data.vertexCount * 2)
            throw new ViewerError('GEOMETRY_INVALID', 'uvs must hold two numbers per vertex');
        this.data.uvs = Float32Array.from(uvs);
        // (Drawn with the shared zeros until now: its own buffer from here.)
        if (this.gpu && !this.gpu.ownUVs) {
            this.gpu.uvs = this.gpu.device.createBuffer({ size: Math.max(4, this.data.uvs.byteLength), usage: BufferUsage.VERTEX | BufferUsage.COPY_DST, label: 'uvs' });
            this.gpu.ownUVs = true;
        }
        if (this.gpu?.uvs)
            this.gpu.device.queue.writeBuffer(this.gpu.uvs, 0, this.data.uvs);
        this.owner.requestRender();
    }
    /**
     * A scalar field for a colour map (G6): one value per vertex (interpolated) or per triangle (drawn flat), NaN where there
     * is none; null removes it. Meshes with a colour map show it (Mesh.colorMap); picks read it (PickHit.scalar).
     */
    setScalars(values, per = 'vertex') {
        this.data.scalars = values ? prepareScalars(this.data, values, per) : null;
        this.releaseScalars();
        this.owner.requestRender();
    }
    /** @internal The field's GPU buffers (made on first draw, and again after a device loss or a new field). */
    scalarGpu = null;
    /** @internal */ releaseScalars() {
        const s = this.scalarGpu;
        if (!s)
            return;
        s.positions?.destroy();
        s.normals?.destroy();
        s.values.destroy();
        this.scalarGpu = null;
    }
    /** Release the GPU buffers (meshes using it stop drawing). */
    dispose() { this.disposed = true; this.release(); this.owner.forget(this); this.owner.requestRender(); }
    /** @internal */ release() {
        this.releaseScalars();
        if (!this.gpu)
            return;
        this.gpu.positions.destroy();
        this.gpu.normals?.destroy();
        this.gpu.colors?.destroy();
        if (this.gpu.ownUVs)
            this.gpu.uvs?.destroy();
        this.gpu.indices?.destroy();
        this.gpu = null;
    }
}
export class Mesh {
    geometry;
    owner;
    /** Picking opacity classification, independent of display-only fades; null follows the material. */
    pickTransparent = null;
    /** @internal */ slot = -1;
    /** @internal */ dirty = true;
    worldBox;
    _transform = identity();
    _material;
    _params = null;
    _visible;
    pickable;
    name;
    castShadow;
    /** Counted in the scene's bounds (AddMeshOptions.bounded). */
    bounded;
    _receiveShadow;
    _outline = null;
    _clipped;
    /** Filled where the clip plane cuts it (a closed solid; AddMeshOptions.cap). */
    cap;
    _capColor = null;
    _capHatch = null;
    _colorMap = null;
    /** @internal A colour map's bind group (its ramp and parameters), for the device and map it was made for. */
    mapState = null;
    /** @internal Instances: their count, packed data, transforms, and the GPU buffer (null: not uploaded). */
    instances = null;
    /** @internal Which outline colour of the frame (1-based; 0 none). */
    outlineSlot = 0;
    /** @internal A shader material's bind group (its map and its own parameters), for the device and inputs it was made for. */
    materialState = null;
    /** @internal Its frame cost record while the viewer counts (Viewer.costs, O10), made when first drawn counting. */
    cost = null;
    /** Pick id (1-based; 0 is empty space). */
    id;
    constructor(geometry, owner, id, options) {
        this.geometry = geometry;
        this.owner = owner;
        this.id = id;
        const material = materialOf(options.material);
        this.checkMaterialMaps(material);
        this._material = material;
        this._visible = options.visible ?? true;
        this.pickable = options.pickable ?? true;
        this.castShadow = options.castShadow ?? true;
        this.bounded = options.bounded ?? true;
        this._receiveShadow = options.receiveShadow ?? true;
        this._clipped = options.clipped ?? true;
        this.cap = options.cap ?? false;
        if (options.capColor)
            this._capColor = parseColor(options.capColor);
        if (options.capHatch)
            this._capHatch = hatchOf(options.capHatch);
        this.name = options.name;
        if (options.transform)
            this.transform = options.transform;
        if (options.instances)
            this.setInstances(options.instances);
    }
    /** Copies of the mesh, each with its own transform (after the mesh's) and colour; null: a single mesh. */
    setInstances(input) {
        if (input && this.geometry.topology !== 'triangles')
            throw new ViewerError('INSTANCES_INVALID', 'Only triangle meshes can be instanced');
        const next = input ? { ...packInstances(input), buffer: null, device: null } : null;
        this.instances?.buffer?.destroy();
        this.instances = next;
        this.worldBox = undefined;
        this.owner.sceneMoved();
        this.owner.requestRender();
    }
    get instanceCount() { return this.instances?.count ?? 1; }
    get transform() { return this._transform; }
    set transform(m) {
        if (m.length !== 16)
            throw new ViewerError('TRANSFORM_INVALID', 'A transform has 16 numbers (column-major)');
        this._transform = Float64Array.from(m);
        this.worldBox = undefined;
        this.owner.sceneMoved();
        this.touch();
    }
    get material() { return this._material; }
    set material(m) {
        const next = materialOf({ ...this._material, ...m });
        this.checkMaterialMaps(next);
        this._material = next;
        this._params = null;
        this.touch();
    }
    checkMaterialMaps(m) {
        if (!hasDataMaps(m))
            return;
        if (this.geometry.topology !== 'triangles')
            throw new ViewerError('MATERIAL_INVALID', 'Material data maps need triangle surfaces');
        if (this._colorMap)
            throw new ViewerError('MATERIAL_INVALID', 'Material data maps cannot use the scalar-field colour map pass');
    }
    /**
     * @internal The 64 bytes of a shader material's parameters: the same array while they stay the same (they
     * are read every frame, so a params array changed in place is still seen), a new one when they change.
     */
    shaderParams() {
        const p = this._material.shader?.params, have = this._params;
        if (have) {
            let same = !p || p.length <= 16;
            for (let i = 0; same && i < 16; i++)
                same = have[i] === Math.fround(p && i < p.length ? p[i] : 0);
            if (same)
                return have;
        }
        const out = new Float32Array(16);
        if (p) {
            if (p.length > 16)
                throw new ViewerError('MATERIAL_INVALID', 'A shader material has at most 16 params');
            for (let i = 0; i < p.length; i++)
                out[i] = p[i];
        }
        return this._params = out;
    }
    get visible() { return this._visible; }
    set visible(v) { this._visible = v; this.owner.requestRender(); }
    get transparent() { return this._material.colorWrite && (this._material.opacity < 1 || this._material.shadowOnly); }
    /**
     * Its cap's colour (sRGB), times its material colour — as a face of it in that colour would be lit — or null: the clip
     * plane's own cap colour (G2b).
     */
    get capColor() { return this._capColor; }
    set capColor(c) {
        const next = c === null ? null : parseColor(c), had = this._capColor;
        if (next === had || (next && had && next[0] === had[0] && next[1] === had[1] && next[2] === had[2]))
            return;
        this._capColor = next;
        this.touch();
    }
    /**
     * Hatch lines on its cap (G19.3), or null: lines 1 CSS pixel wide in its cap's colour × 0.45, `spacing` world units
     * apart, at `angle` degrees in the cap plane from its u axis toward its v (capHatchAxes) — fixed in the world, so a
     * part's cap keeps its hatch as the camera moves and parts at different angles read apart.
     */
    get capHatch() { return this._capHatch; }
    set capHatch(h) {
        const next = h ? hatchOf(h) : null, had = this._capHatch;
        if (next === had || (next && had && next.angle === had.angle && next.spacing === had.spacing))
            return;
        this._capHatch = next;
        this.touch();
    }
    /**
     * A colour map of its geometry's scalar field (G6; Geometry.setScalars) in place of its material's colour, lit as the
     * surface (flat when unlit), or null for the material again. Without a field the material shows.
     */
    get colorMap() { return this._colorMap; }
    set colorMap(map) {
        if (map && hasDataMaps(this._material))
            throw new ViewerError('MATERIAL_INVALID', 'Scalar-field colour maps cannot use UV material data maps');
        this._colorMap = map ? { ...map, packed: packColorMap(map) } : null;
        this.owner.requestRender();
    }
    /** @internal Whether it draws its colour map: one set, a field on its triangles, opaque. */
    get mapped() { return !!this._colorMap && !!this.geometry.data.scalars && this.geometry.topology === 'triangles' && !this.transparent; }
    /** @internal */ get packedMap() { return this._colorMap?.packed ?? null; }
    /** Cut by the viewer's clip plane (when one is set). */
    get clipped() { return this._clipped; }
    set clipped(v) { if (v !== this._clipped) {
        this._clipped = v;
        this.touch();
    } }
    get receiveShadow() { return this._receiveShadow; }
    set receiveShadow(v) { this._receiveShadow = v; this.touch(); }
    /** A selection outline around the visible part of the mesh (sRGB colour), or null. */
    get outline() { return this._outline; }
    set outline(c) { this._outline = c === null ? null : parseColor(c); this.owner.requestRender(); }
    /** The world box of the mesh (its geometry box through its transform). */
    get bounds() {
        if (this.worldBox === undefined) {
            const g = this.geometry.bounds;
            this.worldBox = !g ? null : this.instances ? this.instances.matrices.reduce((b, m) => unionBox(b, transformBox(multiply(this._transform, m), g)), null) : transformBox(this._transform, g);
        }
        return this.worldBox;
    }
    remove() { this.owner.remove(this); }
    touch() { this.dirty = true; this.owner.requestRender(); }
    /** @internal The object block (see Object in shaders.ts); lines carry their width in device pixels. */
    pack(into, at, pixelRatio) {
        const f = into, m = this._material, o = at / 4;
        // (G13: written in place — a scratch normal matrix, the colour by its parts.)
        f.set(this._transform, o);
        f.set(normalMatrixInto(packNormal, this._transform), o + 16);
        f[o + 32] = srgbToLinear(m.color[0]);
        f[o + 33] = srgbToLinear(m.color[1]);
        f[o + 34] = srgbToLinear(m.color[2]);
        f[o + 35] = m.opacity;
        if (this.geometry.topology === 'lines') {
            f[o + 36] = m.lineWidth * pixelRatio;
            f[o + 37] = (m.lineDash?.[0] ?? 0) * pixelRatio;
            f[o + 38] = (m.lineDash?.[1] ?? 0) * pixelRatio;
            f[o + 39] = m.lineHidden;
        }
        else if (this.geometry.topology === 'labels') {
            f[o + 36] = 0;
            f[o + 37] = 0;
            f[o + 38] = 0;
            f[o + 39] = m.lineHidden;
        }
        else if (this.geometry.topology === 'points') {
            f[o + 36] = m.pointSize * pixelRatio;
            f[o + 37] = (m.pointBorder?.width ?? 0) * pixelRatio;
            f[o + 38] = m.pointShape === 'square' ? 0 : 1;
            f[o + 39] = m.lineHidden;
        }
        else {
            f[o + 36] = m.metallic;
            f[o + 37] = m.roughness;
            f[o + 38] = m.emissive;
            f[o + 39] = m.unlit ? 1 : 0;
        }
        const u = packWords(f);
        u[o + 40] = this.id;
        u[o + 41] = this.outlineSlot;
        u[o + 42] = (this._receiveShadow ? 1 : 0) | (this._clipped ? 2 : 0) | (((this.slot % 65535) + 1) << 16);
        u[o + 43] = Math.round(m.alphaCutoff * 1000);
        // (A point's border colour where a surface's cap colour goes.)
        const capOrBorder = this.geometry.topology === 'points' ? m.pointBorder?.color ?? null : this._capColor;
        if (capOrBorder) {
            const c = linear(capOrBorder);
            f[o + 44] = c[0];
            f[o + 45] = c[1];
            f[o + 46] = c[2];
            f[o + 47] = 1;
        }
        else
            f.fill(0, o + 44, o + 48);
        const h = this._capHatch;
        if (this.geometry.topology === 'lines') {
            const hiddenDash = m.lineHiddenDash === undefined ? m.lineDash : m.lineHiddenDash;
            f[o + 48] = (hiddenDash?.[0] ?? 0) * pixelRatio;
            f[o + 49] = (hiddenDash?.[1] ?? 0) * pixelRatio;
            f[o + 50] = 0;
            f[o + 51] = 0;
        }
        else if (h) {
            const a = (h.angle * Math.PI) / 180;
            f[o + 48] = Math.cos(a);
            f[o + 49] = Math.sin(a);
            f[o + 50] = h.spacing;
            f[o + 51] = 1;
        }
        else
            f.fill(0, o + 48, o + 52);
        // (G15a: the finish — kind from 1, scale, strength, clearcoat; axis and the coat's roughness; origin and the oil film.
        // Surfaces only; zeros otherwise.)
        const fin = m.finish, surface = this.geometry.topology === 'triangles';
        if (surface && (fin || m.clearcoat > 0 || m.film > 0)) {
            f[o + 52] = fin ? SURFACE_FINISHES.indexOf(fin.kind) + 1 : 0;
            f[o + 53] = fin?.scale ?? 1;
            f[o + 54] = fin?.strength ?? 0;
            f[o + 55] = m.clearcoat;
            const ax = fin?.axis ?? [0, 0, 1], og = fin?.origin ?? [0, 0, 0];
            f[o + 56] = ax[0];
            f[o + 57] = ax[1];
            f[o + 58] = ax[2];
            f[o + 59] = m.clearcoatRoughness;
            f[o + 60] = og[0];
            f[o + 61] = og[1];
            f[o + 62] = og[2];
            f[o + 63] = m.film;
        }
        else
            f.fill(0, o + 52, o + 64);
    }
}
/** @internal (R2c: used by the viewer too.) */
export function hatchOf(h) {
    return Number.isFinite(h.angle) && Number.isFinite(h.spacing) && h.spacing > 0 ? { angle: h.angle, spacing: h.spacing } : null;
}
/** @internal (R2c: used by the viewer too.) */
export function materialOf(m = {}) {
    const hiddenDash = m.lineHiddenDash;
    const normalMap = dataMapOf(m.normalMap), roughnessMap = dataMapOf(m.roughnessMap), metallicMap = dataMapOf(m.metallicMap);
    const scale = m.normalScale === undefined ? [1, 1] : m.normalScale;
    if (!scale || scale.length !== 2 || ![scale[0], scale[1]].every(v => typeof v === 'number' && Number.isFinite(v) && Number.isFinite(Math.fround(v))))
        throw new ViewerError('MATERIAL_INVALID', 'normalScale needs exactly two finite f32 numbers');
    return {
        normalMap, roughnessMap, metallicMap, normalScale: [scale[0], scale[1]],
        color: parseColor(m.color, m.shadowOnly ? [0, 0, 0] : [0.8, 0.8, 0.8]), opacity: Math.min(1, Math.max(0, m.opacity ?? 1)),
        colorWrite: m.colorWrite ?? true, lineHiddenDash: hiddenDash === undefined ? undefined : hiddenDash && hiddenDash[0] > 0 && hiddenDash[1] > 0 ? [hiddenDash[0], hiddenDash[1]] : null,
        metallic: m.metallic ?? 0, roughness: m.roughness ?? 0.55, emissive: m.emissive ?? 0, unlit: m.unlit ?? false, doubleSided: m.doubleSided ?? false, lineWidth: m.lineWidth ?? 1, lineDash: m.lineDash && m.lineDash[0] > 0 && m.lineDash[1] > 0 ? [m.lineDash[0], m.lineDash[1]] : null, lineOver: m.lineOver ?? false, lineHidden: Math.min(1, Math.max(0, m.lineHidden ?? 0)), decal: m.decal ?? false,
        pointSize: Math.max(0, m.pointSize ?? 4), pointShape: m.pointShape ?? 'circle', pointBorder: m.pointBorder && m.pointBorder.width > 0 ? { width: m.pointBorder.width, color: parseColor(m.pointBorder.color, [1, 1, 1]) } : null, shadowOnly: m.shadowOnly ?? false, map: m.map ?? null, shader: m.shader ?? null, alphaCutoff: Math.min(1, Math.max(0, m.alphaCutoff ?? 0)),
        finish: finishOf(m.finish), clearcoat: unit(m.clearcoat), clearcoatRoughness: Math.min(1, Math.max(0.02, m.clearcoatRoughness ?? 0.08)), film: unit(m.film),
    };
}
function dataMapOf(map) {
    if (map == null)
        return null;
    if (!(map instanceof ImageTexture) || map.disposed || map.options?.srgb !== false)
        throw new ViewerError('TEXTURE_INVALID', 'A material data map needs a live ImageTexture with srgb:false');
    return map;
}
const hasDataMaps = (m) => !!(m.normalMap || m.roughnessMap || m.metallicMap);
const unit = (v) => Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
/** A finish as packed: known kind, positive scale, strength 0–1, a unit axis (Z when none or zero). */
function finishOf(f) {
    if (!f || !SURFACE_FINISHES.includes(f.kind))
        return null;
    const a = f.axis ?? [0, 0, 1], l = Math.hypot(a[0], a[1], a[2]);
    return { kind: f.kind, scale: Number.isFinite(f.scale) && f.scale > 0 ? f.scale : 1, strength: f.strength === undefined ? 0.5 : unit(f.strength),
        axis: l > 1e-12 && Number.isFinite(l) ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 1], origin: f.origin && f.origin.every(Number.isFinite) ? [f.origin[0], f.origin[1], f.origin[2]] : [0, 0, 0] };
}
// (G13: scratch kept across frames — the object block's normal matrix and its 32-bit words.)
const packNormal = new Float64Array(16);
const packViews = new WeakMap();
const packWords = (f) => { let u = packViews.get(f.buffer); if (!u) {
    u = new Uint32Array(f.buffer);
    packViews.set(f.buffer, u);
} return u; };
