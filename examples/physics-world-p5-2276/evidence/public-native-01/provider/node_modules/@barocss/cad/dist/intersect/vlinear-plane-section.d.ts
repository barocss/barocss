import type { CurveD1Result, SurfaceD1Result } from '../core/derivatives.js';
import { SectionRationalContext } from '../section-rational-internal.js';
import type { SectionFraction } from '../section-rational-internal.js';
import type { Curve, Surface, Point, Model } from '../types.js';
import { KernelError } from '../core/barocss-error.js';
export declare const VLinearSurfacePlaneSectionDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly BUDGET: "BUDGET";
    readonly SOURCE: "SOURCE";
    readonly SUPPORT: "SUPPORT";
    readonly CROSSING: "CROSSING";
    readonly CHART: "CHART";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly BINDING: "BINDING";
    readonly NATIVE: "NATIVE";
    readonly OWNED: "OWNED";
}>;
export type VLinearSurfacePlaneSectionDiagnosticCode = typeof VLinearSurfacePlaneSectionDiagnosticCode[keyof typeof VLinearSurfacePlaneSectionDiagnosticCode];
export declare class VLinearSurfacePlaneSectionError extends KernelError {
    readonly code: VLinearSurfacePlaneSectionDiagnosticCode;
    constructor(code: VLinearSurfacePlaneSectionDiagnosticCode, detail: string, cause?: unknown);
}
export interface VLinearSurfacePlaneSectionAsset {
    sourceId: string;
    source: string;
    surface: Surface;
}
export interface VLinearSurfacePlaneSectionOptions {
    evaluationId: string;
    curveId: string;
    surfacePcurveId: string;
    planePcurveId: string;
    maximumObservations: number;
}
type Fraction = SectionFraction;
type Bound = {
    exact: Fraction;
    upper: number;
};
type Domains = {
    u: [number, number];
    v: [number, number];
};
type UVSidecar = {
    coordinateSystem: 'native-surface-uv' | 'native-plane-uv';
    lengthUnit: 'dimensionless';
    curve: Curve;
};
type PoleProof = {
    index: number;
    homogeneous: Fraction[];
    idealCartesian: Fraction[];
    storedCartesian: Point;
    coordinateErrors: Fraction[];
    l1Error: Fraction;
};
type ProductContribution = {
    firstIndex: number;
    secondIndex: number;
    factor: Fraction;
    f1H0: Fraction[];
    negativeF0H1: Fraction[];
    contribution: Fraction[];
};
type SectionProof = {
    plane: {
        origin: Fraction[];
        uDirection: Fraction[];
        vDirection: Fraction[];
        rawNormal: Fraction[];
        d: Fraction;
        gram: {
            uu: Fraction;
            uv: Fraction;
            vv: Fraction;
            determinant: Fraction;
        };
    };
    columns: {
        index: number;
        h0: Fraction[];
        h1: Fraction[];
        rawF0: Fraction;
        rawF1: Fraction;
        f0: Fraction;
        f1: Fraction;
        denominator: Fraction;
    }[];
    world: {
        degree: number;
        homogeneousScale: number;
        coefficients: {
            index: number;
            unscaledHomogeneous: Fraction[];
            scaledHomogeneous: Fraction[];
            contributions: ProductContribution[];
        }[];
        poles: PoleProof[];
    };
    surfaceUV: {
        degree: number;
        homogeneousScale: number;
        denominatorCoefficients: Fraction[];
        uNumeratorCoefficients: Fraction[];
        vNumeratorCoefficients: Fraction[];
        poles: PoleProof[];
    };
    planeUV: {
        degree: number;
        weights: number[];
        poles: PoleProof[];
    };
    lipschitz: {
        surfaceU: Bound;
        surfaceV: Bound;
        planeU: Bound;
        planeV: Bound;
    };
    bounds: {
        worldCartesian: Bound;
        surfaceU: Bound;
        surfaceV: Bound;
        planeU: Bound;
        planeV: Bound;
        worldToSurface: Bound;
        worldToPlane: Bound;
    };
};
type Observation = {
    index: number;
    parameter: number;
    world: {
        d0: Point;
        d1: CurveD1Result;
    };
    surfacePcurve: {
        d0: Point;
        d1: CurveD1Result;
    };
    planePcurve: {
        d0: Point;
        d1: CurveD1Result;
    };
    surface: {
        d0: Point;
        d1: SurfaceD1Result;
    };
    plane: {
        d0: Point;
        d1: SurfaceD1Result;
    };
    surfaceChain: Point;
    planeChain: Point;
    residuals: {
        worldToSurfaceMM: number;
        worldToPlaneMM: number;
        d0ToD1Point: [number, number, number, number, number];
        surfaceChainRelative: number;
        planeChainRelative: number;
    };
};
export interface VLinearSurfacePlaneSectionReport {
    schema: 'barocss-vlinear-surface-plane-section';
    version: 0;
    evaluationId: string;
    surfaceSourceId: string;
    planeSourceId: string;
    surfaceId: string;
    planeId: string;
    curveId: string;
    lengthUnit: 'mm';
    pcurveLengthUnit: 'dimensionless';
    sourceFrame: 'authored-xyz-no-axis-conversion';
    parameterFrame: 'original-native-u-v-domains';
    surfaceDomains: Domains;
    planeDomains: Domains;
    polarity: 1 | -1;
    inputUDegree: number;
    worldDegree: number;
    surfacePcurveDegree: number;
    planePcurveDegree: number;
    sourceOwnership: 'whole-original-source-models-and-one-world-source-model1-uv-json-only';
    wholeModelGapBounds: SectionProof['bounds'];
    maximumObservedPointGapMM: number;
    maximumObservedRelativeChainGap: number;
    directCounts: {
        sourceCompilationCount: 2;
        worldAdoptionCount: 1;
        planeHelperCount: 1;
        uvNativeValidationCount: 2;
        observationCount: 5;
        curvePointEvaluationCount: 15;
        curveDerivativeEvaluationCount: 15;
        surfacePointEvaluationCount: 10;
        surfaceDerivativeEvaluationCount: 10;
    };
    rationalCounts: ReturnType<SectionRationalContext['counts']>;
    numericPolicy: {
        coefficientAuthority: 'exact-rational-IEEE64-input-values';
        poleRounding: 'nearest-even-generated-exact-zero-positive-zero';
        boundRounding: 'upward-including-positive-subnormal';
        derivedWeights: 'exact-binary64-in-native-range-no-normalization';
        planeChart: 'ideal-and-stored-positive-weight-whole-control-hulls';
        modelComparisonMM: 1e-7;
        observationComparisonMM: 1e-7;
        relativeChainComparison: 1e-7;
        observationAuthority: 'local-native-values-separate-from-whole-model-proof';
    };
    quality: {
        geometricValidity: 'not-certified';
        topologyCertified: false;
        solid: false;
        globalCoefficientModelGapCertified: true;
        globalBinary64EvaluationErrorCertified: false;
        regularityCertified: false;
        embeddedManifoldCertified: false;
        manufacturingToleranceCertified: false;
        originalBitsPreserved: true;
        ownership: 'independent-copied-cpu-data-gc';
    };
    limits: {
        maximumUDegree: 2;
        vDegree: 1;
        maximumWorldDegree: 4;
        maximumWorldPoles: 5;
        maximumObservations: 5;
        coordinateAbs: 10000;
        knotAbs: 10000;
        minimumParameterSpan: 1e-6;
        rationalOperations: 200000;
        gcdSteps: 200000;
        rationalIntegerBits: 8192;
        fractionIntegerCharacters: 5000;
        floatSearchStepsPerConversion: 64;
        ownValues: 1048576;
        ownDepth: 64;
        arrayElements: 8192;
        recordFields: 64;
        sourceStringCharacters: 262144;
    };
    workScope: 'direct-new-calls-parent-internal-work-excluded';
    budgetFailure: 'atomic-no-partial-section';
}
export interface VLinearSurfacePlaneSectionResult {
    surfaceAsset: VLinearSurfacePlaneSectionAsset;
    planeAsset: VLinearSurfacePlaneSectionAsset;
    options: VLinearSurfacePlaneSectionOptions;
    originalModels: [Model, Model];
    world: {
        curve: Curve;
        source: string;
        sourceVersion: 0;
        model: Model;
    };
    pcurves: {
        surface: UVSidecar;
        plane: UVSidecar;
    };
    proof: SectionProof;
    observations: Observation[];
    report: VLinearSurfacePlaneSectionReport;
}
/** Exact coefficient construction plus bounded model-representation gaps; native evaluations are separate local observations. */
export declare function buildVLinearSurfacePlaneSection(surfaceInput: VLinearSurfacePlaneSectionAsset, planeInput: VLinearSurfacePlaneSectionAsset, optionsInput: VLinearSurfacePlaneSectionOptions): VLinearSurfacePlaneSectionResult;
/** Reconstruct exact arithmetic, actual sources, all sidecars, bounds and native observations before whole-result comparison. */
export declare function validateVLinearSurfacePlaneSection(input: VLinearSurfacePlaneSectionResult): VLinearSurfacePlaneSectionReport;
export {};
