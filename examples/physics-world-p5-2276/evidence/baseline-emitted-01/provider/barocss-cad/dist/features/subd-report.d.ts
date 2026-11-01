import { type SubdCage, type SubdOptions } from './subd.js';
export interface SubdReport {
    /** Catmull–Clark steps taken (0: regular, SD1), irregular vertices and caps after them, B-rep faces. */
    readonly steps: number;
    readonly irregularVertices: number;
    readonly capCount: number;
    readonly faces: number;
    /** The largest angle between the two faces' normals along edges that are not sharp, over `samples` points; the largest gap. */
    readonly g1: {
        readonly maxAngleDeg: number;
        readonly edges: number;
        readonly samples: number;
        readonly maxGapMM: number;
        readonly sharpEdges: number;
    };
    /**
     * The caps' shape on a 33 × 33 grid of each: the smallest |Su × Sv| against the cap's median (0: a degenerate point)
     * and the largest angle between neighbouring grid points' normals (near 180°: a fold). G1 along edges and a small
     * distance from the limit do not show a fold; this does.
     */
    readonly caps: {
        readonly minJacobianRatio: number;
        readonly maxNormalTurnDeg: number;
    };
    /** The caps' largest and root-mean-square distance of the limit samples to them; at the same parameters; the exact quads' (≈ 0). */
    readonly deviation: {
        readonly maxMM: number;
        readonly rmsMM: number;
        readonly parametricMaxMM: number;
        readonly samples: number;
        readonly levels: number;
        readonly exactMaxMM: number;
        readonly exactSamples: number;
    };
}
export interface SubdReportOptions extends SubdOptions {
    readonly levels?: number;
    readonly samplesPerEdge?: number;
    readonly exactQuads?: number;
}
export declare function subdReport(cage: SubdCage, options?: SubdReportOptions): SubdReport;
