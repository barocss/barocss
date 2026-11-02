import type { C0ElevationKnotBlock, C0ElevationCoefficientResult } from '../curves/curve-c0-degree-elevation-internal.js';
import type { CurveD1Result } from '../../core/derivatives.js';
import type { Curve, Model, Point } from '../../types.js';
import { KernelError } from '../../core/barocss-error.js';
export declare const SourceCurveDegreeElevationDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly VERSION: "VERSION";
    readonly IDENTITY: "IDENTITY";
    readonly SOURCE: "SOURCE";
    readonly TARGET: "TARGET";
    readonly DEGREE: "DEGREE";
    readonly BASIS: "BASIS";
    readonly BUDGET: "BUDGET";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly BINDING: "BINDING";
    readonly NATIVE: "NATIVE";
    readonly OWNED: "OWNED";
    readonly FILE: "FILE";
}>;
export type SourceCurveDegreeElevationDiagnosticCode = typeof SourceCurveDegreeElevationDiagnosticCode[keyof typeof SourceCurveDegreeElevationDiagnosticCode];
export declare class SourceCurveDegreeElevationError extends KernelError {
    readonly code: SourceCurveDegreeElevationDiagnosticCode;
    constructor(code: SourceCurveDegreeElevationDiagnosticCode, detail: string, cause?: unknown);
}
export interface SourceCurveDegreeElevationRequest {
    source: string;
    sourceVersion: 0;
    curveId: string;
    targetDegree: 2 | 3 | 4 | 5;
    maximumObservations: 128;
}
export interface SourceCurveDegreeElevationPatch {
    field: 'degree' | 'knots' | 'control-points' | 'weights';
    startUTF16: number;
    endUTF16: number;
    originalText: string;
    replacementText: string;
}
type Size = {
    utf16: number;
    utf8: number;
};
type D1State = {
    status: 'evaluated';
    value: CurveD1Result;
} | {
    status: 'refused-c0';
    name: string;
    reason: string;
    value: null;
};
type Observation = {
    parameter: number;
    originalPoint: Point;
    point: Point;
    pointDifference: number;
    originalD1: D1State;
    outputD1: D1State;
    relativeDerivativeDifference: number | null;
};
type Provenance = {
    selectedObjectIndex: number;
    originalDegree: number;
    targetDegree: number;
    domain: [number, number];
    blocks: C0ElevationKnotBlock[];
    parameterMap: {
        kind: 'identity';
        formula: 'u=t';
        d1Factor: 1;
    };
    coefficientResult: C0ElevationCoefficientResult;
    patches: SourceCurveDegreeElevationPatch[];
};
export interface SourceCurveDegreeElevationReport {
    schema: 'barocss-source-curve-degree-elevation-report';
    version: 0;
    sourceVersion: 0;
    lengthUnit: 'mm';
    modelName: string;
    curveId: string;
    selectedObjectIndex: number;
    objectCount: number;
    originalDegree: number;
    targetDegree: number;
    domain: [number, number];
    spanCount: number;
    poleCounts: {
        original: number;
        output: number;
    };
    knotCounts: {
        original: number;
        output: number;
    };
    patchCount: 4;
    sourceSizes: {
        original: Size;
        candidate: Size;
    };
    fileSizes: {
        request: Size;
        result: Size;
    };
    stations: number[];
    observations: Observation[];
    maximumPointDifference: number;
    maximumRelativeDerivativeDifference: number;
    directCounts: {
        originalCompileCount: 1;
        candidateCompileCount: 1;
        coefficientElevationCallCount: 1;
        nativeCurveValidationCount: 2;
        domainQueryCount: 2;
        spanCount: number;
        generatedPoleCount: number;
        liftedPoleCount: number;
        copiedEndpointCount: number;
        addedKnotCount: number;
        patchCount: 4;
        decimalEmissionCount: number;
        observationCount: number;
        curveD0Count: number;
        curveD1AttemptCount: number;
        curveD1EvaluatedCount: number;
        curveD1RefusedCount: number;
        oldPublicElevationCallCount: 0;
        sourceWriterCallCount: 0;
        insertionCallCount: 0;
        rationalOperationCount: 0;
    };
    preservation: {
        untouchedSourceSpans: true;
        modelHeaderBits: true;
        objectOrderAndIds: true;
        unselectedObjectBits: true;
        selectedCurveEqualsActualCoefficientCandidate: true;
        endpointAndJoinPoleBits: true;
        originalKnotSlotBits: true;
        domainBits: true;
        parameterIdentity: true;
    };
    quality: {
        geometricValidity: 'not-certified';
        topologyCertified: false;
        solid: false;
        localShapeObservations: true;
        globalShapeErrorCertified: false;
        globalBinary64ErrorCertified: false;
        g1g2Certified: false;
        manufacturingToleranceCertified: false;
        editorDisplayCertified: false;
        persistentTopologyBindingCertified: false;
        publication: false;
        derivativeSemantics: 'actual-native-guards-unchanged';
        ownership: 'independent-copied-cpu-data-gc';
    };
    limits: {
        maximumInputDegree: 4;
        maximumOutputDegree: 5;
        maximumElevations: 1;
        maximumSpans: 31;
        maximumOriginalPoles: 64;
        maximumProfileOriginalPoles: 49;
        maximumOutputPoles: 64;
        maximumKnots: 70;
        maximumGeneratedRows: 48;
        maximumCopiedEndpoints: 32;
        maximumObservations: 128;
        maximumProfileObservations: 125;
        maximumNativeAttempts: 500;
        maximumPatches: 4;
        maximumDecimalEmissions: 325;
        maximumModelObjects: 16;
        coordinateAbs: 10000;
        minimumWeight: 0.000001;
        maximumWeight: 1000000;
        maximumReplacementLiteralCharacters: 512;
        maximumPointDifference: 1e-7;
        maximumRelativeDerivativeDifference: 1e-7;
        sourceUTF16: 262144;
        sourceUTF8: 262144;
        maximumFileUTF16: 2097152;
        maximumFileUTF8: 2097152;
        ownValues: 1048576;
        ownDepth: 64;
        arrayElements: 8192;
        recordFields: 64;
        keyCharacters: 128;
        stringCharacters: 262144;
        identifierCharacters: 48;
    };
    workScope: 'direct-wrapper-calls-private-coefficient-arithmetic-and-native-observations';
    budgetFailure: 'atomic-no-partial-source-degree-elevation';
}
export interface SourceCurveDegreeElevationResult {
    request: SourceCurveDegreeElevationRequest;
    source: string;
    originalModel: Model;
    model: Model;
    originalCurve: Curve;
    curve: Curve;
    provenance: Provenance;
    report: SourceCurveDegreeElevationReport;
}
/** Elevate one admitted Bernstein chain degree through actual coefficients and complete Source0. */
export declare function elevateSourceCurveDegree(input: SourceCurveDegreeElevationRequest): SourceCurveDegreeElevationResult;
/** Reconstruct once from full original source, including actual coefficients and observations. */
export declare function validateSourceCurveDegreeElevation(input: SourceCurveDegreeElevationResult): SourceCurveDegreeElevationReport;
export {};
