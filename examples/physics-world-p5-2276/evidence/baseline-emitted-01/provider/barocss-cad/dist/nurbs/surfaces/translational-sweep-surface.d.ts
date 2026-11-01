import type { CurveD1Result, SurfaceD1Result } from '../../core/derivatives.js';
import type { Curve, Surface, Model, Point } from '../../types.js';
import { KernelError } from '../../core/barocss-error.js';
export declare const TranslationalSweepDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly BUDGET: "BUDGET";
    readonly NATIVE: "NATIVE";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly BINDING: "BINDING";
    readonly OWNED: "OWNED";
}>;
export type TranslationalSweepDiagnosticCode = typeof TranslationalSweepDiagnosticCode[keyof typeof TranslationalSweepDiagnosticCode];
export declare class TranslationalSweepError extends KernelError {
    readonly code: TranslationalSweepDiagnosticCode;
    constructor(code: TranslationalSweepDiagnosticCode, detail: string, cause?: unknown);
}
export interface TranslationalSweepOptions {
    surfaceId: string;
    maximumObservations: number;
}
type D1State<T> = {
    status: 'evaluated';
    value: T;
} | {
    status: 'native-refused';
    reason: string;
    nativeErrorName: string;
};
export interface TranslationalSweepObservation {
    u: number;
    v: number;
    profilePoint: Point;
    railPoint: Point;
    expectedPoint: Point;
    actualPoint: Point;
    difference: number;
    profileD1: D1State<CurveD1Result>;
    railD1: D1State<CurveD1Result>;
    surfaceD1: D1State<SurfaceD1Result>;
    relativeDuDifference: number | null;
    relativeDvDifference: number | null;
}
export interface TranslationalSweepProvenance {
    kind: 'independent-rational-profile-rail-translational-tensor';
    profileId: string;
    railId: string;
    surfaceId: string;
    formula: 'Qij=Pi+(Rj-nativeAnchor);Wij=profileWeight_i*railWeight_j';
    anchorParameter: number;
    anchor: Point;
    profileDomain: [number, number];
    railDomain: [number, number];
    poleGrid: [number, number];
    poles: {
        surfacePole: [number, number];
        profilePoleIndex: number;
        railPoleIndex: number;
        profilePoint: Point;
        railPoint: Point;
        anchor: Point;
        translation: Point;
        profileWeight: number;
        railWeight: number;
        point: Point;
        weight: number;
    }[];
    uKnotMappings: {
        profileKnotIndex: number;
        surfaceKnotIndex: number;
        originalValue: number;
        surfaceValue: number;
    }[];
    vKnotMappings: {
        railKnotIndex: number;
        surfaceKnotIndex: number;
        originalValue: number;
        surfaceValue: number;
    }[];
}
export interface TranslationalSweepReport {
    kind: 'translational-sweep-surface';
    dto: {
        schema: 'barocss-native-translational-sweep-surface';
        version: 0;
        lengthUnit: 'mm';
        frame: 'authored-xyz-no-axis-conversion';
        representation: 'native-independent-profile-rail-tensor-surface-not-moving-frame-or-solid';
    };
    surfaceId: string;
    profileId: string;
    railId: string;
    degreeU: number;
    degreeV: number;
    controlPointGrid: [number, number];
    domains: {
        u: [number, number];
        v: [number, number];
    };
    axisRoles: {
        u: 'original-profile-parameter';
        v: 'original-rail-parameter';
    };
    anchorParameter: number;
    anchor: Point;
    profileSamples: number[];
    railSamples: number[];
    observationCount: number;
    observations: TranslationalSweepObservation[];
    unrepresentedMidpointIntervals: {
        profile: {
            domain: [number, number];
            attemptedParameter: number;
        }[];
        rail: {
            domain: [number, number];
            attemptedParameter: number;
        }[];
    };
    guardedParameters: {
        u: number[];
        v: number[];
    };
    anchorD0EvaluationCount: 1;
    curveD0EvaluationCount: number;
    surfaceD0EvaluationCount: number;
    profileD1AttemptCount: number;
    railD1AttemptCount: number;
    surfaceD1AttemptCount: number;
    derivativeComparisonCount: number;
    derivativeRefusalCount: number;
    derivativeSourceRefusalCounts: {
        profile: number;
        rail: number;
        surface: number;
    };
    maximumPointDifference: number;
    maximumRelativeDuDifference: number | null;
    maximumRelativeDvDifference: number | null;
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    quality: {
        relation: 'actual-profile-point-plus-actual-rail-point-minus-actual-native-anchor';
        independentRationalBasesPreserved: true;
        knotDomainBitsPreserved: true;
        productWeights: 'actual-input-weight-products-no-normalization';
        zeroShiftPolicy: 'exact-zero-rail-delta-copies-original-profile-coordinate';
        localObservationsOnly: true;
        nativeD1Refusals: 'actual-surface-refusal-iff-either-original-curve-refuses-no-inferred-du-dv';
        workScope: 'new-anchor-d0-and-complete-point-d1-pairs-excludes-native-source-compiler-and-internal-validation';
        globalShapeErrorCertified: false;
        globalBinary64ErrorCertified: false;
        manufacturingToleranceCertified: false;
        g1g2Certified: false;
        manifoldCertified: false;
        regularityCertified: false;
        movingFrameCertified: false;
        sourceObjectLimitUnchanged: 16;
        ownership: 'copied-cpu-data-gc-no-renderer-resources';
    };
    budgetFailure: 'atomic-refusal-no-partial-sweep-surface';
    limits: {
        maximumCurveDegree: 3;
        maximumCurvePoles: 16;
        maximumSurfacePoles: 256;
        maximumAxisSamples: 31;
        maximumObservations: 961;
        inputValues: 32768;
        inputDepth: 8;
        inputArrayElements: 128;
        inputRecordFields: 16;
        inputStringCharacters: 128;
        ownValues: 524288;
        ownDepth: 32;
        arrayElements: 4096;
        recordFields: 64;
        sourceStringCharacters: 262144;
        authoredIdCharacters: 48;
        coordinateAbs: 10000;
        weightRange: [1e-6, 1e6];
        pointComparison: 1e-7;
        relativeD1Comparison: 1e-7;
    };
}
export interface TranslationalSweepResult {
    profile: Curve;
    rail: Curve;
    options: TranslationalSweepOptions;
    surface: Surface;
    source: string;
    sourceVersion: 0;
    model: Model;
    provenance: TranslationalSweepProvenance;
    report: TranslationalSweepReport;
}
/** Exact independent homogeneous tensor construction in original native profile/rail parameter units. */
export declare function buildTranslationalSweepSurface(profileInput: Curve, railInput: Curve, optionsInput: TranslationalSweepOptions): TranslationalSweepResult;
/** Rebuild original curves, actual anchor, native tensor/source, all point/D1 states and complete pair work. */
export declare function validateTranslationalSweepSurface(input: TranslationalSweepResult): TranslationalSweepReport;
export {};
