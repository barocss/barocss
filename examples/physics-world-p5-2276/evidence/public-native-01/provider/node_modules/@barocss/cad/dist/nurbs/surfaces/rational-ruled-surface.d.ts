import type { CurveD1Result, SurfaceD1Result } from '../../core/derivatives.js';
import type { Curve, Surface, Model, Point } from '../../types.js';
export interface RationalRuledSurfaceOptions {
    surfaceId: string;
}
export interface RationalRuledSurfaceConstruction {
    kind: 'independent-weight-two-curve-ruled';
    firstCurveId: string;
    secondCurveId: string;
    surfaceId: string;
    lengthUnit: 'mm';
    uRole: 'common-section-parameter';
    vRole: 'rational-section-interpolation';
    rows: {
        surfaceRowIndex: number;
        firstCurveId: string;
        firstPoleIndex: number;
        firstColumn: 0;
        firstWeight: number;
        secondCurveId: string;
        secondPoleIndex: number;
        secondColumn: 1;
        secondWeight: number;
    }[];
    knotsU: {
        surfaceKnotIndex: number;
        firstKnotIndex: number;
        secondKnotIndex: number;
        value: number;
    }[];
    knotsV: {
        surfaceKnotIndex: number;
        value: number;
        origin: 'cross-section-clamp';
    }[];
}
export type RationalRuledSurfaceObservation = {
    kind: 'evaluated';
    u: number;
    v: number;
    firstPointMM: Point;
    secondPointMM: Point;
    firstDenominator: number;
    secondDenominator: number;
    surfaceDenominator: number;
    secondFraction: number;
    expectedPointMM: Point;
    actualPointMM: Point;
    differenceMM: number;
    naiveCartesianPointMM: Point;
    naiveCartesianDifferenceMM: number;
} | {
    kind: 'refused';
    u: number;
    v: number;
    message: string;
};
export type RationalRuledCurveD1Evaluation = {
    kind: 'evaluated';
    result: CurveD1Result;
} | {
    kind: 'refused';
    message: string;
};
export type RationalRuledSurfaceD1Evaluation = {
    kind: 'evaluated';
    result: SurfaceD1Result;
} | {
    kind: 'refused';
    message: string;
};
export interface RationalRuledSurfaceD1Observation {
    u: number;
    v: number;
    first: RationalRuledCurveD1Evaluation;
    second: RationalRuledCurveD1Evaluation;
    surface: RationalRuledSurfaceD1Evaluation;
}
export interface RationalRuledSurfaceReport {
    kind: 'rational-ruled-surface';
    firstCurveId: string;
    secondCurveId: string;
    surfaceId: string;
    lengthUnit: 'mm';
    domains: {
        first: [number, number];
        second: [number, number];
        surface: {
            u: [number, number];
            v: [number, number];
        };
    };
    degrees: {
        u: number;
        v: 1;
    };
    controlPointCounts: {
        u: number;
        v: 2;
        total: number;
    };
    representedUSpan: number;
    sectionWeightsIdentical: boolean;
    parameterMeaning: 'denominator-weighted-section-interpolation';
    observations: RationalRuledSurfaceObservation[];
    successfulPointObservations: number;
    refusedPointObservations: number;
    maximumObservedDifferenceMM: number | null;
    maximumObservedNaiveCartesianDifferenceMM: number | null;
    derivativeObservations: RationalRuledSurfaceD1Observation[];
    guardedUKnots: number[];
    derivativeSemantics: 'native-guards-and-arithmetic-refusals-retained';
    parameterBoundarySemantics: 'original-extractSurfaceBoundary-convention';
    periodic: false;
    authority: 'original-section-coefficients';
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    limits: {
        maximumSectionPoles: 16;
        maximumSectionDegree: 3;
        maximumSurfacePoles: 32;
        authoredIdCharacters: 48;
        snapshotValues: 1024;
        snapshotDepth: 6;
        arrayElements: 64;
        recordFields: 8;
        stringCharacters: 128;
        maximumObservations: 15;
        maximumSurfaceDerivativeObservations: 5;
        observationComparisonMM: 1e-7;
    };
}
export interface RationalRuledSurfaceResult {
    first: Curve;
    second: Curve;
    surface: Surface;
    source: string;
    sourceVersion: 0;
    model: Model;
    construction: RationalRuledSurfaceConstruction;
    report: RationalRuledSurfaceReport;
}
/** Native rational ruled tensor Surface from equal-basis, independently weighted sections. */
export declare function buildRationalRuledSurface(firstInput: Curve, secondInput: Curve, options: RationalRuledSurfaceOptions): RationalRuledSurfaceResult;
