// Lights and the frame block they are packed into with the camera (see Frame in shaders.ts).
import type { Camera } from './camera.js';
import { invert, normalize, srgbToLinear, sub, type Mat4, type Vec3 } from './math.js';
import { FRAME_BYTES, MAX_DIRECTIONAL, MAX_OUTLINES, MAX_POINT, MAX_SPOT, OUTPUT_BYTES } from './shaders.js';

/** sRGB colour, 0–1 per channel, or a CSS hex string. */
export type Color = Vec3 | string;
export interface DirectionalLight { kind: 'directional'; direction: Vec3; color?: Color; intensity?: number; /** Casts shadows (the first such light does). */ castShadow?: boolean }
export interface PointLight { kind: 'point'; position: Vec3; color?: Color; intensity?: number; /** Zero: no cut-off. */ range?: number }
export interface SpotLight { kind: 'spot'; position: Vec3; direction: Vec3; color?: Color; intensity?: number; range?: number; /** Degrees from the axis. */ angle?: number; /** 0–1: share of the cone that fades. */ penumbra?: number }
export type Light = DirectionalLight | PointLight | SpotLight;
export interface Environment {
  /** Hemisphere ambient: sky above the up axis, ground below. */
  sky?: Color; ground?: Color; ambient?: number;
  exposure?: number;
  toneMapping?: 'none' | 'aces';
  /** Screen-space ambient occlusion: radius in world units (default a twelfth of the scene's), strength 0–2. */
  ambientOcclusion?: { radius?: number; strength?: number } | false;
  /**
   * Image-based lighting: an equirectangular environment (Viewer.createTexture, with mipmaps; Z up — its
   * top row overhead) lighting the surfaces in place of the sky and ground: diffuse from its most blurred
   * level round the normal, reflections from the mirrored view direction, blurred with roughness.
   */
  map?: { readonly width: number; readonly height: number } | null;
  /** The environment's brightness (default 1). */
  mapIntensity?: number;
}

export function parseColor(c: Color | undefined, fallback: Vec3 = [1, 1, 1]): Vec3 {
  if (c === undefined) return fallback;
  if (typeof c !== 'string') return c;
  // (Frames ask for the lights' and environment's colours every time: each string is read once; a copy is
  // handed out.)
  let v = parsed.get(c);
  if (!v) {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c.trim());
    if (!m) throw new RangeError(`Not a hex colour: ${c}`);
    const h = m[1].length === 3 ? m[1].split('').map(x => x + x).join('') : m[1];
    v = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255) as unknown as Vec3;
    if (parsed.size >= 256) parsed.clear();
    parsed.set(c, v);
  }
  return [v[0], v[1], v[2]];
}
const parsed = new Map<string, Vec3>();
/** Writes x, y, z, w at o. */
const put4 = (f: Float32Array, o: number, x: number, y: number, z: number, w: number) => { f[o] = x; f[o + 1] = y; f[o + 2] = z; f[o + 3] = w; };
export const linear = (c: Vec3): Vec3 => [srgbToLinear(c[0]), srgbToLinear(c[1]), srgbToLinear(c[2])];

/** The default rig: a key and a fill light from above and a soft hemisphere (Z up). */
export const defaultLights = (): Light[] => [
  { kind: 'directional', direction: [-0.4, 0.6, -1], intensity: 1.1 },
  { kind: 'directional', direction: [0.6, -0.3, -0.4], intensity: 0.35 },
];

/** The shadow of the casting light: its view-projection, normal offset (world), texel size (uv) and depth bias. */
export interface ShadowFrame { viewProjection: Mat4; normalOffset: number; texel: number; bias: number }

/** The directional lights the frame lights with (the shadow index refers to this list). */
export const directionalLights = (lights: readonly Light[]): DirectionalLight[] => lights.filter((l): l is DirectionalLight => l.kind === 'directional').slice(0, MAX_DIRECTIONAL);

/** The ground grid as drawn this frame: cell size, cells per major line, fade distance, height; colour (sRGB) and opacity. */
export interface GridFrame { cell: number; major: number; fade: number; height: number; color: Vec3; opacity: number }

