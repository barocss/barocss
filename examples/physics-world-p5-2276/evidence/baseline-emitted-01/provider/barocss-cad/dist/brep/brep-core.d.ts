import type { Curve, FacetPatch, Point, Surface } from '../types.js';
import { KernelError } from '../core/barocss-error.js';
export interface BrepVertex {
    readonly id: string;
    readonly point: Point;
    readonly tolerance: number;
}
/** An edge runs along `curve` over its whole domain, from vertices[0] (domain start) to vertices[1] (domain end). */
export interface BrepEdge {
    readonly id: string;
    readonly curve: Curve;
    readonly vertices: readonly [string, string];
    readonly tolerance: number;
    readonly name?: string;
}
/**
 * One use of an edge by a loop. `forward` traverses the edge from vertices[0] to vertices[1].
 * `pcurve` (optional) is the edge in the face's (u, v) parameter space, as a curve with z = 0 and the
 * edge curve's domain.
 */
export interface BrepCoedge {
    readonly id: string;
    readonly edge: string;
    readonly sense: 'forward' | 'reversed';
    readonly loop: string;
    readonly next: string;
    readonly prev: string;
    readonly twin: string | null;
    readonly pcurve: Curve | null;
}
export interface BrepLoop {
    readonly id: string;
    readonly face: string;
    readonly kind: 'outer' | 'inner';
    readonly coedges: readonly string[];
}
/** `sense: 'forward'` means the outward normal is ∂S/∂u × ∂S/∂v. */
/** `name` (optional) is a persistent name: it follows the authored feature that made the face, not its id. */
export interface BrepFace {
    readonly id: string;
    readonly shell: string;
    readonly surface: Surface | FacetPatch;
    readonly sense: 'forward' | 'reversed';
    readonly loops: readonly string[];
    readonly name?: string;
}
export interface BrepShell {
    readonly id: string;
    readonly body: string;
    readonly faces: readonly string[];
    readonly closed: boolean;
}
export interface BrepBody {
    readonly id: string;
    readonly kind: 'solid' | 'sheet';
    readonly shells: readonly string[];
}
export interface Brep {
    readonly format: 'barocss-brep';
    readonly version: 0;
    readonly lengthUnit: 'mm';
    /** Which body family and native result this B-rep was converted from (provenance only). */
    readonly source: {
        readonly family: string;
        readonly id: string;
    };
    readonly bodies: readonly BrepBody[];
    readonly shells: readonly BrepShell[];
    readonly faces: readonly BrepFace[];
    readonly loops: readonly BrepLoop[];
    readonly coedges: readonly BrepCoedge[];
    readonly edges: readonly BrepEdge[];
    readonly vertices: readonly BrepVertex[];
}
export interface BrepBodyTopology {
    readonly body: string;
    readonly vertices: number;
    readonly edges: number;
    readonly faces: number;
    readonly loops: number;
    readonly shells: number;
    readonly genus: number;
}
export interface BrepCheckReport {
    readonly valid: boolean;
    /** First problems found (at most 32), as `kind: detail`. Empty when valid. */
    readonly issues: readonly string[];
    readonly counts: {
        readonly bodies: number;
        readonly shells: number;
        readonly faces: number;
        readonly loops: number;
        readonly coedges: number;
        readonly edges: number;
        readonly vertices: number;
    };
    /** Euler–Poincaré per body: V − E + F − (L − F) = 2(S − G), solved for the genus G. */
    readonly topology: readonly BrepBodyTopology[];
    readonly maximumVertexGap: number;
    readonly maximumPcurveGap: number;
    /** With `strict`: the largest distance of an edge's sample from a surface of a face using it (else 0). */
    readonly maximumEdgeSurfaceGap: number;
}
/**
 * A B-rep refusal: its code, and for a refusal a caller acts on, a typed `reason` (never the message's wording):
 * `NOT_PLANAR_WITHIN_FLOAT` — the polyhedral Boolean's face whose vertices are coplanar only to binary64 (FR3b, D126).
 */
export type BrepErrorReason = 'NOT_PLANAR_WITHIN_FLOAT';
export declare class BrepError extends KernelError {
    readonly code: 'INPUT' | 'TOPOLOGY' | 'GEOMETRY';
    readonly report?: BrepCheckReport | undefined;
    readonly reason?: BrepErrorReason | undefined;
    constructor(code: 'INPUT' | 'TOPOLOGY' | 'GEOMETRY', detail: string, report?: BrepCheckReport | undefined, reason?: BrepErrorReason | undefined);
}
/**
 * A face's surface where only a parametric one will do: a facet face (F0) is refused with a typed GEOMETRY error
 * saying the operation does not take mesh faces yet (part-model maps "not supported yet" to CAPABILITY).
 */
