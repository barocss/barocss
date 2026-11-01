import type { Vec3 } from '../types.js';
export declare const dot: (a: Vec3, b: Vec3) => number;
export declare const add: (a: Vec3, b: Vec3) => Vec3;
export declare const scale: (a: Vec3, factor: number) => Vec3;
export declare const norm: (a: Vec3) => number;
/** Clone only admitted private records and arrays. Preserve all numeric bits. */
export declare function clone<T>(value: T): T;
