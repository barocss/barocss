import type { CurveKnotCoefficientResult } from '../curves/curve-knot-insertion.js';
import type { CurveD1Result } from '../../core/derivatives.js';
import type { Curve, Model, Point } from '../../types.js';
import { KernelError } from '../../core/barocss-error.js';
export declare const SourceCurveKnotInsertionDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly VERSION: "VERSION";
    readonly IDENTITY: "IDENTITY";
    readonly SOURCE: "SOURCE";
    readonly TARGET: "TARGET";
    readonly REQUEST: "REQUEST";
    readonly BUDGET: "BUDGET";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly BINDING: "BINDING";
    readonly NATIVE: "NATIVE";
    readonly OWNED: "OWNED";
    readonly FILE: "FILE";
}>;
export type SourceCurveKnotInsertionDiagnosticCode = typeof SourceCurveKnotInsertionDiagnosticCode[keyof typeof SourceCurveKnotInsertionDiagnosticCode];
export declare class SourceCurveKnotInsertionError extends KernelError {
    readonly code: SourceCurveKnotInsertionDiagnosticCode;
    constructor(code: SourceCurveKnotInsertionDiagnosticCode, detail: string, cause?: unknown);
}
export interface SourceCurveKnotInsertionRequest {
    source: string;
    sourceVersion: 0;
    curveId: string;
    knot: number;
    maximumObservations: 128;
}
export interface SourceCurveKnotInsertionPatch {
    field: 'knots' | 'control-points' | 'weights';
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
    refinedPoint: Point;
    pointDifference: number;
    originalD1: D1State;
    refinedD1: D1State;
    relativeDerivativeDifference: number | null;
};
type Provenance = {
    selectedObjectIndex: number;
    degree: number;
    domain: [number, number];
    knot: number;
    priorMultiplicity: number;
    refinedMultiplicity: number;
    parameterMap: {
        kind: 'identity';
        formula: 'u=t';
        d1Factor: 1;
    };
    patches: SourceCurveKnotInsertionPatch[];
    unchangedPoles: CurveKnotCoefficientResult['unchangedPoles'];
    unchangedKnots: CurveKnotCoefficientResult['unchangedKnots'];
    steps: CurveKnotCoefficientResult['steps'];
    homogeneousSteps: CurveKnotCoefficientResult['homogeneousSteps'];
};
export interface SourceCurveKnotInsertionReport {
    schema: 'barocss-source-curve-knot-insertion-report';
    version: 0;
    sourceVersion: 0;
    lengthUnit: 'mm';
    modelName: string;
    curveId: string;
    selectedObjectIndex: number;
    objectCount: number;
    degree: number;
    domain: [number, number];
    poleCounts: {
        original: number;
        refined: number;
    };
    knotCounts: {
        original: number;
        refined: number;
    };
    knot: number;
    priorMultiplicity: number;
    refinedMultiplicity: number;
    patchCount: 3;
    sourceSizes: {
        original: Size;
        candidate: Size;
    };
    fileSizes: {
        request: Size;
        result: Size;
    };
    observations: Observation[];
    maximumPointDifference: number;
    maximumRelativeDerivativeDifference: number;
    directCounts: {
        originalCompileCount: 1;
        candidateCompileCount: 1;
        coefficientInsertionCallCount: 1;
        insertedKnotCount: 1;
        nativeCurveValidationCount: 2;
        domainQueryCount: 2;
        patchCount: 3;
        decimalEmissionCount: number;
        observationCount: number;
        curveD0Count: number;
        curveD1AttemptCount: number;
        curveD1EvaluatedCount: number;
        curveD1RefusedCount: number;
        sourceWriterCallCount: 0;
        publicRefinementCallCount: 0;
        loftCallCount: 0;
        rationalOperationCount: 0;
    };
    preservation: {
        untouchedSourceSpans: true;
        modelHeaderBits: true;
        objectOrderAndIds: true;
        unselectedObjectBits: true;
        selectedCurveEqualsActualCoefficientCandidate: true;
        unaffectedCoefficientBits: true;
        degreeDomain: true;
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
        maximumDegree: 5;
        maximumOriginalPoles: 63;
        maximumRefinedPoles: 64;
        maximumKnots: 70;
        maximumInsertions: 1;
        maximumObservations: 128;
        maximumPatches: 3;
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
    workScope: 'direct-wrapper-calls-inherited-helper-compiler-work-excluded';
    budgetFailure: 'atomic-no-partial-source-curve-insertion';
}
export interface SourceCurveKnotInsertionResult {
    request: SourceCurveKnotInsertionRequest;
    source: string;
    originalModel: Model;
    model: Model;
    originalCurve: Curve;
    curve: Curve;
    provenance: Provenance;
    report: SourceCurveKnotInsertionReport;
}
/** Insert once through the existing coefficient kernel and adopt the complete compiled source. */
export declare function insertSourceCurveKnot(input: SourceCurveKnotInsertionRequest): SourceCurveKnotInsertionResult;
/** Rebuild all source, coefficient and native receipts from the complete owned request. */
export declare function validateSourceCurveKnotInsertion(input: SourceCurveKnotInsertionResult): SourceCurveKnotInsertionReport;
export {};
