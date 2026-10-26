// Lights and the frame block they are packed into with the camera (see Frame in shaders.ts).
import { ViewerError } from './viewer-error.js';
import type { Camera } from './camera.js';
import { invert, normalize, srgbToLinear, sub, type Mat4, type Vec3 } from './math.js';
import { FRAME_BYTES, MAX_CLIP_PLANES, MAX_DIRECTIONAL, MAX_OUTLINES, MAX_POINT, MAX_SPOT, MAX_SHADOWS, POINT_SHADOW_START, POINT_SHADOW_FACES, OUTPUT_BYTES } from './shaders.js';

/** sRGB colour, 0–1 per channel, or a CSS hex string. */
export type Color = Vec3 | string;
export interface DirectionalLight { kind: 'directional'; direction: Vec3; color?: Color; intensity?: number; /** Casts a shadow for each enabled light among the first four directional lights. */ castShadow?: boolean }
export interface PointLight { kind: 'point'; position: Vec3; color?: Color; intensity?: number; /** Zero: no cut-off. */ range?: number; /** Enables a six-face PCF shadow; at most one of the first eight point lights may enable it. */ castShadow?: boolean }
export interface SpotLight { kind: 'spot'; position: Vec3; direction: Vec3; color?: Color; intensity?: number; range?: number; /** Degrees from the axis. */ angle?: number; /** 0–1: share of the cone that fades. */ penumbra?: number; /** Enables a shadow among the first four spot lights. */ castShadow?: boolean; /** Light disk radius in world units (finite nonnegative f32); zero or omitted retains PCF, positive enables PCSS. Independent of cone penumbra. */ shadowRadius?: number }
export type Light = DirectionalLight | PointLight | SpotLight;
export interface Environment {
  /** Hemisphere ambient: sky above the up axis, ground below. */
  sky?: Color; ground?: Color; ambient?: number;
  exposure?: number;
  /** ACES (filmic, the default look), AgX (G15d.1: gentler highlights, colours that desaturate to white) or none. */
  toneMapping?: 'none' | 'aces' | 'agx';
  /** Colour grading after tone mapping (G15d.1), on the whole frame — scene and background, not the outlines. */
  grading?: ColorGrading | null;
  /** A vignette (G15d.1): the frame darkened towards its corners. */
  vignette?: Vignette | null;
  /**
   * Soft shadows (G15b): every shadow-casting directional light's angular size in degrees — its penumbra widening with the distance
   * from what casts it (PCSS); 0 or none: the hard 3×3-filtered edge.
   */
  softShadows?: number;
  /** Contact shadows (G15b): a short screen-space ray toward the shadow-casting light from each pixel, darkening where the
   *  depth buffer blocks it — the creases and contacts the shadow map is too coarse for. `length` in world units
   *  (default a fortieth of the scene's radius), `strength` 0–1 (default 0.6). */
  contactShadows?: { length?: number; strength?: number } | false;
  /** Bloom (G15d.2): light above `threshold` (linear, default 1: brighter than white) glowing past its edges, added at
   *  `strength` (default 0.05) before the tone map; `knee` the threshold's soft width (default a quarter of it). */
  bloom?: { strength?: number; threshold?: number; knee?: number } | false;
  /** Depth of field: positive view-axis focus distance (world units), maximum blur radius (CSS pixels, 0–24). */
  depthOfField?: { focus: number; blur?: number } | false;
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

/**
 * Colour grading (G15d.1), in the order applied: white balance, lift / gamma / gain (per channel, linear), saturation
 * (around Rec. 709 luminance), then contrast around mid grey in the encoded image. Every field's default leaves the
 * image as it is.
 */
export interface ColorGrading {
  /** White balance: −1 cool (blue) … 1 warm (amber); default 0. */
  temperature?: number;
  /** −1 green … 1 magenta; default 0. */
  tint?: number;
  /** Shadows raised (per channel, 0–1); default 0. */
  lift?: Vec3;
  /** Midtones (per channel, above 1 brighter); default 1. */
  gamma?: Vec3;
  /** Highlights scaled (per channel); default 1. */
  gain?: Vec3;
  /** 0 grey, 1 unchanged, above 1 more colourful. */
  saturation?: number;
  /** 1 unchanged; above 1 darker shadows and brighter highlights. */
  contrast?: number;
}
/** A vignette: `amount` 0–1 (how dark the corners get), `size` the share of the half-diagonal left clear (default 0.5),
 *  `softness` the share it fades over (default 0.5). */
export interface Vignette { amount: number; size?: number; softness?: number }

/** White balance as channel gains, luminance kept: temperature along amber–blue, tint along magenta–green. */
export function whiteBalance(temperature = 0, tint = 0): Vec3 {
  const t = Math.max(-1, Math.min(1, temperature)), m = Math.max(-1, Math.min(1, tint));
  const r = 1 + 0.25 * t, g = 1 - 0.2 * m, b = 1 - 0.25 * t, y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return [r / y, g / y, b / y];
}

export function parseColor(c: Color | undefined, fallback: Vec3 = [1, 1, 1]): Vec3 {
  if (c === undefined) return fallback;
  if (typeof c !== 'string') return c;
  // (Frames ask for the lights' and environment's colours every time: each string is read once; a copy is
  // handed out.)
  let v = parsed.get(c);
  if (!v) {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c.trim());
    if (!m) throw new ViewerError('COLOR_INVALID', `Not a hex colour: ${c}`);
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
/** The shadow-casting light's view (`eye`, `direction`: where it looks from and along — the caps' probe from it, G19.4). */
export interface ShadowFrame { viewProjection: Mat4; normalOffset: number; texel: number; bias: number; eye?: Vec3; direction?: Vec3;
  /** Perspective light projection (spot or point face); omitted for orthographic directional lights. */
  perspective?: boolean;
  /** Actual perspective projection inputs, used to recover spot-shadow axial depth for PCSS. */
  near?: number; far?: number; focal?: number;
  /** G15b: the penumbra's width in the map's uv per unit of its depth between a blocker and the shadowed point (0: hard). */
  softness?: number }

/** The directional lights the frame lights with (the shadow index refers to this list). */
export const directionalLights = (lights: readonly Light[]): DirectionalLight[] => lights.filter((l): l is DirectionalLight => l.kind === 'directional').slice(0, MAX_DIRECTIONAL);
/** The spot lights the frame lights with; shadow metadata uses MAX_DIRECTIONAL plus this index. */
export const spotLights = (lights: readonly Light[]): SpotLight[] => lights.filter((l): l is SpotLight => l.kind === 'spot').slice(0, MAX_SPOT);
/** The first eight point lights, in the same order as the frame's lighting inputs. */
export const pointLights = (lights: readonly Light[]): PointLight[] => lights.filter((l): l is PointLight => l.kind === 'point').slice(0, MAX_POINT);

/** The ground grid as drawn this frame: cell size, cells per major line, fade distance, height; colour (sRGB) and opacity. */
export interface GridFrame { cell: number; major: number; fade: number; height: number; color: Vec3; opacity: number }

/**
 * The clip planes (G2, G19): drawn where dot(normal, p) ≥ offset for every plane (normals of unit length) — the
 * intersection of their kept sides — or, `cutout` (G20), for any plane: a corner cut out, the intersection of their
 * cut-away sides. The caps in a colour (sRGB). `normal` and `offset`: the first plane's.
 */
export interface ClipFrame { normal: Vec3; offset: number; cap: Vec3; planes: readonly { normal: Vec3; offset: number }[]; cutout?: boolean }
export function packFrame(viewProjection: Mat4, camera: Camera, lights: readonly Light[], env: Environment, shadow: ShadowFrame | null = null, viewport: readonly number[] = [1, 1, 1, 0], grid: GridFrame | null = null, clip: ClipFrame | null = null, into: Float32Array | null = null, shadows?: readonly (ShadowFrame | null)[]): Float32Array {
  // (`into`: a block kept for it, cleared and written again — G13.)
  const f = into ? (into.fill(0), into) : new Float32Array(FRAME_BYTES / 4), u = new Uint32Array(f.buffer);
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
  const dirs = directionalLights(lights), spots = spotLights(lights), points = pointLights(lights);
  const legacyCaster = shadow ? dirs.findIndex(light => light.castShadow) : -1;
  const activeShadows: (ShadowFrame | null)[] = new Array(MAX_SHADOWS).fill(null);
  for (let i = 0; i < dirs.length; i++) if (dirs[i].castShadow) activeShadows[i] = shadows === undefined ? (i === legacyCaster ? shadow : null) : shadows[i] ?? null;
  for (let i = 0; i < spots.length; i++) if (spots[i].castShadow && shadows !== undefined) activeShadows[MAX_DIRECTIONAL + i] = shadows[MAX_DIRECTIONAL + i] ?? null;
  const pointCaster = points.findIndex(light => light.castShadow);
  const pointFrames = Array.from({ length: POINT_SHADOW_FACES }, (_, face) => shadows?.[POINT_SHADOW_START + face] ?? null);
  const pointActive = pointCaster >= 0 && pointFrames.every(frame => frame !== null);
  if (pointActive) for (let face = 0; face < POINT_SHADOW_FACES; face++) activeShadows[POINT_SHADOW_START + face] = pointFrames[face];
  const caster = activeShadows.slice(0, dirs.length).findIndex(frame => frame !== null);
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
    // Shadow admission permits every finite nonzero direction, including subnormals.
    const largest = l.castShadow ? Math.max(Math.abs(l.direction[0]), Math.abs(l.direction[1]), Math.abs(l.direction[2])) : 1;
    const d = normalize(l.castShadow ? [l.direction[0] / largest, l.direction[1] / largest, l.direction[2] / largest] : l.direction), c = linear(parseColor(l.color)), at = o + i * 16;
    put4(f, at, l.position[0], l.position[1], l.position[2], l.range ?? 0); put4(f, at + 4, d[0], d[1], d[2], 0);
    put4(f, at + 8, c[0], c[1], c[2], l.intensity ?? 1); put4(f, at + 12, Math.max(Math.cos(inner), Math.cos(outer) + 1e-4), Math.cos(outer), 0, 0);
  }
  o += MAX_SPOT * 16;
  const primaryShadow = caster >= 0 ? activeShadows[caster] : null;
  if (primaryShadow) { f.set(primaryShadow.viewProjection, o); put4(f, o + 16, primaryShadow.normalOffset, primaryShadow.texel, primaryShadow.bias, primaryShadow.softness ?? 0); }
  // (viewport.w: the scene's size, the see-through surfaces' depth weight's scale; G11.)
  put4(f, o + 20, viewport[0], viewport[1], viewport[2], viewport[3] ?? 0);
  if (grid) {
    f.set(invert(viewProjection), o + 24);
    const c = linear(grid.color);
    put4(f, o + 40, grid.cell, grid.major, grid.fade, grid.height); put4(f, o + 44, c[0], c[1], c[2], grid.opacity);
  }
  if (clip) {
    const c = linear(clip.cap), n = Math.min(MAX_CLIP_PLANES, clip.planes.length);
    put4(f, o + 48, c[0], c[1], c[2], clip.cutout ? -n : n);
    for (let i = 0; i < n; i++) { const p = clip.planes[i]; put4(f, o + 52 + 4 * i, p.normal[0], p.normal[1], p.normal[2], p.offset); }
  }
  const shadowStart = o + 52 + MAX_CLIP_PLANES * 4;
  let shadowMask = 0;
  for (let i = 0; i < activeShadows.length; i++) {
    const frame = activeShadows[i];
    if (!frame) continue;
    const at = shadowStart + i * 20;
    f.set(frame.viewProjection, at); put4(f, at + 16, frame.normalOffset, frame.texel, frame.bias, i < MAX_DIRECTIONAL ? frame.softness ?? 0 : 0);
    shadowMask |= 1 << i;
  }
  u[shadowStart + MAX_SHADOWS * 20] = shadowMask;
  u[shadowStart + MAX_SHADOWS * 20 + 1] = pointActive ? pointCaster + 1 : 0;
  const spotParamsStart = shadowStart + MAX_SHADOWS * 20 + 4;
  for (let i = 0; i < spots.length; i++) {
    const frame = activeShadows[MAX_DIRECTIONAL + i], radius = spots[i].shadowRadius ?? 0;
    if (frame && radius > 0) put4(f, spotParamsStart + i * 4, frame.near ?? 0, frame.far ?? 0, frame.focal ?? 0, radius);
  }
  return f;
}

/** A vertical gradient (sRGB) behind the scene; null: transparent. */
export type Background = { top: Vec3; bottom: Vec3 } | null;
/** What the ambient occlusion needs of the camera: the inverse projection and pixels per world unit. */
export interface OcclusionFrame { inverseProjection: Mat4; radius: number; pixelsPerUnit: number; perspective: boolean }

/** G15b: the contact shadows' ray — the camera's projection, the direction toward the light in view space, its length and
 *  the strength and the thickness a blocker is taken to have (world); the inverse projection to read view positions. */
export interface ContactFrame { projection: Mat4; inverseProjection: Mat4; direction: Vec3; length: number; strength: number; thickness: number }
/** The output block (see Output in shaders.ts): outline colours are sRGB, the width in device pixels. */
/** `outlineRect`: where outlines can be (pixels x0, y0, x1, y1), or null for anywhere. */
export function packOutput(env: Environment, outlines: readonly Vec3[] = [], outlineWidth = 2, background: Background = null, ao: OcclusionFrame | null = null, outlineRect: readonly number[] | null = null,
  // (`into`: a block kept for it, cleared and written again — R2.)
  into: ArrayBuffer | null = null, contact: ContactFrame | null = null, focus: { inverseProjection: Mat4; pixelRatio: number } | null = null): ArrayBuffer {
  const b = into ?? new ArrayBuffer(OUTPUT_BYTES), f = new Float32Array(b), u = new Uint32Array(b);
  if (into) f.fill(0);
  f[0] = env.exposure ?? 1;
  u[1] = env.toneMapping === 'aces' ? 1 : env.toneMapping === 'agx' ? 2 : 0;
  f[2] = outlineWidth;
  u[3] = Math.min(outlines.length, MAX_OUTLINES);
  for (let i = 0; i < outlines.length && i < MAX_OUTLINES; i++) { const c = outlines[i], k = 4 + i * 4; f[k] = c[0]; f[k + 1] = c[1]; f[k + 2] = c[2]; f[k + 3] = 1; }
  const o = 4 + MAX_OUTLINES * 4;
  if (background) { f.set([...background.top, 1], o); f.set([...background.bottom, 1], o + 4); }
  if (ao && env.ambientOcclusion) {
    f.set(ao.inverseProjection, o + 8);
    f.set([ao.radius, env.ambientOcclusion.strength ?? 1, ao.pixelsPerUnit, ao.perspective ? 1 : -1], o + 24);
  }
  // (G15d.2: the bloom's strength; 0 off.)
  if (env.bloom) f[o + 28] = Math.max(0, env.bloom.strength ?? 0.05);
  // (G15b: the contact shadows' projection, direction and length, strength and thickness; none: zeros.)
  if (contact && contact.strength > 0 && contact.length > 0) {
    // (It reads view positions as the occlusion does: the inverse projection, set here when the occlusion is off.)
    if (!(ao && env.ambientOcclusion)) f.set(contact.inverseProjection, o + 8);
    f.set(contact.projection, o + 32);
    f.set([contact.direction[0], contact.direction[1], contact.direction[2], contact.length], o + 48);
    f.set([Math.min(1, contact.strength), contact.thickness, 0, 0], o + 52);
  }
  // (G15d.1: balance and contrast, lift and saturation, gamma and on, gain; then the vignette. Off: zeros, and the
  // pass skips them.)
  const g = env.grading, v = env.vignette;
  if (g) {
    const wb = whiteBalance(g.temperature, g.tint), lift = g.lift ?? [0, 0, 0], gamma = g.gamma ?? [1, 1, 1], gain = g.gain ?? [1, 1, 1];
    f.set([wb[0], wb[1], wb[2], Math.max(0, g.contrast ?? 1)], o + 56);
    f.set([lift[0], lift[1], lift[2], Math.max(0, g.saturation ?? 1)], o + 60);
    f.set([Math.max(1e-3, gamma[0]), Math.max(1e-3, gamma[1]), Math.max(1e-3, gamma[2]), 1], o + 64);
    f.set([gain[0], gain[1], gain[2], 0], o + 68);
  }
  if (v && v.amount > 0) {
    const size = Math.max(0, Math.min(1, v.size ?? 0.5)), soft = Math.max(1e-3, v.softness ?? 0.5);
    f.set([Math.min(1, v.amount), size, size + soft, 0], o + 72);
  }
  f.set(outlineRect ?? [-1e9, -1e9, 1e9, 1e9], o + 76);
  const dof = env.depthOfField;
  if (focus && dof && Number.isFinite(dof.focus) && dof.focus > 0 && Number.isFinite(dof.blur ?? 8) && (dof.blur ?? 8) > 0) {
    f.set(focus.inverseProjection, o + 8);
    f.set([dof.focus, Math.min(24, dof.blur ?? 8) * focus.pixelRatio, 0, 0], o + 80);
  }
  return b;
}
