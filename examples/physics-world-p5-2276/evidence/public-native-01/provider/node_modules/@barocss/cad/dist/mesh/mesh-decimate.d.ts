export interface DecimateOptions {
    /** Stop at this many triangles or fewer. */
    readonly targetTriangles?: number;
    /** Or at this share of the triangles (0–1); with neither, as far as `maxError` lets it go. */
    readonly ratio?: number;
    /** Make no collapse whose quadric bound (the square root of its cost) passes this (mm). */
    readonly maxError?: number;
    /** A dihedral angle past this (degrees, default 40) makes an edge a crease, kept as a feature line. */
    readonly feature?: number;
    /** Per triangle, a group (any integer); edges between groups are feature lines, and every triangle keeps its group. */
    readonly groups?: ArrayLike<number>;
    /** Measure the distance between the original and the result (default true). */
    readonly measure?: boolean;
}
export interface DecimateReport {
    readonly trianglesBefore: number;
    readonly trianglesAfter: number;
    readonly verticesBefore: number;
    readonly verticesAfter: number;
    readonly collapses: number;
    /** Collapses not made: they would turn a triangle over or flatten it; they would break the manifold. */
    readonly refused: {
        readonly flip: number;
        readonly topology: number;
    };
    /** Why it stopped: the target reached, the error bound reached, or nothing left that it may collapse. */
    readonly stoppedBy: 'target' | 'error' | 'exhausted';
    /** The largest quadric bound of a collapse made (mm): no vertex is further than it from any plane it gathered. */
    readonly bound: number;
    /** Measured (when asked): from the original to the result, from the result to the original, the larger, and the RMS of both. */
    readonly distance?: {
        readonly toResultMax: number;
        readonly toOriginalMax: number;
        readonly hausdorff: number;
        readonly rms: number;
        readonly samples: number;
    };
    /** Wall time in seconds, from the existing measurement interval. */
    readonly wallTime: number;
}
export interface DecimateResult {
    readonly positions: Float64Array;
    readonly indices: Uint32Array;
    readonly groups: Int32Array | null;
    readonly report: DecimateReport;
}
export declare function decimateMesh(positions: ArrayLike<number>, indices: ArrayLike<number>, options?: DecimateOptions): DecimateResult;
