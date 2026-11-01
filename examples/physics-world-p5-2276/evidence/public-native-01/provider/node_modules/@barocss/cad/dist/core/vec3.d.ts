import type { Point } from '../types.js';
type V = readonly number[];
export declare const add: (a: V, b: V) => Point;
export declare const sub: (a: V, b: V) => Point;
export declare const scale: (a: V, k: number) => Point;
export declare const dot: (a: V, b: V) => number;
export declare const cross: (a: V, b: V) => Point;
export declare const len: (a: V) => number;
/** a / |a| (a zero vector stays zero). */
export declare const unit: (a: V) => Point;
/** |a − b|. */
export declare const dist: (a: V, b: V) => number;
export declare const lerp: (a: V, b: V, t: number) => Point;
export {};
