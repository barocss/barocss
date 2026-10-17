// How a part is rendered (the Render workspace), kept in the document beside the model: an appearance
// per body, lights, the environment and a saved camera. Colours are sRGB hex; directions point the way
// light travels (world, Z up).

export type Hex = `#${string}`;
export interface Appearance {
  color: Hex; metallic: number; roughness: number; opacity: number;
  /** A material of the settings by name: its authored shader colours the surface (times the colour). */
  shader?: string;
  /** Both sides of each face lit (open or thin shells seen from inside); one side by default. */
  twoSided?: boolean;
  /** A colour map (an image, as a data URL) multiplied into the colour, box-projected: one repeat every `scale` mm. */
  texture?: { image: string; scale: number };
  /** Alpha cutout: where the texture's alpha is below this (0 – 1) nothing is drawn (holes, leaves, grilles). */
  cutout?: number;
}
export type RenderLight =
  | { kind: 'directional'; direction: [number, number, number]; color: Hex; intensity: number; castShadow: boolean }
  | { kind: 'point'; position: [number, number, number]; color: Hex; intensity: number; range: number }
  | { kind: 'spot'; position: [number, number, number]; direction: [number, number, number]; color: Hex; intensity: number; range: number; angle: number; penumbra: number };
export interface RenderEnvironment {
  top: Hex; bottom: Hex;
  /** Hemisphere ambient strength. */
  ambient: number;
  exposure: number;
  toneMapping: 'none' | 'aces';
  occlusion: boolean;
  /** A shadow catcher under the part. */
  ground: boolean;
  grid: boolean;
  edges: boolean;
  /** Image-based lighting: an equirectangular environment image (a data URL; its top row overhead) lighting the part, and its brightness. */
  map?: { image: string; intensity: number };
}
export interface RenderCamera { target: [number, number, number]; distance: number; yaw: number; pitch: number; fovY: number; ortho: boolean }
export interface RenderSettings {
  version: 1;
  /** By body key (BodyResult.key); bodies without one use the default. */
  appearances: Record<string, Appearance>;
  defaultAppearance: Appearance;
  lights: RenderLight[];
  environment: RenderEnvironment;
  camera: RenderCamera | null;
  /** Authored @shader materials by name. */
  materials: Record<string, string>;
  /** Props: a CSS-shaped scene source (Y up) placed in the part's Z-up world, sceneScale mm to its unit. */
  scene: string;
  sceneScale: number;
  animation: RenderAnimation;
}

/** Keyframed body moves (linear between keys, held before the first and after the last) and a turntable. */
export interface RenderKey { t: number; offset: [number, number, number] }
export interface RenderAnimation {
  /** Seconds. */
  duration: number;
  /** By body key, keys in time order. */
  tracks: Record<string, RenderKey[]>;
  /** One camera turn about the target over the duration. */
  turntable: boolean;
}

/** Each animated body's offset at a time. */
export function offsetsAt(a: RenderAnimation, t: number): Map<string, [number, number, number]> {
  const out = new Map<string, [number, number, number]>();
  for (const [key, keys] of Object.entries(a.tracks)) {
    if (!keys.length) continue;
    if (t <= keys[0].t) { out.set(key, keys[0].offset); continue; }
    const last = keys[keys.length - 1];
    if (t >= last.t) { out.set(key, last.offset); continue; }
    const i = keys.findIndex(k => k.t > t), a0 = keys[i - 1], a1 = keys[i], k = (t - a0.t) / (a1.t - a0.t || 1);
    out.set(key, [0, 1, 2].map(j => a0.offset[j] + (a1.offset[j] - a0.offset[j]) * k) as [number, number, number]);
  }
  return out;
}
/** A track with a key set at a time (replacing a key at the same time). */
export function withKey(keys: readonly RenderKey[], key: RenderKey): RenderKey[] {
  return [...keys.filter(k => Math.abs(k.t - key.t) > 1e-6), key].sort((a, b) => a.t - b.t);
}

/** A material to start from: a mix of two colours by a uniform. */
export const MATERIAL_TEMPLATE = '@shader #paint {\n  @uniform amount: float(0, 1, .35);\n  @fragment { color: mix(#d0643c, #3c78b4, amount); }\n}\n';
/** Props to start from: a plinth under the part (Y up: its Z turns to −Y in the part's world). */
export const SCENE_TEMPLATE = '@scene props {\n  version: 0;\n  box #plinth;\n}\n#plinth { size: 9 .4 6; translate: 3.2 -.25 -1.6; color: #6d727a; }\n';

