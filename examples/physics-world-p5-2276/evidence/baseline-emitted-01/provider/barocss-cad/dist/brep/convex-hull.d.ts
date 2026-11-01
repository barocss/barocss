import { KernelError } from '../core/barocss-error.js';
export type HullErrorCode = 'TOO_FEW' | 'DEGENERATE';
export declare class HullError extends KernelError {
    readonly code: HullErrorCode;
    constructor(code: HullErrorCode, message: string);
}
export interface ConvexHull {
    readonly positions: Float64Array; /** Triangles into `positions`, counter-clockwise from outside. */
    readonly indices: Uint32Array;
}
/** The convex hull of points (x, y, z each). Throws HullError for fewer than 4 points or flat input. */
export declare function convexHull(points: ArrayLike<number>): ConvexHull;
