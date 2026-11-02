import type { SectionExactSurfaceBindingResult } from '../features/section-exact-surface-binding.js';
import type { CurveD1Result, SurfaceD1Result } from '../core/derivatives.js';
import { SectionRationalContext } from '../section-rational-internal.js';
import type { SectionFraction } from '../section-rational-internal.js';
import type { Curve, Model, Point } from '../types.js';
import { KernelError } from '../core/barocss-error.js';
export declare const ExactSurfaceBandTrimDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly BUDGET: "BUDGET";
    readonly PARENT: "PARENT";
    readonly PAIR: "PAIR";
    readonly SUPPORT: "SUPPORT";
    readonly BAND: "BAND";
    readonly EMBEDDING: "EMBEDDING";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly BINDING: "BINDING";
    readonly NATIVE: "NATIVE";
    readonly OWNED: "OWNED";
}>;
export type ExactSurfaceBandTrimDiagnosticCode = typeof ExactSurfaceBandTrimDiagnosticCode[keyof typeof ExactSurfaceBandTrimDiagnosticCode];
export declare class ExactSurfaceBandTrimError extends KernelError {
    readonly code: ExactSurfaceBandTrimDiagnosticCode;
    constructor(code: ExactSurfaceBandTrimDiagnosticCode, detail: string, cause?: unknown);
}
export interface ExactSurfaceBandTrimOptions {
    evaluationId: string;
    resultIdPrefix: string;
    orientation: 'forward' | 'reverse';
    maximumParents: 2;
    maximumObservations: 40;
}
type Fraction = SectionFraction;
type Bound = {
    exact: Fraction;
    upper: number;
};
type Role = 'lower' | 'right' | 'upper' | 'left';
type Vertex = {
    id: string;
    sourceId: string;
    surfaceId: string;
    world: Point;
    uv: Point;
};
export interface ExactSurfaceBandTrimEdge {
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
        kind: 'bound-section' | 'connector';
        sourceId: string;
        surfaceId: string;
        bindingEvaluationId: string | null;
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
export interface ExactSurfaceBandTrimResult {
    lower: SectionExactSurfaceBindingResult;
    upper: SectionExactSurfaceBindingResult;
    options: ExactSurfaceBandTrimOptions;
    vertices: Vertex[];
    edges: ExactSurfaceBandTrimEdge[];
    loop: Loop;
    face: Face;
    world: {
        source: string;
        sourceVersion: 0;
        model: Model;
    };
    proof: Proof;
    observations: Observation[];
    report: ExactSurfaceBandTrimReport;
}
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
type BandSpan = {
    index: number;
    domain: [number, number];
    originalPoleIndices: number[];
    lowerPcurvePoleIndices: number[];
    upperPcurvePoleIndices: number[];
    uCoefficients: Fraction[];
    lowerV: Fraction[];
    upperV: Fraction[];
    lowerChartGaps: Fraction[];
    upperChartGaps: Fraction[];
    gapCoefficients: Fraction[];
    minimumLowerChartGap: Fraction;
    minimumUpperChartGap: Fraction;
    minimumBandGap: Fraction;
};
type Band = {
    spans: BandSpan[];
    minimumLowerChartGap: Fraction;
    minimumUpperChartGap: Fraction;
    minimumBandGap: Fraction;
};
type CutBinding = {
    edgeId: string;
    role: 'lower' | 'upper';
    bindingEvaluationId: string;
    worldCurveId: string;
    pcurveId: string;
    sourceId: string;
    surfaceId: string;
    certificate: SectionExactSurfaceBindingResult['proof']['certificate'];
    spans: SectionExactSurfaceBindingResult['proof']['spans'];
    wholeGap: Bound;
};
type Connector = {
    edgeId: string;
    role: 'right' | 'left';
    originalUIndex: number;
    worldEndpoints: Point[];
    uvEndpoints: Point[];
    surfaceEndpoints: Fraction[][];
    residuals: Fraction[][];
    endpointL1Errors: Fraction[];
    wholeGap: Bound;
};
type Embedding = {
    schema: 'barocss-exact-projected-vlinear-surface-band-face';
    version: 0;
    authority: 'validated-exact-cut-bindings-original-projection-and-stored-side-coefficients';
    sourceId: string;
    surfaceId: string;
    lowerBindingEvaluationId: string;
    upperBindingEvaluationId: string;
    lowerWorldCurveId: string;
    upperWorldCurveId: string;
    lowerPcurveId: string;
    upperPcurveId: string;
    faceId: string;
    loopId: string;
    worldModelId: string;
    edgeIds: string[];
    orientation: 'forward' | 'reverse';
    nativeDomains: SectionExactSurfaceBindingResult['section']['report']['surfaceDomains'];
    spanCount: number;
    minimumBandGap: Fraction;
    normalYAbsoluteLowerBound: Fraction;
    gramDeterminantLowerBound: Fraction;
    orientedNormalYSign: -1 | 1;
    wholeCoefficientModelGap: Bound;
    closedDiskCertified: true;
    exactWorldSurfaceAgreement: true;
};
type Proof = {
    projection: Projection;
    band: Band;
    cutBindings: CutBinding[];
    connectors: Connector[];
    edgeBounds: {
        edgeId: string;
        role: Role;
        bound: Bound;
    }[];
    faceEmbedding: Embedding;
};
export interface ExactSurfaceBandTrimReport {
    schema: 'barocss-exact-surface-band-trim';
    version: 0;
    evaluationId: string;
    surfaceSourceId: string;
    surfaceId: string;
    lowerBindingEvaluationId: string;
    upperBindingEvaluationId: string;
    lowerWorldCurveId: string;
    upperWorldCurveId: string;
    lowerPcurveId: string;
    upperPcurveId: string;
    faceId: string;
    orientation: 'forward' | 'reverse';
    lengthUnit: 'mm';
    uvLengthUnit: 'dimensionless';
    sourceFrame: 'authored-xyz-no-axis-conversion';
    parameterFrame: 'original-boundary-u-and-fixed-u-side-parameters';
    spanCount: number;
    vertexCount: 4;
    edgeCount: 4;
    useCount: 4;
    loopCount: 1;
    faceCount: 1;
    worldObjectCount: 5;
    maximumWholeEdgeModelGapMM: 0;
    minimumBandGap: Fraction;
    projection: Projection;
    maximumObservedPointGapMM: number;
    maximumObservedRelativeChainGap: number;
    derivativeCounts: Record<'world' | 'pcurve' | 'surface', {
        evaluated: number;
        refused: number;
    }>;
    rationalCounts: ReturnType<SectionRationalContext['counts']>;
    directCounts: {
        bindingValidationCount: 2;
        newWorldCurveValidationCount: 2;
        newUVValidationCount: 2;
        worldSourceCompilationCount: 1;
        observationCount: number;
        curvePointEvaluationCount: number;
        curveDerivativeEvaluationCount: number;
        surfacePointEvaluationCount: number;
        surfaceDerivativeEvaluationCount: number;
        boundaryExtractionCount: 0;
    };
    fileSizes: {
        request: {
            utf16: number;
            utf8: number;
        };
        result: {
            utf16: number;
            utf8: number;
        };
    };
    numericPolicy: {
        authority: 'validated-original-surface-cut-bindings-and-stored-band-coefficients';
        positionAdmission: 'all-stored-world-surface-residuals-zero';
        ordering: 'whole-degree2-bernstein-gap-and-chart-hulls';
        reversal: 'whole-use-order-and-senses-only';
        nativeObservations: 'actual-provider-coordinates-c0-unions-no-snap';
        projectionRegularity: 'per-smooth-patch-and-one-sided-endpoints-no-global-c1-claim';
        pointComparisonMM: 1e-7;
        relativeChainComparison: 1e-7;
    };
    quality: {
        geometricValidity: 'exact-projected-surface-band-certified';
        faceEmbeddingCertified: true;
        wholeModelGapCertified: true;
        logicalIncidence: true;
        storedUVSimpleBand: true;
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
        publication: false;
        ownership: 'independent-copied-cpu-data-gc';
    };
    limits: {
        maximumParents: 2;
        maximumSpans: 4;
        maximumUDegree: 2;
        maximumUVDegree: 2;
        maximumWorldCutDegree: 4;
        maximumWorldPoles: 17;
        maximumObservations: 40;
        maximumWorldObjects: 5;
        prefixCharacters: 12;
        idCharacters: 48;
        maximumFileUTF16: 2097152;
        maximumFileUTF8: 2097152;
        sourceStringCharacters: 262144;
        ownValues: 1048576;
        ownDepth: 64;
        arrayElements: 8192;
        recordFields: 64;
        keyCharacters: 128;
        rationalOperations: 200000;
        gcdSteps: 200000;
        rationalIntegerBits: 8192;
        fractionIntegerCharacters: 5000;
        maximumFinalFloatConversions: 0;
    };
    workScope: 'direct-root-calls-and-arithmetic-parent-internal-work-retained-and-excluded';
    budgetFailure: 'atomic-no-partial-band-face';
}
/** Construct a real band Face on the exact shared original Surface, retaining both full cut bindings. */
export declare function buildExactSurfaceBandTrim(lowerInput: SectionExactSurfaceBindingResult, upperInput: SectionExactSurfaceBindingResult, optionsInput: ExactSurfaceBandTrimOptions): ExactSurfaceBandTrimResult;
/** Fully reconstruct exact parents, stored band geometry/source/proofs and all actual native states. */
export declare function validateExactSurfaceBandTrim(input: ExactSurfaceBandTrimResult): ExactSurfaceBandTrimReport;
export {};
