import type { CurveD1Result } from '../../core/derivatives.js';
import type { BezierCurveDegreeElevationResult, BezierCurveDegreeElevationProvenance } from '../curves/bezier-curve-degree-elevation.js';
import type { RationalRuledSurfaceResult, RationalRuledSurfaceReport } from './rational-ruled-surface.js';
import type { Curve, Surface, Model, Point } from '../../types.js';
export interface DegreeMatchedBezierRuledOptions {
    surfaceId: string;
    targetDegree: 2 | 3;
}
export interface DegreeMatchedBezierSectionProvenance {
    curveId: string;
    mode: 'direct-copy' | 'degree-elevation';
    originalDomain: [number, number];
    matchedDomain: [number, number];
    endpoints: {
        originalPoleIndex: number;
        matchedPoleIndex: number;
    }[];
    retainedKnots: {
        originalKnotIndex: number;
        matchedKnotIndex: number;
        value: number;
    }[];
    elevations: BezierCurveDegreeElevationProvenance[];
}
export interface DegreeMatchedBezierRuledProvenance {
    kind: 'explicit-degree-matched-bezier-ruled';
    surfaceId: string;
    targetDegree: 2 | 3;
    first: DegreeMatchedBezierSectionProvenance;
    second: DegreeMatchedBezierSectionProvenance;
}
export type DegreeMatchedBezierPointObservation = {
    kind: 'evaluated';
    parameter: number;
    originalPointMM: Point;
    matchedPointMM: Point;
    differenceMM: number;
} | {
    kind: 'refused';
    parameter: number;
    message: string;
};
export type DegreeMatchedBezierD1Evaluation = {
    kind: 'evaluated';
    result: CurveD1Result;
} | {
    kind: 'refused';
    message: string;
};
export interface DegreeMatchedBezierD1Observation {
    parameter: number;
    original: DegreeMatchedBezierD1Evaluation;
    matched: DegreeMatchedBezierD1Evaluation;
}
export interface DegreeMatchedBezierSectionReport {
    curveId: string;
    originalDegree: number;
    matchedDegree: 2 | 3;
    originalPoleCount: number;
    matchedPoleCount: number;
    stepCount: number;
    domains: {
        original: [number, number];
        matched: [number, number];
    };
    endpointBitsRetained: true;
    observations: DegreeMatchedBezierPointObservation[];
    maximumObservedDifferenceMM: number | null;
    derivativeObservations: DegreeMatchedBezierD1Observation[];
}
export interface DegreeMatchedBezierRuledReport {
    kind: 'degree-matched-bezier-ruled';
    surfaceId: string;
    lengthUnit: 'mm';
    targetDegree: 2 | 3;
    first: DegreeMatchedBezierSectionReport;
    second: DegreeMatchedBezierSectionReport;
    totalElevationSteps: number;
    ruled: RationalRuledSurfaceReport;
    parameterMeaning: 'denominator-weighted-section-interpolation';
    authority: 'original-bezier-sections-with-explicit-degree-matching';
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    limits: {
        maximumOriginalDegree: 3;
        maximumTargetDegree: 3;
        maximumOriginalPoles: 4;
        maximumElevationStepsPerSection: 2;
        authoredIdCharacters: 48;
        snapshotValues: 1024;
        snapshotDepth: 6;
        arrayElements: 64;
        recordFields: 8;
        stringCharacters: 128;
        maximumPointObservationsPerSection: 5;
        maximumDerivativeObservationsPerSection: 3;
        observationComparisonMM: 1e-7;
    };
}
export interface DegreeMatchedBezierRuledResult {
    originalFirst: Curve;
    originalSecond: Curve;
    matchedFirst: Curve;
    matchedSecond: Curve;
    steps: {
        first: BezierCurveDegreeElevationResult[];
        second: BezierCurveDegreeElevationResult[];
    };
    ruled: RationalRuledSurfaceResult;
    surface: Surface;
    source: string;
    sourceVersion: 0;
    model: Model;
    provenance: DegreeMatchedBezierRuledProvenance;
    report: DegreeMatchedBezierRuledReport;
}
/** Explicit original Bezier section matching through actual one-step and ruled operations. */
export declare function buildDegreeMatchedBezierRuledSurface(firstInput: Curve, secondInput: Curve, options: DegreeMatchedBezierRuledOptions): DegreeMatchedBezierRuledResult;
