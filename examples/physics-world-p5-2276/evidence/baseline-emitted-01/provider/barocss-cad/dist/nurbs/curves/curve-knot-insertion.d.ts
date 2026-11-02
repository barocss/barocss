import type { Curve, Model, Point } from '../../types.js';
export interface CurveKnotInsertionOptions {
    knot: number;
    insertions: number;
}
export interface CurveKnotUnchangedPole {
    originalPoleIndex: number;
    refinedPoleIndex: number;
}
export interface CurveKnotUnchangedKnot {
    originalKnotIndex: number;
    refinedKnotIndex: number;
}
export interface CurveKnotInsertionStep {
    insertion: number;
    spanIndex: number;
    priorMultiplicity: number;
    generatedPoles: {
        refinedPoleIndex: number;
        leftPriorPoleIndex: number;
        rightPriorPoleIndex: number;
        alpha: number;
    }[];
}
export interface CurveKnotInsertionProvenance {
    kind: 'homogeneous-curve-knot-insertion';
    curveId: string;
    degree: number;
    knot: number;
    insertions: number;
    unchangedPoles: CurveKnotUnchangedPole[];
    unchangedKnots: CurveKnotUnchangedKnot[];
    steps: CurveKnotInsertionStep[];
}
export interface CurveKnotInsertionReport {
    kind: 'curve-knot-insertion';
    curveId: string;
    knot: number;
    insertions: number;
    degree: number;
    domain: [number, number];
    originalPoleCount: number;
    refinedPoleCount: number;
    originalMultiplicity: number;
    refinedMultiplicity: number;
    observations: {
        parameter: number;
        originalPointMM: Point;
        refinedPointMM: Point;
        differenceMM: number;
    }[];
    maximumObservedDifferenceMM: number;
    guardedKnots: {
        original: number[];
        refined: number[];
    };
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    limits: {
        maximumPoles: 16;
        maximumDegree: 3;
        maximumInsertions: 3;
        authoredIdCharacters: 48;
        snapshotValues: 1024;
        snapshotDepth: 6;
        arrayElements: 64;
        recordFields: 8;
        stringCharacters: 128;
        observationComparisonMM: number;
    };
}
export interface CurveKnotInsertionResult {
    original: Curve;
    refined: Curve;
    source: string;
    sourceVersion: 0;
    model: Model;
    provenance: CurveKnotInsertionProvenance;
    report: CurveKnotInsertionReport;
}
export type CurveHomogeneousCoefficient = [number, number, number, number];
export interface CurveHomogeneousInsertionStep {
    insertion: number;
    spanIndex: number;
    priorMultiplicity: number;
    generatedPoles: {
        refinedPoleIndex: number;
        leftPriorPoleIndex: number;
        rightPriorPoleIndex: number;
        alpha: number;
        left: CurveHomogeneousCoefficient;
        right: CurveHomogeneousCoefficient;
        generated: CurveHomogeneousCoefficient;
    }[];
}
export interface CurveKnotCoefficientResult {
    candidate: Curve;
    unchangedPoles: CurveKnotUnchangedPole[];
    unchangedKnots: CurveKnotUnchangedKnot[];
    steps: CurveKnotInsertionStep[];
    homogeneousSteps: CurveHomogeneousInsertionStep[];
}
/** INTERNAL: caller supplies an admitted own Curve/request/capacity profile. No source or public admission widening. */
export declare function insertCurveKnotCoefficientsTrusted(original: Curve, knot: number, insertions: number): CurveKnotCoefficientResult;
/** Local homogeneous convex knot insertion; original evaluator remains authority. */
export declare function insertCurveKnot(input: Curve, options: CurveKnotInsertionOptions): CurveKnotInsertionResult;
