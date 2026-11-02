import type { WideAdaptiveCurveSpan, WideAdaptiveCurveD1State } from '../source-wide/curve-wide-adaptive-sampling.js';
import type { Curve, Model, Point } from '../../types.js';
import { KernelError } from '../../core/barocss-error.js';
export declare const CurveBezierSpanExtractionDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly SPAN: "SPAN";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly NATIVE: "NATIVE";
    readonly BINDING: "BINDING";
    readonly OWNED: "OWNED";
}>;
export type CurveBezierSpanExtractionDiagnosticCode = typeof CurveBezierSpanExtractionDiagnosticCode[keyof typeof CurveBezierSpanExtractionDiagnosticCode];
export declare class CurveBezierSpanExtractionError extends KernelError {
    readonly code: CurveBezierSpanExtractionDiagnosticCode;
    constructor(code: CurveBezierSpanExtractionDiagnosticCode, detail: string, cause?: unknown);
}
export interface CurveBezierSpanExtractionOptions {
    resultIdPrefix: string;
}
export type CurveBezierSpan = WideAdaptiveCurveSpan;
export type CurveBezierSpanD1State = WideAdaptiveCurveD1State;
export interface CurveBezierSpanObservation {
    spanIndex: number;
    bezierCurveId: string;
    location: 'start' | 'midpoint' | 'end';
    parameter: number;
    originalPointMM: Point;
    extractedPointMM: Point;
    extractionDifferenceMM: number;
    originalD1: CurveBezierSpanD1State;
    extractedD1: CurveBezierSpanD1State;
    derivativeDifferenceMM: number | null;
    relativeDerivativeDifference: number | null;
}
export interface CurveBezierSpanEndpoint {
    parameter: number;
    originalPointMM: Point;
    adjacentSpanIndices: number[];
    adjacentBezierCurveIds: string[];
    atOriginalKnot: boolean;
    originalMultiplicity: number;
    originalD1Guarded: boolean;
    originalD1: CurveBezierSpanD1State;
    localSides: {
        spanIndex: number;
        bezierCurveId: string;
        side: 'start' | 'end';
        pointMM: Point;
        pointDifferenceMM: number;
        d1: CurveBezierSpanD1State;
        derivativeDifferenceMM: number | null;
        relativeDerivativeDifference: number | null;
    }[];
}
export interface CurveBezierSpanExtractionReport {
    family: 'own-native-positive-rational-curve-bezier-spans';
    dto: {
        schema: 'barocss-native-curve-bezier-spans';
        version: 0;
        lengthUnit: 'mm';
        frame: 'authored-xyz-no-axis-conversion';
        representation: 'native-coefficient-spans-not-wire-or-fit';
    };
    curveId: string;
    degree: number;
    domain: [number, number];
    originalPoleCount: number;
    originalKnotCount: number;
    spanCount: number;
    observationCount: number;
    endpointCount: number;
    maximumExtractionDifferenceMM: number;
    maximumRelativeDerivativeDifference: number;
    maximumPartitionResidual: number;
    originalGuardedParameters: number[];
    geometryAuthority: 'original-curve-coefficients-and-original-source0';
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
        extraction: 'existing-local-cox-de-boor-to-bernstein-coefficients';
        extractionReference: string;
        pointComparisonMM: 1e-7;
        relativeD1Comparison: 1e-7;
        partitionComparison: number;
        localObservationsOnly: true;
        globalBinary64ErrorCertified: false;
        manufacturingToleranceCertified: false;
        derivativeSemantics: 'original-native-c0-guards-and-local-one-sided-d1-no-g1-g2-claim';
        adjacencySemantics: 'native-parameter-and-point-observations-not-sewn-wire-topology';
        ownership: 'copied-cpu-data-gc-no-renderer-resources';
    };
    limits: {
        maximumDegree: 3;
        maximumOriginalPoles: 64;
        maximumOriginalKnots: 70;
        maximumSpans: 64;
        maximumLocalBezierPoles: 4;
        maximumObservations: 192;
        maximumEndpoints: 65;
        maximumReservedRoleIds: 65;
        inputValues: 32768;
        inputDepth: 8;
        inputArrayElements: 128;
        inputRecordFields: 16;
        inputStringCharacters: 128;
        snapshotValues: 262144;
        snapshotDepth: 32;
        arrayElements: 4096;
        recordFields: 64;
        sourceStringCharacters: 262144;
        authoredIdCharacters: 48;
        resultIdPrefixCharacters: 20;
    };
}
export interface CurveBezierSpanExtractionResult {
    curve: Curve;
    options: CurveBezierSpanExtractionOptions;
    source: string;
    sourceVersion: 0;
    model: Model;
    domain: [number, number];
    spans: CurveBezierSpan[];
    observations: CurveBezierSpanObservation[];
    endpoints: CurveBezierSpanEndpoint[];
    report: CurveBezierSpanExtractionReport;
}
/** Extract native coefficient spans without a display tolerance or global original Curve refinement. */
export declare function extractCurveBezierSpans(curveInput: Curve, inputOptions: CurveBezierSpanExtractionOptions): CurveBezierSpanExtractionResult;
/** Rebuild native original/span sources, analytic lineage and all original/local observations. */
export declare function validateCurveBezierSpans(input: CurveBezierSpanExtractionResult): CurveBezierSpanExtractionReport;
