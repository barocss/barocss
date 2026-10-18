// Axis-aligned boxes, their transforms and the view frustum test the viewer culls with.
import { transformPoint, type Mat4, type Vec3 } from './math.js';

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
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < 8; i++) {
    const p = transformPoint(m, [i & 1 ? b.max[0] : b.min[0], i & 2 ? b.max[1] : b.min[1], i & 4 ? b.max[2] : b.min[2]]);
    for (let k = 0; k < 3; k++) { if (p[k] < min[k]) min[k] = p[k]; if (p[k] > max[k]) max[k] = p[k]; }
  }
  return { min: [min[0], min[1], min[2]], max: [max[0], max[1], max[2]] };
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
  const m = viewProjection, row = (r: number) => [m[r], m[4 + r], m[8 + r], m[12 + r]];
  const r0 = row(0), r1 = row(1), r2 = row(2), r3 = row(3), out = new Float64Array(24);
  // Left, right, bottom, top, near (z ≤ w), far (z ≥ 0); a far plane at infinity is a zero plane that passes all.
  const planes = [r3.map((v, i) => v + r0[i]), r3.map((v, i) => v - r0[i]), r3.map((v, i) => v + r1[i]), r3.map((v, i) => v - r1[i]), r3.map((v, i) => v - r2[i]), r2];
  planes.forEach((p, k) => {
    const l = Math.hypot(p[0], p[1], p[2]) || 1;
    for (let i = 0; i < 4; i++) out[k * 4 + i] = p[i] / l;
  });
  return out;
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
