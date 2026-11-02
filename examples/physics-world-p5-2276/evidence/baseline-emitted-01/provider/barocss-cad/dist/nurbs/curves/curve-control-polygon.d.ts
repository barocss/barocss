import type { CurveD1Result } from '../../core/derivatives.js';
import type { Curve, Model, Point } from '../../types.js';
export type CurvePoleField = 'xMM' | 'yMM' | 'zMM' | 'weight';
export interface CurvePoleEdit {
    index: number;
    xMM?: number;
    yMM?: number;
    zMM?: number;
    weight?: number;
}
export interface CurveControlPolygonEdits {
    poleEdits: CurvePoleEdit[];
}
export interface CurvePoleEditProvenance {
    index: number;
    requestedFields: CurvePoleField[];
    changedFields: CurvePoleField[];
    before: {
        pointMM: Point;
        weight: number;
    };
    after: {
        pointMM: Point;
        weight: number;
    };
}
export type CurveControlPolygonD1Evaluation = {
    kind: 'evaluated';
    result: CurveD1Result;
} | {
    kind: 'refused';
    message: string;
};
export interface CurveControlPolygonD1Observation {
    parameter: number;
    before: CurveControlPolygonD1Evaluation;
    after: CurveControlPolygonD1Evaluation;
}
export interface CurveControlPolygonReport {
    kind: 'curve-control-polygon-edit';
    curveId: string;
    lengthUnit: 'mm';
    domain: [number, number];
    degree: number;
    controlPointCount: number;
    requestedPoleCount: number;
    changedPoleCount: number;
    changedFieldCount: number;
    untouchedPoleCount: number;
    untouchedFieldCount: number;
    observations: {
        parameter: number;
        beforePointMM: Point;
        afterPointMM: Point;
        observedChangeMM: number;
    }[];
    maximumObservedChangeMM: number;
    derivativeObservations: CurveControlPolygonD1Observation[];
    guardedKnots: number[];
    derivativeSemantics: 'native-guards-unchanged';
    authority: 'direct-curve-coefficients';
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    limits: {
        maximumPoles: 16;
        maximumDegree: 3;
        maximumEdits: 16;
        authoredIdCharacters: 48;
        snapshotValues: 1024;
        snapshotDepth: 6;
        arrayElements: 64;
        recordFields: 8;
        stringCharacters: 128;
        maximumObservations: 32;
        maximumDerivativeObservations: 3;
    };
}
export interface CurveControlPolygonResult {
    original: Curve;
    curve: Curve;
    source: string;
    sourceVersion: 0;
    model: Model;
    provenance: CurvePoleEditProvenance[];
    report: CurveControlPolygonReport;
}
/** Trusted patch admission/application; callers snapshot and establish their own capacity/profile. */
export declare function applyCurvePoleEditsTrusted(original: Curve, poleEdits: unknown[]): {
    candidate: Curve;
    provenance: CurvePoleEditProvenance[];
};
/** Atomic Cartesian/weight coefficient edits on a directly authored original Curve. */
export declare function editCurveControlPolygon(input: Curve, edits: CurveControlPolygonEdits): CurveControlPolygonResult;
