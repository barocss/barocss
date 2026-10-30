// Frozen CPU data for the progressive still renderer. Source triangle ids survive the BVH reorder.
import { packBvh, type PackedBvh } from '../compute/bvhPack.js';
import { linear, parseColor } from './lights.js';
import { identity, invert, multiply, normalize, transformPoint, type Vec3 } from './math.js';
import { SURFACE_FINISHES, type ImageTexture, type Mesh } from './scene.js';
import { ViewerError } from './viewer-error.js';
import { RenderTargetTexture } from './render-target.js';

export interface TraceScene { bvh: PackedBvh; attributes: Float32Array; materials: Float32Array; maps: ImageTexture[]; dataMaps: ImageTexture[] }
/** Only visible, bounded triangle surfaces are exported; grid, labels, lines and overlays stay in the raster view. */
export function traceScene(meshes: readonly Mesh[]): TraceScene {
  const positions: number[] = [], attributes: number[] = [], materials: number[] = [], maps: ImageTexture[] = [], dataMaps: ImageTexture[] = [];
  const layer = (map: ImageTexture | null | undefined) => { if (!map) return 0; if (map.disposed) throw new ViewerError('TEXTURE_INVALID', 'A path tracing texture was disposed'); let i = maps.indexOf(map); if (i < 0) { i = maps.length; maps.push(map); } return i + 1; };
  const dataLayer = (map: ImageTexture | null | undefined) => {
    if (!map) return 0;
    if (map.disposed || map.options.srgb !== false) throw new ViewerError('TEXTURE_INVALID', 'Path tracing data maps must be live linear textures');
    let i = dataMaps.indexOf(map); if (i < 0) { i = dataMaps.length; dataMaps.push(map); } return i + 1;
  };
  const flags = (map: ImageTexture | null | undefined) => (map?.options.wrap === 'repeat' ? 1 : 0) + (map?.options.filter === 'nearest' ? 2 : 0);
  for (const mesh of meshes) {
    if (!mesh.visible || !mesh.bounded || mesh.geometry.disposed || mesh.geometry.topology !== 'triangles' || mesh.material.colorWrite === false || mesh.material.shadowOnly) continue;
    const m = mesh.material, g = mesh.geometry.data;
    if (m.map instanceof RenderTargetTexture) throw new ViewerError('PATH_TRACE_UNSUPPORTED', 'Path tracing cannot sample a render target');
    if (m.shader || mesh.colorMap || g.contour) throw new ViewerError('PATH_TRACE_UNSUPPORTED', 'Path tracing needs triangle surfaces without custom shaders, scalar maps, contours');
    const material = materials.length / 48, color = linear(parseColor(m.color));
    // The exact G15a object frame (instance transforms affect geometry, not the finish frame).
    materials.push(...mesh.transform, ...color, m.opacity ?? 1, m.metallic ?? 0, m.roughness ?? 0.5, m.emissive ?? 0, m.unlit ? 1 : 0);
    const f = m.finish;
    materials.push(f ? SURFACE_FINISHES.indexOf(f.kind) + 1 : 0, f?.scale ?? 1, f?.strength ?? 0.5, m.clearcoat ?? 0,
      ...(f?.axis ?? [0, 0, 1]), m.clearcoatRoughness ?? 0.08, ...(f?.origin ?? [0, 0, 0]), m.film ?? 0,
      layer(m.map), m.doubleSided ? 1 : 0, m.alphaCutoff ?? 0, (m.map?.options.wrap === 'repeat' ? 1 : 0) + (m.map?.options.filter === 'nearest' ? 2 : 0));
    const normalScale = m.normalScale ?? [1, 1];
    materials.push(dataLayer(m.normalMap), dataLayer(m.roughnessMap), dataLayer(m.metallicMap),
      flags(m.normalMap) | (flags(m.roughnessMap) << 2) | (flags(m.metallicMap) << 4), normalScale[0], normalScale[1], 0, 0);
    const copies = mesh.instances?.matrices ?? [identity()], colors = mesh.instances ? new Uint8Array(mesh.instances.data) : null;
    for (let instance = 0; instance < copies.length; instance++) {
      const model = multiply(mesh.transform, copies[instance]), inv = invert(model);
      const normal = (i: number): Vec3 => normalize([inv[0] * g.normals[i] + inv[1] * g.normals[i + 1] + inv[2] * g.normals[i + 2], inv[4] * g.normals[i] + inv[5] * g.normals[i + 1] + inv[6] * g.normals[i + 2], inv[8] * g.normals[i] + inv[9] * g.normals[i + 1] + inv[10] * g.normals[i + 2]]);
      for (let t = 0; t < g.elementCount; t += 3) {
        const ids = [0, 1, 2].map(k => g.indices ? g.indices[t + k] : t + k);
        for (const v of ids) {
          const p = transformPoint(model, [g.positions[v * 3], g.positions[v * 3 + 1], g.positions[v * 3 + 2]]);
          if (!p.every(Number.isFinite) || p.some(x => !Number.isFinite(Math.fround(x)))) throw new ViewerError('GEOMETRY_INVALID', 'Path tracing positions must fit finite f32');
          positions.push(...p);
          attributes.push(...normal(v * 3), material);
        }
        for (const v of ids) for (let k = 0; k < 4; k++) attributes.push(g.colors[v * 4 + k] / 255 * (colors ? colors[instance * 68 + 64 + k] / 255 : 1));
        attributes.push(...ids.flatMap(v => [g.uvs?.[v * 2] ?? 0, g.uvs?.[v * 2 + 1] ?? 0]), 0, 0);
      }
    }
  }
  if (!positions.length) throw new ViewerError('PATH_TRACE_UNSUPPORTED', 'No visible bounded triangle surfaces to path trace');
  const p = Float64Array.from(positions), indices = Uint32Array.from({ length: p.length / 3 }, (_, i) => i);
  return { bvh: packBvh({ positions: p, indices }), attributes: Float32Array.from(attributes), materials: Float32Array.from(materials), maps, dataMaps };
}

