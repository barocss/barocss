import { SectionRationalContext } from '../section-rational-internal.js';
import type { PairedSurfaceUVSplitFacesProof, PairedSurfaceUVSplitVertex, PairedSurfaceUVSplitEdge, PairedSurfaceUVSplitLoop, PairedSurfaceUVSplitFace, PairedSurfaceUVSplitWorld } from './paired-surface-uv-split-faces-proof-internal.js';
import type { Point } from '../types.js';
import type { CurveD1Result, SurfaceD1Result } from '../core/derivatives.js';
import type { ExactPairedVLinearSurfaceIntersectionResult } from '../exact-proof/exact-paired-vlinear-surface-intersection.js';
import type { SurfaceIsoCurveResult } from '../nurbs/surfaces/surface-isocurve.js';
import type { SourceCurveIntervalExtractionResult } from '../nurbs/source-wide/source-curve-interval-extraction.js';
import type { SectionFraction } from '../section-rational-internal.js';
import { KernelError } from '../core/barocss-error.js';
type F = SectionFraction;
type Sense = 'forward' | 'reverse';
type Size = {
    utf16: number;
    utf8: number;
};
export interface PairedSurfaceUVSplitFacesOptions {
    evaluationId: string;
    resultIdPrefix: string;
    orientation: Sense;
    maximumIsoCurves: 2;
    maximumIntervals: 2;
    maximumObservations: 35;
}
export interface PairedSurfaceUVSplitFacesRequest {
    section: ExactPairedVLinearSurfaceIntersectionResult;
    options: PairedSurfaceUVSplitFacesOptions;
}
type SupportRef = {
    sourceId: string;
    surfaceId: string;
    sourceField: 'request.section.request.assets[0].source';
    modelField: 'request.section.originalModels[0]';
    modelName: string;
    objectIndex: number;
};
type Vertex = PairedSurfaceUVSplitVertex;
type Edge = PairedSurfaceUVSplitEdge;
type Loop = PairedSurfaceUVSplitLoop;
type Face = PairedSurfaceUVSplitFace;
type World = PairedSurfaceUVSplitWorld;
type Proof = PairedSurfaceUVSplitFacesProof;
type D1<T> = {
    status: 'evaluated';
    value: T;
} | {
    status: 'native-refused';
    reason: string;
    nativeErrorName: string;
};
type Observation = {
    edgeId: string;
    edgeIndex: number;
    index: number;
    parameter: number;
    world: {
        d0: Point;
        d1: D1<CurveD1Result>;
    };
    pcurve: {
        d0: Point;
        d1: D1<CurveD1Result>;
    };
    surface: {
        d0: Point;
        d1: D1<SurfaceD1Result>;
    };
    chain: Point | null;
    residuals: {
        pointGapMM: number;
        worldD0D1PointGapMM: number | null;
        uvD0D1PointGap: number | null;
        surfaceD0D1PointGapMM: number | null;
        relativeChainGap: number | null;
    };
};
export interface PairedSurfaceUVSplitFacesResult {
    request: PairedSurfaceUVSplitFacesRequest;
    isoCurves: [SurfaceIsoCurveResult, SurfaceIsoCurveResult];
    intervals: [SourceCurveIntervalExtractionResult, SourceCurveIntervalExtractionResult];
    world: World;
    vertices: Vertex[];
    edges: Edge[];
    loops: [Loop, Loop];
    faces: [Face, Face];
    proof: Proof;
    observations: Observation[];
    report: PairedSurfaceUVSplitFacesReport;
}
export interface PairedSurfaceUVSplitFacesReport {
    schema: 'barocss-paired-surface-uv-split-faces';
    version: 0;
    evaluationId: string;
    parentEvaluationId: string;
    support: SupportRef;
    orientation: Sense;
    window: {
        u: [number, number];
        v: [number, number];
    };
    lengthUnit: 'mm';
    uvLengthUnit: 'dimensionless';
    parameterFrame: 'original-a-u-window-and-native-edge-parameters';
    vertexCount: 6;
    edgeCount: 7;
    faceCount: 2;
    loopCount: 2;
    useCount: 8;
    worldObjectCount: 8;
    sharedCutEdgeId: string;
    sharedWorldCurveId: string;
    sharedPcurveId: string;
    worldModelName: string;
    reservedIds: string[];
    minimumLowerGap: F;
    minimumUpperGap: F;
    xyDeterminant: F;
    wholeEdgeModelGapMM: 0;
    maximumObservedPointGapMM: number;
    maximumObservedRelativeChainGap: number;
    derivativeCounts: Record<'world' | 'pcurve' | 'surface', {
        evaluated: number;
        refused: number;
    }>;
    directCounts: {
        parentValidationCount: 1;
        isoCurveExtractionCount: 2;
        sourceIntervalExtractionCount: 2;
        sideWorldValidationCount: 4;
        newUVValidationCount: 6;
        worldModelAdoptionCount: 1;
        observationCount: 35;
        curveD0Count: 70;
        curveD1AttemptCount: 70;
        surfaceD0Count: 35;
        surfaceD1AttemptCount: 35;
        rationalFloatConversionCount: 0;
    };
    inheritedCounts: {
        parent: ExactPairedVLinearSurfaceIntersectionResult['report']['directCounts'];
        iso: [SurfaceIsoCurveResult['report'], SurfaceIsoCurveResult['report']];
        intervals: [
            SourceCurveIntervalExtractionResult['report']['directCounts'],
            SourceCurveIntervalExtractionResult['report']['directCounts']
        ];
    };
    rationalCounts: ReturnType<SectionRationalContext['counts']>;
    quality: {
        individualFaceEmbedded: true;
        closedUVDisks: true;
        complementaryWindowRegions: true;
        exactWorldSurfaceAgreement: true;
        sharedCutUnchanged: true;
        oppositeSharedUses: true;
        fullOriginalSourcesAndBothUVRetained: true;
        parentFlagsUnchanged: true;
        wholeOriginalOutsideWindowSplit: false;
        bSplitProduced: false;
        sewnManifold: false;
        wholeBodyTopologyCertified: false;
        solid: false;
        occupiedVolumeCertified: false;
        worldSurfaceAreaComputed: false;
        genericBoolean: false;
        globalBinary64EvaluationErrorCertified: false;
        manufacturingToleranceCertified: false;
        publication: false;
        ownership: 'independent-copied-cpu-data-gc';
    };
    fileSizes: {
        request: Size;
        result: Size;
    };
    ownValues: number;
    limits: {
        maximumIsoCurves: 2;
        maximumIntervals: 2;
        maximumSideLines: 4;
        maximumVertices: 6;
        maximumEdges: 7;
        maximumFaces: 2;
        maximumUses: 8;
        maximumWorldObjects: 8;
        maximumUDegree: 2;
        vDegree: 1;
        maximumCutDegree: 4;
        maximumProofDegree: 4;
        maximumObservations: 35;
        maximumNativeObservationAttempts: 210;
        sourceCharacters: 262144;
        sourceUTF8Bytes: 262144;
        maximumOriginalModelObjects: 16;
        requestBytes: 4194304;
        resultBytes: 16777216;
        ownValues: 4194304;
        ownDepth: 64;
        arrayElements: 8192;
        recordFields: 64;
        keyCharacters: 128;
        stringCharacters: 262144;
        prefixCharacters: 12;
        identityCharacters: 48;
        rationalOperations: 200000;
        gcdSteps: 200000;
        rationalIntegerBits: 8192;
        fractionIntegerCharacters: 5000;
        maximumRationalFloatConversions: 0;
        maximumSettlePasses: 8;
    };
    workScope: 'direct-parent-iso-interval-adoption-and-edge-observations-with-inherited-work-separated';
    budgetFailure: 'atomic-no-partial-complementary-faces';
}
export declare const PairedSurfaceUVSplitFacesDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly PARENT: "PARENT";
    readonly SUPPORT: "SUPPORT";
    readonly DOMAIN: "DOMAIN";
    readonly ISO: "ISO";
    readonly INTERVAL: "INTERVAL";
    readonly REGION: "REGION";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly BINDING: "BINDING";
    readonly NATIVE: "NATIVE";
    readonly BUDGET: "BUDGET";
    readonly FILE: "FILE";
    readonly OWNED: "OWNED";
}>;
type DiagnosticCode = typeof PairedSurfaceUVSplitFacesDiagnosticCode[keyof typeof PairedSurfaceUVSplitFacesDiagnosticCode];
type DirectAttempts = {
    [K in keyof PairedSurfaceUVSplitFacesReport['directCounts']]: number;
};
type ErrorContext = {
    phase: 'input' | 'parent' | 'iso' | 'interval' | 'side' | 'uv' | 'adoption' | 'proof' | 'observation' | 'file' | 'owned';
    edgeIndex: number | null;
    observationIndex: number | null;
    directCounts: DirectAttempts;
};
export declare class PairedSurfaceUVSplitFacesError extends KernelError {
    readonly code: DiagnosticCode;
    readonly context: ErrorContext;
    constructor(code: DiagnosticCode, detail: string, state: ErrorContext, cause?: unknown);
}
/** Two complementary embedded strips in the unchanged original-A selected UV window. */
export declare function buildPairedSurfaceUVSplitFaces(input: PairedSurfaceUVSplitFacesRequest): PairedSurfaceUVSplitFacesResult;
/** Reconstruct once from the full paired parent and return an independent complete Report. */
export declare function validatePairedSurfaceUVSplitFaces(input: unknown): PairedSurfaceUVSplitFacesReport;
export {};
