// Axis-aligned boxes, their transforms and the view frustum test the viewer culls with.
import type { Mat4, Vec3 } from './math.js';

export interface Box3 { readonly min: Vec3; readonly max: Vec3 }

export function boxOfPositions(positions: ArrayLike<number>): Box3 | null {
  if (positions.length < 3) return null;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i + 2 < positions.length; i += 3) for (let k = 0; k < 3; k++) {
    const v = positions[i + k];
    if (v < min[k]) min[k] = v;
    if (v > max[k]) max[k] = v;
  }
  return { min: [min[0], min[1], min[2]], max: [max[0], max[1], max[2]] };
}

/** The box around a box's eight corners after a transform. */
export function transformBox(m: Mat4, b: Box3): Box3 {
  // (No arrays a corner, G13: the box's eight corners transformed as numbers.)
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < 8; i++) {
    const x = i & 1 ? b.max[0] : b.min[0], y = i & 2 ? b.max[1] : b.min[1], z = i & 4 ? b.max[2] : b.min[2];
    const w = m[3] * x + m[7] * y + m[11] * z + m[15];
    const px = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w, py = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w, pz = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
    if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py; if (pz < z0) z0 = pz; if (pz > z1) z1 = pz;
  }
  return { min: [x0, y0, z0], max: [x1, y1, z1] };
}
/** A box grown in place to hold another (G13: no box a step, as unionBox makes). */
export function growBox(into: Box3, b: Box3): void {
  const lo = into.min as unknown as number[], hi = into.max as unknown as number[];
  for (let k = 0; k < 3; k++) { if (b.min[k] < lo[k]) lo[k] = b.min[k]; if (b.max[k] > hi[k]) hi[k] = b.max[k]; }
}

export function unionBox(a: Box3 | null, b: Box3 | null): Box3 | null {
  if (!a) return b;
  if (!b) return a;
  return { min: [Math.min(a.min[0], b.min[0]), Math.min(a.min[1], b.min[1]), Math.min(a.min[2], b.min[2])], max: [Math.max(a.max[0], b.max[0]), Math.max(a.max[1], b.max[1]), Math.max(a.max[2], b.max[2])] };
}

export const boxCenter = (b: Box3): Vec3 => [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
export const boxRadius = (b: Box3): number => Math.hypot(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]) / 2;

/** Six planes (a, b, c, d with a·x + b·y + c·z + d ≥ 0 inside) of a reversed-depth view-projection. */
export function frustumPlanes(viewProjection: Mat4): Float64Array {
  const m = viewProjection, out = new Float64Array(24);
  // Left, right, bottom, top, near (z ≤ w), far (z ≥ 0); a far plane at infinity is a zero plane that passes all.
  // (Each plane row 3 ± row k of the matrix, worked out in place: no arrays or closures a frame; PERF3 C17.)
  plane(out, 0, m, 0, 1); plane(out, 1, m, 0, -1); plane(out, 2, m, 1, 1); plane(out, 3, m, 1, -1); plane(out, 4, m, 2, -1);
  const l = Math.hypot(m[2], m[6], m[10]) || 1;
  for (let i = 0; i < 4; i++) out[20 + i] = m[4 * i + 2] / l;
  return out;
}
/** Plane k of the frustum: row 3 plus `sign` times row r, normalised by its normal's length. */
function plane(out: Float64Array, k: number, m: Mat4, r: number, sign: 1 | -1): void {
  const a = sign > 0 ? m[3] + m[r] : m[3] - m[r], b = sign > 0 ? m[7] + m[4 + r] : m[7] - m[4 + r], c = sign > 0 ? m[11] + m[8 + r] : m[11] - m[8 + r], d = sign > 0 ? m[15] + m[12 + r] : m[15] - m[12 + r];
  const l = Math.hypot(a, b, c) || 1;
  out[k * 4] = a / l; out[k * 4 + 1] = b / l; out[k * 4 + 2] = c / l; out[k * 4 + 3] = d / l;
}

/** Whether a box is at least partly inside the frustum (conservative: may keep a box just outside a corner). */
export function boxInFrustum(planes: Float64Array, b: Box3): boolean {
  for (let k = 0; k < 6; k++) {
    const a = planes[k * 4], bb = planes[k * 4 + 1], c = planes[k * 4 + 2], d = planes[k * 4 + 3];
    if (a === 0 && bb === 0 && c === 0) continue;
    // The corner furthest along the plane normal.
    const x = a >= 0 ? b.max[0] : b.min[0], y = bb >= 0 ? b.max[1] : b.min[1], z = c >= 0 ? b.max[2] : b.min[2];
    if (a * x + bb * y + c * z + d < 0) return false;
  }
  return true;
}

/**
 * The screen rectangle (pixels of a w × h target, y down: x0, y0, x1, y1) the boxes' corners project to through
 * the view-projection, or null when a corner is not in front of the eye (the rectangle is then unbounded).
 */
export function screenRect(viewProjection: Mat4, boxes: readonly Box3[], w: number, h: number): [number, number, number, number] | null {
  const m = viewProjection;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const b of boxes) for (let i = 0; i < 8; i++) {
    const x = i & 1 ? b.max[0] : b.min[0], y = i & 2 ? b.max[1] : b.min[1], z = i & 4 ? b.max[2] : b.min[2];
    const cw = m[3] * x + m[7] * y + m[11] * z + m[15]; if (!(cw > 1e-9)) return null;
    const sx = ((m[0] * x + m[4] * y + m[8] * z + m[12]) / cw * 0.5 + 0.5) * w, sy = (0.5 - (m[1] * x + m[5] * y + m[9] * z + m[13]) / cw * 0.5) * h;
    if (sx < x0) x0 = sx; if (sx > x1) x1 = sx; if (sy < y0) y0 = sy; if (sy > y1) y1 = sy;
  }
  return [x0, y0, x1, y1];
}