/** Appearance presets: the look of common materials. */
export const APPEARANCES: readonly { id: string; label: string; appearance: Appearance }[] = [
  { id: 'aluminium', label: 'Aluminium', appearance: { color: '#c9ccd1', metallic: 1, roughness: 0.35, opacity: 1 } },
  { id: 'steel', label: 'Steel', appearance: { color: '#a7abb1', metallic: 1, roughness: 0.25, opacity: 1 } },
  { id: 'brass', label: 'Brass', appearance: { color: '#d6b25a', metallic: 1, roughness: 0.3, opacity: 1 } },
  { id: 'copper', label: 'Copper', appearance: { color: '#d48a63', metallic: 1, roughness: 0.3, opacity: 1 } },
  { id: 'plastic-white', label: 'White plastic', appearance: { color: '#eceae6', metallic: 0, roughness: 0.45, opacity: 1 } },
  { id: 'plastic-black', label: 'Black plastic', appearance: { color: '#26272a', metallic: 0, roughness: 0.5, opacity: 1 } },
  { id: 'rubber', label: 'Rubber', appearance: { color: '#3a3b3d', metallic: 0, roughness: 0.9, opacity: 1 } },
  { id: 'glass', label: 'Glass', appearance: { color: '#cfe6ee', metallic: 0, roughness: 0.05, opacity: 0.35 } },
  { id: 'clay', label: 'Clay', appearance: { color: '#bfc2c8', metallic: 0, roughness: 0.7, opacity: 1 } },
];

export const defaultRender = (): RenderSettings => ({
  version: 1,
  appearances: {},
  defaultAppearance: { color: '#bfc2c8', metallic: 0, roughness: 0.6, opacity: 1 },
  lights: [
    { kind: 'directional', direction: [-0.45, 0.35, -1], color: '#ffffff', intensity: 1.15, castShadow: true },
    { kind: 'directional', direction: [0.7, -0.5, -0.35], color: '#dfe8ff', intensity: 0.4, castShadow: false },
  ],
  environment: { top: '#3a3f47', bottom: '#15171a', ambient: 0.6, exposure: 1, toneMapping: 'aces', occlusion: true, ground: true, grid: false, edges: false },
  camera: null,
  materials: {},
  scene: '',
  sceneScale: 10,
  animation: { duration: 4, tracks: {}, turntable: false },
});

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const num = (v: unknown, lo: number, hi: number, fallback: number) => typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
const hex = (v: unknown, fallback: Hex): Hex => typeof v === 'string' && HEX.test(v) ? v as Hex : fallback;
const vec = (v: unknown, fallback: [number, number, number]): [number, number, number] =>
  Array.isArray(v) && v.length === 3 && v.every(x => typeof x === 'number' && Number.isFinite(x)) ? [v[0], v[1], v[2]] : fallback;
const obj = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};

