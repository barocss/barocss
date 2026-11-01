import type { Point, Surface } from '../types.js';
import { KernelError } from '../core/barocss-error.js';
export declare class SubdError extends KernelError {
    readonly code: 'INPUT' | 'CAPABILITY';
    constructor(code: 'INPUT' | 'CAPABILITY', detail: string);
}
export interface PolyCage {
    readonly positions: ArrayLike<number>;
    readonly faces: readonly (readonly number[])[];
    readonly creases?: readonly (readonly [number, number])[];
}
type P3 = [number, number, number];
/** The most edges at a vertex (and sides of a face) SD2 takes. */
export declare const SUBD_MAX_VALENCE = 32;
export type VertexKind = 'smooth' | 'dart' | 'crease' | 'corner';
/** A vertex's faces in order round it (each the next across the previous one's second edge), its edges between them. */
export interface Fan {
    readonly faces: {
        readonly face: number;
        readonly side: number;
    }[];
    /** The other ends of the edges in order: edge k is face k's first edge (and face k − 1's second); K + 1 of them when open. */
    readonly ends: number[];
    readonly sharp: boolean[];
    readonly closed: boolean;
    readonly kind: VertexKind;
    readonly regular: boolean;
}
export interface PolyMesh {
    readonly P: Float64Array;
    readonly nv: number;
    readonly F: number[][];
    /** Half-edges: face k side s (F[k][s] → F[k][s + 1]) is start[k] + s; its twin, −1 on a boundary. */
    readonly start: Int32Array;
    readonly twin: Int32Array;
    readonly heFace: Int32Array;
    readonly heSide: Int32Array;
    /** Sharp: a boundary edge or a crease. */
    readonly sharp: Uint8Array;
    readonly crease: Set<number>;
    readonly fans: (Fan | null)[];
}
/** The cage checked and its topology: half-edges, sharp edges and each vertex's fan, kind and regularity. */
export declare function polyMesh(cage: PolyCage, allowNgons?: boolean, lenient?: boolean): PolyMesh;
export interface Refined {
    readonly cage: {
        positions: number[];
        faces: number[][];
        creases: [number, number][];
    };
    readonly labels: string[];
}
/** One Catmull–Clark step of a polygon cage: each face of n sides n quads (labelled `<face label>_<corner>`). */
export declare function refine(m: PolyMesh, labels?: readonly string[]): Refined;
/** A vertex's limit position: smooth and dart (n²·v + 4·Σ edge ends + Σ diagonals) / (n(n + 5)), crease (a + 4v + b)/6, corner v. */
export declare function limitPosition(m: PolyMesh, v: number): P3;
/** A quad's bicubic Bézier net in the frame from corner `r` (u along its first edge, v along the edge before it). */
export declare function bezierNet(m: PolyMesh, face: number, r: number): P3[][];
/** The 4 × 4 net split at τ both ways: 7 × 7 Bézier points of its 2 × 2 pieces. */
export declare function splitNet(B: P3[][], t?: number): P3[][];
export interface Cap {
    readonly face: number;
    readonly r: number;
    readonly vertex: number; /** 6 × 6 B-spline poles, knots 0 0 0 0 τ τ 1 1 1 1 both ways. */
    readonly poles: Point[][];
    readonly tau: number;
    /** The largest distance from the limit surface's samples (a 17 × 17 grid, finer than the fit's) to the cap, by closest points. */
    readonly deviationMM: number;
    /** Its vertex's kind: at a crease or a corner (or a boundary) the caps' even angles cost the most (D78). */
    readonly kind: VertexKind;
}
export declare const capKnots: (tau: number) => number[];
/** The caps round every irregular vertex of a quad cage (each quad at most one irregular corner). */
export declare function buildCaps(m: PolyMesh, scale: number): Map<number, Cap>;
/** A cap's poles as its surface (for the fit's closest points). */
export declare function capSurface(poles: Point[][], tau: number): Surface;
/** The closest point on a cap to p from (u, v): damped Gauss–Newton, kept within [0, 1]². */
export declare function closestOnCap(S: Surface, p: readonly number[], u: number, v: number): [number, number];
/**
 * The Catmull–Clark limit surface over a quad of a quad cage at (i / 2^levels, j / 2^levels) in the frame from its
 * corner `r`: its one-ring refined `levels` times (its own region exact: a quad's limit depends on its one-ring only),
 * each vertex over the quad taken to its limit position.
 */
export declare function limitGrid(m: PolyMesh, face: number, r: number, levels: number): LimitSample[];
export interface LimitSample {
    u: number;
    v: number;
    p: P3;
}
/** limitGrid at several levels (ascending) from one refinement of the one-ring (PERF3 A4: the fit's 9 × 9 and the deviation's 17 × 17). */
export declare function limitGrids(m: PolyMesh, face: number, r: number, levels: readonly number[]): LimitSample[][];
export {};
