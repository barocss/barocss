import type { CurveD1Result } from '../../core/derivatives.js';
import type { WideAdaptiveCurveSpan } from './curve-wide-adaptive-sampling.js';
import type { BezierSubdivisionResult } from '../curves/curve-bezier-subdivision-internal.js';
import type { Curve, Model, Point } from '../../types.js';
import { KernelError } from '../../core/barocss-error.js';
export declare const SourceCurveAdaptiveSamplingDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly SOURCE: "SOURCE";
    readonly REFERENCE: "REFERENCE";
    readonly IDENTITY: "IDENTITY";
    readonly SPAN: "SPAN";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly BUDGET: "BUDGET";
    readonly NATIVE: "NATIVE";
    readonly BINDING: "BINDING";
    readonly FILE: "FILE";
    readonly OWNED: "OWNED";
}>;
export type SourceCurveAdaptiveSamplingDiagnosticCode = typeof SourceCurveAdaptiveSamplingDiagnosticCode[keyof typeof SourceCurveAdaptiveSamplingDiagnosticCode];
export declare class SourceCurveAdaptiveSamplingError extends KernelError {
    readonly code: SourceCurveAdaptiveSamplingDiagnosticCode;
    constructor(code: SourceCurveAdaptiveSamplingDiagnosticCode, detail: string, cause?: unknown);
}
export interface SourceCurveAdaptiveSamplingOptions {
    chordToleranceMM: number;
    maxSegments: number;
    maxDepth: number;
    resultIdPrefix: string;
}
export interface SourceCurveAdaptiveSamplingRequest {
    source: string;
    sourceVersion: 0;
    curveId: string;
    options: SourceCurveAdaptiveSamplingOptions;
}
export interface SourceCurveAdaptiveSamplingResult {
    request: SourceCurveAdaptiveSamplingRequest;
    originalModel: Model;
    curve: Curve;
    domain: [number, number];
    samples: Sample[];
    spans: Span[];
    operations: Operation[];
    report: SourceCurveAdaptiveSamplingReport;
}
type D1State = {
    status: 'evaluated';
    value: CurveD1Result;
} | {
    status: 'native-refused';
    reason: string;
};
type Observation = {
    parameter: number;
    originalPointMM: Point;
    localPointMM: Point;
    extractionDifferenceMM: number;
    outputChordDistanceMM: number;
    originalD1: D1State;
    localD1: D1State;
    derivativeDifferenceMM: number | null;
    relativeDerivativeDifference: number | null;
};
type Sample = {
    id: string;
    parameter: number;
    pointMM: Point;
    adjacentSegmentIds: string[];
    originalSpanIndices: number[];
    atOriginalKnot: boolean;
    originalD1Guarded: boolean;
};
type Span = {
    extraction: WideAdaptiveCurveSpan;
    leaves: Leaf[];
};
type Leaf = {
    id: string;
    originalSpanIndex: number;
    depth: number;
    domain: [number, number];
    localCurve: Curve;
    origin: {
        kind: 'extraction' | 'split';
        operationIndex: number | null;
        side: 'lower' | 'upper' | null;
    };
    finiteChord: {
        startMM: Point;
        endMM: Point;
        degenerate: boolean;
    };
    controlPolygonBoundMM: number;
    arithmeticUncertaintyMM: number;
    observations: [Observation, Observation, Observation];
    maximumExtractionDifferenceMM: number;
    maximumObservedOutputChordDistanceMM: number;
    maximumRelativeDerivativeDifference: number;
};
type Operation = {
    index: number;
    purpose: 'adaptive-subdivision';
    originalSpanIndex: number;
    depth: number;
    inputOrigin: {
        kind: 'extraction' | 'split';
        operationIndex: number | null;
        side: 'lower' | 'upper' | null;
    };
    subdivision: BezierSubdivisionResult;
};
type DirectCounts = {
    originalSourceCompileCount: number;
    extractionInvocationCount: number;
    coefficientHelperInvocationCount: number;
    subdivisionSourceCompileCount: number;
    curveD0AttemptCount: number;
    curveD1AttemptCount: number;
    curveD1EvaluatedCount: number;
    curveD1NativeRefusedCount: number;
    visitedIntervalCount: number;
    splitAttemptCount: number;
    acceptedLeafCount: number;
    outputPointCount: number;
};
export interface SourceCurveAdaptiveSamplingReport {
    family: 'complete-source-adaptive-native-rational-curve-display-samples';
    sourceVersion: 0;
    curveId: string;
    degree: number;
    lengthUnit: 'mm';
    domain: [number, number];
    originalPoleCount: number;
    originalKnotCount: number;
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
    bindings: {
        original: {
            requestSourcePath: 'request.source';
            sourceVersion: 0;
            modelName: string;
            objectIndex: number;
            curveId: string;
        };
        extractions: {
            spanIndex: number;
            sourcePath: string;
            modelPath: string;
            modelName: string;
            curveId: string;
        }[];
        subdivisions: {
            operationIndex: number;
            sourcePath: string;
            modelPath: string;
            modelName: string;
            lowerCurveId: string;
            upperCurveId: string;
        }[];
    };
    generatedIds: string[];
    directCounts: DirectCounts;
    delegatedReceipts: {
        extractionCount: number;
        extractionSourceCompileReceiptCount: number;
        coefficientResultCount: number;
        subdivisionModelCount: number;
    };
    quality: {
        geometryAuthority: 'original-native-evaluateCurve';
        representation: 'sampled-display-points-not-native-edges-or-fit';
        criterion: 'finite-segment-control-hull-estimate-plus-arithmetic-margin';
        extraction: 'existing-local-cox-de-boor-to-bernstein';
        subdivision: 'existing-homogeneous-knot-insertion-and-indexed-children';
        geometricValidity: 'not-certified';
        localObservationsOnly: true;
        globalErrorCertified: false;
        globalBinary64ErrorCertified: false;
        manufacturingToleranceCertified: false;
        topologyCertified: false;
        solid: false;
        derivativeSemantics: 'original-native-c0-refusals-and-local-one-sided-d1';
        ownership: 'copied-cpu-data-gc-no-renderer-resources';
    };
    limits: {
        sourceCharacters: 262144;
        sourceUTF8Bytes: 262144;
        modelObjects: 16;
        maximumDegree: 5;
        maximumOriginalPoles: 64;
        maximumOriginalKnots: 70;
        maximumOriginalSpans: 63;
        weightMinimum: 0.000001;
        weightMaximum: 1000000;
        coordinateAbsMM: 10000;
        minimumChordToleranceMM: 0.0000001;
        maximumChordToleranceMM: 1000;
        maximumSegments: 4096;
        maximumPoints: 4097;
        maximumDepth: 16;
        maximumOperations: 4095;
        maximumLocalPoles: 6;
        maximumTemporaryPoles: 11;
        maximumTemporaryKnots: 17;
        maximumCurveD0Attempts: 45055;
        maximumCurveD1Attempts: 24576;
        requestBytes: 1048576;
        resultBytes: 16777216;
        ownValues: 4194304;
        ownDepth: 64;
        arrayElements: 32768;
        recordFields: 64;
        stringCharacters: 262144;
        authoredIdCharacters: 48;
        resultIdPrefixCharacters: 20;
    };
    fileSizes: {
        request: {
            utf16: number;
            utf8: number;
        };
        result: {
            utf16: number;
            utf8: number;
        };
    };
    ownValues: number;
}
/** Sample one selected Curve while retaining the complete authored mixed Model. */
export declare function sampleSourceCurveAdaptive(input: SourceCurveAdaptiveSamplingRequest): SourceCurveAdaptiveSamplingResult;
/** Reconstruct once from the full request and return an independent complete Report. */
export declare function validateSourceCurveAdaptive(input: SourceCurveAdaptiveSamplingResult): SourceCurveAdaptiveSamplingReport;
export {};
