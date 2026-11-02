import { type Brep } from './brep-core.js';
import type { Curve, Point, Surface } from '../types.js';
export interface BrepMeshFace {
    readonly faceId: string;
    readonly kind: 'planar' | 'ruled' | 'trimmed' | 'facet';
    readonly vertexOffset: number;
    readonly vertexCount: number;
    readonly indexOffset: number;
    readonly indexCount: number;
}
export interface BrepMeshEdge {
    readonly edgeId: string;
    readonly points: Float64Array;
}
export interface BrepMesh {
    readonly positions: Float64Array;
    readonly normals: Float64Array;
    readonly indices: Uint32Array;
    readonly faces: readonly BrepMeshFace[];
    readonly edges: readonly BrepMeshEdge[];
}
export interface BrepTessellationOptions {
    readonly segmentsPerQuarter?: number;
}
type XY = [number, number];
/**
 * A rational quadratic circular arc (spans of control points P2s, P2s+1, P2s+2 with end weights 1):
 * centre, radius, and a frame fixed by the plane alone (canonical normal; first axis from world X),
 * so every circle in one plane shares it.
 */
export declare function circleOf(curve: Curve): {
    c: Point;
    r: number;
    e1: Point;
    e2: Point;
    spans: {
        k0: number;
        k1: number;
        phi: number;
    }[];
    a0: number;
    sign: number;
} | null;
export declare function triangulatePolygonWithHoles(outer: readonly XY[], holes: readonly (readonly XY[])[], earCost?: (a: XY, b: XY, c: XY) => number): [number, number, number][];
/** A flat bilinear patch's frame (its normal along ∂S/∂u × ∂S/∂v), or null when the surface is not one. */
export declare function planar(surface: Surface): {
    origin: Point;
    normal: Point;
    e1: Point;
    e2: Point;
} | null;
export declare function tessellateBrep(brep: Brep, options?: BrepTessellationOptions): BrepMesh;
/** A face's vertices in a parameter domain of its surface, and the exact surface there (mass quadrature). */
export interface FaceParameters {
    readonly uv: readonly XY[];
    readonly at: (u: number, v: number) => Point;
    /** Exact cylinder-frame differential and projection, all in the same arc-length/height coordinates. */
    readonly analytic?: {
        partials(u: number, v: number): readonly [Point, Point];
        project(point: Point, seed: readonly [number, number]): XY;
        projectDerivative(point: Point, derivative: Point): XY;
    };
    /** The triangles covering the domain (local indices) when they differ from the mesh's: on a pole side, those collapsed in space. */
    readonly domain?: readonly (readonly [number, number, number])[];
    /** `uv` is the surface's own (u, v), `at` its own evaluator: its knots and domain apply (FRk8b, D167). Else a frame's (a ruled wall's) parameters. */
    readonly own?: true;
}
/** The mesh with, for the faces triangulated in a parameter domain, each vertex's (u, v) there; `only`: just those faces (their edges sampled as for the whole B-rep). */
/** An edge's stretch between two of its samples: its curve, and the parameters at `from` (a sample point) and at the other end. */
export interface EdgeSegment {
    readonly curve: Curve;
    readonly from: Point;
    readonly tFrom: number;
    readonly tTo: number;
}
export declare function tessellateBrepWithParameters(brep: Brep, options?: BrepTessellationOptions, only?: ReadonlySet<string> | null): {
    mesh: BrepMesh;
    parameters: Map<string, FaceParameters>;
    segments: Map<string, EdgeSegment>;
};
/** The key of a mesh segment between two sample points, the same either way round (for `segments`). */
export declare function segmentKey(a: ArrayLike<number>, b: ArrayLike<number>): string;
/** Sides of a patch's domain that collapse to one point (poles): `along` is the coordinate that varies. */
export declare function polesOf(S: Surface): {
    along: 0 | 1;
    at: number;
    point: Point;
}[];
export {};
