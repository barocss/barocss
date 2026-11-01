import type { CurveSplitSharedCoefficient, CurveParameterSplitReport } from './curve-parameter-split.js';
import type { Curve, Model, Point } from '../../types.js';
export interface AdaptiveCurveSamplingOptions {
    chordToleranceMM: number;
    maxSegments: number;
    maxDepth: number;
    resultIdPrefix: string;
}
export interface AdaptiveCurveSample {
    id: string;
    parameter: number;
    pointMM: Point;
    adjacentSegmentIds: string[];
    originalSpanIndices: number[];
    atOriginalKnot: boolean;
    originalD1Guarded: boolean;
}
export interface AdaptiveCurveObservation {
    parameter: number;
    originalPointMM: Point;
    extractedPointMM: Point;
    extractionDifferenceMM: number;
    outputChordDistanceMM: number;
}
export interface AdaptiveCurveSegment {
    id: string;
    domain: [number, number];
    originalSpanIndex: number;
    originalSpanDomain: [number, number];
    depth: number;
    bezier: Curve;
    controlPolygonBoundMM: number;
    arithmeticUncertaintyMM: number;
    finiteChord: {
        startMM: Point;
        endMM: Point;
        degenerate: boolean;
    };
    observations: AdaptiveCurveObservation[];
    maximumExtractionDifferenceMM: number;
    maximumObservedOutputChordDistanceMM: number;
}
export interface AdaptiveCurveSplitOperation {
    index: number;
    purpose: 'span-extraction' | 'adaptive-subdivision';
    originalSpanIndex: number;
    depth: number;
    inputCurveId: string;
    inputDomain: [number, number];
    parameter: number;
    lowerCurveId: string;
    upperCurveId: string;
    refinementKind: 'knot-insertion' | 'direct-copy';
    insertions: number;
    firstRefinedKnotIndex: number;
    poleCounts: CurveParameterSplitReport['poleCounts'];
    sharedCoefficient: CurveSplitSharedCoefficient;
    cutEndpoints: CurveParameterSplitReport['cutEndpoints'];
    nativeMaximumObservedDifferenceMM: number;
}
export interface AdaptiveCurveSamplingReport {
    family: 'own-adaptive-native-rational-curve-display-samples';
    dto: {
        schema: 'barocss-native-curve-samples';
        version: 0;
        lengthUnit: 'mm';
        frame: 'authored-xyz-no-axis-conversion';
        representation: 'sampled-display-points-not-native-edges-or-fit';
    };
    curveId: string;
    degree: number;
    originalSpanCount: number;
    segmentCount: number;
    pointCount: number;
    operationCount: number;
    maximumDepthUsed: number;
    maximumControlPolygonBoundMM: number;
    maximumArithmeticUncertaintyMM: number;
    maximumExtractionDifferenceMM: number;
    maximumObservedOutputChordDistanceMM: number;
    originalGuardedParameters: number[];
    geometryAuthority: 'original-evaluateCurve-and-original-source0';
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    inputProfile: {
        degreeRange: [1, 3];
        poleRange: [2, 16];
        weightRange: [1e-6, 1e6];
        coordinateAbsMM: number;
        maximumNonzeroSpans: 8;
        clamped: true;
        nonperiodic: true;
    };
    budgetFailure: 'atomic-refusal-no-partial-result';
    quality: {
        criterion: 'finite-segment-control-hull-estimate-plus-arithmetic-margin';
        globalBinary64ErrorCertified: false;
        manufacturingToleranceCertified: false;
        localObservationsOnly: true;
        positiveWeightHullReference: string[];
        derivativeSemantics: 'original-native-guards-unchanged-no-d1-g1-inference';
    };
    limits: {
        maximumOriginalPoles: 16;
        maximumOriginalSpans: 8;
        maximumSegments: 1024;
        maximumPoints: 1025;
        maximumDepth: 16;
        maximumOperations: 1023;
        maximumReservedRoleIds: 4096;
        maximumTemporaryPoles: 16;
        snapshotValues: 262144;
        snapshotDepth: 24;
        arrayElements: 4096;
        recordFields: 64;
        sourceStringCharacters: 262144;
    };
}
export interface AdaptiveCurveSamplingResult {
    curve: Curve;
    options: AdaptiveCurveSamplingOptions;
    source: string;
    sourceVersion: 0;
    model: Model;
    domain: [number, number];
    parameters: number[];
    pointsMM: Point[];
    samples: AdaptiveCurveSample[];
    segments: AdaptiveCurveSegment[];
    operations: AdaptiveCurveSplitOperation[];
    report: AdaptiveCurveSamplingReport;
}
/** Distance to a closed finite segment; endpoint cases do not use an infinite supporting line. */
export declare function finiteSegmentDistance(point: Point, start: Point, end: Point): number;
/** Deterministic native Bezier subdivision; returned points always evaluate the original Curve. */
export declare function sampleCurveAdaptive(curveInput: Curve, inputOptions: AdaptiveCurveSamplingOptions): AdaptiveCurveSamplingResult;
/** Actual deterministic native rebuild; stored sampling points or quality flags are never authority. */
export declare function validateAdaptiveCurveSamples(input: AdaptiveCurveSamplingResult): AdaptiveCurveSamplingReport;
