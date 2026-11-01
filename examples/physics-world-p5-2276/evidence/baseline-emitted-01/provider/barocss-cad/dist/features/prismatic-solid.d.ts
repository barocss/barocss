import { type CurveRegion2, type CurveSegment2, type XY } from '../brep/curved-arrangement.js';
import { type Brep } from '../brep/brep-core.js';
import { type ProfileSegmentInput } from './extruded-profile-solid.js';
import type { Curve, Point } from '../types.js';
import { type SideTags } from '../document/side-names.js';
import { type KernelError } from '../core/barocss-error.js';
export interface PrismaticSlab {
    readonly z0: number;
    readonly z1: number;
    readonly regions: readonly CurveRegion2[];
}
/** An authored top or bottom: caps of the solid at height z inside these regions take its tag. */
export interface PrismaticCapSource {
    readonly z: number;
    readonly regions: readonly CurveRegion2[];
    readonly tag: string;
}
/** Slabs sorted by height, disjoint in Z; adjacent slabs with equal sections are merged. */
export interface PrismaticSolid {
    readonly kind: 'prismatic-solid';
    readonly slabs: readonly PrismaticSlab[];
    readonly caps?: readonly PrismaticCapSource[];
}
export type PrismaticBooleanOperation = 'union' | 'intersection' | 'difference';
/** This module's refusal (R7.3a batch 2: the PrismaticSolidError class folded, D279): a BarocssError, `details.source` 'prismatic-solid'. */
export declare const prismaticSolidError: (detail: string) => KernelError & {
    readonly code: "PRISMATIC_SOLID";
};
/** Whether something thrown is this module's refusal. */
export declare const isPrismaticSolidError: (e: unknown) => e is KernelError & {
    readonly code: "PRISMATIC_SOLID";
};
/** Closed rings (material on the left; self-overlap counts once) swept from z0 to z1. */
export declare function prismaticExtrude(rings: readonly (readonly CurveSegment2[])[], z0: number, z1: number): PrismaticSolid;
/**
 * A line + arc profile with holes (the extruded-profile input format) extruded upward. With a `tag`,
 * walls are named `tag.side<i>` (i: the authored segment) and `tag.hole<h>.side<i>`, caps `tag.top`
 * and `tag.bottom`.
 */
export declare function prismaticFromProfile(input: {
    readonly outer: readonly ProfileSegmentInput[];
    readonly regions?: readonly (readonly ProfileSegmentInput[])[];
    readonly holes?: readonly (readonly ProfileSegmentInput[])[];
    readonly height: number;
    readonly from?: number;
    readonly tag?: string;
    readonly sideTags?: SideTags;
    /**
     * Whole names for the outer loop's walls (one an authored segment) and the caps, in place of the tag's (R12.1 sheet roles,
     * D116); the holes' walls too, each hole's list in its order (FR1 section roles, D123). A loop left out is named by the tag.
     */
    readonly names?: {
        readonly outer?: readonly string[];
        readonly holes?: readonly (readonly string[])[];
        readonly bottom: string;
        readonly top: string;
    };
}): PrismaticSolid;
/**
 * The solid under x' = M·x + t (M a similarity: rotation or reflection times a scale s), z' = zScale·z
 * + zOffset (|zScale| = s keeps cylinders round; any nonzero value is accepted for planar walls).
 * `retag` renames every tag (pattern copies); a string appends a suffix.
 */
export declare function transformPrismatic(solid: PrismaticSolid, transform: {
    readonly matrix: readonly [number, number, number, number];
    readonly offset?: readonly [number, number];
    readonly zScale?: number;
    readonly zOffset?: number;
    readonly retag?: ((tag: string) => string) | string;
}): PrismaticSolid;
/** Slab-wise Boolean: split at every level of either solid, 2D Boolean of each pair of sections. */
export declare function booleanPrismatic(a: PrismaticSolid, b: PrismaticSolid, operation: PrismaticBooleanOperation): PrismaticSolid;
export declare const prismaticVolume: (s: PrismaticSolid) => number;
export declare const inRegion: (p: XY, r: CurveRegion2) => boolean;
/** Whether a point is inside the solid (boundary points either way). */
export declare function prismaticContains(s: PrismaticSolid, p: Point): boolean;
/** The solid as a B-rep: walls on extruded lines and arcs, planar caps, pcurves on every coedge. */
export declare function brepFromPrismatic(solid: PrismaticSolid, options?: {
    readonly id?: string;
}): Brep;
/** Edge names from their face names; several edges between the same two faces are numbered by midpoint. */
export declare function nameEdges(edges: {
    curve: Curve;
    name?: string;
}[]): void;
