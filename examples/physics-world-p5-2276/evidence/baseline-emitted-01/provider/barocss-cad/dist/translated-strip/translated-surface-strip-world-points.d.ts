import type { TranslatedSurfaceStripVolumeResult } from './translated-surface-strip-volume.js';
import { SectionRationalContext } from '../section-rational-internal.js';
import type { SectionFraction } from '../section-rational-internal.js';
import type { Point } from '../types.js';
import { KernelError } from '../core/barocss-error.js';
export declare const TranslatedSurfaceStripWorldPointDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly BUDGET: "BUDGET";
    readonly PARENT: "PARENT";
    readonly SUPPORT: "SUPPORT";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly BINDING: "BINDING";
    readonly OWNED: "OWNED";
}>;
export type TranslatedSurfaceStripWorldPointDiagnosticCode = typeof TranslatedSurfaceStripWorldPointDiagnosticCode[keyof typeof TranslatedSurfaceStripWorldPointDiagnosticCode];
export declare class TranslatedSurfaceStripWorldPointError extends KernelError {
    readonly code: TranslatedSurfaceStripWorldPointDiagnosticCode;
    constructor(code: TranslatedSurfaceStripWorldPointDiagnosticCode, detail: string, cause?: unknown);
}
export interface TranslatedSurfaceStripWorldPointQuery {
    queryId: string;
    pointMM: Point;
}
export interface TranslatedSurfaceStripWorldPointOptions {
    evaluationId: string;
    maximumQueries: 16;
}
type Sign = -1 | 0 | 1;
type BoundaryRole = 'u-min' | 'u-max' | 'v-min' | 'roof' | 'lower' | 'upper';
type OutsideConstraint = 'x-below' | 'x-above' | 'z-below' | 'roof-above' | 'lower-y' | 'upper-y';
type Classification = {
    queryId: string;
    status: 'inside' | 'outside' | 'boundary';
    boundaryRoles: BoundaryRole[];
    outsideConstraints: OutsideConstraint[];
};
type Power = {
    a: SectionFraction;
    b: SectionFraction;
    c: SectionFraction;
};
type SpanSource = {
    index: number;
    domain: [number, number];
    originalPoleIndices: number[];
    newUVPoleIndices: number[];
    xBernstein: SectionFraction[];
    xDerivativeNormalized: SectionFraction[];
    xDerivativeNative: SectionFraction[];
    yAtVMinBernstein: SectionFraction[];
    yAtVMaxBernstein: SectionFraction[];
    roofVBernstein: SectionFraction[];
    roofZBernstein: SectionFraction[];
    planeRoofResiduals: SectionFraction[];
};
type SourceProof = {
    volumeEvaluationId: string;
    lowerSourceId: string;
    upperSourceId: string;
    planeSourceId: string;
    lowerSurfaceId: string;
    upperSurfaceId: string;
    planeId: string;
    roofIds: [string, string];
    regionCertificate: TranslatedSurfaceStripVolumeResult['region']['certificate'];
    nativeDomains: TranslatedSurfaceStripVolumeResult['region']['certificate']['nativeDomains'];
    globalXMinimum: SectionFraction;
    globalXMaximum: SectionFraction;
    z0: SectionFraction;
    z1: SectionFraction;
    zDerivative: SectionFraction;
    h: SectionFraction;
    uniformWeight: SectionFraction;
    translation: {
        differences: SectionFraction[][][];
        residuals: SectionFraction[][][];
    };
    plane: {
        origin: SectionFraction[];
        uDirection: SectionFraction[];
        vDirection: SectionFraction[];
        rawNormal: SectionFraction[];
        d: SectionFraction;
        fourthCornerResiduals: SectionFraction[];
    };
    spans: SpanSource[];
};
type SignMethod = 'rational-root' | 'constant-remainder' | 'threshold-below' | 'threshold-above' | 'threshold-in-interval';
type SignWitness = {
    method: SignMethod;
    offsetY: SectionFraction;
    lambda: SectionFraction | null;
    L: SectionFraction | null;
    K: SectionFraction | null;
    reconstructionResiduals: SectionFraction[] | null;
    r: SectionFraction | null;
    rPosition: 'below-zero' | 'at-zero' | 'interior' | 'at-one' | 'above-one' | null;
    xAtR: SectionFraction | null;
    xDifference: SectionFraction | null;
    rootDifferenceSign: Sign | null;
    LSign: Sign | null;
    resultSign: Sign;
    evaluatedY: SectionFraction | null;
};
type QueryProof = {
    queryId: string;
    pointExact: [SectionFraction, SectionFraction, SectionFraction];
    preliminary: {
        globalXMinimum: SectionFraction;
        globalXMaximum: SectionFraction;
        z0: SectionFraction;
        planeF: SectionFraction;
        xRelation: 'below' | 'minimum' | 'interior' | 'maximum' | 'above';
        zRelation: 'below' | 'on' | 'above';
        roofRelation: 'below' | 'on' | 'above';
    };
    spanSelection: {
        index: number;
        domain: [number, number];
        originalPoleIndices: number[];
        newUVPoleIndices: number[];
        position: 'lower-endpoint' | 'interior' | 'upper-endpoint';
        internalJoin: boolean;
    } | null;
    beta: SectionFraction | null;
    nativeV: SectionFraction | null;
    coefficients: {
        xBernstein: SectionFraction[];
        yAtVMinBernstein: SectionFraction[];
        yAtVMaxBernstein: SectionFraction[];
        yFixedVBernstein: SectionFraction[];
        xDerivativeNormalized: SectionFraction[];
        xDerivativeNative: SectionFraction[];
        xPower: Power;
        yPower: Power;
    } | null;
    root: {
        method: 'linear-rational' | 'quadratic-unique-monotone';
        F: Power;
        tExact: SectionFraction | null;
        nativeUExact: SectionFraction | null;
        unitInterval: [0, 1];
        spanRelation: {
            formula: 'nativeU=spanUmin+t*spanLength';
            nativeUMinimum: SectionFraction;
            spanLength: SectionFraction;
        };
        endpointX: [SectionFraction, SectionFraction];
        xDerivativeNormalized: SectionFraction[];
    } | null;
    lower: SignWitness | null;
    upper: SignWitness | null;
    classification: Classification;
};
type Proof = {
    source: SourceProof;
    queries: QueryProof[];
};
export interface TranslatedSurfaceStripWorldPointReport {
    schema: 'barocss-translated-surface-strip-world-points';
    version: 0;
    evaluationId: string;
    parentEvaluationId: string;
    lowerSourceId: string;
    upperSourceId: string;
    planeSourceId: string;
    lowerSurfaceId: string;
    upperSurfaceId: string;
    planeId: string;
    roofIds: [string, string];
    queryCount: number;
    spanCount: number;
    counts: {
        inside: number;
        outside: number;
        boundary: number;
    };
    boundaryRoleCounts: Record<BoundaryRole, number>;
    spanQueryCounts: {
        index: number;
        count: number;
    }[];
    methodCounts: Record<SignMethod, number>;
    lengthUnit: 'mm';
    sourceFrame: 'authored-xyz-no-axis-conversion';
    parameterFrame: 'exact-world-xyz-and-native-v-with-local-u-root-selector';
    authority: 'exact-source-defined-translated-strip-region';
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
        volumeValidationCount: 1;
        preliminaryQueryCount: number;
        spanSelectionCount: number;
        lowerSignComparisonCount: number;
        upperSignComparisonCount: number;
        curvePointEvaluationCount: 0;
        curveDerivativeEvaluationCount: 0;
        surfacePointEvaluationCount: 0;
        surfaceDerivativeEvaluationCount: 0;
        sourceCompilationCount: 0;
        nativeRootCount: 0;
        refinementCount: 0;
        floatConversionCount: 0;
    };
    rationalCounts: ReturnType<SectionRationalContext['counts']>;
    numericPolicy: {
        input: 'exact-represented-world-xyz';
        coefficients: 'exact-stored-cartesian-uniform-weight-cancellation';
        root: 'strict-monotone-x-with-exact-polynomial-remainder-and-threshold-order';
        spanJoins: 'lower-span-internal-join-not-material-boundary';
        classification: 'outside-priority-and-boundary-only-global-region-sides';
        generatedExactZero: 'positive-zero';
        toleranceUsed: false;
        nativeD0EqualityAuthority: false;
        squareRootApproximationUsed: false;
        rayUsed: false;
        pointProjectionPerformed: false;
        snapPerformed: false;
        iterativeRefinementPerformed: false;
    };
    quality: {
        exactRegionMembershipCertified: true;
        sourceDefinedRegionAuthority: true;
        originalBitsPreserved: true;
        parentProofUnchanged: true;
        nativeBodyTopologyCertified: false;
        BRepBoundaryMappingCertified: false;
        solid: false;
        generalCurvedSolidCertified: false;
        globalBinary64EvaluationErrorCertified: false;
        manufacturingToleranceCertified: false;
        rendererPickingCertified: false;
        booleanCertified: false;
        ownership: 'independent-copied-cpu-data-gc';
    };
    limits: {
        maximumQueries: 16;
        maximumOriginalUDegree: 2;
        maximumOriginalSpans: 4;
        maximumRootPolynomialDegree: 2;
        maximumYPolynomialDegree: 2;
        maximumSignComparisonsPerQuery: 2;
        maximumSignComparisons: 32;
        rationalOperations: 200000;
        gcdSteps: 200000;
        rationalIntegerBits: 8192;
        fractionIntegerCharacters: 5000;
        ownValues: 1048576;
        ownDepth: 64;
        arrayElements: 8192;
        recordFields: 64;
        keyCharacters: 128;
        sourceStringCharacters: 262144;
        maximumFileUTF16: 1048576;
        maximumFileUTF8: 1048576;
        maximumFinalFloatConversions: 0;
        rootNativeCalls: 0;
    };
    workScope: 'one-complete-volume-validation-and-new-exact-predicates-parent-internal-work-retained-and-excluded';
    budgetFailure: 'atomic-no-partial-point-classification';
}
export interface TranslatedSurfaceStripWorldPointResult {
    volume: TranslatedSurfaceStripVolumeResult;
    queries: TranslatedSurfaceStripWorldPointQuery[];
    options: TranslatedSurfaceStripWorldPointOptions;
    classifications: Classification[];
    proof: Proof;
    report: TranslatedSurfaceStripWorldPointReport;
}
/** Classify represented World XYZ points in the exact source-defined region without approximating U. */
export declare function classifyTranslatedSurfaceStripWorldPoints(volumeInput: TranslatedSurfaceStripVolumeResult, queriesInput: TranslatedSurfaceStripWorldPointQuery[], optionsInput: TranslatedSurfaceStripWorldPointOptions): TranslatedSurfaceStripWorldPointResult;
/** Rebuild complete parent authority and every exact World query, proof, counter and file size. */
export declare function validateTranslatedSurfaceStripWorldPointClassification(input: TranslatedSurfaceStripWorldPointResult): TranslatedSurfaceStripWorldPointReport;
export {};
