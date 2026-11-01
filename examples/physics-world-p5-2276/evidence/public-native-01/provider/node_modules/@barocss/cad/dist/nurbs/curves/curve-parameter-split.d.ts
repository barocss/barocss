import type { CurveKnotInsertionProvenance, CurveKnotUnchangedPole, CurveKnotUnchangedKnot } from './curve-knot-insertion.js';
import type { Curve, Model, Point } from '../../types.js';
export interface CurveParameterSplitOptions {
    parameter: number;
    lowerCurveId: string;
    upperCurveId: string;
}
export interface CurveSplitPoleMapping {
    refinedPoleIndex: number;
    childPoleIndex: number;
}
export interface CurveSplitKnotMapping {
    childKnotIndex: number;
    refinedKnotIndex: number | null;
    value: number;
    origin: 'refined-copy' | 'requested-clamp';
}
export interface CurveSplitChildProvenance {
    side: 'lower' | 'upper';
    curveId: string;
    poleMappings: CurveSplitPoleMapping[];
    knots: CurveSplitKnotMapping[];
}
export interface CurveSplitRefinementProvenance {
    kind: 'knot-insertion' | 'direct-copy';
    insertions: number;
    operation: CurveKnotInsertionProvenance | null;
    unchangedPoles: CurveKnotUnchangedPole[];
    unchangedKnots: CurveKnotUnchangedKnot[];
}
export interface CurveSplitSharedCoefficient {
    refinedPoleIndex: number;
    lowerPoleIndex: number;
    upperPoleIndex: number;
    point: Point;
    weight: number;
}
export interface CurveParameterSplitProvenance {
    kind: 'curve-parameter-split';
    sourceCurveId: string;
    parameter: number;
    firstRefinedKnotIndex: number;
    refinement: CurveSplitRefinementProvenance;
    lower: CurveSplitChildProvenance;
    upper: CurveSplitChildProvenance;
    shared: CurveSplitSharedCoefficient;
}
export interface CurveParameterSplitReport {
    kind: 'curve-parameter-split';
    curveId: string;
    lengthUnit: 'mm';
    parameter: number;
    degree: number;
    originalMultiplicity: number;
    requiredInsertions: number;
    refinedMultiplicity: number;
    poleCounts: {
        original: number;
        refined: number;
        lower: number;
        upper: number;
    };
    domains: {
        original: [number, number];
        refined: [number, number];
        lower: [number, number];
        upper: [number, number];
    };
    cutEndpoints: {
        requested: number;
        lower: number;
        upper: number;
        negativeZero: {
            requested: boolean;
            lower: boolean;
            upper: boolean;
        };
    };
    cutKnotGuards: {
        original: boolean;
        refined: boolean;
        lowerEndpoint: boolean;
        upperEndpoint: boolean;
    };
    guardedKnots: {
        original: number[];
        refined: number[];
        lower: number[];
        upper: number[];
    };
    derivativeSemantics: 'native-guards-unchanged';
    shared: CurveSplitSharedCoefficient;
    sharedCutPoints: {
        originalPoint: Point;
        refinedPoint: Point;
        lowerPoint: Point;
        upperPoint: Point;
        maximumObservedDifference: number;
    };
    observations: {
        side: 'lower' | 'upper';
        curveId: string;
        parameter: number;
        originalPoint: Point;
        refinedPoint: Point;
        childPoint: Point;
        originalDifference: number;
        refinedDifference: number;
    }[];
    maximumObservedDifference: number;
    authority: 'original-curve-coefficients';
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    limits: {
        maximumPoles: 16;
        maximumDegree: 3;
        authoredIdCharacters: 48;
        snapshotValues: 1024;
        snapshotDepth: 6;
        arrayElements: 64;
        recordFields: 8;
        stringCharacters: 128;
        maximumObservations: 64;
        observationComparison: number;
    };
}
export interface CurveParameterSplitResult {
    original: Curve;
    refined: Curve;
    lower: Curve;
    upper: Curve;
    source: string;
    sourceVersion: 0;
    model: Model;
    provenance: CurveParameterSplitProvenance;
    report: CurveParameterSplitReport;
}
/** Two increasing-parameter native Curves through actual original knot refinement. */
export declare function splitCurveAtParameter(input: Curve, options: CurveParameterSplitOptions): CurveParameterSplitResult;
