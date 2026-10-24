// An instance's rotation and placement (R4 C1: the math assembly/mates.ts and engine/doc.ts each held, gathered in the
// engine so the document no longer imports the assembly solver): the rotation matrix of its X → Y → Z angles, the
// kernel turns that apply it, the angles of a matrix back, and the placement the kernel gives every body.
import type { PartInstance } from './doc';
import type { Vec3 } from './vec3';

export type Mat3 = [number, number, number, number, number, number, number, number, number];
export const matMul = (a: Mat3, b: Mat3): Mat3 => {
  const r = new Array(9).fill(0) as Mat3;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
  return r;
};
/** Rotation by `angle` radians about the unit `axis` (Rodrigues). */
export function axisAngle(axis: Vec3, angle: number): Mat3 {
  const [x, y, z] = axis, c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
  return [t * x * x + c, t * x * y - s * z, t * x * z + s * y, t * x * y + s * z, t * y * y + c, t * y * z - s * x, t * x * z - s * y, t * y * z + s * x, t * z * z + c];
}
export const DEG = Math.PI / 180;
/** An instance's rotation (degrees about X, then Y, then Z, as placedDoc applies it): R = Rz · Ry · Rx. */
export function rotationMatrix(rotation: readonly number[]): Mat3 {
  return matMul(axisAngle([0, 0, 1], rotation[2] * DEG), matMul(axisAngle([0, 1, 0], rotation[1] * DEG), axisAngle([1, 0, 0], rotation[0] * DEG)));
}
/**
 * An instance's rotation as kernel turns, applied in order: X → Y → Z when the X and Y angles are quarter
 * turns (the kernel turns about X and Y by those only), else the same rotation exactly as Z turns between
 * quarter turns about X — R = Rz(a) · Rx(−90) · Rz(b) · Rx(90) · Rz(c), since Rx(−90) Rz(b) Rx(90) = Ry(b).
 */
export function rotationSteps(rotation: readonly number[]): { axis: 'x' | 'y' | 'z'; angle: number }[] {
  const quarter = (v: number) => Math.abs(v / 90 - Math.round(v / 90)) < 1e-12;
  if (quarter(rotation[0]) && quarter(rotation[1])) return (['x', 'y', 'z'] as const).flatMap((axis, k) => rotation[k] ? [{ axis, angle: rotation[k] }] : []);
  const m = rotationMatrix(rotation);
  // Z–Y–Z angles of R: b from R22, then a and c (b at 0 or 180: one Z turn).
  const b = Math.acos(Math.max(-1, Math.min(1, m[8]))), sb = Math.sin(b);
  let a: number, c: number;
  if (sb > 1e-12) { a = Math.atan2(m[5], m[2]); c = Math.atan2(m[7], -m[6]); }
  else if (m[8] > 0) { a = Math.atan2(m[3], m[0]); c = 0; }
  else { a = Math.atan2(-m[3], -m[0]); c = 0; }
  const deg = (r: number) => clean(r / DEG, 1e-9);
  return [{ axis: 'z' as const, angle: deg(c) }, { axis: 'x' as const, angle: 90 }, { axis: 'z' as const, angle: deg(b) },
    { axis: 'x' as const, angle: 270 }, { axis: 'z' as const, angle: deg(a) }].filter(s => s.angle !== 0);
}
/** Values a hair from a round number are that number (and −0 is 0), so solved placements read cleanly. */
export const clean = (v: number, step = 1e-9) => { const r = Math.round(v); const x = Math.abs(v - r) < step ? r : v; return x === 0 ? 0 : x; };
/**
 * Angles within a micro-degree of a whole degree are that degree: a slanted face's normal is read back from
 * its surface to about 1e-10, which would otherwise leave 44.99999999745° where the face is at 45°.
 */
const ANGLE_SNAP = 1e-6;
/** The X→Y→Z angles (degrees) of a rotation; at ±90° about Y the X angle is 0. */
export function eulerOf(m: Mat3): Vec3 {
  const sy = -m[6];
  if (Math.abs(sy) > 1 - 1e-12) {
    const y = sy > 0 ? 90 : -90;
    return [0, y, clean(Math.atan2(-m[1], m[4]) / DEG, ANGLE_SNAP)];
  }
  return [clean(Math.atan2(m[7], m[8]) / DEG, ANGLE_SNAP), clean(Math.atan2(sy, Math.hypot(m[7], m[8])) / DEG, ANGLE_SNAP), clean(Math.atan2(m[3], m[0]) / DEG, ANGLE_SNAP)];
}

/**
 * An instance's placement as the kernel applies it to every body: the turns of `rotationSteps` in order
 * (quarter turns exactly), then the move — x' = m·x + t, m row-major.
 */
export function placementOf(inst: PartInstance): { m: number[]; t: [number, number, number] } {
  let m = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  for (const { axis, angle } of rotationSteps(inst.rotation)) m = mul3(turnMatrix(axis, angle), m);
  return { m, t: [inst.position[0], inst.position[1], inst.position[2]] };
}
/** A turn about an axis through the origin, as the kernel's rotate feature makes it. */
function turnMatrix(axis: 'x' | 'y' | 'z', deg: number): number[] {
  const k = Math.round(deg / 90);
  if (k * 90 === deg) {
    const turns = ((k % 4) + 4) % 4, c = [1, 0, -1, 0][turns], s = [0, 1, 0, -1][turns];
    return axis === 'x' ? [1, 0, 0, 0, c, -s, 0, s, c] : axis === 'y' ? [c, 0, s, 0, 1, 0, -s, 0, c] : [c, -s, 0, s, c, 0, 0, 0, 1];
  }
  const r = deg * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r);
  return axis === 'z' ? [c, -sn, 0, sn, c, 0, 0, 0, 1] : axis === 'x' ? [1, 0, 0, 0, c, -sn, 0, sn, c] : [c, 0, sn, 0, 1, 0, -sn, 0, c];
}
function mul3(a: readonly number[], b: readonly number[]): number[] {
  const out = Array<number>(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) out[3 * i + j] = a[3 * i] * b[j] + a[3 * i + 1] * b[3 + j] + a[3 * i + 2] * b[6 + j];
  return out;
}
