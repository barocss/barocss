import type { Body, Quat, Vec3 } from './types.js';

export function multiplyQuaternion(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a, [bx, by, bz, bw] = b;
  return [aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz];
}
export function advanceOrientation(orientation: Quat, angularVelocity: Vec3, dt: number): Quat {
  const speed = Math.hypot(...angularVelocity);
  if (speed === 0) return [...orientation];
  const halfAngle = speed * dt / 2;
  const scale = Math.sin(halfAngle) / speed;
  const delta: Quat = [angularVelocity[0] * scale, angularVelocity[1] * scale,
    angularVelocity[2] * scale, Math.cos(halfAngle)];
  const next = multiplyQuaternion(delta, orientation);
  const norm = Math.hypot(...next);
  return next.map((component) => component / norm) as Quat;
}

export const add = (a: Vec3, b: Vec3): Vec3 => a.map((value, index) => value + b[index]) as Vec3;
export const sub = (a: Vec3, b: Vec3): Vec3 => a.map((value, index) => value - b[index]) as Vec3;
export const scale = (a: Vec3, value: number): Vec3 => a.map((component) => component * value) as Vec3;
export const dot = (a: Vec3, b: Vec3): number => a.reduce((sum, value, index) => sum + value * b[index], 0);
export const cross = (a: Vec3, b: Vec3): Vec3 =>
  [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const inverse = (q: Quat): Quat => [-q[0], -q[1], -q[2], q[3]];
export function rotate(q: Quat, v: Vec3): Vec3 {
  const axis: Vec3 = [q[0], q[1], q[2]];
  const t = scale(cross(axis, v), 2);
  return add(v, add(scale(t, q[3]), cross(axis, t)));
}
export const localPoint = (body: Body, point: Vec3): Vec3 => rotate(inverse(body.orientation), sub(point, body.positionM));
export const worldPoint = (body: Body, point: Vec3): Vec3 => add(body.positionM, rotate(body.orientation, point));
export function inverseInertia(body: Body, vector: Vec3): Vec3 {
  const local = rotate(inverse(body.orientation), vector);
  return rotate(body.orientation, local.map((value, index) => value * body.inverseInertiaLocal[index]) as Vec3);
}
export function inertia(body: Body, vector: Vec3): Vec3 {
  const local = rotate(inverse(body.orientation), vector);
  return rotate(body.orientation, local.map((value, index) => value / body.inverseInertiaLocal[index]) as Vec3);
}
