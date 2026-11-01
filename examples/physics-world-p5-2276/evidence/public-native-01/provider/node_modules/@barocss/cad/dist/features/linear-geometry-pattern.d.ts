import type { AffineGeometryTransformResult } from './affine-geometry-transform.js';
import type { Curve, Surface, Model, Point } from '../types.js';
import { KernelError } from '../core/barocss-error.js';
export declare const LinearGeometryPatternDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly BUDGET: "BUDGET";
    readonly NATIVE: "NATIVE";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly BINDING: "BINDING";
    readonly OWNED: "OWNED";
}>;
export type LinearGeometryPatternDiagnosticCode = typeof LinearGeometryPatternDiagnosticCode[keyof typeof LinearGeometryPatternDiagnosticCode];
export declare class LinearGeometryPatternError extends KernelError {
    readonly code: LinearGeometryPatternDiagnosticCode;
    readonly instanceIndex: number | null;
    constructor(code: LinearGeometryPatternDiagnosticCode, detail: string, context?: {
        instanceIndex?: number | null;
        cause?: unknown;
    });
}
export interface LinearGeometryPatternOptions {
    patternId: string;
    idPrefix: string;
    count: number;
    spacingMM: Point;
    maximumCopyObservations: number;
}
export interface LinearGeometryPatternInstance {
    index: number;
    geometryId: string;
    translationMM: Point;
    geometry: Curve | Surface;
    evaluation: AffineGeometryTransformResult | null;
}
export interface LinearGeometryPatternReport {
    schema: 'barocss-native-linear-geometry-pattern';
    version: 0;
    originalId: string;
    patternId: string;
    kind: 'curve' | 'surface';
    lengthUnit: 'mm';
    sourceFrame: 'authored-xyz-no-axis-conversion';
    count: number;
    spacingMM: Point;
    activeGeometryIds: string[];
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
        translationMM: Point;
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
        preflight: 'all-active-identities-translations-and-complete-copy-observation-budget-before-any-child';
        translationPolicy: 'index-times-authored-raw-xyz-spacing-no-chained-copies';
        seedPolicy: 'actual-original-with-null-evaluation-no-phantom-copy-work';
        nativeProofs: 'complete-individual-affine-results-not-first-member-broadcast';
        sourceAuthority: 'one-actual-compiled-native-model-seed-then-copies';
        identityMeaning: 'current-recipe-roles-not-persistent-topological-naming-or-graph-revisions';
        workScope: 'summed-actual-affine-child-point-d1-counts-excludes-seed-validation-source-compiler-and-internal-validation';
        assembly: false;
        booleanUnion: false;
        circularPattern: false;
        topologyCertified: false;
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
        spacingAbsMM: 10000;
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
export interface LinearGeometryPatternResult {
    original: Curve | Surface;
    options: LinearGeometryPatternOptions;
    instances: LinearGeometryPatternInstance[];
    source: string;
    sourceVersion: 0;
    model: Model;
    report: LinearGeometryPatternReport;
}
/** One atomic native Model containing the seed and direct, independently evaluated affine copies. */
export declare function buildLinearGeometryPattern(originalInput: Curve | Surface, optionsInput: LinearGeometryPatternOptions): LinearGeometryPatternResult;
/** Rebuild the complete recipe and all actual affine/source proofs from safely copied owned inputs. */
export declare function validateLinearGeometryPattern(input: LinearGeometryPatternResult): LinearGeometryPatternReport;
