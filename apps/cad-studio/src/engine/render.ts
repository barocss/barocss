// How a part is rendered (the Render workspace), kept in the document beside the model: an appearance
// per body, lights, the environment and a saved camera. Colours are sRGB hex; directions point the way
// light travels (world, Z up).

export type Hex = `#${string}`;
export interface Appearance { color: Hex; metallic: number; roughness: number; opacity: number }
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
}

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
});

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const num = (v: unknown, lo: number, hi: number, fallback: number) => typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
const hex = (v: unknown, fallback: Hex): Hex => typeof v === 'string' && HEX.test(v) ? v as Hex : fallback;
const vec = (v: unknown, fallback: [number, number, number]): [number, number, number] =>
  Array.isArray(v) && v.length === 3 && v.every(x => typeof x === 'number' && Number.isFinite(x)) ? [v[0], v[1], v[2]] : fallback;
const obj = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};

export function readAppearance(v: unknown, fallback: Appearance): Appearance {
  const o = obj(v);
  return { color: hex(o.color, fallback.color), metallic: num(o.metallic, 0, 1, fallback.metallic), roughness: num(o.roughness, 0, 1, fallback.roughness), opacity: num(o.opacity, 0.05, 1, fallback.opacity) };
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
    },
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