export function readAppearance(v: unknown, fallback: Appearance): Appearance {
  const o = obj(v);
  return { color: hex(o.color, fallback.color), metallic: num(o.metallic, 0, 1, fallback.metallic), roughness: num(o.roughness, 0, 1, fallback.roughness), opacity: num(o.opacity, 0.05, 1, fallback.opacity),
    ...(typeof o.shader === 'string' && o.shader ? { shader: o.shader } : {}), ...(o.twoSided === true ? { twoSided: true } : {}),
    ...(typeof o.cutout === 'number' && o.cutout > 0 ? { cutout: num(o.cutout, 0, 1, 0) } : {}),
    ...(typeof obj(o.texture).image === 'string' && /^data:image\//.test(obj(o.texture).image as string) ? { texture: { image: obj(o.texture).image as string, scale: num(obj(o.texture).scale, 0.1, 10000, 20) } } : {}) };
}

/** Render settings from a saved document (anything missing or out of range takes the default). */
export function readRender(v: unknown): RenderSettings {
  const d = defaultRender(), o = obj(v);
  if (!v) return d;
  const env = obj(o.environment), cam = o.camera ? obj(o.camera) : null;
  const lights = Array.isArray(o.lights) ? o.lights.slice(0, 12).flatMap((l): RenderLight[] => {
    const x = obj(l), color = hex(x.color, '#ffffff'), intensity = num(x.intensity, 0, 100, 1);
    if (x.kind === 'directional') return [{ kind: 'directional', direction: vec(x.direction, [0, 0, -1]), color, intensity, castShadow: x.castShadow === true }];
    if (x.kind === 'point') return [{ kind: 'point', position: vec(x.position, [0, 0, 100]), color, intensity, range: num(x.range, 0, 1e6, 0) }];
    if (x.kind === 'spot') return [{ kind: 'spot', position: vec(x.position, [0, 0, 100]), direction: vec(x.direction, [0, 0, -1]), color, intensity, range: num(x.range, 0, 1e6, 0), angle: num(x.angle, 1, 89, 30), penumbra: num(x.penumbra, 0, 1, 0.2) }];
    return [];
  }) : d.lights;
  const def = readAppearance(o.defaultAppearance, d.defaultAppearance);
  const appearances: Record<string, Appearance> = {};
  for (const [k, a] of Object.entries(obj(o.appearances))) appearances[k] = readAppearance(a, def);
  return {
    version: 1, appearances, defaultAppearance: def, lights,
    environment: {
      top: hex(env.top, d.environment.top), bottom: hex(env.bottom, d.environment.bottom),
      ambient: num(env.ambient, 0, 4, d.environment.ambient), exposure: num(env.exposure, 0.05, 8, d.environment.exposure),
      toneMapping: env.toneMapping === 'none' ? 'none' : 'aces',
      occlusion: env.occlusion !== false, ground: env.ground !== false, grid: env.grid === true, edges: env.edges === true,
      ...(typeof obj(env.map).image === 'string' && /^data:image\//.test(obj(env.map).image as string) ? { map: { image: obj(env.map).image as string, intensity: num(obj(env.map).intensity, 0, 8, 1) } } : {}),
    },
    materials: Object.fromEntries(Object.entries(obj(o.materials)).filter((e): e is [string, string] => typeof e[1] === 'string' && e[1].length <= 65536).slice(0, 32)),
    scene: typeof o.scene === 'string' && o.scene.length <= 65536 ? o.scene : '',
    sceneScale: num(o.sceneScale, 1e-3, 1e4, 10),
    animation: (() => {
      const a = obj(o.animation), duration = num(a.duration, 0.1, 600, 4), tracks: Record<string, RenderKey[]> = {};
      for (const [k, keys] of Object.entries(obj(a.tracks))) {
        if (!Array.isArray(keys)) continue;
        tracks[k] = keys.slice(0, 256).map(x => obj(x)).filter(x => typeof x.t === 'number' && Number.isFinite(x.t))
          .map(x => ({ t: num(x.t, 0, duration, 0), offset: vec(x.offset, [0, 0, 0]) })).sort((p, q) => p.t - q.t);
      }
      return { duration, tracks, turntable: a.turntable === true };
    })(),
    camera: cam ? { target: vec(cam.target, [0, 0, 0]), distance: num(cam.distance, 1e-3, 1e6, 160), yaw: num(cam.yaw, -1e3, 1e3, 0), pitch: num(cam.pitch, -1.57, 1.57, 0.4), fovY: num(cam.fovY, 0.05, 2.5, 0.56), ortho: cam.ortho === true } : null,
  };
}

/** A body's appearance. */
export const appearanceOf = (r: RenderSettings, key: string): Appearance => r.appearances[key] ?? r.defaultAppearance;

/** Light travelling from an azimuth (degrees about Z from +X) and elevation (degrees above the XY plane). */
export function directionFrom(azimuth: number, elevation: number): [number, number, number] {
  const a = (azimuth * Math.PI) / 180, e = (elevation * Math.PI) / 180;
  return [-Math.cos(e) * Math.cos(a), -Math.cos(e) * Math.sin(a), -Math.sin(e)];
}
/** The azimuth and elevation a light comes from. */
export function anglesOf(d: readonly [number, number, number]): [number, number] {
  const l = Math.hypot(d[0], d[1], d[2]) || 1;
  return [Math.round((Math.atan2(-d[1], -d[0]) * 180) / Math.PI), Math.round((Math.asin(Math.max(-1, Math.min(1, -d[2] / l))) * 180) / Math.PI)];
}

/**
 * Box-projected texture coordinates of a mesh: each vertex mapped on the plane across its normal's
 * largest component (X: Y and Z, Y: X and Z, Z: X and Y), one repeat every `scale` mm.
 */
export function tiledUVs(positions: ArrayLike<number>, normals: ArrayLike<number>, scale: number): Float32Array {
  const n = positions.length / 3, out = new Float32Array(n * 2), s = 1 / Math.max(1e-6, scale);
  for (let v = 0; v < n; v++) {
    const ax = Math.abs(normals[3 * v]), ay = Math.abs(normals[3 * v + 1]), az = Math.abs(normals[3 * v + 2]);
    const [a, b] = ax >= ay && ax >= az ? [1, 2] : ay >= az ? [0, 2] : [0, 1];
    out[2 * v] = positions[3 * v + a] * s; out[2 * v + 1] = positions[3 * v + b] * s;
  }
  return out;
}
