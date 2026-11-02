import type { Brep } from './brep-core.js';
import type { PrismaticSolid } from '../features/prismatic-solid.js';
import type { Point } from '../types.js';
import { type KernelError } from '../core/barocss-error.js';
/**
 * A body's mass properties in MMGS (R7.3b, api-conventions §2): `volume` mm³, `mass` g, `centroid` mm, `inertia` g·mm²
 * about the centroid, products of inertia stored as −∫xy dm. A density is in g/cm³.
 */
export interface MassProperties {
    readonly volume: number;
    readonly mass: number;
    readonly centroid: Point;
    readonly inertia: readonly [readonly [number, number, number], readonly [number, number, number], readonly [number, number, number]];
    /** `quadrature`: Gauss quadrature exact across and to rounding along smooth (rational) edges. */
    readonly method: 'closed-form' | 'planar-exact' | 'tessellated' | 'quadrature';
    /**
     * `tessellated` only (a curved body the quadrature could not integrate): an estimate of the volume's error, mm³ — the
     * change from a mesh of half the segments, which the chord error's square makes some three times the error itself.
     */
    readonly volumeBound?: number;
}
/** This module's refusal (R7.3a batch 2: the SolidMassError class folded, D279): a BarocssError, `details.source` 'solid-mass'. */
export declare const solidMassError: (detail: string) => KernelError & {
    readonly code: "SOLID_MASS";
};
/** Whether something thrown is this module's refusal. */
export declare const isSolidMassError: (e: unknown) => e is KernelError & {
    readonly code: "SOLID_MASS";
};
/** From volume integrals [V, ∫x, ∫y, ∫z, ∫x², ∫y², ∫z², ∫xy, ∫xz, ∫yz] in mm-powers. */
export declare function solidMassFromIntegrals(I: readonly number[], density: number, method: MassProperties['method']): MassProperties;
export declare function prismaticMassProperties(solid: PrismaticSolid, density: number): MassProperties;
/**
 * The surface area of a B-rep (mm²): over its exact surfaces as mass properties are (planar faces by Green's
 * theorem along their edges, whole B-spline patches by tensor Gauss, others over their parameter domains),
 * else the area of its fine tessellation.
 */
export declare function brepSurfaceArea(brep: Brep, options?: {
    readonly segmentsPerQuarter?: number;
    readonly quadratureSegments?: number;
}): number;
/**
 * Curved B-reps by quadrature over their surfaces, on meshes of `quadratureSegments` a quarter (8 by
 * default; 0: none) and twice that, extrapolated (Richardson: with the curved strips along trims integrated,
 * the error left falls with the cube of the step, beside a surface's pole with its square; faces with none
 * give the same value on both). Otherwise, or when that cannot integrate a face, tetrahedra from the
 * origin over the watertight tessellation (divergence theorem).
 */
export declare function brepMassProperties(brep: Brep, density: number, options?: {
    readonly segmentsPerQuarter?: number;
    readonly quadratureSegments?: number;
}): MassProperties;
/**
 * Mass properties of a body made of pieces that meet only in faces, each given in its own frame and
 * placed by a rotation (its columns: the frame's axes in world) and an offset (mm): masses add, centroids
 * average, each inertia turns with its piece (R I Rᵀ) and moves to the common centroid (parallel axes).
 */
export declare function combineMassProperties(parts: readonly {
    readonly props: MassProperties;
    readonly axes: readonly [Point, Point, Point];
    readonly offset: Point;
}[]): MassProperties;
/**
 * The ten volume integrals and the area (eleventh) of a body whose every face is a facet patch or a planar face
 * bounded by straight edges, exactly and without a tessellation: tetrahedra from the body's centre over each
 * facet triangle and over a fan of each planar loop (a fan's signed triangles cover the loop's region, holes
 * too, so their cones add up to the face's). Null for any other body, or when a planar face's loops do not
 * turn about its outward normal as the B-rep's do.
 */
export declare function polyhedralIntegrals(brep: Brep): readonly number[] | null;
