import type { Curve, Point } from '../../types.js';
export type C0ElevationHomogeneous = [number, number, number, number];
export interface C0ElevationKnotBlock {
    index: number;
    value: number;
    originalFirstKnotIndex: number;
    originalLastKnotIndex: number;
    multiplicity: number;
}
export interface C0ElevationGeneratedReceipt {
    outputPoleIndex: number;
    leftOriginalPoleIndex: number;
    rightOriginalPoleIndex: number;
    alpha: number;
    leftHomogeneous: C0ElevationHomogeneous;
    rightHomogeneous: C0ElevationHomogeneous;
    leftContribution: C0ElevationHomogeneous;
    rightContribution: C0ElevationHomogeneous;
    homogeneous: C0ElevationHomogeneous;
    pointMM: Point;
    weight: number;
}
export interface C0ElevationSpanReceipt {
    index: number;
    domain: [number, number];
    originalPoleIndices: number[];
    outputPoleIndices: number[];
    generated: C0ElevationGeneratedReceipt[];
}
export interface C0ElevationKnotReceipt {
    outputKnotIndex: number;
    originalKnotIndex: number | null;
    value: number;
    origin: 'original-copy' | 'degree-multiplicity-increase';
    blockIndex: number;
}
export interface C0ElevationCoefficientResult {
    candidate: Curve;
    liftedOriginalHomogeneous: C0ElevationHomogeneous[];
    spans: C0ElevationSpanReceipt[];
    copiedPoles: {
        originalPoleIndex: number;
        outputPoleIndex: number;
    }[];
    knots: C0ElevationKnotReceipt[];
}
/** PRIVATE: root supplies admitted actual C0 data, dimensions and represented knot blocks. */
export declare function elevateC0BezierChainCoefficientsTrusted(original: Curve, blocks: C0ElevationKnotBlock[]): C0ElevationCoefficientResult;
