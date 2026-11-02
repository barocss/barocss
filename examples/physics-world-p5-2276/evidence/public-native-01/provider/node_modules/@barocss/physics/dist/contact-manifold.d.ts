import type { Body, Hit, Vec3 } from './internal-types.js';
export interface ManifoldPoint {
    id: string;
    pointM: Vec3;
}
/** Clip an incident box face against a reference box face. Edge axes keep the one-point path. */
export declare function boxFaceManifold(a: Body, b: Body, hit: Hit): ManifoldPoint[] | null;
