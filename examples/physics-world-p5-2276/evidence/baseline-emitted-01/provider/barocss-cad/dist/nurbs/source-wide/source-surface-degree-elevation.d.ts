import type { C0ElevationKnotBlock, C0ElevationCoefficientResult } from '../curves/curve-c0-degree-elevation-internal.js';
import type { SurfaceD1Result } from '../../core/derivatives.js';
import type { Curve, Surface, Model, Point } from '../../types.js';
import { KernelError } from '../../core/barocss-error.js';
export declare const SourceSurfaceDegreeElevationDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly VERSION: "VERSION";
    readonly IDENTITY: "IDENTITY";
    readonly SOURCE: "SOURCE";
    readonly TARGET: "TARGET";
    readonly BASIS: "BASIS";
    readonly BUDGET: "BUDGET";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly BINDING: "BINDING";
    readonly NATIVE: "NATIVE";
    readonly OWNED: "OWNED";
    readonly FILE: "FILE";
}>;
export type SourceSurfaceDegreeElevationDiagnosticCode = typeof SourceSurfaceDegreeElevationDiagnosticCode[keyof typeof SourceSurfaceDegreeElevationDiagnosticCode];
export declare class SourceSurfaceDegreeElevationError extends KernelError {
    readonly code: SourceSurfaceDegreeElevationDiagnosticCode;
    constructor(code: SourceSurfaceDegreeElevationDiagnosticCode, detail: string, cause?: unknown);
}
export interface SourceSurfaceDegreeElevationRequest {
    source: string;
    sourceVersion: 0;
    surfaceId: string;
    axis: 'u' | 'v';
    targetDegree: 2 | 3 | 4 | 5;
    maximumObservations: 1024;
}
export interface SourceSurfaceDegreeElevationPatch {
    field: 'degree-u' | 'degree-v' | 'knots-u' | 'knots-v' | 'control-points' | 'weights';
    startUTF16: number;
    endUTF16: number;
    originalText: string;
    replacementText: string;
}
type Size = {
    utf16: number;
    utf8: number;
};
type Degrees = {
    u: number;
    v: number;
};
type Domains = {
    u: [number, number];
    v: [number, number];
};
type Grid = {
    u: number;
    v: number;
    total: number;
};
type D1State = {
    status: 'evaluated';
    value: SurfaceD1Result;
} | {
    status: 'refused-c0';
    name: string;
    reason: string;
    value: null;
};
type Observation = {
    u: number;
    v: number;
    originalPoint: Point;
    elevatedPoint: Point;
    pointDifference: number;
    originalD1: D1State;
    elevatedD1: D1State;
    relativeDuDifference: number | null;
    relativeDvDifference: number | null;
};
type CopiedPole = {
    originalUIndex: number;
    originalVIndex: number;
    elevatedUIndex: number;
    elevatedVIndex: number;
};
type Strip = {
    fixedPoleIndex: number;
    originalCurve: Curve;
    calculation: C0ElevationCoefficientResult;
};
type Provenance = {
    selectedObjectIndex: number;
    axis: 'u' | 'v';
    degrees: {
        original: Degrees;
        elevated: Degrees;
    };
    domain: Domains;
    selectedBlocks: C0ElevationKnotBlock[];
    spanCount: number;
    parameterMap: {
        kind: 'identity';
        formula: 'u=s;v=t';
        uD1Factor: 1;
        vD1Factor: 1;
    };
    patches: SourceSurfaceDegreeElevationPatch[];
    copiedPoles: CopiedPole[];
    knots: C0ElevationCoefficientResult['knots'];
    strips: Strip[];
};
export interface SourceSurfaceDegreeElevationReport {
    schema: 'barocss-source-surface-degree-elevation-report';
    version: 0;
    sourceVersion: 0;
    lengthUnit: 'mm';
    modelName: string;
    surfaceId: string;
    selectedObjectIndex: number;
    objectCount: number;
    axis: 'u' | 'v';
    degrees: {
        original: Degrees;
        elevated: Degrees;
    };
    domain: Domains;
    grids: {
        original: Grid;
        elevated: Grid;
    };
    knotCounts: {
        original: Degrees;
        elevated: Degrees;
    };
    spanCount: number;
    stripCount: number;
    patchCount: 4;
    sourceSizes: {
        original: Size;
        candidate: Size;
    };
    fileSizes: {
        request: Size;
        result: Size;
    };
    stations: {
        u: number[];
        v: number[];
    };
    observations: Observation[];
    maximumPointDifference: number;
    maximumRelativeDuDifference: number;
    maximumRelativeDvDifference: number;
    receiptCounts: {
        spanReceiptCount: number;
        generatedPoleCount: number;
        liftedPoleCount: number;
        copiedPoleCount: number;
        addedAxisKnotCount: number;
    };
    directCounts: {
        originalCompileCount: 1;
        candidateCompileCount: 1;
        coefficientElevationCallCount: number;
        nativeSurfaceValidationCount: 2;
        domainQueryCount: 2;
        patchCount: 4;
        decimalEmissionCount: number;
        observationCount: number;
        surfaceD0Count: number;
        surfaceD1AttemptCount: number;
        surfaceD1EvaluatedCount: number;
        surfaceD1RefusedCount: number;
        curveD0Count: 0;
        curveD1AttemptCount: 0;
        curveDomainQueryCount: 0;
        publicCurveElevationCallCount: 0;
        sourceWriterCallCount: 0;
        rationalOperationCount: 0;
    };
    preservation: {
        untouchedSourceSpans: true;
        modelHeaderBits: true;
        objectOrderAndIds: true;
        unselectedObjectBits: true;
        selectedSurfaceEqualsActualCoefficientCandidate: true;
        endpointAndJoinPoleBits: true;
        originalKnotSlotBits: true;
        nonselectedDegreeKnotsBits: true;
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
        maximumInputSelectedDegree: 4;
        maximumOutputSelectedDegree: 5;
        maximumOtherDegree: 5;
        maximumElevations: 1;
        maximumSelectedSpans: 7;
        maximumOriginalSelectedPoles: 13;
        maximumElevatedSelectedPoles: 16;
        maximumOtherPoles: 16;
        maximumTotalPoles: 256;
        maximumKnotsPerAxis: 22;
        maximumStrips: 16;
        maximumGeneratedRows: 192;
        maximumLiftedPoles: 208;
        maximumCopiedPoles: 128;
        maximumSpanReceipts: 112;
        maximumSelectedStations: 29;
        maximumOtherStations: 31;
        maximumObservations: 1024;
        maximumProfileObservations: 899;
        maximumNativeAttempts: 3596;
        maximumPatches: 4;
        maximumDecimalEmissions: 1047;
        maximumModelObjects: 16;
        coordinateAbs: 10000;
        minimumWeight: 0.000001;
        maximumWeight: 1000000;
        maximumReplacementLiteralCharacters: 512;
        maximumPointDifference: 1e-7;
        maximumRelativeDerivativeDifference: 1e-7;
        sourceUTF16: 262144;
        sourceUTF8: 262144;
        maximumFileUTF16: 4194304;
        maximumFileUTF8: 4194304;
        ownValues: 1048576;
        ownDepth: 64;
        arrayElements: 8192;
        recordFields: 64;
        keyCharacters: 128;
        stringCharacters: 262144;
        identifierCharacters: 48;
    };
    workScope: 'direct-wrapper-calls-private-strip-arithmetic-and-whole-native-surface-observations';
    budgetFailure: 'atomic-no-partial-source-surface-degree-elevation';
}
export interface SourceSurfaceDegreeElevationResult {
    request: SourceSurfaceDegreeElevationRequest;
    source: string;
    originalModel: Model;
    model: Model;
    originalSurface: Surface;
    surface: Surface;
    provenance: Provenance;
    report: SourceSurfaceDegreeElevationReport;
}
/** Elevate one admitted actual Surface axis through copied private strips and preserve the full source. */
export declare function elevateSourceSurfaceAxisDegree(input: SourceSurfaceDegreeElevationRequest): SourceSurfaceDegreeElevationResult;
/** Reconstruct the complete source, every actual strip and native slot once, then compare all retained bits. */
export declare function validateSourceSurfaceAxisDegreeElevation(input: SourceSurfaceDegreeElevationResult): SourceSurfaceDegreeElevationReport;
export {};
