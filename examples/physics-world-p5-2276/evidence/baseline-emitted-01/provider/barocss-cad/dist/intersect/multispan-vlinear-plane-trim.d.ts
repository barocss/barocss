import type { MultiSpanVLinearSurfacePlaneSectionResult } from './multispan-vlinear-plane-section.js';
import type { ExtractedCurveIntervalResult } from '../nurbs/curves/curve-interval-extraction.js';
import { SectionRationalContext } from '../section-rational-internal.js';
import type { SectionFraction } from '../section-rational-internal.js';
import type { CurveD1Result, SurfaceD1Result } from '../core/derivatives.js';
import type { Curve, Model, Point } from '../types.js';
import { KernelError } from '../core/barocss-error.js';
export declare const MultiSpanVLinearSurfacePlaneTrimDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly BUDGET: "BUDGET";
    readonly SECTION: "SECTION";
    readonly UV: "UV";
    readonly INTERVAL: "INTERVAL";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly BINDING: "BINDING";
    readonly NATIVE: "NATIVE";
    readonly OWNED: "OWNED";
}>;
export type MultiSpanVLinearSurfacePlaneTrimDiagnosticCode = typeof MultiSpanVLinearSurfacePlaneTrimDiagnosticCode[keyof typeof MultiSpanVLinearSurfacePlaneTrimDiagnosticCode];
export declare class MultiSpanVLinearSurfacePlaneTrimError extends KernelError {
    readonly code: MultiSpanVLinearSurfacePlaneTrimDiagnosticCode;
    constructor(code: MultiSpanVLinearSurfacePlaneTrimDiagnosticCode, detail: string, cause?: unknown);
}
export interface MultiSpanVLinearSurfacePlaneTrimOptions {
    evaluationId: string;
    resultIdPrefix: string;
    maximumBoundaries: number;
    maximumIntervals: number;
    maximumObservations: number;
}
type Bound = {
    exact: SectionFraction;
    upper: number;
};
type Role = 'bottom' | 'rightLow' | 'rightHigh' | 'top' | 'leftLow' | 'leftHigh' | 'sharedCut';
type Vertex = {
    id: string;
    sourceId: string;
    surfaceId: string;
    role: 'bottomLeft' | 'bottomRight' | 'topRight' | 'topLeft' | 'cutLeft' | 'cutRight';
    uv: Point;
};
export interface MultiSpanVLinearSurfacePlaneTrimEdge {
    id: string;
    role: Role;
    curve: Curve;
    vertexIds: [string, string];
    pcurve: {
        coordinateSystem: 'native-surface-uv';
        lengthUnit: 'dimensionless';
        curve: Curve;
    };
    origin: {
        kind: 'natural-boundary' | 'interval' | 'section';
        index: number;
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
    orientation: 'forward';
    region: 'below-stored-uv-graph' | 'above-stored-uv-graph';
};
type Cut = {
    boundaryIndex: number;
    requestedV: number;
    requestedParameter: SectionFraction;
    roundedParameter: number;
    mappedV: SectionFraction;
    vError: Bound;
};
type Restriction = {
    intervalIndex: number;
    boundaryIndex: number;
    idealHomogeneous: SectionFraction[][];
    storedHomogeneous: SectionFraction[][];
    crossDifference: SectionFraction[][];
    minimumIdealWeight: SectionFraction;
    minimumStoredWeight: SectionFraction;
    restrictionGap: Bound;
    uvEndpointErrors: [SectionFraction, SectionFraction];
    uvMappingError: Bound;
    surfaceMappingGap: Bound;
    modelGap: Bound;
};
type Proof = {
    uvMonotonicity: {
        spans: {
            index: number;
            domain: [number, number];
            poleIndices: number[];
            degree: number;
            coefficients: SectionFraction[];
            minimumCoefficient: SectionFraction;
        }[];
        nativeParameterDerivative: true;
        allStrictPositive: true;
        endpointUExact: true;
        allVPolesStrictInterior: true;
    };
    naturalBoundaryKnots: {
        boundaryIndex: number;
        sourceAxis: 'u' | 'v';
        reversed: boolean;
        originalKnots: number[];
        actualKnots: number[];
        expectedKnots: SectionFraction[];
    }[];
    cuts: {
        left: Cut;
        right: Cut;
    };
    restrictions: Restriction[];
    edgeBounds: {
        edgeId: string;
        role: Role;
        kind: 'exact-native-boundary' | 'restriction-and-uv-map' | 'inherited-section';
        bound: Bound;
    }[];
};
type D1State<T> = {
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
        d1: D1State<CurveD1Result>;
    };
    pcurve: {
        d0: Point;
        d1: D1State<CurveD1Result>;
    };
    support: {
        d0: Point;
        d1: D1State<SurfaceD1Result>;
    };
    chain: Point | null;
    residuals: {
        pointGapMM: number;
        worldD0D1PointGapMM: number | null;
        uvD0D1PointGap: number | null;
        supportD0D1PointGapMM: number | null;
        relativeChainGap: number | null;
    };
};
export interface MultiSpanVLinearSurfacePlaneTrimReport {
    schema: 'barocss-multispan-vlinear-surface-plane-trim-candidates';
    version: 0;
    evaluationId: string;
    sourceId: string;
    surfaceId: string;
    lengthUnit: 'mm';
    uvLengthUnit: 'dimensionless';
    spanCount: number;
    derivativeCounts: Record<'world' | 'pcurve' | 'support', {
        evaluated: number;
        refused: number;
    }>;
    vertexCount: 6;
    edgeCount: 7;
    loopCount: 2;
    faceCount: 2;
    worldObjectCount: 8;
    sharedCutEdgeId: string;
    storedUVSimpleGraphCertified: true;
    orientedUVCyclesCertified: true;
    logicalIncidenceClosed: true;
    wholeEdgeModelGapCertified: true;
    maximumWholeEdgeModelGapMM: number;
    maximumObservedPointGapMM: number;
    maximumObservedRelativeChainGap: number;
    edgeModelGaps: Proof['edgeBounds'];
    rationalCounts: ReturnType<SectionRationalContext['counts']>;
    directCounts: {
        sectionValidationCount: 1;
        boundaryExtractionCount: 4;
        intervalExtractionCount: 4;
        worldSourceCompilationCount: 1;
        uvCurveValidationCount: 6;
        observationCount: number;
        curvePointEvaluationCount: number;
        curveDerivativeEvaluationCount: number;
        surfacePointEvaluationCount: number;
        surfaceDerivativeEvaluationCount: number;
    };
    numericPolicy: {
        authority: 'exact-coefficient-models-with-local-native-observations';
        uvClosure: 'unchanged-stored-cut-endpoint-poles-and-nominal-linear-sidecars';
        reflection: 'exact-natural-knot-reflection-and-actual-affine-inverse-nearest-even-no-snap';
        restriction: 'exact-degree2-cross-product-and-positive-denominator-bound';
        pointComparisonMM: 1e-7;
        relativeChainComparison: 1e-7;
        boundRounding: 'upward-including-positive-subnormal';
        planeSide: 'candidate-region-relative-to-stored-uv-graph-no-ideal-plane-side-guarantee';
    };
    quality: {
        geometricValidity: 'not-certified';
        topologyCertified: false;
        solid: false;
        insideOutsideCertified: false;
        embeddedManifoldCertified: false;
        globalBinary64EvaluationErrorCertified: false;
        manufacturingToleranceCertified: false;
        supportRegularityCertified: false;
        globalD1ErrorCertified: false;
        weldingPerformed: false;
        parentProofsUnchanged: true;
        ownership: 'independent-copied-cpu-data-gc';
    };
    limits: {
        maximumBoundaries: 4;
        maximumIntervals: 4;
        maximumObservations: 63;
        maximumSpans: 4;
        maximumMonotonicityDegree: 5;
        maximumGapDegree: 2;
        maximumWorldObjects: 8;
        prefixCharacters: 12;
        ownValues: 1048576;
        ownDepth: 64;
        arrayElements: 8192;
        recordFields: 64;
        stringCharacters: 262144;
        rationalOperations: 200000;
        gcdSteps: 200000;
        rationalIntegerBits: 8192;
        fractionIntegerCharacters: 5000;
        floatSearchStepsPerConversion: 64;
    };
    workScope: 'direct-root-calls-only-full-inherited-child-work-retained-and-excluded';
    budgetFailure: 'atomic-no-partial-trim-candidates';
}
export interface MultiSpanVLinearSurfacePlaneTrimResult {
    section: MultiSpanVLinearSurfacePlaneSectionResult;
    options: MultiSpanVLinearSurfacePlaneTrimOptions;
    boundaries: Curve[];
    intervals: ExtractedCurveIntervalResult[];
    world: {
        source: string;
        sourceVersion: 0;
        model: Model;
    };
    vertices: Vertex[];
    edges: MultiSpanVLinearSurfacePlaneTrimEdge[];
    loops: [Loop, Loop];
    faces: [Face, Face];
    proof: Proof;
    observations: Observation[];
    report: MultiSpanVLinearSurfacePlaneTrimReport;
}
/** Construct two original-support trim candidates with simple UV cycles and seven whole coefficient-model position bounds. */
export declare function buildMultiSpanVLinearSurfacePlaneTrimCandidates(sectionInput: MultiSpanVLinearSurfacePlaneSectionResult, optionsInput: MultiSpanVLinearSurfacePlaneTrimOptions): MultiSpanVLinearSurfacePlaneTrimResult;
/** Rebuild the actual section/interval receipts, exact proofs, World source and every native observation before whole-result comparison. */
export declare function validateMultiSpanVLinearSurfacePlaneTrimCandidates(input: MultiSpanVLinearSurfacePlaneTrimResult): MultiSpanVLinearSurfacePlaneTrimReport;
export {};
