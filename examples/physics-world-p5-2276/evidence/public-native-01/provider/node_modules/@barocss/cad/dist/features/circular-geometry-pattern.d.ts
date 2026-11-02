import type { AffineGeometryTransformResult, CadAffineMatrix3x4 } from './affine-geometry-transform.js';
import type { Curve, Surface, Model, Point } from '../types.js';
import { KernelError } from '../core/barocss-error.js';
export declare const CircularGeometryPatternDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly BUDGET: "BUDGET";
    readonly NATIVE: "NATIVE";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly BINDING: "BINDING";
    readonly OWNED: "OWNED";
}>;
export type CircularGeometryPatternDiagnosticCode = typeof CircularGeometryPatternDiagnosticCode[keyof typeof CircularGeometryPatternDiagnosticCode];
export declare class CircularGeometryPatternError extends KernelError {
    readonly code: CircularGeometryPatternDiagnosticCode;
    readonly instanceIndex: number | null;
    constructor(code: CircularGeometryPatternDiagnosticCode, detail: string, context?: {
        instanceIndex?: number | null;
        cause?: unknown;
    });
}
export interface CircularGeometryPatternOptions {
    patternId: string;
    idPrefix: string;
    count: number;
    axisOriginMM: Point;
    axisDirection: Point;
    angleStepDegrees: number;
    maximumCopyObservations: number;
}
export interface CircularGeometryPatternInstance {
    index: number;
    geometryId: string;
    angleDegrees: number;
    matrix: CadAffineMatrix3x4;
    geometry: Curve | Surface;
    evaluation: AffineGeometryTransformResult | null;
}
export interface CircularGeometryPatternReport {
    schema: 'barocss-native-circular-geometry-pattern';
    version: 0;
    originalId: string;
    patternId: string;
    kind: 'curve' | 'surface';
    lengthUnit: 'mm';
    sourceFrame: 'authored-xyz-no-axis-conversion';
    count: number;
    axisOriginMM: Point;
    axisDirection: Point;
    axisNorm: number;
    normalizedAxis: Point;
    normalizationResidual: number;
    angleStepDegrees: number;
    activeGeometryIds: string[];
    anglesDegrees: number[];
    matrices: CadAffineMatrix3x4[];
    rotations: {
        index: number;
        angleDegrees: number;
        radians: number;
        sine: number;
        cosine: number;
        oneMinusCosine: number;
        trigonometry: 'exact-integral-quarter-turn-table' | 'native-sin-cos-stable-half-angle';
        matrix: CadAffineMatrix3x4;
        determinant: number;
        orthogonalityResidual: number;
        determinantResidual: number;
        axisResidual: number;
        anchorResidual: number;
    }[];
    plannedCopyCount: number;
    plannedCopyObservations: number;
    observationsPerCopy: number;
    childConstructionCount: number;
    domains: {
        curve: [number, number] | null;
        u: [number, number] | null;
        v: [number, number] | null;
    };
    samples: {
        curve: number[];
        u: number[];
        v: number[];
    };
    unrepresentedMidpointIntervals: {
        curve: {
            domain: [number, number];
            attemptedParameter: number;
        }[];
        u: {
            domain: [number, number];
            attemptedParameter: number;
        }[];
        v: {
            domain: [number, number];
            attemptedParameter: number;
        }[];
    };
    copyObservationCount: number;
    originalD0EvaluationCount: number;
    targetD0EvaluationCount: number;
    originalD1AttemptCount: number;
    targetD1AttemptCount: number;
    derivativeComparisonCount: number;
    derivativeRefusalCount: number;
    derivativeSourceRefusalCounts: {
        original: number;
        target: number;
    };
    maximumPointDifferenceMM: number;
    maximumRelativeDerivativeDifference: number | null;
    maximumRelativeCrossDifference: number | null;
    sourceModelObjectCount: number;
    members: {
        index: number;
        geometryId: string;
        angleDegrees: number;
        observationCount: number;
        derivativeComparisonCount: number;
        derivativeRefusalCount: number;
        handedness: 'preserved' | null;
    }[];
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    quality: {
        authority: 'actual-public-native-affine-copy-per-member-from-original-seed';
        originalSeedBitsPreserved: true;
        basisWeightsAndParameterBitsPreserved: true;
        preflight: 'all-active-identities-angles-rodrigues-matrices-residuals-and-complete-copy-observation-budget-before-any-child';
        rotationPolicy: 'normalized-authored-axis-right-hand-rodrigues-no-modulo-or-angle-snapping';
        trigonometryPolicy: 'exact-integral-quarter-turn-table-otherwise-native-sin-cos-and-two-sin-half-angle-squared';
        residualScales: {
            orthogonality: 'max-absolute-rt-r-minus-identity';
            determinant: 'absolute-det-minus-one';
            axis: 'euclidean-r-axis-minus-axis';
            anchor: 'euclidean-r-c-plus-t-minus-c-over-max-one-c-r-c-t-norms';
        };
        seedPolicy: 'actual-original-identity-matrix-null-evaluation-no-phantom-copy-work';
        nativeProofs: 'complete-individual-affine-results-not-first-member-broadcast';
        sourceAuthority: 'one-actual-compiled-native-model-seed-then-copies';
        identityMeaning: 'current-recipe-roles-not-persistent-topological-naming-or-graph-revisions';
        workScope: 'per-copy-matrix-preflight-and-summed-actual-affine-child-point-d1-counts-excludes-seed-validation-source-compiler-and-internal-validation';
        assembly: false;
        booleanUnion: false;
        topologyCertified: false;
        globalMetricPreservationCertified: false;
        globalShapeErrorCertified: false;
        globalBinary64ErrorCertified: false;
        manufacturingToleranceCertified: false;
        sourceObjectLimitUnchanged: 16;
        ownership: 'copied-cpu-data-gc-no-renderer-resources';
    };
    budgetFailure: 'atomic-refusal-no-partial-native-pattern';
    limits: {
        maximumInstances: 5;
        maximumCopies: 4;
        maximumCurveDegree: 5;
        maximumCurvePoles: 64;
        maximumSurfaceAxisPoles: 16;
        maximumSurfacePoles: 256;
        maximumCurveSamples: 127;
        maximumSurfaceSamples: 961;
        maximumCopyObservations: 3844;
        coordinateAbsMM: 10000;
        axisOriginAbsMM: 10000;
        axisDirectionAbs: 1000;
        minimumAxisNorm: 1e-6;
        minimumNormalizedNonzeroAxisComponent: 1e-12;
        minimumMultiMemberAngleDegrees: 1e-6;
        exclusiveMaximumTotalAngleDegrees: 360;
        rotationResidualThreshold: number;
        translationAbsMM: 10000;
        authoredIdCharacters: 48;
        prefixCharacters: 32;
        inputValues: 32768;
        inputDepth: 8;
        inputArrayElements: 128;
        inputRecordFields: 16;
        inputStringCharacters: 128;
        ownValues: 1048576;
        ownDepth: 40;
        arrayElements: 8192;
        recordFields: 64;
        sourceStringCharacters: 262144;
    };
}
export interface CircularGeometryPatternResult {
    original: Curve | Surface;
    options: CircularGeometryPatternOptions;
    instances: CircularGeometryPatternInstance[];
    source: string;
    sourceVersion: 0;
    model: Model;
    report: CircularGeometryPatternReport;
}
/** One atomic native Model containing a seed and direct right-hand axis-angle copies. */
export declare function buildCircularGeometryPattern(originalInput: Curve | Surface, optionsInput: CircularGeometryPatternOptions): CircularGeometryPatternResult;
/** Rebuild the complete axis-angle recipe and all actual affine/source proofs from copied owned inputs. */
export declare function validateCircularGeometryPattern(input: CircularGeometryPatternResult): CircularGeometryPatternReport;
