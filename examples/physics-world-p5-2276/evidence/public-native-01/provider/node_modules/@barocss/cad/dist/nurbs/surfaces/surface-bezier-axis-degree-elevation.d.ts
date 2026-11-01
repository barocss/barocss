import type { SurfaceD1Result } from '../../core/derivatives.js';
import type { BezierCurveDegreeElevationProvenance, BezierCurveDegreeElevationReport, BezierCurveElevationKnot } from '../curves/bezier-curve-degree-elevation.js';
import type { Surface, Model, Point } from '../../types.js';
export interface SurfaceBezierAxisDegreeElevationOptions {
    axis: 'u' | 'v';
    targetDegree: 2 | 3;
}
export interface SurfaceBezierAxisEndpointMapping {
    originalUIndex: number;
    originalVIndex: number;
    elevatedUIndex: number;
    elevatedVIndex: number;
}
export interface SurfaceBezierAxisDegreeStrip {
    fixedPoleIndex: number;
    curve: BezierCurveDegreeElevationProvenance;
    report: BezierCurveDegreeElevationReport;
}
export interface SurfaceBezierAxisDegreeElevationProvenance {
    kind: 'strip-bezier-surface-axis-degree-elevation';
    surfaceId: string;
    axis: 'u' | 'v';
    originalDegree: number;
    targetDegree: 2 | 3;
    endpointPoles: SurfaceBezierAxisEndpointMapping[];
    knots: BezierCurveElevationKnot[];
    strips: SurfaceBezierAxisDegreeStrip[];
}
export type SurfaceBezierAxisD1Evaluation = {
    kind: 'evaluated';
    result: SurfaceD1Result;
} | {
    kind: 'refused';
    message: string;
};
export interface SurfaceBezierAxisD1Observation {
    u: number;
    v: number;
    original: SurfaceBezierAxisD1Evaluation;
    elevated: SurfaceBezierAxisD1Evaluation;
}
export interface SurfaceBezierAxisDegreeElevationReport {
    kind: 'surface-bezier-axis-degree-elevation';
    surfaceId: string;
    lengthUnit: 'mm';
    axis: 'u' | 'v';
    originalDegree: number;
    targetDegree: 2 | 3;
    degrees: {
        original: {
            u: number;
            v: number;
        };
        elevated: {
            u: number;
            v: number;
        };
    };
    grids: {
        original: {
            u: number;
            v: number;
            total: number;
        };
        elevated: {
            u: number;
            v: number;
            total: number;
        };
    };
    domain: {
        u: [number, number];
        v: [number, number];
    };
    representedSpans: {
        u: number;
        v: number;
    };
    stripCount: number;
    endpointBitsRetained: true;
    nonselectedBitsRetained: true;
    observations: {
        u: number;
        v: number;
        originalPointMM: Point;
        elevatedPointMM: Point;
        differenceMM: number;
    }[];
    maximumObservedDifferenceMM: number;
    derivativeObservations: SurfaceBezierAxisD1Observation[];
    guardedKnots: {
        original: {
            u: number[];
            v: number[];
        };
        elevated: {
            u: number[];
            v: number[];
        };
    };
    stripReports: {
        fixedPoleIndex: number;
        report: BezierCurveDegreeElevationReport;
    }[];
    derivativeSemantics: 'native-guards-and-arithmetic-refusals-retained';
    authority: 'original-surface-coefficients';
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    limits: {
        maximumOriginalGridAxis: 16;
        maximumOriginalPoles: 256;
        maximumSelectedOriginalDegree: 2;
        maximumTargetDegree: 3;
        maximumOtherDegree: 3;
        maximumElevationsPerCall: 1;
        maximumElevatedSelectedPoles: 4;
        maximumStrips: 16;
        maximumElevatedPoles: 64;
        authoredIdCharacters: 48;
        snapshotValues: 4096;
        snapshotDepth: 8;
        arrayElements: 64;
        recordFields: 8;
        stringCharacters: 128;
        maximumObservations: 9;
        maximumDerivativeObservations: 5;
        observationComparisonMM: 1e-7;
    };
}
export interface SurfaceBezierAxisDegreeElevationResult {
    original: Surface;
    elevated: Surface;
    source: string;
    sourceVersion: 0;
    model: Model;
    provenance: SurfaceBezierAxisDegreeElevationProvenance;
    report: SurfaceBezierAxisDegreeElevationReport;
}
/** One selected Bezier axis elevated through actual original Curve strip operations. */
export declare function elevateSurfaceBezierAxisDegree(input: Surface, options: SurfaceBezierAxisDegreeElevationOptions): SurfaceBezierAxisDegreeElevationResult;
