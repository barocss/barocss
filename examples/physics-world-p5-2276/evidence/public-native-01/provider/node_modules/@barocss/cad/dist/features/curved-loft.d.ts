import type { LoftInput } from './loft.js';
import type { Point } from '../types.js';
type Frame = {
    readonly origin: Point;
    readonly u: Point;
    readonly v: Point;
};
/** Called after the shared explicit-frame admission. No curved support for the legacy z path. */
export declare function curvedLoftSolid(input: LoftInput, frames: readonly Frame[]): {
    brep: import("../brep/brep-core.js").Brep;
    mass: (density: number) => import("../brep/solid-mass.js").MassProperties;
};
export {};
