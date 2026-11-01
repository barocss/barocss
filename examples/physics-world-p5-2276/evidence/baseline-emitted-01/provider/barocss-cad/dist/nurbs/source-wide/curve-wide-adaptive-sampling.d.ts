import type { CurveD1Result } from '../../core/derivatives.js';
import type { CurveParameterSplitReport, CurveSplitSharedCoefficient } from '../curves/curve-parameter-split.js';
import type { Curve, Model, Point } from '../../types.js';
import { KernelError } from '../../core/barocss-error.js';
export declare const WideAdaptiveCurveSamplingDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly SPAN: "SPAN";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly BUDGET: "BUDGET";
    readonly NATIVE: "NATIVE";
    readonly BINDING: "BINDING";
    readonly OWNED: "OWNED";
}>;
export type WideAdaptiveCurveSamplingDiagnosticCode = typeof WideAdaptiveCurveSamplingDiagnosticCode[keyof typeof WideAdaptiveCurveSamplingDiagnosticCode];
export declare class WideAdaptiveCurveSamplingError extends KernelError {
    readonly code: WideAdaptiveCurveSamplingDiagnosticCode;
    constructor(code: WideAdaptiveCurveSamplingDiagnosticCode, detail: string, cause?: unknown);
}
export interface WideAdaptiveCurveSamplingOptions {
    chordToleranceMM: number;
    maxSegments: number;
    maxDepth: number;
    resultIdPrefix: string;
}
export interface WideAdaptiveCurveSample {
    id: string;
    parameter: number;
    pointMM: Point;
    adjacentSegmentIds: string[];
    originalSpanIndices: number[];
    atOriginalKnot: boolean;
    originalD1Guarded: boolean;
}
export type WideAdaptiveCurveD1State = {
    status: 'evaluated';
    value: CurveD1Result;
} | {
    status: 'native-refused';
    reason: string;
};
export interface WideAdaptiveCurveExtractionLevel {
    degree: number;
    basisIndices: number[];
    coefficientMatrix: number[][];
    columnSums: number[];
    maximumPartitionResidual: number;
}
export interface WideAdaptiveCurveSpan {
    index: number;
    knotSpanIndex: number;
    domain: [number, number];
    activePoleIndices: number[];
    activeKnotIndices: number[];
    originalActiveControlPoints: Point[];
    originalActiveWeights: number[];
    levels: WideAdaptiveCurveExtractionLevel[];
    coefficientMatrix: number[][];
    rowSums: number[];
    columnSums: number[];
    maximumPartitionResidual: number;
    controlOrigins: {
        bezierPoleIndex: number;
        origin: 'original-copy' | 'generated-arithmetic';
        originalPoleIndex: number | null;
        coefficients: number[];
        homogeneous: [number, number, number, number];
    }[];
    bezier: Curve;
    nativeSpanSource: string;
    sourceVersion: 0;
    nativeSpanModel: Model;
}
export interface WideAdaptiveCurveObservation {
    parameter: number;
    originalPointMM: Point;
    extractedPointMM: Point;
    extractionDifferenceMM: number;
    outputChordDistanceMM: number;
    originalD1: WideAdaptiveCurveD1State;
    extractedD1: WideAdaptiveCurveD1State;
    derivativeDifferenceMM: number | null;
    relativeDerivativeDifference: number | null;
}
export interface WideAdaptiveCurveSegment {
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
    observations: WideAdaptiveCurveObservation[];
    maximumExtractionDifferenceMM: number;
    maximumObservedOutputChordDistanceMM: number;
    maximumRelativeDerivativeDifference: number;
}
export interface WideAdaptiveCurveSplitOperation {
    index: number;
    purpose: 'adaptive-subdivision';
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
export interface WideAdaptiveCurveSamplingReport {
    family: 'own-wide-adaptive-native-rational-curve-display-samples';
    dto: {
        schema: 'barocss-native-curve-samples';
        version: 1;
        lengthUnit: 'mm';
        frame: 'authored-xyz-no-axis-conversion';
        representation: 'sampled-display-points-not-native-edges-or-fit';
        capacity: {
            maximumOriginalPoles: 64;
            maximumOriginalKnots: 70;
            maximumSegments: 4096;
            maximumPoints: 4097;
        };
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
    maximumRelativeDerivativeDifference: number;
    maximumPartitionResidual: number;
    originalGuardedParameters: number[];
    geometryAuthority: 'original-evaluateCurve-and-original-source0';
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    inputProfile: {
        degreeRange: [1, 3];
        poleRange: [2, 64];
        maximumKnots: 70;
        weightRange: [1e-6, 1e6];
        coordinateAbsMM: 10000;
        maximumNonzeroSpans: 64;
        clamped: true;
        nonperiodic: true;
    };
    budgetFailure: 'atomic-refusal-no-partial-result';
    quality: {
        criterion: 'finite-segment-control-hull-estimate-plus-arithmetic-margin';
        extraction: 'local-cox-de-boor-to-bernstein-coefficients';
        extractionReference: string;
        globalBinary64ErrorCertified: false;
        manufacturingToleranceCertified: false;
        localObservationsOnly: true;
        pointComparisonMM: 1e-7;
        relativeD1Comparison: 1e-7;
        partitionComparison: number;
        positiveWeightHullReference: string[];
        derivativeSemantics: 'original-native-c0-guards-and-local-one-sided-d1-no-g1-g2-claim';
        ownership: 'copied-cpu-data-gc-no-renderer-resources';
        identity: 'display-provenance-roles-not-native-edges-or-fit';
    };
    limits: {
        maximumOriginalPoles: 64;
        maximumOriginalKnots: 70;
        maximumOriginalSpans: 64;
        maximumSegments: 4096;
        maximumPoints: 4097;
        maximumDepth: 16;
        maximumOperations: 4095;
        maximumReservedRoleIds: 32768;
        maximumLocalBezierPoles: 4;
        maximumTemporaryPoles: 7;
        inputValues: 32768;
        inputDepth: 8;
        inputArrayElements: 128;
        inputRecordFields: 16;
        inputStringCharacters: 128;
        snapshotValues: 2097152;
        snapshotDepth: 32;
        arrayElements: 8192;
        recordFields: 64;
        sourceStringCharacters: 262144;
        authoredIdCharacters: 48;
        resultIdPrefixCharacters: 20;
    };
}
export interface WideAdaptiveCurveSamplingResult {
    curve: Curve;
    options: WideAdaptiveCurveSamplingOptions;
    source: string;
    sourceVersion: 0;
    model: Model;
    domain: [number, number];
    parameters: number[];
    pointsMM: Point[];
    samples: WideAdaptiveCurveSample[];
    spans: WideAdaptiveCurveSpan[];
    segments: WideAdaptiveCurveSegment[];
    operations: WideAdaptiveCurveSplitOperation[];
    report: WideAdaptiveCurveSamplingReport;
}
/** Analytic local basis extraction. No original Curve refinement or point fitting occurs here. */
export declare function extractCurveBezierSpanTrusted(original: Curve, knotSpanIndex: number, index: number, curveId: string): WideAdaptiveCurveSpan;
/** Sample a bounded wide Curve. Every returned display point uses the original native evaluator. */
export declare function sampleCurveWideAdaptive(curveInput: Curve, inputOptions: WideAdaptiveCurveSamplingOptions): WideAdaptiveCurveSamplingResult;
/** Rebuild all original/source/analytic/native-split/point/quality fields before accepting an owned DTO. */
export declare function validateWideAdaptiveCurveSamples(input: WideAdaptiveCurveSamplingResult): WideAdaptiveCurveSamplingReport;
