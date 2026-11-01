import type { MultiSpanVLinearSurfacePlaneSectionResult } from '../intersect/multispan-vlinear-plane-section.js';
import { SectionRationalContext } from '../section-rational-internal.js';
import type { SectionFraction } from '../section-rational-internal.js';
import type { CurveD1Result, SurfaceD1Result } from '../core/derivatives.js';
import type { Curve, Model, Point } from '../types.js';
import { KernelError } from '../core/barocss-error.js';
export declare const PairedSectionPlaneCapDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly BUDGET: "BUDGET";
    readonly SECTION: "SECTION";
    readonly BASIS: "BASIS";
    readonly GRAPH: "GRAPH";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly BINDING: "BINDING";
    readonly NATIVE: "NATIVE";
    readonly OWNED: "OWNED";
}>;
export type PairedSectionPlaneCapDiagnosticCode = typeof PairedSectionPlaneCapDiagnosticCode[keyof typeof PairedSectionPlaneCapDiagnosticCode];
export declare class PairedSectionPlaneCapError extends KernelError {
    readonly code: PairedSectionPlaneCapDiagnosticCode;
    constructor(code: PairedSectionPlaneCapDiagnosticCode, detail: string, cause?: unknown);
}
export interface PairedSectionPlaneCapOptions {
    evaluationId: string;
    resultIdPrefix: string;
    maximumSections: number;
    maximumConnectors: number;
    maximumObservations: number;
}
type Bound = {
    exact: SectionFraction;
    upper: number;
};
type Vertex = {
    id: string;
    sourceId: string;
    planeId: string;
    world: Point;
    uv: Point;
};
export interface PairedSectionPlaneCapEdge {
    id: string;
    role: 'lower' | 'right' | 'upper' | 'left';
    curve: Curve;
    vertexIds: [string, string];
    pcurve: {
        coordinateSystem: 'native-plane-uv';
        lengthUnit: 'dimensionless';
        curve: Curve;
    };
    origin: {
        kind: 'original-section' | 'connector';
        section: 'lower' | 'upper' | null;
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
    planeId: string;
    outerLoopId: string;
    orientation: 'forward';
};
type Monotonic = {
    degree: number;
    coefficients: SectionFraction[];
    minimumCoefficient: SectionFraction;
};
type SpanProof = {
    index: number;
    domain: [number, number];
    lowerPoleIndices: number[];
    upperPoleIndices: number[];
    homogeneous: {
        lower: SectionFraction[][];
        upper: SectionFraction[][];
    };
    minimumWeights: {
        lower: SectionFraction;
        upper: SectionFraction;
    };
    maximumWeights: {
        lower: SectionFraction;
        upper: SectionFraction;
    };
    uMonotonicity: {
        lower: Monotonic;
        upper: Monotonic;
    };
    commonU: {
        degree: number;
        method: 'identical-homogeneous-u-and-weights' | 'expanded-cross-product';
        coefficients: SectionFraction[];
    };
    separation: {
        degree: number;
        method: 'shared-weight-difference-product' | 'expanded-cross-product';
        coefficients: SectionFraction[];
        minimumCoefficient: SectionFraction;
        minimumGapUV: SectionFraction;
    };
};
type Mapping = {
    side: 'lower' | 'upper';
    inheritedBound: Bound;
    spans: {
        index: number;
        domain: [number, number];
        worldPoleIndices: number[];
        planePcurvePoleIndices: number[];
        worldHomogeneous: SectionFraction[][];
        planeUVHomogeneous: SectionFraction[][];
        mappedWorldHomogeneous: SectionFraction[][];
        residuals: SectionFraction[][];
    }[];
};
type ConnectorProof = {
    edgeId: string;
    worldEndpoints: Point[];
    uvEndpoints: Point[];
    planeEndpoints: SectionFraction[][];
    residuals: SectionFraction[][];
    endpointL1Errors: SectionFraction[];
    bound: Bound;
};
type Embedding = {
    schema: 'barocss-exact-affine-plane-strip-face';
    version: 0;
    sourceId: string;
    planeId: string;
    faceId: string;
    loopId: string;
    worldModelId: string;
    edgeIds: string[];
    planeGramDeterminant: SectionFraction;
    uMinimum: SectionFraction;
    uMaximum: SectionFraction;
    minimumGapUV: SectionFraction;
    closedDiskCertified: true;
    exactWorldPlaneAgreement: true;
    orientation: 'forward';
    authority: 'exact-stored-control-coefficients-and-source-qualified-loop';
};
type Proof = {
    spans: SpanProof[];
    worldMappings: [Mapping, Mapping];
    connectors: ConnectorProof[];
    edgeBounds: {
        edgeId: string;
        role: PairedSectionPlaneCapEdge['role'];
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
    planePcurve: {
        d0: Point;
        d1: D1<CurveD1Result>;
    };
    plane: {
        d0: Point;
        d1: D1<SurfaceD1Result>;
    };
    chain: Point | null;
    residuals: {
        pointGapMM: number;
        worldD0D1PointGapMM: number | null;
        uvD0D1PointGap: number | null;
        planeD0D1PointGapMM: number | null;
        relativeChainGap: number | null;
    };
};
export interface PairedSectionPlaneCapReport {
    schema: 'barocss-paired-section-plane-cap';
    version: 0;
    evaluationId: string;
    planeSourceId: string;
    planeId: string;
    lowerCurveId: string;
    upperCurveId: string;
    faceId: string;
    lengthUnit: 'mm';
    uvLengthUnit: 'dimensionless';
    sourceFrame: 'authored-xyz-no-axis-conversion';
    parameterFrame: 'original-section-u-and-shared-original-plane-uv';
    spanCount: number;
    vertexCount: 4;
    edgeCount: 4;
    useCount: 4;
    loopCount: 1;
    faceCount: 1;
    worldObjectCount: 5;
    minimumCertifiedVGapUV: SectionFraction;
    edgeModelGaps: Proof['edgeBounds'];
    maximumWholeEdgeModelGapMM: 0;
    maximumObservedPointGapMM: number;
    maximumObservedRelativeChainGap: number;
    derivativeCounts: Record<'world' | 'planePcurve' | 'plane', {
        evaluated: number;
        refused: number;
    }>;
    rationalCounts: ReturnType<SectionRationalContext['counts']>;
    directCounts: {
        sectionValidationCount: 2;
        newWorldCurveValidationCount: 2;
        newUVValidationCount: 2;
        worldSourceCompilationCount: 1;
        observationCount: number;
        curvePointEvaluationCount: number;
        curveDerivativeEvaluationCount: number;
        surfacePointEvaluationCount: number;
        surfaceDerivativeEvaluationCount: number;
    };
    quality: {
        geometricValidity: 'exact-affine-plane-strip-certified';
        storedUVSimpleStrip: true;
        orientedUVCycle: true;
        logicalIncidence: true;
        exactStoredWorldEndpointIncidence: true;
        exactStoredPlaneAgreement: true;
        faceEmbeddingCertified: true;
        wholeModelGapCertified: true;
        wholeBodyTopologyCertified: false;
        manifoldCertified: false;
        solid: false;
        occupiedVolumeCertified: false;
        outwardSolidCapCertified: false;
        globalBinary64EvaluationErrorCertified: false;
        manufacturingToleranceCertified: false;
        generalSurfaceRegularityCertified: false;
        weldingPerformed: false;
        parentProofsUnchanged: true;
        ownership: 'independent-copied-cpu-data-gc';
    };
    numericPolicy: {
        authority: 'exact-stored-coefficients-and-original-affine-plane';
        positionAdmission: 'all-stored-world-plane-coefficient-residuals-zero';
        commonU: 'exact-cross-product-or-tagged-homogeneous-identity';
        separation: 'strict-positive-bernstein-cross-coefficients';
        vGapLowerBound: 'exact-fraction-no-upward-lower-bound';
        reversal: 'upper-use-only-no-geometry-rewrite';
        nativeObservations: 'actual-provider-coordinates-c0-unions-no-snap';
        pointComparisonMM: 1e-7;
        relativeChainComparison: 1e-7;
    };
    limits: {
        maximumSpans: 4;
        maximumPlaneUVDegree: 4;
        maximumMonotonicityDegree: 7;
        maximumCrossDegree: 8;
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
    budgetFailure: 'atomic-no-partial-cap';
}
export interface PairedSectionPlaneCapResult {
    lower: MultiSpanVLinearSurfacePlaneSectionResult;
    upper: MultiSpanVLinearSurfacePlaneSectionResult;
    options: PairedSectionPlaneCapOptions;
    vertices: Vertex[];
    edges: PairedSectionPlaneCapEdge[];
    loop: Loop;
    face: Face;
    world: {
        source: string;
        sourceVersion: 0;
        model: Model;
    };
    proof: Proof;
    observations: Observation[];
    report: PairedSectionPlaneCapReport;
}
/** Construct an exact original-Plane Face from two proved stored UV graphs and two real connectors. */
export declare function buildPairedSectionPlaneCap(lowerInput: MultiSpanVLinearSurfacePlaneSectionResult, upperInput: MultiSpanVLinearSurfacePlaneSectionResult, optionsInput: PairedSectionPlaneCapOptions): PairedSectionPlaneCapResult;
/** Reconstruct both complete parents, exact Face proof, source, topology and all native observations. */
export declare function validatePairedSectionPlaneCap(input: PairedSectionPlaneCapResult): PairedSectionPlaneCapReport;
export {};