export declare function nurbsOf(face: {
    readonly id: string;
    readonly surface: Surface | FacetPatch;
}, what?: string): Surface;
export declare const isFacetFace: (face: {
    readonly surface: Surface | FacetPatch;
}) => boolean;
/** ∂S/∂u × ∂S/∂v at the middle of the surface domain (central differences). */
export declare function surfaceNormalAtCentre(surface: Surface): Point;
/** Vector area (½∮ p × dp) of a loop of directed curve uses: straight and polyline uses by their corners, others sampled 16 times. */
export declare function loopVectorArea(uses: readonly {
    readonly curve: Curve;
    readonly sense: 'forward' | 'reversed';
}[]): Point;
/**
 * Whether a loop of directed curve uses on `surface` runs counter-clockwise in its (u, v) domain (`true`) or clockwise
 * (`false`); `undefined` where that cannot be told: a sample more than `reach` off the surface, a ring that does not
 * close in the domain (it winds round a closed direction), or one enclosing no area. A direction in which the surface
 * closes on itself is unwrapped along the ring. Each use is sampled as `loopVectorArea` samples it.
 */
export declare function loopWindsInDomain(surface: Surface, uses: readonly {
    readonly curve: Curve;
    readonly sense: 'forward' | 'reversed';
}[], reach: number): boolean | undefined;
/**
 * Whether `surface` turns by more than a half turn along u or v (its normal at a domain end more than 90° from the
 * middle's, along the domain's middle line), with no domain side collapsed to a point (no pole: a ball's and a cone's
 * sense stay with the vector area). Only there can a face's normals lie more than 90° from the middle's: a face over most
 * of a turn — a cylinder's 354°, its gap anywhere in the domain — is judged by its outer loop's vector area neither way,
 * and its winding in the domain does (D257, D263).
 */
export declare function wrapsWithoutPoles(surface: Surface, reach: number): boolean;
/** Coedge start / end vertex ids. */
export declare function coedgeVertices(brep: Brep, coedge: BrepCoedge, edges?: Map<string, BrepEdge>): [string, string];
/**
 * Checks topology (references, loop cycles, twins, manifold edges and vertex links, Euler–Poincaré)
 * and geometry (edge ends on their vertices, pcurves on their surfaces) within entity tolerances.
 * `strict` adds the L0 geometric checks (brep-check-geometry.ts): edges on their faces' surfaces, loops
 * not crossing in a face's parameters, no sliver faces, tolerances under a cap of the model's size.
 */
export declare function checkBrep(brep: Brep, options?: {
    readonly pcurveSamples?: number;
    readonly strict?: boolean;
}): BrepCheckReport;
/** Throws a BrepError carrying the report when the B-rep is not valid. */
export declare function assertValidBrep(brep: Brep): BrepCheckReport;
export interface BrepLoopInput {
    readonly kind: 'outer' | 'inner';
    readonly uses: readonly {
        readonly edge: string;
        readonly sense: 'forward' | 'reversed';
        readonly pcurve?: Curve | null;
    }[];
}
export interface BrepFaceInput {
    readonly id: string;
    readonly surface: Surface | FacetPatch;
    readonly sense: 'forward' | 'reversed';
    readonly loops: readonly BrepLoopInput[];
    readonly name?: string;
}
export interface BrepShellInput {
    readonly id: string;
    readonly faces: readonly BrepFaceInput[];
    readonly closed: boolean;
}
export interface BrepBuildInput {
    readonly source: Brep['source'];
    /** (`tolerance` on a vertex or an edge: its own, for one that is tolerant — a fitted offset's, D110; else the B-rep's.) */
    readonly vertices: readonly {
        readonly id: string;
        readonly point: Point;
        readonly tolerance?: number;
    }[];
    readonly edges: readonly {
        readonly id: string;
        readonly curve: Curve;
        readonly vertices: readonly [string, string];
        readonly name?: string;
        readonly tolerance?: number;
    }[];
    readonly bodies: readonly {
        readonly id: string;
        readonly kind: 'solid' | 'sheet';
        readonly shells: readonly BrepShellInput[];
    }[];
    /** Entity tolerance; defaults to CadNumericPolicy.linearTolerance at the geometry's scale. */
    readonly tolerance?: number;
}
export declare function buildBrep(input: BrepBuildInput): Brep;
/** A straight edge curve between two points, domain [0, 1]. */
export declare const lineCurve: (id: string, a: Point, b: Point) => Curve;
/** Several B-reps (with disjoint ids) as one B-rep holding all of their bodies. */
export declare function mergeBreps(breps: readonly Brep[], source: Brep['source']): Brep;
