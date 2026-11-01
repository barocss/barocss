import type { Body, Vec3 } from '../../packages/barocss-physics/src/types.js';
import type { WitnessPoint } from './contact-types.js';
export declare const WITNESS_MESSAGE = "private feature contact requires valid box witnesses";
export declare const WITNESS_TOLERANCE_M = 1e-12;
export declare const DUPLICATE_TOLERANCE_M = 1e-12;
export declare const basis: (b: Body) => Vec3[];
export declare const extents: (b: Body) => Vec3;
export declare function unit(v: Vec3): Vec3;
export declare function point(key: string, a: Vec3, b: Vec3, n: Vec3): WitnessPoint;
