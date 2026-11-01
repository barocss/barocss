import { type Brep } from './brep-core.js';
import { type PlanarBooleanOperation, type PolygonWithHoles } from './planar-arrangement.js';
import type { ProfileSegmentInput } from '../features/extruded-profile-solid.js';
export interface ProfileWithHolesInput {
    readonly id?: string;
    /** Outer boundary (any orientation; normalised counter-clockwise). */
    readonly outer: readonly ProfileSegmentInput[];
    /** Holes, each a closed line + arc loop strictly inside the outer boundary and disjoint from each other. */
    readonly holes?: readonly (readonly ProfileSegmentInput[])[];
    readonly height: number;
    readonly from?: number;
}
export declare function extrudeProfileWithHoles(input: ProfileWithHolesInput): Brep;
/**
 * Boolean of two prisms over the same height: the planar Boolean of their profiles (exact arrangement,
 * touching and shared edges included), each resulting region extruded with its holes. Several
 * disconnected regions give several bodies in one B-rep.
 */
export declare function extrudePolygonBoolean(a: readonly PolygonWithHoles[], b: readonly PolygonWithHoles[], operation: PlanarBooleanOperation, options: {
    readonly height: number;
    readonly from?: number;
    readonly id?: string;
}): {
    brep: Brep;
    regions: PolygonWithHoles[];
};
