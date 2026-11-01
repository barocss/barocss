import type { CurveD1Result } from '../../core/derivatives.js';
import type { Curve, Model, Point } from '../../types.js';
export interface BezierCurveDegreeElevationOptions {
    targetDegree: 2 | 3;
}
export interface BezierCurveElevatedInteriorPole {
    elevatedPoleIndex: number;
    leftOriginalPoleIndex: number;
    rightOriginalPoleIndex: number;
    alpha: number;
    leftHomogeneous: [number, number, number, number];
    rightHomogeneous: [number, number, number, number];
    leftContribution: [number, number, number, number];
    rightContribution: [number, number, number, number];
    homogeneous: [number, number, number, number];
    pointMM: Point;
    weight: number;
}
export interface BezierCurveElevationKnot {
    elevatedKnotIndex: number;
    originalKnotIndex: number | null;
    value: number;
    origin: 'original-copy' | 'start-clamp' | 'end-clamp';
}
export interface BezierCurveDegreeElevationProvenance {
    kind: 'one-step-rational-bezier-degree-elevation';
    curveId: string;
    originalDegree: number;
    targetDegree: 2 | 3;
    endpoints: {
        originalPoleIndex: number;
        elevatedPoleIndex: number;
        pointMM: Point;
        weight: number;
    }[];
    interior: BezierCurveElevatedInteriorPole[];
    knots: BezierCurveElevationKnot[];
}
export type BezierCurveDegreeD1Evaluation = {
    kind: 'evaluated';
    result: CurveD1Result;
} | {
    kind: 'refused';
    message: string;
};
export interface BezierCurveDegreeD1Observation {
    parameter: number;
    original: BezierCurveDegreeD1Evaluation;
    elevated: BezierCurveDegreeD1Evaluation;
}
export interface BezierCurveDegreeElevationReport {
    kind: 'bezier-curve-degree-elevation';
    curveId: string;
    lengthUnit: 'mm';
    originalDegree: number;
    targetDegree: 2 | 3;
    originalPoleCount: number;
    elevatedPoleCount: number;
    domain: [number, number];
    representedSpan: number;
    endpointBitsRetained: true;
    observations: {
        parameter: number;
        originalPointMM: Point;
        elevatedPointMM: Point;
        differenceMM: number;
    }[];
    maximumObservedDifferenceMM: number;
    derivativeObservations: BezierCurveDegreeD1Observation[];
    derivativeSemantics: 'native-arithmetic-refusals-retained';
    authority: 'original-single-span-bezier-coefficients';
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    limits: {
        maximumOriginalDegree: 2;
        maximumTargetDegree: 3;
        maximumElevationsPerCall: 1;
        maximumElevatedPoles: 4;
        authoredIdCharacters: 48;
        snapshotValues: 1024;
        snapshotDepth: 6;
        arrayElements: 64;
        recordFields: 8;
        stringCharacters: 128;
        maximumObservations: 5;
        maximumDerivativeObservations: 3;
        observationComparisonMM: 1e-7;
    };
}
export interface BezierCurveDegreeElevationResult {
    original: Curve;
    elevated: Curve;
    source: string;
    sourceVersion: 0;
    model: Model;
    provenance: BezierCurveDegreeElevationProvenance;
    report: BezierCurveDegreeElevationReport;
}
/** One-step homogeneous Bernstein elevation of an original rational Bezier Curve. */
export declare function elevateBezierCurveDegree(input: Curve, options: BezierCurveDegreeElevationOptions): BezierCurveDegreeElevationResult;
