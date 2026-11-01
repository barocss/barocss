import { type AnalyticBooleanOperation } from '../brep/analytic-boolean.js';
import { type Brep } from '../brep/brep-core.js';
import type { Point } from '../types.js';
import { type KernelError } from '../core/barocss-error.js';
export interface FacetBooleanOptions {
    /** The result's id. */
    readonly id: string;
    /** How finely the tool's faces and rims are sampled (segments a quarter turn); default 32. */
    readonly segmentsPerQuarter?: number;
    /** At most this many mesh triangles near the tool (the exact Boolean's share); default 16 000. */
    readonly nearTriangles?: number;
}
/** This module's refusal (R7.3a batch 2: the FacetBooleanError class folded, D279): a BarocssError, `details.source` 'facet-boolean'. */
export declare const facetBooleanError: (code: "CAPABILITY" | "GEOMETRY", detail: string) => KernelError & {
    readonly code: "CAPABILITY" | "GEOMETRY";
};
/** Whether something thrown is this module's refusal. */
export declare const isFacetBooleanError: (e: unknown) => e is KernelError & {
    readonly code: "CAPABILITY" | "GEOMETRY";
};
/** `a` holds facet faces (and maybe exact ones from an earlier F2); `b` none. */
export declare function facetBoolean(a: Brep, b: Brep, op: AnalyticBooleanOperation, options: FacetBooleanOptions): Brep;
/**
 * F1 for a body that mixes mesh and exact faces (an earlier F2): split through the soup like a mesh — its exact faces
 * tessellated, their surfaces given back after, each side's cap a planar mesh face `<at>.cut.top` / `.bottom`.
 */
export declare function splitMixedBrep(a: Brep, normal: Point, offset: number, at: string, segmentsPerQuarter?: number): {
    below: Brep | null;
    above: Brep | null;
};
/**
 * A mixed body (mesh faces and exact ones, an earlier F2) as mesh faces only, each face its name: the exact faces
 * sampled at `segmentsPerQuarter` (STEP writes a mesh body tessellated or as planar faces; the exact faces' surfaces
 * have no tessellated form beside them).
 */
export declare function facetedCopy(a: Brep, segmentsPerQuarter?: number): Brep;
