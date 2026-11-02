import type { CurveD1Result } from '../../core/derivatives.js';
import type { CurveParameterSplitResult } from './curve-parameter-split.js';
import type { Curve, Model, Point } from '../../types.js';
import { KernelError } from '../../core/barocss-error.js';
export declare const CurveIntervalExtractionDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly INTERVAL: "INTERVAL";
    readonly IDENTITY: "IDENTITY";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly NATIVE_CAPACITY: "NATIVE_CAPACITY";
    readonly NATIVE: "NATIVE";
    readonly BINDING: "BINDING";
    readonly OWNED: "OWNED";
}>;
export type CurveIntervalExtractionDiagnosticCode = typeof CurveIntervalExtractionDiagnosticCode[keyof typeof CurveIntervalExtractionDiagnosticCode];
export declare class CurveIntervalExtractionError extends KernelError {
    readonly code: CurveIntervalExtractionDiagnosticCode;
    constructor(code: CurveIntervalExtractionDiagnosticCode, detail: string, cause?: unknown);
}
export interface CurveIntervalExtractionOptions {
    curveId: string;
    interval: [number, number];
    resultIdPrefix: string;
}
export type CurveIntervalExtractionD1State = {
    status: 'evaluated';
    value: CurveD1Result;
} | {
    status: 'native-refused';
    reason: string;
};
export interface CurveIntervalBoundaryChoice {
    boundary: 'start' | 'end';
    requested: number;
    effective: number;
    origin: 'original-domain-endpoint' | 'interior-request';
    adoptedOriginalEndpointBits: boolean;
}
export interface CurveIntervalSplitOperation {
    index: number;
    boundary: 'start' | 'end';
    retainedSide: 'upper' | 'lower';
    result: CurveParameterSplitResult;
}
export interface CurveIntervalExtractionProvenance {
    originalCurveId: string;
    outputCurveId: string;
    originalDomain: [number, number];
    requestedInterval: [number, number];
    effectiveInterval: [number, number];
    parameterMap: {
        kind: 'identity';
        formula: 'u=t';
        d1Factor: 1;
    };
    boundaries: [CurveIntervalBoundaryChoice, CurveIntervalBoundaryChoice];
    fullDomainCopy: boolean;
    operations: CurveIntervalSplitOperation[];
}
export interface CurveIntervalExtractionObservation {
    parameter: number;
    originalPointMM: Point;
    extractedPointMM: Point;
    pointDifferenceMM: number;
    originalD1: CurveIntervalExtractionD1State;
    extractedD1: CurveIntervalExtractionD1State;
    derivativeDifferenceMM: number | null;
}
export interface CurveIntervalExtractionGuardObservation {
    originalParameter: number;
    extractedParameter: number;
    outputLocation: 'interior' | 'start-endpoint' | 'end-endpoint';
    originalAtOriginalKnot: CurveIntervalExtractionD1State;
    extractedAtRetainedParameter: CurveIntervalExtractionD1State;
}
export interface ExtractedCurveIntervalReport {
    family: 'own-native-original-parameter-curve-interval';
    dto: {
        schema: 'barocss-native-curve-interval';
        version: 0;
        lengthUnit: 'mm';
        frame: 'authored-xyz-no-axis-conversion';
        representation: 'native-curve-not-wire-topology';
    };
    originalCurveId: string;
    curveId: string;
    degree: number;
    poleCounts: {
        original: number;
        extracted: number;
    };
    originalDomain: [number, number];
    domain: [number, number];
    operationCount: number;
    observations: CurveIntervalExtractionObservation[];
    guards: CurveIntervalExtractionGuardObservation[];
    maximumPointDifferenceMM: number;
    maximumRelativeDerivativeDifference: number;
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    quality: {
        pointComparisonMM: 1e-7;
        relativeD1Comparison: 1e-7;
        localObservationsOnly: true;
        globalShapeErrorCertified: false;
        manufacturingToleranceCertified: false;
        derivativeSemantics: 'original-c0-guards-and-extracted-endpoint-d1-distinct-no-g1-g2-claim';
    };
    limits: {
        maximumDegree: 3;
        maximumOriginalPoles: 16;
        maximumTemporaryPoles: 16;
        maximumOperations: 2;
        maximumObservations: 128;
        inputValues: 4096;
        inputDepth: 8;
        inputArrayElements: 64;
        inputRecordFields: 16;
        snapshotValues: 131072;
        snapshotDepth: 24;
        arrayElements: 4096;
        recordFields: 64;
        sourceStringCharacters: 262144;
        authoredIdCharacters: 48;
        resultIdPrefixCharacters: 20;
    };
}
export interface ExtractedCurveIntervalResult {
    original: Curve;
    options: CurveIntervalExtractionOptions;
    curve: Curve;
    source: string;
    sourceVersion: 0;
    model: Model;
    originalSource: string;
    originalModel: Model;
    provenance: CurveIntervalExtractionProvenance;
    report: ExtractedCurveIntervalReport;
}
/** Original-parameter restriction using at most two actual native624 splits. */
export declare function extractCurveInterval(curveInput: Curve, inputOptions: CurveIntervalExtractionOptions): ExtractedCurveIntervalResult;
/** Rebuild originals/options and complete actual split/source/guard lineage, without trusting cached reports. */
export declare function validateExtractedCurveInterval(input: ExtractedCurveIntervalResult): ExtractedCurveIntervalReport;
