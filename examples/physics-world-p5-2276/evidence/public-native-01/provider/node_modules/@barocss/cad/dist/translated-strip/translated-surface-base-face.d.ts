import type { ExactSurfaceLowerTrimResult } from '../exact-proof/exact-surface-lower-trim.js';
import type { CompatibleRuledSurfaceResult } from '../nurbs/surfaces/compatible-ruled-surface.js';
import type { CurveD1Result, SurfaceD1Result } from '../core/derivatives.js';
import { SectionRationalContext } from '../section-rational-internal.js';
import type { SectionFraction } from '../section-rational-internal.js';
import type { Curve, Model, Point } from '../types.js';
import { KernelError } from '../core/barocss-error.js';
export declare const TranslatedSurfaceBaseFaceDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly BUDGET: "BUDGET";
    readonly PARENT: "PARENT";
    readonly PAIR: "PAIR";
    readonly SUPPORT: "SUPPORT";
    readonly TRANSLATION: "TRANSLATION";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly BINDING: "BINDING";
    readonly NATIVE: "NATIVE";
    readonly OWNED: "OWNED";
}>;
export type TranslatedSurfaceBaseFaceDiagnosticCode = typeof TranslatedSurfaceBaseFaceDiagnosticCode[keyof typeof TranslatedSurfaceBaseFaceDiagnosticCode];
export declare class TranslatedSurfaceBaseFaceError extends KernelError {
    readonly code: TranslatedSurfaceBaseFaceDiagnosticCode;
    constructor(code: TranslatedSurfaceBaseFaceDiagnosticCode, detail: string, cause?: unknown);
}
export interface TranslatedSurfaceBaseFaceOptions {
    evaluationId: string;
    resultIdPrefix: string;
    baseLeftCurveId: string;
    baseRightCurveId: string;
    maximumParents: 2;
    maximumObservations: 40;
}
type Bound = {
    exact: SectionFraction;
    upper: number;
};
type Role = 'lower' | 'right' | 'upper' | 'left';
type Vertex = {
    id: string;
    world: Point;
    uv: Point;
};
export interface TranslatedSurfaceBaseFaceEdge {
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
        kind: 'original-wall-boundary' | 'base-line';
        lowerSourceId: string;
        upperSourceId: string;
        lowerSurfaceId: string;
        upperSurfaceId: string;
        wallFaceId: string | null;
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
    surfaceId: string;
    outerLoopId: string;
    orientation: 'reverse';
};
type Translation = {
    lowerSourceId: string;
    upperSourceId: string;
    lowerSurfaceId: string;
    upperSurfaceId: string;
    nativeDomains: ExactSurfaceLowerTrimResult['binding']['section']['report']['surfaceDomains'];
    degreeU: number;
    degreeV: 1;
    knotsU: number[];
    knotsV: number[];
    uniformWeight: SectionFraction;
    h: SectionFraction;
    differences: SectionFraction[][][];
    residuals: SectionFraction[][][];
};
type SurfaceMapping = {
    lowerBottomCurveId: string;
    upperBottomCurveId: string;
    surfaceId: string;
    originalCartesian: SectionFraction[][][];
    storedCartesian: SectionFraction[][][];
    originalWeights: number[][];
    storedWeights: number[][];
    residuals: SectionFraction[][][];
};
type BoundarySpan = {
    index: number;
    domain: [number, number];
    poleIndices: number[];
    parameterCoefficients: SectionFraction[];
    uvRestriction: SectionFraction[][];
    originalCartesian: SectionFraction[][];
    storedCartesian: SectionFraction[][];
    residuals: SectionFraction[][];
};
type Boundary = {
    edgeId: string;
    role: Role;
    kind: 'natural-boundary' | 'base-line';
    spans: BoundarySpan[];
    endpoints: {
        world: Point[];
        uv: Point[];
        mapped: SectionFraction[][];
        residuals: SectionFraction[][];
        l1Errors: SectionFraction[];
    } | null;
    wholeGap: Bound;
};
type Embedding = {
    schema: 'barocss-exact-translated-surface-base-face';
    version: 0;
    authority: 'exact-original-translation-and-stored-ruled-coefficients';
    lowerSourceId: string;
    upperSourceId: string;
    surfaceId: string;
    worldModelId: string;
    faceId: string;
    loopId: string;
    edgeIds: string[];
    worldCurveIds: string[];
    pcurveIds: string[];
    orientation: 'reverse';
    nativeDomains: {
        u: [number, number];
        v: [number, number];
    };
    h: SectionFraction;
    minimumXDerivative: SectionFraction;
    normalZAbsoluteLowerBound: SectionFraction;
    gramDeterminantLowerBound: SectionFraction;
    orientedNormalZSign: -1;
    regularity: 'per-smooth-patch-and-one-sided-endpoints-no-global-c1';
    closedDiskCertified: true;
    exactWorldSurfaceAgreement: true;
    wholeCoefficientModelGap: Bound;
};
type Correspondence = {
    wallBoundaries: {
        wallFaceId: string;
        wallEdgeId: string;
        baseFaceId: string;
        baseEdgeId: string;
        curveId: string;
        wallSense: 'forward' | 'reverse';
        baseSense: 'forward' | 'reverse';
        sameSourceQualifiedCurveGeometry: true;
        oppositeUseSenses: true;
        generatedEdgeIdsDiffer: true;
        sharedSewnEdge: false;
    }[];
    baseLines: {
        side: 'left' | 'right';
        curveId: string;
        curve: Curve;
        convention: 'lower-to-upper-unit-weight-domain-0-1';
        sharedSewnEdge: false;
    }[];
};
type Proof = {
    translation: Translation;
    surfaceMapping: SurfaceMapping;
    boundaries: Boundary[];
    faceEmbedding: Embedding;
    correspondence: Correspondence;
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
export interface TranslatedSurfaceBaseFaceReport {
    schema: 'barocss-translated-surface-base-face';
    version: 0;
    evaluationId: string;
    lowerSourceId: string;
    upperSourceId: string;
    lowerSurfaceId: string;
    upperSurfaceId: string;
    surfaceId: string;
    faceId: string;
    baseLeftCurveId: string;
    baseRightCurveId: string;
    orientation: 'reverse';
    h: SectionFraction;
    lengthUnit: 'mm';
    uvLengthUnit: 'dimensionless';
    sourceFrame: 'authored-xyz-no-axis-conversion';
    parameterFrame: 'original-u-and-unit-extrusion-v';
    spanCount: number;
    surfaceCount: 1;
    faceCount: 1;
    vertexCount: 4;
    edgeCount: 4;
    useCount: 4;
    worldObjectCount: 5;
    maximumWholeEdgeModelGapMM: 0;
    normalZAbsoluteLowerBound: SectionFraction;
    gramDeterminantLowerBound: SectionFraction;
    maximumObservedPointGapMM: number;
    maximumObservedRelativeChainGap: number;
    derivativeCounts: Record<'world' | 'pcurve' | 'surface', {
        evaluated: number;
        refused: number;
    }>;
    rationalCounts: ReturnType<SectionRationalContext['counts']>;
    directCounts: {
        wallValidationCount: 2;
        ruledBuilderCount: 1;
        newWorldCurveValidationCount: 2;
        newUVValidationCount: 4;
        worldSourceCompilationCount: 1;
        observationCount: number;
        curvePointEvaluationCount: number;
        curveDerivativeEvaluationCount: number;
        surfacePointEvaluationCount: number;
        surfaceDerivativeEvaluationCount: number;
    };
    quality: {
        individualFaceEmbedded: true;
        exactTranslation: true;
        wholeModelGapCertified: true;
        logicalFaceIncidence: true;
        orientedLoop: true;
        parentProofsUnchanged: true;
        sharedBodyTopologyCertified: false;
        manifoldCertified: false;
        solid: false;
        occupiedVolumeCertified: false;
        outwardSolidOrientationCertified: false;
        generalSurfaceRegularityCertified: false;
        globalBinary64EvaluationErrorCertified: false;
        manufacturingToleranceCertified: false;
        weldingPerformed: false;
        ownership: 'independent-copied-cpu-data-gc';
    };
    numericPolicy: {
        authority: 'exact-translated-control-coefficients-with-local-native-observations';
        positionAdmission: 'all-stored-boundary-residuals-zero';
        reversal: 'whole-use-order-and-senses-only';
        correspondence: 'same-curve-and-opposite-uses-not-sewn-topology';
        regularity: 'per-smooth-patch-and-one-sided-endpoints-no-global-c1';
        pointComparisonMM: 1e-7;
        relativeChainComparison: 1e-7;
    };
    limits: {
        maximumUDegree: 2;
        maximumSpans: 4;
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
    workScope: 'direct-root-calls-and-arithmetic-parent-and-ruled-internals-retained-and-excluded';
    budgetFailure: 'atomic-no-partial-base-face';
}
export interface TranslatedSurfaceBaseFaceResult {
    lowerWall: ExactSurfaceLowerTrimResult;
    upperWall: ExactSurfaceLowerTrimResult;
    options: TranslatedSurfaceBaseFaceOptions;
    ruled: CompatibleRuledSurfaceResult;
    vertices: Vertex[];
    edges: TranslatedSurfaceBaseFaceEdge[];
    loop: Loop;
    face: Face;
    world: {
        source: string;
        sourceVersion: 0;
        model: Model;
    };
    proof: Proof;
    observations: Observation[];
    report: TranslatedSurfaceBaseFaceReport;
}
/** A real reverse-oriented base Face from two complete exact translated wall operands. */
export declare function buildTranslatedSurfaceBaseFace(lowerInput: ExactSurfaceLowerTrimResult, upperInput: ExactSurfaceLowerTrimResult, optionsInput: TranslatedSurfaceBaseFaceOptions): TranslatedSurfaceBaseFaceResult;
/** Rebuild complete parents, real ruled/World/UV geometry, exact proofs and native observations. */
export declare function validateTranslatedSurfaceBaseFace(input: TranslatedSurfaceBaseFaceResult): TranslatedSurfaceBaseFaceReport;
export {};
