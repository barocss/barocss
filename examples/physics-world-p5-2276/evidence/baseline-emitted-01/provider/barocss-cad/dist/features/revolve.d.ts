import { type Brep } from '../brep/brep-core.js';
import { type ProfileSegmentInput, type XY } from './extruded-profile-solid.js';
import type { Point } from '../types.js';
export interface RevolveInput {
    readonly id?: string;
    readonly profile: readonly ProfileSegmentInput[];
    /** Strictly interior, pairwise disjoint bore loops. No touching or nested loops. */
    readonly holes?: readonly (readonly ProfileSegmentInput[])[];
    /** One side-tag list per authored bore loop (SideTags.holes). */
    readonly holeTags?: readonly (readonly string[])[];
    /** The axis: a point on it and its direction, both in the sketch plane (z = 0). */
    readonly axis: {
        readonly origin: XY;
        readonly direction: XY;
    };
    /** 0 < angle ≤ 360; positive turns the profile from the sketch plane towards +Z. */
    readonly angle: number;
    /** The sketch's segment tags (R10a, D86): sides named `${id}.side[t]` instead of by position. */
    readonly sideTags?: readonly string[];
}
export declare function revolveProfile(input: RevolveInput): Brep;
/**
 * Mass properties of a revolved profile in closed form: dV = ρ dφ dA over the profile in (h, ρ), with
 * the φ integrals done exactly and the profile moments ∫∫ hᵐρᵏ dA by Green's theorem (Gauss–Legendre
 * on each segment: exact for lines, far below rounding for arcs).
 */
/** The revolved solid's mass properties in closed form (MMGS: density g/cm³; R7.3b). */
export declare function revolveMassProperties(input: RevolveInput, density: number): {
    volume: number;
    mass: number;
    centroid: Point;
    inertia: [[number, number, number], [number, number, number], [number, number, number]];
    method: 'closed-form';
};