/** Convert each image to identical atlas dimensions, preserving its declared colour space. */
export function traceMapPixels(map: ImageTexture, width: number, height: number): Uint8Array {
  const source = map.source;
  const canvas = new OffscreenCanvas(width, height), ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = map.options.filter !== 'nearest';
  if ('data' in source) {
    const original = new OffscreenCanvas(source.width, source.height), c = original.getContext('2d')!;
    c.putImageData(new ImageData(new Uint8ClampedArray(source.data), source.width, source.height), 0, 0);
    ctx.drawImage(original, 0, 0, width, height);
  } else ctx.drawImage(source, 0, 0, width, height);
  const bytes = new Uint8Array(ctx.getImageData(0, 0, width, height).data);
  if (!map.options.srgb) for (let i = 0; i < bytes.length; i++) if (i % 4 !== 3) { const v = bytes[i] / 255; bytes[i] = Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055)); }
  return bytes;
}

/** Raw linear data in its own atlas: no colour transfer, including maps also used as colour textures. */
export function traceDataMapPixels(map: ImageTexture, width: number, height: number): Uint8Array {
  const source = map.source, sourceWidth = map.width, sourceHeight = map.height;
  let pixels: Uint8Array | Uint8ClampedArray;
  if ('data' in source) pixels = source.data;
  else {
    const canvas = new OffscreenCanvas(sourceWidth, sourceHeight), ctx = canvas.getContext('2d')!;
    ctx.drawImage(source, 0, 0, sourceWidth, sourceHeight);
    pixels = ctx.getImageData(0, 0, sourceWidth, sourceHeight).data;
  }
  if (width === sourceWidth && height === sourceHeight) return Uint8Array.from(pixels);
  const bytes = new Uint8Array(width * height * 4), nearest = map.options.filter === 'nearest', repeat = map.options.wrap === 'repeat';
  const address = (value: number, size: number) => repeat ? (value % size + size) % size : Math.max(0, Math.min(size - 1, value));
  const at = (x: number, y: number, channel: number) => pixels[(address(y, sourceHeight) * sourceWidth + address(x, sourceWidth)) * 4 + channel];
  // Resample raw channels independently; canvas compositing would discard data RGB under alpha zero.
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sx = (x + 0.5) * sourceWidth / width - 0.5, sy = (y + 0.5) * sourceHeight / height - 0.5;
    const x0 = Math.floor(sx), y0 = Math.floor(sy), tx = sx - x0, ty = sy - y0;
    for (let channel = 0; channel < 4; channel++) {
      const top = at(x0, y0, channel) * (1 - tx) + at(x0 + 1, y0, channel) * tx;
      const bottom = at(x0, y0 + 1, channel) * (1 - tx) + at(x0 + 1, y0 + 1, channel) * tx;
      bytes[(y * width + x) * 4 + channel] = nearest ? at(Math.floor(sx + 0.5), Math.floor(sy + 0.5), channel) : Math.round(top * (1 - ty) + bottom * ty);
    }
  }
  return bytes;
}

export function traceSize(width: number, height: number, limit: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > limit || height > limit) throw new ViewerError('SIZE_INVALID', 'Path tracing dimensions must be positive integers within the device limit');
}
