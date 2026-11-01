import type { SectionExactSurfaceBindingResult } from '../features/section-exact-surface-binding.js';
import type { CurveD1Result, SurfaceD1Result } from '../core/derivatives.js';
import { SectionRationalContext } from '../section-rational-internal.js';
import type { SectionFraction } from '../section-rational-internal.js';
import type { Curve, Model, Point } from '../types.js';
import { KernelError } from '../core/barocss-error.js';
export declare const ExactSurfaceLowerTrimDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly BUDGET: "BUDGET";
    readonly BINDING: "BINDING";
    readonly PARENT: "PARENT";
    readonly SUPPORT: "SUPPORT";
    readonly EMBEDDING: "EMBEDDING";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly NATIVE: "NATIVE";
    readonly OWNED: "OWNED";
}>;
export type ExactSurfaceLowerTrimDiagnosticCode = typeof ExactSurfaceLowerTrimDiagnosticCode[keyof typeof ExactSurfaceLowerTrimDiagnosticCode];
export declare class ExactSurfaceLowerTrimError extends KernelError {
    readonly code: ExactSurfaceLowerTrimDiagnosticCode;
    constructor(code: ExactSurfaceLowerTrimDiagnosticCode, detail: string, cause?: unknown);
}
export interface ExactSurfaceLowerTrimOptions {
    evaluationId: string;
    resultIdPrefix: string;
    orientation: 'forward' | 'reverse';
    maximumObservations: 40;
}
type Bound = {
    exact: SectionFraction;
    upper: number;
};
type Vertex = {
    id: string;
    sourceId: string;
    surfaceId: string;
    world: Point;
    uv: Point;
};
export interface ExactSurfaceLowerTrimEdge {
    id: string;
    role: 'bottom' | 'right' | 'cut' | 'left';
    curve: Curve;
    vertexIds: [string, string];
    pcurve: {
        coordinateSystem: 'native-surface-uv';
        lengthUnit: 'dimensionless';
        curve: Curve;
    };
    origin: {
        kind: 'natural-boundary' | 'bound-section' | 'connector';
        sourceId: string;
        surfaceId: string;
    };
}
type Use = {
    id: string;
    edgeId: string;
    vertexIds: [string, string];
    sense: 'forward' | 'reverse';
    interval: [number, number];
    pcurveId: string;
};
type Loop = {
    id: string;
    uses: [Use, Use, Use, Use];
};
type Face = {
    id: string;
    sourceId: string;
    surfaceId: string;
    outerLoopId: string;
    orientation: 'forward' | 'reverse';
};
type Projection = {
    spans: {
        index: number;
        domain: [number, number];
        originalPoleIndices: number[];
        xCoefficients: SectionFraction[];
        xDerivativeDegree: number;
        xDerivativeCoefficients: SectionFraction[];
        minimumXDerivative: SectionFraction;
    }[];
    z0: SectionFraction;
    z1: SectionFraction;
    zDerivative: SectionFraction;
    minimumXDerivative: SectionFraction;
    normalYAbsoluteLowerBound: SectionFraction;
    gramDeterminantLowerBound: SectionFraction;
};
type Natural = {
    curveId: string;
    spans: {
        index: number;
        domain: [number, number];
        originalPoleIndices: number[];
        bottomPoleIndices: number[];
        originalCartesian: SectionFraction[][];
        storedCartesian: SectionFraction[][];
        residuals: SectionFraction[][];
    }[];
    wholeGap: Bound;
};
type Connector = {
    edgeId: string;
    originalUIndex: number;
    worldEndpoints: Point[];
    uvEndpoints: Point[];
    surfaceEndpoints: SectionFraction[][];
    residuals: SectionFraction[][];
    endpointL1Errors: SectionFraction[];
    wholeGap: Bound;
};
type Embedding = {
    schema: 'barocss-exact-projected-vlinear-lower-strip-face';
    version: 0;
    authority: 'exact-stored-coefficients-original-projected-surface-and-oriented-loop';
    sourceId: string;
    surfaceId: string;
    bindingEvaluationId: string;
    worldCurveId: string;
    newUVId: string;
    faceId: string;
    loopId: string;
    worldModelId: string;
    edgeIds: string[];
    orientation: 'forward' | 'reverse';
    nativeDomains: SectionExactSurfaceBindingResult['section']['report']['surfaceDomains'];
    spanCount: number;
    wholeWorldSurfaceGap: Bound;
    UVminimumVGap: SectionFraction;
    UVminimumUpperGap: SectionFraction;
    closedDiskCertified: true;
    exactWorldSurfaceAgreement: true;
};
type Proof = {
    projection: Projection;
    naturalBoundary: Natural;
    connectors: Connector[];
    edgeBounds: {
        edgeId: string;
        role: ExactSurfaceLowerTrimEdge['role'];
        bound: Bound;
    }[];
    faceEmbedding: Embedding;
};
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
export interface ExactSurfaceLowerTrimReport {
    schema: 'barocss-exact-surface-lower-trim';
    version: 0;
    evaluationId: string;
    surfaceSourceId: string;
    surfaceId: string;
    bindingEvaluationId: string;
    worldCurveId: string;
    newUVId: string;
    faceId: string;
    orientation: 'forward' | 'reverse';
    lengthUnit: 'mm';
    uvLengthUnit: 'dimensionless';
    sourceFrame: 'authored-xyz-no-axis-conversion';
    parameterFrame: 'original-edge-parameters-and-native-surface-uv';
    spanCount: number;
    vertexCount: 4;
    edgeCount: 4;
    useCount: 4;
    loopCount: 1;
    faceCount: 1;
    worldObjectCount: 5;
    maximumWholeEdgeModelGapMM: 0;
    projection: Projection;
    maximumObservedPointGapMM: number;
    maximumObservedRelativeChainGap: number;
    derivativeCounts: Record<'world' | 'pcurve' | 'surface', {
        evaluated: number;
        refused: number;
    }>;
    rationalCounts: ReturnType<SectionRationalContext['counts']>;
    directCounts: {
        bindingValidationCount: 1;
        boundaryExtractionCount: 1;
        newWorldCurveValidationCount: 2;
        newUVValidationCount: 3;
        worldSourceCompilationCount: 1;
        observationCount: number;
        curvePointEvaluationCount: number;
        curveDerivativeEvaluationCount: number;
        surfacePointEvaluationCount: number;
        surfaceDerivativeEvaluationCount: number;
    };
    quality: {
        geometricValidity: 'exact-projected-surface-strip-certified';
        faceEmbeddingCertified: true;
        wholeModelGapCertified: true;
        logicalIncidence: true;
        storedUVSimpleStrip: true;
        orientedUVCycle: true;
        parentProofsUnchanged: true;
        wholeBodyTopologyCertified: false;
        manifoldCertified: false;
        solid: false;
        occupiedVolumeCertified: false;
        outwardSolidOrientationCertified: false;
        globalBinary64EvaluationErrorCertified: false;
        manufacturingToleranceCertified: false;
        generalSurfaceRegularityCertified: false;
        weldingPerformed: false;
        ownership: 'independent-copied-cpu-data-gc';
    };
    numericPolicy: {
        authority: 'exact-original-projected-surface-and-stored-edges';
        positionAdmission: 'all-stored-world-surface-residuals-zero';
        reversal: 'whole-use-order-and-senses-only';
        nativeObservations: 'actual-provider-coordinates-c0-unions-no-snap';
        projectionRegularity: 'per-smooth-patch-and-one-sided-endpoints-no-global-c1-claim';
        pointComparisonMM: 1e-7;
        relativeChainComparison: 1e-7;
    };
    limits: {
        maximumSpans: 4;
        maximumUDegree: 2;
        maximumUVDegree: 2;
        maximumWorldCutDegree: 4;
        maximumWorldPoles: 17;
        maximumNaturalPoles: 9;
        maximumObservations: 40;
        maximumWorldObjects: 5;
        prefixCharacters: 12;
        ownValues: 1048576;
        ownDepth: 64;
        arrayElements: 8192;
        recordFields: 64;
        sourceStringCharacters: 262144;
        rationalOperations: 200000;
        gcdSteps: 200000;
        rationalIntegerBits: 8192;
        fractionIntegerCharacters: 5000;
    };
    workScope: 'direct-root-calls-and-arithmetic-parent-internal-work-retained-and-excluded';
    budgetFailure: 'atomic-no-partial-face';
}
export interface ExactSurfaceLowerTrimResult {
    binding: SectionExactSurfaceBindingResult;
    options: ExactSurfaceLowerTrimOptions;
    vertices: Vertex[];
    edges: ExactSurfaceLowerTrimEdge[];
    loop: Loop;
    face: Face;
    world: {
        source: string;
        sourceVersion: 0;
        model: Model;
    };
    proof: Proof;
    observations: Observation[];
    report: ExactSurfaceLowerTrimReport;
}
/** Construct a real lower-strip Face with exact binding and a scoped original Surface embedding proof. */
export declare function buildExactSurfaceLowerTrim(bindingInput: SectionExactSurfaceBindingResult, optionsInput: ExactSurfaceLowerTrimOptions): ExactSurfaceLowerTrimResult;
/** Reconstruct the full binding, real edges/Source0, projection/Face proof and actual native observations. */
export declare function validateExactSurfaceLowerTrim(input: ExactSurfaceLowerTrimResult): ExactSurfaceLowerTrimReport;
export {};
