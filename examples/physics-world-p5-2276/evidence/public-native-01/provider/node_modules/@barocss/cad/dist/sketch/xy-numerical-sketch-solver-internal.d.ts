import type { XYNumericalSketchDocumentV0, XYNumericalSketchPoint, XYNumericalSketchReport, XYNumericalSketchResidual } from './xy-numerical-sketch.js';
export declare const limits: Readonly<{
    points: 16;
    segments: 16;
    constraints: 32;
    scalarResiduals: 64;
    unknowns: 32;
    branchGuards: 16;
    coordinateAbs: 10000;
    minimumSegment: 0.001;
    iterations: 100;
    evaluations: 1200;
}>;
/**
 * `bounded-length-angle-v1`: the same solver and tolerances over larger bounded sketches (outlines with
 * several placed circles). v0's limits are unchanged.
 */
export declare const limitsV1: Readonly<{
    points: 64;
    segments: 64;
    constraints: 128;
    scalarResiduals: 256;
    unknowns: 128;
    branchGuards: 32;
    coordinateAbs: 10000;
    minimumSegment: 0.001;
    iterations: 100;
    evaluations: 1200;
}>;
export declare const limitsFor: (profile: string) => Readonly<{
    points: 16;
    segments: 16;
    constraints: 32;
    scalarResiduals: 64;
    unknowns: 32;
    branchGuards: 16;
    coordinateAbs: 10000;
    minimumSegment: 0.001;
    iterations: 100;
    evaluations: 1200;
}> | Readonly<{
    points: 64;
    segments: 64;
    constraints: 128;
    scalarResiduals: 256;
    unknowns: 128;
    branchGuards: 32;
    coordinateAbs: 10000;
    minimumSegment: 0.001;
    iterations: 100;
    evaluations: 1200;
}>;
export declare const tolerances: Readonly<{
    linear: 1e-7;
    angular: 1e-9;
    rankRelative: 1e-10;
}>;
export declare function wrap(angle: number): number;
/** Householder QR with recomputed column norms; strict > selects the first current column on a tie. */
export declare function qr(matrix: number[][], rhs: number[], columns: number): {
    solution: number[];
    rank: number;
    threshold: number;
};
/** Independently recomputed from each supplied candidate, with no cached geometry or residual. */
export declare function evaluate(d: XYNumericalSketchDocumentV0, x: number[]): {
    jacobian: number[][];
    residuals: XYNumericalSketchResidual[];
    objective: number;
};
export declare function solve(d: XYNumericalSketchDocumentV0): {
    points: XYNumericalSketchPoint[];
    report: XYNumericalSketchReport;
};
