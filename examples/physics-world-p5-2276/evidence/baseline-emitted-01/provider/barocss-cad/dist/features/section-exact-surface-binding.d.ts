import type { CurveD1Result, SurfaceD1Result } from '../core/derivatives.js';
import type { MultiSpanVLinearSurfacePlaneSectionResult } from '../intersect/multispan-vlinear-plane-section.js';
import { SectionRationalContext } from '../section-rational-internal.js';
import type { SectionFraction } from '../section-rational-internal.js';
import type { Curve, Point } from '../types.js';
import { KernelError } from '../core/barocss-error.js';
export declare const SectionExactSurfaceBindingDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly BUDGET: "BUDGET";
    readonly SECTION: "SECTION";
    readonly SUPPORT: "SUPPORT";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly BINDING: "BINDING";
    readonly NATIVE: "NATIVE";
    readonly OWNED: "OWNED";
}>;
export type SectionExactSurfaceBindingDiagnosticCode = typeof SectionExactSurfaceBindingDiagnosticCode[keyof typeof SectionExactSurfaceBindingDiagnosticCode];
export declare class SectionExactSurfaceBindingError extends KernelError {
    readonly code: SectionExactSurfaceBindingDiagnosticCode;
    constructor(code: SectionExactSurfaceBindingDiagnosticCode, detail: string, cause?: unknown);
}
export interface SectionExactSurfaceBindingOptions {
    evaluationId: string;
    pcurveId: string;
    maximumObservations: 17;
}
type Bound = {
    exact: SectionFraction;
    upper: number;
};
type D1<T> = {
    status: 'evaluated';
    value: T;
} | {
    status: 'native-refused';
    reason: string;
    nativeErrorName: string;
};
export interface SectionExactSurfaceBindingSpanProof {
    index: number;
    domain: [number, number];
    originalPoleIndices: number[];
    worldPoleIndices: number[];
    pcurvePoleIndices: number[];
    uniformSurfaceWeight: SectionFraction;
    constantDenominator: SectionFraction;
    degree: number;
    uCoefficients: SectionFraction[];
    vCoefficients: SectionFraction[];
    betaCoefficients: SectionFraction[];
    originalCartesian: SectionFraction[][][];
    storedWorldCartesian: SectionFraction[][];
    composedCartesian: SectionFraction[][];
    elevatedWorldCartesian: SectionFraction[][];
    residuals: SectionFraction[][];
}
type Certificate = {
    schema: 'barocss-exact-vlinear-section-surface-binding';
    version: 0;
    surfaceSourceId: string;
    surfaceId: string;
    worldCurveId: string;
    pcurveId: string;
    evaluationId: string;
    surfaceDomains: MultiSpanVLinearSurfacePlaneSectionResult['report']['surfaceDomains'];
    spanCount: number;
    authority: 'exact-stored-coefficients-and-original-source';
    exactWorldSurfaceAgreement: true;
    wholeCoefficientModelGap: Bound;
    inheritedWorldSurfaceBound: Bound;
};
type Observation = {
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
    surfaceChain: Point | null;
    residuals: {
        worldToSurfaceMM: number;
        d0ToD1Point: (number | null)[];
        surfaceChainRelative: number | null;
    };
};
export interface SectionExactSurfaceBindingReport {
    schema: 'barocss-section-exact-surface-binding';
    version: 0;
    evaluationId: string;
    surfaceSourceId: string;
    surfaceId: string;
    worldCurveId: string;
    pcurveId: string;
    lengthUnit: 'mm';
    uvLengthUnit: 'dimensionless';
    sourceFrame: 'authored-xyz-no-axis-conversion';
    parameterFrame: 'original-native-u-v-domains';
    spanCount: number;
    pcurveDegree: 2;
    pcurvePoleCount: number;
    wholeCoefficientModelGap: Bound;
    inheritedWorldSurfaceBound: Bound;
    maximumObservedPointGapMM: number;
    maximumObservedRelativeChainGap: number;
    derivativeCounts: Record<'world' | 'pcurve' | 'surface', {
        evaluated: number;
        refused: number;
    }>;
    rationalCounts: ReturnType<SectionRationalContext['counts']>;
    directCounts: {
        sectionValidationCount: 1;
        uvNativeValidationCount: 1;
        sourceCompilationCount: 0;
        observationCount: number;
        curvePointEvaluationCount: number;
        curveDerivativeEvaluationCount: number;
        surfacePointEvaluationCount: number;
        surfaceDerivativeEvaluationCount: number;
    };
    numericPolicy: {
        generatedCoefficients: 'exact-binary64-no-rounded-admission';
        positionAdmission: 'all-stored-world-surface-coefficient-residuals-zero';
        observationAuthority: 'local-native-values-separate-from-whole-model-proof';
        pointComparisonMM: 1e-7;
        relativeChainComparison: 1e-7;
    };
    quality: {
        exactWorldSurfaceAgreement: true;
        originalBitsPreserved: true;
        surfaceEmbeddingCertified: false;
        trimFaceCertified: false;
        bodyCertified: false;
        manifoldCertified: false;
        solid: false;
        outwardSolidOrientationCertified: false;
        booleanCertified: false;
        globalBinary64EvaluationErrorCertified: false;
        manufacturingToleranceCertified: false;
        parentProofsUnchanged: true;
        ownership: 'independent-copied-cpu-data-gc';
    };
    limits: {
        maximumSpans: 4;
        maximumUDegree: 2;
        pcurveDegree: 2;
        maximumPcurvePoles: 9;
        maximumComposedDegree: 4;
        maximumObservations: 17;
        rationalOperations: 200000;
        gcdSteps: 200000;
        rationalIntegerBits: 8192;
        fractionIntegerCharacters: 5000;
        ownValues: 1048576;
        ownDepth: 64;
        arrayElements: 8192;
        recordFields: 64;
        sourceStringCharacters: 262144;
    };
    workScope: 'direct-root-calls-and-arithmetic-parent-internal-work-retained-and-excluded';
    budgetFailure: 'atomic-no-partial-binding';
}
export interface SectionExactSurfaceBindingResult {
    section: MultiSpanVLinearSurfacePlaneSectionResult;
    options: SectionExactSurfaceBindingOptions;
    pcurve: {
        coordinateSystem: 'native-surface-uv';
        lengthUnit: 'dimensionless';
        curve: Curve;
    };
    proof: {
        spans: SectionExactSurfaceBindingSpanProof[];
        certificate: Certificate;
    };
    observations: Observation[];
    report: SectionExactSurfaceBindingReport;
}
/** Build a real degree2 UV Curve and certify its exact original-Surface position binding. */
export declare function buildSectionExactSurfaceBinding(sectionInput: MultiSpanVLinearSurfacePlaneSectionResult, optionsInput: SectionExactSurfaceBindingOptions): SectionExactSurfaceBindingResult;
/** Rebuild the complete parent, real new UV, exact coefficient certificate and all native observations. */
export declare function validateSectionExactSurfaceBinding(input: SectionExactSurfaceBindingResult): SectionExactSurfaceBindingReport;
export {};
