import type { ExactSurfaceLowerTrimResult } from '../exact-proof/exact-surface-lower-trim.js';
import type { PairedSectionPlaneCapResult } from '../paired/paired-section-plane-cap.js';
import type { SurfaceD1Result } from '../core/derivatives.js';
import { SectionRationalContext } from '../section-rational-internal.js';
import type { SectionFraction } from '../section-rational-internal.js';
import type { Point } from '../types.js';
import { KernelError } from '../core/barocss-error.js';
export declare const TranslatedSurfaceStripVolumeDiagnosticCode: Readonly<{
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
export type TranslatedSurfaceStripVolumeDiagnosticCode = typeof TranslatedSurfaceStripVolumeDiagnosticCode[keyof typeof TranslatedSurfaceStripVolumeDiagnosticCode];
export declare class TranslatedSurfaceStripVolumeError extends KernelError {
    readonly code: TranslatedSurfaceStripVolumeDiagnosticCode;
    constructor(code: TranslatedSurfaceStripVolumeDiagnosticCode, detail: string, cause?: unknown);
}
export interface TranslatedSurfaceStripVolumeOptions {
    evaluationId: string;
    maximumParents: 3;
    maximumObservations: 17;
}
type Bound = {
    exact: SectionFraction;
    upper: number;
};
type Domains = ExactSurfaceLowerTrimResult['binding']['section']['report']['surfaceDomains'];
type Relationship = {
    wallFaceId: string;
    wallEdgeId: string;
    capFaceId: string;
    capEdgeId: string;
    curveId: string;
    wallSense: 'forward' | 'reverse';
    capSense: 'forward' | 'reverse';
    sameSourceQualifiedCurveGeometry: true;
    oppositeUseSenses: true;
    sharedSewnBRepEdge: false;
};
type Translation = {
    lowerSourceId: string;
    upperSourceId: string;
    lowerSurfaceId: string;
    upperSurfaceId: string;
    degreeU: number;
    degreeV: 1;
    knotsU: number[];
    knotsV: number[];
    nativeDomains: Domains;
    uniformWeight: SectionFraction;
    h: SectionFraction;
    differences: SectionFraction[][][];
    residuals: SectionFraction[][][];
    planeSourceId: string;
    planeId: string;
    planeRawNormal: SectionFraction[];
    matchedNewUVGeometry: true;
    canonicalRelationships: Relationship[];
};
type Certificate = {
    schema: 'barocss-exact-source-defined-translated-strip-region';
    version: 0;
    authority: 'exact-original-surface-stored-cut-graph-and-injective-parameterization';
    evaluationId: string;
    lowerSourceId: string;
    upperSourceId: string;
    lowerSurfaceId: string;
    upperSurfaceId: string;
    lowerWallFaceId: string;
    upperWallFaceId: string;
    capFaceId: string;
    nativeDomains: Domains;
    roofCurveIds: [string, string];
    extrusionDomain: [0, 1];
    positiveXDerivative: SectionFraction;
    positiveZDerivative: SectionFraction;
    h: SectionFraction;
    perPatchJacobianAbsoluteLowerBound: SectionFraction;
    sourceDefinedRegionInjective: true;
    regularity: 'per-smooth-patch-and-one-sided-endpoints-no-global-c1';
};
type Region = {
    translation: Translation;
    certificate: Certificate;
    source: {
        map: 'B(u,v,w)=originalLowerSurface(u,v)+[0,h*w,0]';
        domain: 'originalUmin<=u<=originalUmax;nativeVmin<=v<=actualStoredNewUVVcut(u);0<=w<=1';
        lowerSourceId: string;
        lowerSurfaceId: string;
        roofCurveId: string;
        nativeDomains: Domains;
        extrusionDomain: [0, 1];
        h: SectionFraction;
    };
};
export interface TranslatedSurfaceStripVolumeSpan {
    index: number;
    domain: [number, number];
    originalPoleIndices: number[];
    newUVPoleIndices: number[];
    originalXCoefficients: SectionFraction[];
    xDerivativeCoefficients: SectionFraction[];
    nativeVcutCoefficients: SectionFraction[];
    roofHeightCoefficients: SectionFraction[];
    productDegree: number;
    productCoefficients: SectionFraction[];
    integralFactor: SectionFraction;
    integratedHeightX: SectionFraction;
    exactVolumeMM3: SectionFraction;
}
type Total = {
    exactVolumeMM3: SectionFraction;
    volumeMM3: number;
    conversionError: Bound;
};
type D1 = {
    status: 'evaluated';
    value: SurfaceD1Result;
} | {
    status: 'native-refused';
    reason: string;
    nativeErrorName: string;
};
type NativeError = {
    absolute: SectionFraction;
    relative: SectionFraction;
};
type Observation = {
    index: number;
    parameter: number;
    uvD0: Point;
    lower: {
        d0: Point;
        d1: D1;
    };
    upper: {
        d0: Point;
        d1: D1;
    };
    localHeightMM: number;
    determinants: {
        modelExact: SectionFraction;
        lowerNativeExact: SectionFraction;
        upperNativeExact: SectionFraction;
        relativeErrors: {
            lower: NativeError;
            upper: NativeError;
        };
    } | null;
    translationGapMM: number;
};
export interface TranslatedSurfaceStripVolumeReport {
    schema: 'barocss-translated-surface-strip-volume';
    version: 0;
    evaluationId: string;
    lowerSourceId: string;
    upperSourceId: string;
    lowerSurfaceId: string;
    upperSurfaceId: string;
    planeSourceId: string;
    planeId: string;
    lowerWallFaceId: string;
    upperWallFaceId: string;
    capFaceId: string;
    lengthUnit: 'mm';
    volumeUnit: 'mm3';
    uvLengthUnit: 'dimensionless';
    sourceFrame: 'authored-xyz-no-axis-conversion';
    parameterFrame: 'original-native-u-v-and-unit-extrusion-w';
    spanCount: number;
    h: SectionFraction;
    exactVolumeMM3: SectionFraction;
    volumeMM3: number;
    conversionError: Bound;
    maximumObservedTranslationGapMM: number;
    maximumObservedRelativeJacobianGap: SectionFraction;
    derivativeCounts: Record<'lower' | 'upper', {
        evaluated: number;
        refused: number;
    }>;
    rationalCounts: ReturnType<SectionRationalContext['counts']>;
    directCounts: {
        wallValidationCount: 2;
        capValidationCount: 1;
        observationCount: number;
        curvePointEvaluationCount: number;
        surfacePointEvaluationCount: number;
        surfaceDerivativeEvaluationCount: number;
        sourceCompilationCount: 0;
    };
    quality: {
        exactSourceDefinedRegionVolume: true;
        sourceDefinedRegionInjective: true;
        originalBitsPreserved: true;
        parentProofsUnchanged: true;
        nativeBodyTopologyCertified: false;
        manifoldCertified: false;
        solid: false;
        outwardSolidOrientationCertified: false;
        manufacturingToleranceCertified: false;
        generalCurvedSolidPropertiesCertified: false;
        globalBinary64EvaluationErrorCertified: false;
        ownership: 'independent-copied-cpu-data-gc';
    };
    numericPolicy: {
        authority: 'exact-original-cartesian-coefficients-and-stored-unit-weight-cut';
        integration: 'exact-bernstein-product-and-integral';
        conversion: 'nearest-even-total-only-with-least-upward-absolute-error';
        nativeHeight: 'local-floating-observation-only';
        regularity: 'per-smooth-patch-and-one-sided-endpoints-no-global-c1';
        translationComparisonMM: 1e-7;
        relativeJacobianComparison: 1e-7;
        nonzeroUnderflow: 'refused';
    };
    limits: {
        maximumUDegree: 2;
        maximumSpans: 4;
        maximumProductDegree: 3;
        maximumObservations: 17;
        maximumFinalFloatConversions: 2;
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
    budgetFailure: 'atomic-no-partial-volume';
}
export interface TranslatedSurfaceStripVolumeResult {
    lowerWall: ExactSurfaceLowerTrimResult;
    upperWall: ExactSurfaceLowerTrimResult;
    cap: PairedSectionPlaneCapResult;
    options: TranslatedSurfaceStripVolumeOptions;
    region: Region;
    spans: TranslatedSurfaceStripVolumeSpan[];
    total: Total;
    observations: Observation[];
    report: TranslatedSurfaceStripVolumeReport;
}
/** Measure the exact geometric volume of a source-defined injective parameterized region. */
export declare function measureTranslatedSurfaceStripVolume(lowerInput: ExactSurfaceLowerTrimResult, upperInput: ExactSurfaceLowerTrimResult, capInput: PairedSectionPlaneCapResult, optionsInput: TranslatedSurfaceStripVolumeOptions): TranslatedSurfaceStripVolumeResult;
/** Reconstruct complete parents, exact integrals, final conversion and actual native observations. */
export declare function validateTranslatedSurfaceStripVolume(input: TranslatedSurfaceStripVolumeResult): TranslatedSurfaceStripVolumeReport;
export {};
