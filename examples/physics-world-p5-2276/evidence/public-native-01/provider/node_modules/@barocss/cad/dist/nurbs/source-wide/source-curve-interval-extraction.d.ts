import type { CurveKnotCoefficientResult } from '../curves/curve-knot-insertion.js';
import type { CurveD1Result } from '../../core/derivatives.js';
import type { Curve, Model, Point } from '../../types.js';
import { KernelError } from '../../core/barocss-error.js';
export declare const SourceCurveIntervalExtractionDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly VERSION: "VERSION";
    readonly IDENTITY: "IDENTITY";
    readonly SOURCE: "SOURCE";
    readonly TARGET: "TARGET";
    readonly INTERVAL: "INTERVAL";
    readonly BUDGET: "BUDGET";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly BINDING: "BINDING";
    readonly NATIVE: "NATIVE";
    readonly OWNED: "OWNED";
    readonly FILE: "FILE";
}>;
export type SourceCurveIntervalExtractionDiagnosticCode = typeof SourceCurveIntervalExtractionDiagnosticCode[keyof typeof SourceCurveIntervalExtractionDiagnosticCode];
export declare class SourceCurveIntervalExtractionError extends KernelError {
    readonly code: SourceCurveIntervalExtractionDiagnosticCode;
    constructor(code: SourceCurveIntervalExtractionDiagnosticCode, detail: string, cause?: unknown);
}
export interface SourceCurveIntervalExtractionRequest {
    source: string;
    sourceVersion: 0;
    curveId: string;
    interval: [number, number];
    maximumObservations: 256;
}
export interface SourceCurveIntervalExtractionPatch {
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
type BoundaryChoice = {
    boundary: 'start' | 'end';
    requested: number;
    effective: number;
    origin: 'original-domain-endpoint' | 'interior-request';
    adoptedOriginalEndpointBits: boolean;
};
type Basis = {
    degree: number;
    poleCount: number;
    knots: number[];
    domain: [number, number];
};
type CutPlan = {
    index: number;
    boundary: 'start' | 'end';
    parameter: number;
    retainedSide: 'upper' | 'lower';
    input: Basis;
    requiredInsertions: number;
    refined: Basis;
    firstRefinedKnotIndex: number;
    sharedRefinedPoleIndex: number;
    lower: Basis;
    upper: Basis;
};
type CompletePlan = {
    effectiveInterval: [number, number];
    stages: CutPlan[];
    output: Basis;
    helperCallCount: number;
    insertedKnotCount: number;
    maximumTemporaryPoles: number;
    maximumTemporaryKnots: number;
};
type PoleMap = {
    refinedPoleIndex: number;
    childPoleIndex: number;
};
type KnotMap = {
    childKnotIndex: number;
    refinedKnotIndex: number | null;
    value: number;
    origin: 'refined-copy' | 'requested-clamp';
};
type ChildMaps = {
    poles: PoleMap[];
    knots: KnotMap[];
};
type Shared = {
    refinedPoleIndex: number;
    lowerPoleIndex: number;
    upperPoleIndex: number;
    point: Point;
    weight: number;
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
type Provider = {
    d0: Point;
    d1: D1State;
};
type CutWitness = {
    parameter: number;
    input: Provider;
    refined: Provider;
    lower: Provider;
    upper: Provider;
    maximumPointDifference: number;
    relativeInputLowerDifference: number | null;
    relativeInputUpperDifference: number | null;
    relativeLowerUpperDifference: number;
};
type Refinement = {
    kind: 'knot-insertion' | 'direct-copy';
    insertions: number;
    calculation: CurveKnotCoefficientResult | null;
};
type Stage = {
    index: number;
    boundary: 'start' | 'end';
    parameter: number;
    retainedSide: 'upper' | 'lower';
    input: Curve;
    refined: Curve;
    refinement: Refinement;
    firstRefinedKnotIndex: number;
    lower: Curve;
    upper: Curve;
    lowerMaps: ChildMaps;
    upperMaps: ChildMaps;
    shared: Shared;
    witness: CutWitness;
};
type CopiedPole = {
    originalPoleIndex: number;
    outputPoleIndex: number;
};
type CopiedKnot = {
    originalKnotIndex: number;
    outputKnotIndex: number;
};
type Provenance = {
    selectedObjectIndex: number;
    degree: number;
    boundaries: [BoundaryChoice, BoundaryChoice];
    parameterMap: {
        kind: 'identity';
        formula: 'u=t';
        d1Factor: 1;
    };
    plan: CompletePlan;
    stages: Stage[];
    unchangedPoles: CopiedPole[];
    unchangedKnots: CopiedKnot[];
    patches: SourceCurveIntervalExtractionPatch[];
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
export interface SourceCurveIntervalExtractionReport {
    schema: 'barocss-source-curve-interval-extraction-report';
    version: 0;
    sourceVersion: 0;
    lengthUnit: 'mm';
    modelName: string;
    curveId: string;
    selectedObjectIndex: number;
    objectCount: number;
    degree: number;
    interval: {
        requested: [number, number];
        effective: [number, number];
    };
    domains: {
        original: [number, number];
        output: [number, number];
    };
    poleCounts: {
        original: number;
        output: number;
        maximumTemporary: number;
    };
    knotCounts: {
        original: number;
        output: number;
        maximumTemporary: number;
    };
    cutStageCount: number;
    coefficientInsertionCallCount: number;
    insertedKnotCount: number;
    patchCount: 3;
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
    maximumCutPointDifference: number;
    directCounts: {
        originalCompileCount: 1;
        candidateCompileCount: 1;
        cutStageCount: number;
        coefficientInsertionCallCount: number;
        insertedKnotCount: number;
        nativeCurveValidationCount: number;
        domainQueryCount: number;
        patchCount: 3;
        decimalEmissionCount: number;
        observationCount: number;
        cutWitnessCount: number;
        curveD0Count: number;
        curveD1AttemptCount: number;
        curveD1EvaluatedCount: number;
        curveD1RefusedCount: number;
        sourceWriterCallCount: 0;
        publicSplitCallCount: 0;
        publicIntervalCallCount: 0;
        publicRefinementCallCount: 0;
        rationalOperationCount: 0;
    };
    preservation: {
        untouchedSourceSpans: true;
        modelHeaderBits: true;
        objectOrderAndIds: true;
        unselectedObjectBits: true;
        selectedCurveEqualsActualRetainedCandidate: true;
        unaffectedCoefficientBits: true;
        degree: true;
        originalParameterUnits: true;
        effectiveEndpointBits: true;
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
        maximumOriginalPoles: 64;
        maximumTemporaryPoles: 64;
        maximumOutputPoles: 64;
        maximumKnots: 70;
        maximumCuts: 2;
        maximumInsertionsPerCut: 5;
        maximumTotalInsertions: 10;
        maximumHelperCalls: 2;
        maximumObservations: 256;
        maximumProfileObservations: 129;
        maximumCutWitnesses: 2;
        maximumNativeAttempts: 532;
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
    budgetFailure: 'atomic-no-partial-source-curve-interval';
}
export interface SourceCurveIntervalExtractionResult {
    request: SourceCurveIntervalExtractionRequest;
    source: string;
    originalModel: Model;
    model: Model;
    originalCurve: Curve;
    curve: Curve;
    provenance: Provenance;
    report: SourceCurveIntervalExtractionReport;
}
/** Restrict a selected Curve through actual refinements and indexed children in full Source0. */
export declare function extractSourceCurveInterval(input: SourceCurveIntervalExtractionRequest): SourceCurveIntervalExtractionResult;
/** Reconstruct complete source and all actual interval stages from the owned request. */
export declare function validateSourceCurveIntervalExtraction(input: SourceCurveIntervalExtractionResult): SourceCurveIntervalExtractionReport;
export {};
