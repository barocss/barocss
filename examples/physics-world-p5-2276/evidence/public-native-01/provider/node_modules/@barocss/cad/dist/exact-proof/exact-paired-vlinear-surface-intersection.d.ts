import { SectionRationalContext } from '../section-rational-internal.js';
import type { ExactPairedVLinearProof } from './exact-paired-vlinear-polynomial-internal.js';
import type { Curve, Surface, Model, Point } from '../types.js';
import type { CurveD1Result, SurfaceD1Result } from '../core/derivatives.js';
import { KernelError } from '../core/barocss-error.js';
type Asset = {
    sourceId: string;
    source: string;
    surface: Surface;
};
export interface ExactPairedVLinearSurfaceIntersectionOptions {
    evaluationId: string;
    worldCurveId: string;
    pcurveAId: string;
    pcurveBId: string;
    maximumObservations: 5;
}
export interface ExactPairedVLinearSurfaceIntersectionRequest {
    assets: [Asset, Asset];
    uAInterval: [number, number];
    options: ExactPairedVLinearSurfaceIntersectionOptions;
}
type Selection = {
    assetIndex: 0 | 1;
    sourceId: string;
    sourceField: string;
    modelField: string;
    modelName: string;
    objectIndex: number;
    surfaceId: string;
    nativeDomains: {
        u: [number, number];
        v: [number, number];
    };
};
type UV = {
    coordinateSystem: 'original-native-uv';
    lengthUnit: 'dimensionless';
    embeddedZ: 0;
    parameterFrame: 'original-a-u';
    curve: Curve;
    support: Selection;
};
type Proof = ExactPairedVLinearProof;
type Observation = {
    index: number;
    parameter: number;
    world: {
        d0: Point;
        d1: CurveD1Result;
    };
    pcurveA: {
        d0: Point;
        d1: CurveD1Result;
    };
    pcurveB: {
        d0: Point;
        d1: CurveD1Result;
    };
    surfaceA: {
        d0: Point;
        d1: SurfaceD1Result;
    };
    surfaceB: {
        d0: Point;
        d1: SurfaceD1Result;
    };
    chainA: Point;
    chainB: Point;
    residuals: {
        worldToA: number;
        worldToB: number;
        aToB: number;
        relativeWorldChainA: number;
        relativeWorldChainB: number;
        d0ToD1Point: [number, number, number, number, number];
    };
};
export interface ExactPairedVLinearSurfaceIntersectionResult {
    request: ExactPairedVLinearSurfaceIntersectionRequest;
    originalModels: [Model, Model];
    world: {
        curve: Curve;
        source: string;
        sourceVersion: 0;
        model: Model;
    };
    pcurves: {
        a: UV;
        b: UV;
    };
    proof: Proof;
    observations: Observation[];
    report: ExactPairedVLinearSurfaceIntersectionReport;
}
export interface ExactPairedVLinearSurfaceIntersectionReport {
    schema: 'barocss-exact-paired-vlinear-surface-intersection-report';
    version: 0;
    evaluationId: string;
    selections: [Selection, Selection];
    parameterDomain: [number, number];
    parameterFrame: 'original-a-u';
    worldCurveId: string;
    pcurveAId: string;
    pcurveBId: string;
    curveDegree: 4;
    curvePoleCount: 5;
    curveKnotCount: 10;
    worldLengthUnit: 'mm';
    uvLengthUnit: 'dimensionless';
    sourceFrame: 'authored-xyz-no-axis-conversion';
    worldSourceBinding: {
        sourceField: 'world.source';
        modelField: 'world.model';
        modelName: string;
        objectIndex: 0;
        curveId: string;
    };
    wholeCoefficientResidualZero: true;
    uniqueCompleteBranchOnDeclaredInterval: true;
    maximumObservedPointGapMM: number;
    maximumObservedRelativeChainGap: number;
    directCounts: {
        originalSourceCompileCount: 2;
        selectedSurfaceValidationCount: 2;
        surfaceDomainCount: 2;
        newCurveValidationCount: 3;
        worldSourceAdoptionCount: 1;
        uvSourceCompilationCount: 0;
        observationCount: 5;
        curveD0Count: 15;
        curveD1AttemptCount: 15;
        surfaceD0Count: 10;
        surfaceD1AttemptCount: 10;
        traceCallCount: 0;
        fittingCallCount: 0;
        rootSolveCount: 0;
        originalSourceEditCount: 0;
    };
    rationalCounts: ReturnType<SectionRationalContext['counts']>;
    quality: {
        exactStoredCoefficientBinding: true;
        bothOriginalUVPreserved: true;
        completeOriginalSourcesRetained: true;
        uniqueOnAdmittedInterval: true;
        exactWholeModelGapZero: true;
        nativeObservationsSeparate: true;
        uvCurvesEmittedAsWorldSource: false;
        genericIntersection: false;
        allBranchesOutsideInterval: false;
        trimFaceProduced: false;
        topologyCertified: false;
        solid: false;
        globalBinary64EvaluationErrorCertified: false;
        manufacturingToleranceCertified: false;
        publication: false;
        ownership: 'independent-copied-cpu-data-gc';
    };
    sourceSizes: {
        a: Size;
        b: Size;
        world: Size;
    };
    fileSizes: {
        request: Size;
        result: Size;
    };
    ownValues: number;
    limits: {
        maximumSelectedUDegree: 2;
        selectedVDegree: 1;
        maximumSelectedUPoles: 3;
        selectedVPoles: 2;
        maximumSpans: 1;
        maximumCurveDegree: 4;
        maximumCurvePoles: 5;
        maximumCurveKnots: 10;
        maximumObservations: 5;
        maximumNativeObservationAttempts: 50;
        maximumFinalCoordinateConversions: 45;
        sourceCharacters: 262144;
        sourceUTF8Bytes: 262144;
        maximumOriginalModelObjects: 16;
        coordinateAbs: 10000;
        parameterAbs: 10000;
        minimumSpan: 0.000001;
        minimumWeight: 0.000001;
        maximumWeight: 1000000;
        rationalOperations: 200000;
        gcdSteps: 200000;
        rationalIntegerBits: 8192;
        fractionIntegerCharacters: 5000;
        requestBytes: 2097152;
        resultBytes: 4194304;
        ownValues: 1048576;
        ownDepth: 64;
        arrayElements: 8192;
        recordFields: 64;
        stringCharacters: 262144;
        identityCharacters: 48;
        maximumSettlePasses: 8;
    };
    workScope: 'exact-private-profile-composition-and-direct-native-observations';
    budgetFailure: 'atomic-no-partial-exact-paired-section';
}
type Size = {
    utf16: number;
    utf8: number;
};
export declare const ExactPairedVLinearSurfaceIntersectionDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly SOURCE: "SOURCE";
    readonly REFERENCE: "REFERENCE";
    readonly SUPPORT: "SUPPORT";
    readonly DOMAIN: "DOMAIN";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly BUDGET: "BUDGET";
    readonly BINDING: "BINDING";
    readonly NATIVE: "NATIVE";
    readonly FILE: "FILE";
    readonly OWNED: "OWNED";
}>;
type DiagnosticCode = typeof ExactPairedVLinearSurfaceIntersectionDiagnosticCode[keyof typeof ExactPairedVLinearSurfaceIntersectionDiagnosticCode];
type DirectAttempts = {
    [K in keyof ExactPairedVLinearSurfaceIntersectionReport['directCounts']]: number;
};
type ErrorContext = {
    phase: 'input' | 'source' | 'reference' | 'support' | 'polynomial' | 'curve-validation' | 'world-adoption' | 'observation' | 'file' | 'owned';
    assetIndex: 0 | 1 | null;
    stationIndex: number | null;
    directCounts: DirectAttempts;
};
export declare class ExactPairedVLinearSurfaceIntersectionError extends KernelError {
    readonly code: DiagnosticCode;
    readonly context: ErrorContext;
    constructor(code: DiagnosticCode, detail: string, state: ErrorContext, cause?: unknown);
}
/** Construct exact stored-model World and both original-UV Curves before native observations. */
export declare function buildExactPairedVLinearSurfaceIntersection(input: ExactPairedVLinearSurfaceIntersectionRequest): ExactPairedVLinearSurfaceIntersectionResult;
/** Reconstruct the full exact pair once and return an independent complete Report. */
export declare function validateExactPairedVLinearSurfaceIntersection(input: unknown): ExactPairedVLinearSurfaceIntersectionReport;
export {};
