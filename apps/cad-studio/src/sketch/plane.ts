// Sketch planes: where a sketch lies in the part (world, Z up, mm). A sketch's own coordinates (u, v) run
// along xAxis and normal × xAxis from origin; its solids grow along the normal. The kernel takes planes
// with one axis vertical: horizontal faces (any spin) and vertical faces (any heading).
import type { Vec3 } from '../engine/mesh';

export interface SketchPlane { origin: Vec3; normal: Vec3; xAxis: Vec3 }

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** Rounding noise off: components near 0 or ±1 become exactly that. */
const clean = (v: Vec3): Vec3 => v.map(c => Math.abs(c) < 1e-9 ? 0 : Math.abs(Math.abs(c) - 1) < 1e-9 ? Math.sign(c) : c) as Vec3;
/** Lengths to a micrometre, so face positions read as authored. */
const mm = (x: number) => Math.round(x * 1000) / 1000 || 0;

export type PlaneKind = 'xy' | 'xz' | 'yz';
/**
 * The coordinate planes through the origin, seen as in the Top, Front and Right views: XY (X right, Y
 * up), XZ (X right, Z up, facing −Y) and YZ (Y right, Z up, facing +X).
 */
export const standardPlane = (kind: PlaneKind): SketchPlane =>
  kind === 'xy' ? xyPlane() : kind === 'xz' ? { origin: [0, 0, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] } : { origin: [0, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] };
/** A plane moved along its normal. */
export const offsetPlane = (p: SketchPlane, d: number): SketchPlane =>
  d ? { ...p, origin: [0, 1, 2].map(k => mm(p.origin[k] + p.normal[k] * d)) as Vec3 } : p;
/** The XY plane at height z (the default sketch plane, z 0). */
export const xyPlane = (z = 0): SketchPlane => ({ origin: [0, 0, z], normal: [0, 0, 1], xAxis: [1, 0, 0] });
export const isDefaultPlane = (p: SketchPlane) => p.normal[2] === 1 && p.xAxis[0] === 1 && p.origin.every(c => c === 0);
export const yAxisOf = (p: SketchPlane): Vec3 => clean(cross(p.normal, p.xAxis));

/**
 * The sketch plane on a flat face: a horizontal face keeps the part's X and Y (so coordinates read as in
 * a top view), a vertical one runs X along the face and Y up. Null for faces the kernel cannot sketch on.
 */
export function planeOfFace(normal: Vec3, point: Vec3): SketchPlane | null {
  const l = Math.hypot(...normal); if (!(l > 0)) return null;
  const n = clean(normal.map(c => c / l) as Vec3);
  if (Math.abs(n[2]) === 1) return { origin: [0, 0, mm(point[2])], normal: [0, 0, n[2]], xAxis: [1, 0, 0] };
  if (Math.abs(n[2]) > 1e-6) return null;
  const h = Math.hypot(n[0], n[1]), m = clean([n[0] / h, n[1] / h, 0]), d = mm(dot(point, m));
  return { origin: clean([m[0] * d, m[1] * d, 0]).map(mm) as Vec3, normal: m, xAxis: clean([-m[1], m[0], 0]) };
}

export const toWorld = (p: SketchPlane, [u, v]: readonly [number, number]): Vec3 => {
  const y = yAxisOf(p);
  return [0, 1, 2].map(k => p.origin[k] + u * p.xAxis[k] + v * y[k]) as Vec3;
};
export const toLocal = (p: SketchPlane, w: Vec3): [number, number] => {
  const d: Vec3 = [w[0] - p.origin[0], w[1] - p.origin[1], w[2] - p.origin[2]];
  return [dot(d, p.xAxis), dot(d, yAxisOf(p))];
};
/** Where a ray meets the plane, in the plane's coordinates (null behind the ray or edge-on). */
export function rayOnPlane(p: SketchPlane, origin: Vec3, dir: Vec3): [number, number] | null {
  const denom = dot(dir, p.normal); if (Math.abs(denom) < 1e-6) return null;
  const t = dot([p.origin[0] - origin[0], p.origin[1] - origin[1], p.origin[2] - origin[2]], p.normal) / denom;
  if (t < 0) return null;
  return toLocal(p, [origin[0] + dir[0] * t, origin[1] + dir[1] * t, origin[2] + dir[2] * t]);
}
/** The plane's coordinates of a box's corners: its extent seen on the plane. */
export function boxOnPlane(p: SketchPlane, min: Vec3, max: Vec3): [[number, number], [number, number]] {
  const lo: [number, number] = [Infinity, Infinity], hi: [number, number] = [-Infinity, -Infinity];
  for (let i = 0; i < 8; i++) {
    const uv = toLocal(p, [i & 1 ? max[0] : min[0], i & 2 ? max[1] : min[1], i & 4 ? max[2] : min[2]]);
    for (const k of [0, 1]) { lo[k] = Math.min(lo[k], uv[k]); hi[k] = Math.max(hi[k], uv[k]); }
  }
  return [lo, hi];
}

/** A short name: the coordinate a face lies at when it is axis-aligned. */
export function planeLabel(p: SketchPlane): string {
  const n = p.normal;
  for (const [k, name] of [[2, 'Z'], [0, 'X'], [1, 'Y']] as const) if (Math.abs(n[k]) === 1) return `${name} ${mm(p.origin[k])}`;
  return `${Math.round(Math.atan2(n[1], n[0]) * 180 / Math.PI)}° plane`;
}
