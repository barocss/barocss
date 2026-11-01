import type { QualifiedTranslatedStripBodyResult, QualifiedTranslatedStripBodyOptions } from './qualified-translated-strip-body.js';
import type { MultiSpanVLinearSurfacePlaneSectionOptions } from '../intersect/multispan-vlinear-plane-section.js';
import type { SectionExactSurfaceBindingOptions } from '../features/section-exact-surface-binding.js';
import type { ExactSurfaceLowerTrimOptions } from '../exact-proof/exact-surface-lower-trim.js';
import type { PairedSectionPlaneCapOptions } from '../paired/paired-section-plane-cap.js';
import type { TranslatedSurfaceBaseFaceOptions } from './translated-surface-base-face.js';
import type { TranslatedSurfaceEndFacesOptions } from './translated-surface-end-faces.js';
import type { TranslatedSurfaceStripVolumeOptions } from './translated-surface-strip-volume.js';
import { SectionRationalContext } from '../section-rational-internal.js';
import type { SectionFraction } from '../section-rational-internal.js';
import { KernelError } from '../core/barocss-error.js';
export declare const TranslatedStripIntervalBooleanDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly BUDGET: "BUDGET";
    readonly PARENT: "PARENT";
    readonly SUPPORT: "SUPPORT";
    readonly PAIR: "PAIR";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly BINDING: "BINDING";
    readonly CONSTRUCTION: "CONSTRUCTION";
    readonly OWNED: "OWNED";
}>;
export type TranslatedStripIntervalBooleanDiagnosticCode = typeof TranslatedStripIntervalBooleanDiagnosticCode[keyof typeof TranslatedStripIntervalBooleanDiagnosticCode];
export declare class TranslatedStripIntervalBooleanError extends KernelError {
    readonly code: TranslatedStripIntervalBooleanDiagnosticCode;
    constructor(code: TranslatedStripIntervalBooleanDiagnosticCode, detail: string, cause?: unknown);
}
export interface TranslatedStripIntervalBooleanOptions {
    operation: 'union' | 'intersection' | 'difference';
    evaluationId: string;
    resultIdPrefix: string;
    maximumOperands: 2;
    maximumOutputBodies: 2;
    maximumSlabs: 3;
}
type Label = 'a-lower' | 'a-upper' | 'b-lower' | 'b-upper';
type EndpointReference = {
    label: Label;
    operand: 'a' | 'b';
    side: 'lower' | 'upper';
    bodyEvaluationId: string;
    bodyId: string;
    materialCertificateId: string;
    bodyFaceId: string;
    parentWallFaceId: string;
    sourceId: string;
    modelId: string;
    surfaceId: string;
    selectedObjectIndex: number;
};
type Interval = {
    lowerOffsetY: SectionFraction;
    upperOffsetY: SectionFraction;
    width: SectionFraction;
};
type EndpointProof = {
    reference: EndpointReference;
    offsetY: SectionFraction;
    yDifferences: SectionFraction[][];
    yResiduals: SectionFraction[][];
    basisBitsEqual: true;
    xzBitsEqual: true;
    roofBitsEqual: true;
};
type CommonSpan = {
    index: number;
    domain: [number, number];
    originalPoleIndices: number[];
    newUVPoleIndices: number[];
    xBernstein: SectionFraction[];
    xDerivativeNative: SectionFraction[];
    roofVBernstein: SectionFraction[];
    roofHeightBernstein: SectionFraction[];
    planeRoofResiduals: SectionFraction[];
};
type CommonMap = {
    anchor: EndpointReference;
    nativeDomains: {
        u: [number, number];
        v: [number, number];
    };
    degrees: {
        u: number;
        v: number;
    };
    knotsU: number[];
    knotsV: number[];
    uniformWeight: SectionFraction;
    z0: SectionFraction;
    z1: SectionFraction;
    zDerivative: SectionFraction;
    minimumXDerivative: SectionFraction;
    plane: {
        sourceId: string;
        modelId: string;
        surfaceId: string;
        origin: SectionFraction[];
        uDirection: SectionFraction[];
        vDirection: SectionFraction[];
        rawNormal: SectionFraction[];
        d: SectionFraction;
        fourthCornerResiduals: SectionFraction[];
    };
    spans: CommonSpan[];
    endpointProofs: EndpointProof[];
    areaFactorMM2: SectionFraction;
    injectivity: {
        map: 'H(u,v,c)=S(u,v)+[0,c,0]';
        domain: 'common-native-u-and-vmin-through-stored-roof';
        positiveX: true;
        positiveZ: true;
        uniqueTranslationCoordinate: true;
        oneSidedSpans: true;
        globalC1: false;
    };
};
type EndpointGroup = {
    index: number;
    offsetY: SectionFraction;
    donorLabels: Label[];
    selectedDonor: EndpointReference;
};
type Slab = {
    index: number;
    lowerGroupIndex: number;
    upperGroupIndex: number;
    lowerOffsetY: SectionFraction;
    upperOffsetY: SectionFraction;
    midpointOffsetY: SectionFraction;
    insideA: boolean;
    insideB: boolean;
    selected: boolean;
};
type OutputPlan = {
    index: number;
    lowerGroupIndex: number;
    upperGroupIndex: number;
    interval: Interval;
    slabIndices: number[];
    lower: EndpointReference;
    upper: EndpointReference;
};
type Recipe = {
    stem: string;
    lowerSection: MultiSpanVLinearSurfacePlaneSectionOptions;
    upperSection: MultiSpanVLinearSurfacePlaneSectionOptions;
    lowerBinding: SectionExactSurfaceBindingOptions;
    upperBinding: SectionExactSurfaceBindingOptions;
    lowerWall: ExactSurfaceLowerTrimOptions;
    upperWall: ExactSurfaceLowerTrimOptions;
    cap: PairedSectionPlaneCapOptions;
    base: TranslatedSurfaceBaseFaceOptions;
    ends: TranslatedSurfaceEndFacesOptions;
    volume: TranslatedSurfaceStripVolumeOptions;
    body: QualifiedTranslatedStripBodyOptions;
};
export interface TranslatedStripIntervalBooleanOutput {
    index: number;
    interval: Interval;
    lower: EndpointReference;
    upper: EndpointReference;
    recipe: Recipe;
    body: QualifiedTranslatedStripBodyResult;
}
type Proof = {
    commonMap: CommonMap;
    plan: {
        endpointGroups: EndpointGroup[];
        slabs: Slab[];
        outputs: OutputPlan[];
        semantics: 'regularized-closure-of-selected-occupied-interior';
        internalSelectedBoundariesCancelled: true;
    };
    generatedIds: string[];
    outputVolumeChecks: {
        index: number;
        width: SectionFraction;
        expectedExactVolumeMM3: SectionFraction;
        actualExactVolumeMM3: SectionFraction;
        residual: SectionFraction;
    }[];
    volumeAccounting: {
        aExactVolumeMM3: SectionFraction;
        bExactVolumeMM3: SectionFraction;
        intersectionExactVolumeMM3: SectionFraction;
        expectedResultExactVolumeMM3: SectionFraction;
        actualResultExactVolumeMM3: SectionFraction;
        residual: SectionFraction;
    };
};
export interface TranslatedStripIntervalBooleanReport {
    schema: 'barocss-translated-strip-interval-boolean';
    version: 0;
    evaluationId: string;
    operation: TranslatedStripIntervalBooleanOptions['operation'];
    operandBodyIds: [string, string];
    operandMaterialCertificateIds: [string, string];
    outputBodyIds: string[];
    operandCount: 2;
    endpointCount: 4;
    endpointGroupCount: number;
    slabCount: number;
    outputBodyCount: number;
    empty: boolean;
    exactVolumeMM3: SectionFraction;
    lengthUnit: 'mm';
    volumeUnit: 'mm3';
    authority: 'exact-common-source-map-and-regularized-y-interval-material';
    sourceFrame: 'authored-xyz-no-axis-conversion';
    directionConvention: 'new-canonical-parents-stored-use-order-already-includes-face-orientation';
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
    directCounts: {
        operandBodyValidationCount: 2;
        endpointCount: 4;
        slabCount: number;
        outputBodyConstructionCount: number;
        sectionBuildCount: number;
        bindingBuildCount: number;
        wallBuildCount: number;
        capBuildCount: number;
        baseBuildCount: number;
        endBuildCount: number;
        volumeBuildCount: number;
        qualifiedBodyBuildCount: number;
        curvePointEvaluationCount: 0;
        curveDerivativeEvaluationCount: 0;
        surfacePointEvaluationCount: 0;
        surfaceDerivativeEvaluationCount: 0;
        sourceCompilationCount: 0;
        floatConversionCount: 0;
        nativeRootCount: 0;
        refinementCount: 0;
    };
    rationalCounts: ReturnType<SectionRationalContext['counts']>;
    numericPolicy: {
        input: 'exact-represented-native-source-coefficients';
        material: 'regularized-closure-of-selected-occupied-interior';
        endpointSelection: 'unchanged-original-source-qualified-boundary-surfaces';
        ties: 'a-lower-a-upper-b-lower-b-upper';
        generatedExactZero: 'positive-zero';
        coefficientGeneration: false;
        toleranceUsed: false;
        sourceIdentityRenaming: false;
        weldingPerformed: false;
        rootFloatConversion: false;
        rootNativeSampling: false;
        rayUsed: false;
        snapPerformed: false;
        iterativeRefinementPerformed: false;
    };
    quality: {
        restrictedIntervalBooleanCertified: true;
        regularizedMaterialCertified: true;
        actualOutputBodiesQualified: true;
        fullOperandsRetained: true;
        parentFlagsUnchanged: true;
        originalEndpointBitsPreserved: true;
        genericBoolean: false;
        arbitraryCurvedSolidCertified: false;
        globalC1: false;
        globalBinary64EvaluationErrorCertified: false;
        manufacturingToleranceCertified: false;
        publication: false;
        ownership: 'independent-copied-cpu-data-gc';
    };
    limits: {
        maximumOperands: 2;
        maximumEndpointAssets: 4;
        maximumSlabs: 3;
        maximumOutputBodies: 2;
        maximumOutputModels: 4;
        maximumOutputGeometryObjects: 36;
        maximumOriginalUDegree: 2;
        maximumOriginalSpans: 4;
        maximumFileUTF16Request: 6291456;
        maximumFileUTF8Request: 6291456;
        maximumFileUTF16Result: 12582912;
        maximumFileUTF8Result: 12582912;
        maximumBodyFileUTF16: 2097152;
        maximumBodyFileUTF8: 2097152;
        maximumObjectsPerModel: 16;
        ownValues: 4194304;
        ownDepth: 64;
        arrayElements: 8192;
        recordFields: 64;
        keyCharacters: 128;
        sourceStringCharacters: 262144;
        prefixCharacters: 4;
        rationalOperations: 200000;
        gcdSteps: 200000;
        rationalIntegerBits: 8192;
        fractionIntegerCharacters: 5000;
        maximumFinalFloatConversions: 0;
        rootNativeCalls: 0;
    };
    workScope: 'two-complete-operand-validations-and-new-shared-root-proof-plus-bounded-existing-producer-delegation-parent-internal-work-retained-and-excluded';
    budgetFailure: 'atomic-no-partial-interval-boolean';
}
export interface TranslatedStripIntervalBooleanResult {
    a: QualifiedTranslatedStripBodyResult;
    b: QualifiedTranslatedStripBodyResult;
    options: TranslatedStripIntervalBooleanOptions;
    proof: Proof;
    outputs: TranslatedStripIntervalBooleanOutput[];
    total: {
        exactVolumeMM3: SectionFraction;
    };
    report: TranslatedStripIntervalBooleanReport;
}
/** Rebuild actual restricted Bodies selected by exact regularized common-map Y intervals. */
export declare function buildTranslatedStripIntervalBoolean(aInput: QualifiedTranslatedStripBodyResult, bInput: QualifiedTranslatedStripBodyResult, optionsInput: TranslatedStripIntervalBooleanOptions): TranslatedStripIntervalBooleanResult;
/** Rebuild both complete operands, exact common map, interval plan, and all real output Bodies. */
export declare function validateTranslatedStripIntervalBoolean(input: TranslatedStripIntervalBooleanResult): TranslatedStripIntervalBooleanReport;
export {};