export function packFrame(viewProjection: Mat4, camera: Camera, lights: readonly Light[], env: Environment, shadow: ShadowFrame | null = null, viewport: readonly [number, number, number] = [1, 1, 1], grid: GridFrame | null = null): Float32Array {
  const f = new Float32Array(FRAME_BYTES / 4), u = new Uint32Array(f.buffer);
  f.set(viewProjection, 0);
  const forward = normalize(sub(camera.target, camera.position));
  const eye = camera.position; put4(f, 16, eye[0], eye[1], eye[2], camera.projection === 'perspective' ? 1 : 0);
  // (forward.w: the environment map's last mip level; up.w: its intensity, 0 without one.)
  const envLevels = env.map ? Math.floor(Math.log2(Math.max(env.map.width, env.map.height))) : 0;
  put4(f, 20, forward[0], forward[1], forward[2], envLevels);
  const amb = env.ambient ?? 0.3, sky = linear(parseColor(env.sky, [0.85, 0.9, 1])), ground = linear(parseColor(env.ground, [0.45, 0.42, 0.4])), up = normalize(camera.up);
  put4(f, 24, sky[0], sky[1], sky[2], amb);
  put4(f, 28, ground[0], ground[1], ground[2], amb);
  put4(f, 32, up[0], up[1], up[2], env.map ? env.mapIntensity ?? 1 : 0);
  const dirs = directionalLights(lights), points: PointLight[] = [], spots: SpotLight[] = [];
  for (const l of lights) { if (l.kind === 'point' && points.length < MAX_POINT) points.push(l); else if (l.kind === 'spot' && spots.length < MAX_SPOT) spots.push(l); }
  let caster = -1;
  if (shadow) for (let i = 0; i < dirs.length && caster < 0; i++) if (dirs[i].castShadow) caster = i;
  u[36] = dirs.length; u[37] = points.length; u[38] = spots.length; u[39] = caster + 1;
  let o = 40;
  for (let i = 0; i < dirs.length; i++) {
    const l = dirs[i], d = normalize(l.direction), c = linear(parseColor(l.color));
    put4(f, o + i * 8, d[0], d[1], d[2], 0); put4(f, o + i * 8 + 4, c[0], c[1], c[2], l.intensity ?? 1);
  }
  o += MAX_DIRECTIONAL * 8;
  for (let i = 0; i < points.length; i++) {
    const l = points[i], c = linear(parseColor(l.color));
    put4(f, o + i * 8, l.position[0], l.position[1], l.position[2], l.range ?? 0); put4(f, o + i * 8 + 4, c[0], c[1], c[2], l.intensity ?? 1);
  }
  o += MAX_POINT * 8;
  for (let i = 0; i < spots.length; i++) {
    const l = spots[i], outer = ((l.angle ?? 30) * Math.PI) / 180, inner = outer * (1 - Math.min(1, Math.max(0, l.penumbra ?? 0.2)));
    const d = normalize(l.direction), c = linear(parseColor(l.color)), at = o + i * 16;
    put4(f, at, l.position[0], l.position[1], l.position[2], l.range ?? 0); put4(f, at + 4, d[0], d[1], d[2], 0);
    put4(f, at + 8, c[0], c[1], c[2], l.intensity ?? 1); put4(f, at + 12, Math.max(Math.cos(inner), Math.cos(outer) + 1e-4), Math.cos(outer), 0, 0);
  }
  o += MAX_SPOT * 16;
  if (shadow && caster >= 0) { f.set(shadow.viewProjection, o); put4(f, o + 16, shadow.normalOffset, shadow.texel, shadow.bias, 0); }
  put4(f, o + 20, viewport[0], viewport[1], viewport[2], 0);
  if (grid) {
    f.set(invert(viewProjection), o + 24);
    const c = linear(grid.color);
    put4(f, o + 40, grid.cell, grid.major, grid.fade, grid.height); put4(f, o + 44, c[0], c[1], c[2], grid.opacity);
  }
  return f;
}

/** A vertical gradient (sRGB) behind the scene; null: transparent. */
export type Background = { top: Vec3; bottom: Vec3 } | null;
/** What the ambient occlusion needs of the camera: the inverse projection and pixels per world unit. */
export interface OcclusionFrame { inverseProjection: Mat4; radius: number; pixelsPerUnit: number; perspective: boolean }

/** The output block (see Output in shaders.ts): outline colours are sRGB, the width in device pixels. */
export function packOutput(env: Environment, outlines: readonly Vec3[] = [], outlineWidth = 2, background: Background = null, ao: OcclusionFrame | null = null): ArrayBuffer {
  const b = new ArrayBuffer(OUTPUT_BYTES), f = new Float32Array(b), u = new Uint32Array(b);
  f[0] = env.exposure ?? 1;
  u[1] = env.toneMapping === 'aces' ? 1 : 0;
  f[2] = outlineWidth;
  u[3] = Math.min(outlines.length, MAX_OUTLINES);
  outlines.slice(0, MAX_OUTLINES).forEach((c, i) => f.set([...c, 1], 4 + i * 4));
  const o = 4 + MAX_OUTLINES * 4;
  if (background) { f.set([...background.top, 1], o); f.set([...background.bottom, 1], o + 4); }
  if (ao && env.ambientOcclusion) {
    f.set(ao.inverseProjection, o + 8);
    f.set([ao.radius, env.ambientOcclusion.strength ?? 1, ao.pixelsPerUnit, ao.perspective ? 1 : -1], o + 24);
  }
  return b;
}
