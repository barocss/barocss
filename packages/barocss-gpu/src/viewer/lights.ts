// Lights and the frame block they are packed into with the camera (see Frame in shaders.ts).
import type { Camera } from './camera.js';
import { normalize, srgbToLinear, sub, type Mat4, type Vec3 } from './math.js';
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
}

export function parseColor(c: Color | undefined, fallback: Vec3 = [1, 1, 1]): Vec3 {
  if (c === undefined) return fallback;
  if (typeof c !== 'string') return c;
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c.trim());
  if (!m) throw new RangeError(`Not a hex colour: ${c}`);
  const h = m[1].length === 3 ? m[1].split('').map(x => x + x).join('') : m[1];
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255) as unknown as Vec3;
}
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

export function packFrame(viewProjection: Mat4, camera: Camera, lights: readonly Light[], env: Environment, shadow: ShadowFrame | null = null): Float32Array {
  const f = new Float32Array(FRAME_BYTES / 4), u = new Uint32Array(f.buffer);
  f.set(viewProjection, 0);
  const forward = normalize(sub(camera.target, camera.position));
  f.set([...camera.position, camera.projection === 'perspective' ? 1 : 0], 16);
  f.set([...forward, 0], 20);
  const amb = env.ambient ?? 0.3;
  f.set([...linear(parseColor(env.sky, [0.85, 0.9, 1])), amb], 24);
  f.set([...linear(parseColor(env.ground, [0.45, 0.42, 0.4])), amb], 28);
  f.set([...normalize(camera.up), 0], 32);
  const dirs = directionalLights(lights);
  const points = lights.filter((l): l is PointLight => l.kind === 'point').slice(0, MAX_POINT);
  const spots = lights.filter((l): l is SpotLight => l.kind === 'spot').slice(0, MAX_SPOT);
  const caster = shadow ? dirs.findIndex(l => l.castShadow) : -1;
  u.set([dirs.length, points.length, spots.length, caster + 1], 36);
  let o = 40;
  dirs.forEach((l, i) => { f.set([...normalize(l.direction), 0, ...linear(parseColor(l.color)), l.intensity ?? 1], o + i * 8); });
  o += MAX_DIRECTIONAL * 8;
  points.forEach((l, i) => { f.set([...l.position, l.range ?? 0, ...linear(parseColor(l.color)), l.intensity ?? 1], o + i * 8); });
  o += MAX_POINT * 8;
  spots.forEach((l, i) => {
    const outer = ((l.angle ?? 30) * Math.PI) / 180, inner = outer * (1 - Math.min(1, Math.max(0, l.penumbra ?? 0.2)));
    f.set([...l.position, l.range ?? 0, ...normalize(l.direction), 0, ...linear(parseColor(l.color)), l.intensity ?? 1, Math.max(Math.cos(inner), Math.cos(outer) + 1e-4), Math.cos(outer), 0, 0], o + i * 16);
  });
  o += MAX_SPOT * 16;
  if (shadow && caster >= 0) { f.set(shadow.viewProjection, o); f.set([shadow.normalOffset, shadow.texel, shadow.bias, 0], o + 16); }
  return f;
}

/** The output block (see Output in shaders.ts): outline colours are sRGB, the width in device pixels. */
export function packOutput(env: Environment, outlines: readonly Vec3[] = [], outlineWidth = 2): ArrayBuffer {
  const b = new ArrayBuffer(OUTPUT_BYTES), f = new Float32Array(b), u = new Uint32Array(b);
  f[0] = env.exposure ?? 1;
  u[1] = env.toneMapping === 'aces' ? 1 : 0;
  f[2] = outlineWidth;
  u[3] = Math.min(outlines.length, MAX_OUTLINES);
  outlines.slice(0, MAX_OUTLINES).forEach((c, i) => f.set([...c, 1], 4 + i * 4));
  return b;
}
