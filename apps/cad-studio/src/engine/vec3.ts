// 3D vector helpers for the studio (one copy instead of one per module). `unit` keeps a zero vector zero.
export type Vec3 = [number, number, number];
/** An axis by index: 0 X, 1 Y, 2 Z (PKG-b, B2: the model's, not the viewport gizmo's). */
export type Axis3 = 0 | 1 | 2;
type V = readonly number[];

export const add = (a: V, b: V): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V, b: V): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: V, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V, b: V): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a: V) => Math.hypot(a[0], a[1], a[2]);
/** a / |a| (a zero vector stays zero). */
export const unit = (a: V): Vec3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
