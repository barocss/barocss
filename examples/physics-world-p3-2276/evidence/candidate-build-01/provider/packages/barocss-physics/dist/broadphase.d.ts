import type { Body, Vec3 } from './internal-types.js';
export interface Bounds {
    min: Vec3;
    max: Vec3;
}
export declare function bodyBounds(body: Body): Bounds;
export declare function boundsOverlap(a: Bounds, b: Bounds): boolean;
