import type { Brep } from './brep-core.js';
import type { Curve, Point } from '../types.js';
type XY = [number, number];
export interface SweepSolidRequest {
    readonly id?: string;
    /** The profile in its plane's coordinates: an outer loop and holes (points in order, either way round). */
    readonly outer: readonly XY[];
    readonly holes?: readonly (readonly XY[])[];
    /** The profile's plane in the world: its X and Y axes (unit, square) — X is carried along the path. */
    readonly xAxis: Point;
    readonly yAxis: Point;
    /** The path. */
    readonly path: Curve;
    /** Positions along the path (default from its length and the profile's size, 32 to 512). */
    readonly samples?: number;
}
export declare function sweepSolid(req: SweepSolidRequest): Brep;
export {};
