// Small 3D vector helpers shared by the B-rep layer (one definition instead of a copy per module).
import type { Point } from '../types.js';

type V = readonly number[];
export const add = (a: V, b: V): Point => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V, b: V): Point => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: V, k: number): Point => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V, b: V): Point => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a: V) => Math.hypot(a[0], a[1], a[2]);
/** a / |a| (a zero vector stays zero). */
export const unit = (a: V): Point => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
/** |a − b|. */
export const dist = (a: V, b: V) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const lerp = (a: V, b: V, t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
