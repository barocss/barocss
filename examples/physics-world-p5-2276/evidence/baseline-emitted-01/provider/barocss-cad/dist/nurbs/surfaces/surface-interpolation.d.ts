import type { CurveInterpolationResult } from '../curves/curve-interpolation.js';
import type { Surface, Model, Point } from '../../types.js';
import { KernelError } from '../../core/barocss-error.js';
export declare const SurfaceInterpolationDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly BUDGET: "BUDGET";
    readonly NATIVE: "NATIVE";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly CONDITIONING: "CONDITIONING";
    readonly BINDING: "BINDING";
    readonly OWNED: "OWNED";
}>;
export type SurfaceInterpolationDiagnosticCode = typeof SurfaceInterpolationDiagnosticCode[keyof typeof SurfaceInterpolationDiagnosticCode];
export declare class SurfaceInterpolationError extends KernelError {
    readonly code: SurfaceInterpolationDiagnosticCode;
    readonly axis: 'u' | 'v' | null;
    readonly index: number | null;
    constructor(code: SurfaceInterpolationDiagnosticCode, detail: string, context?: {
        axis?: 'u' | 'v' | null;
        index?: number | null;
        cause?: unknown;
    });
}
export interface SurfaceInterpolationOptions {
    surfaceId: string;
    degreeU: number;
    degreeV: number;
    maximumBasisEvaluations: number;
    maximumEliminationSteps: number;
    maximumSurfaceEvaluations: number;
}
export interface SurfaceInterpolationObservation {
    u: number;
    v: number;
    inputIndex: [number, number];
    inputPointMM: Point;
    actualPointMM: Point;
    differenceMM: number;
}
export interface SurfaceInterpolationReport {
    schema: 'barocss-native-surface-interpolation';
    version: 0;
    surfaceId: string;
    lengthUnit: 'mm';
    sourceFrame: 'authored-xyz-no-axis-conversion';
    degreeU: number;
    degreeV: number;
    pointGrid: [number, number];
    controlPointGrid: [number, number];
    parametersU: number[];
    parametersV: number[];
    domains: {
        u: [number, number];
        v: [number, number];
    };
    knotsU: number[];
    knotsV: number[];
    axisRoles: {
        u: 'original-u-grid-parameter';
        v: 'original-v-grid-parameter';
    };
    phaseU: {
        axis: 'u';
        role: 'fixed-v-column';
        index: number;
        curveId: string;
        evaluation: CurveInterpolationResult;
    }[];
    phaseV: {
        axis: 'v';
        role: 'solved-u-pole-row';
        index: number;
        curveId: string;
        evaluation: CurveInterpolationResult;
    }[];
    plannedCounts: {
        basisEvaluations: number;
        eliminationSteps: number;
        surfaceEvaluations: number;
        curveConstructions: number;
        nestedCurvePointEvaluations: number;
    };
    basisEvaluationCount: number;
    eliminationStepCount: number;
    surfaceEvaluationCount: number;
    curveConstructionCount: number;
    nestedCurvePointEvaluationCount: number;
    observations: SurfaceInterpolationObservation[];
    maximumPointDifferenceMM: number;
    cornerBitsPreserved: true;
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    quality: {
        authority: 'actual-public-native-curve-interpolation-in-u-then-v';
        ordering: 'u-columns-then-solved-u-pole-v-rows';
        weights: 'polynomial-all-one';
        parameters: 'explicit-original-parameters-and-child-knot-bits';
        intermediateGeometry: 'temporary-constructor-curves-not-cad-edges-or-topology';
        workScope: 'actual-child-basis-and-elimination-counts-nested-final-curve-checks-separate-from-direct-surface-checks';
        noBasisFactorCacheClaimed: true;
        cornerEndpointBitsPreserved: true;
        localGridInterpolationAccuracyOnly: true;
        rationalFit: false;
        tangentConstraintsSolved: false;
        periodicCertified: false;
        leastSquaresFit: false;
        regularityCertified: false;
        globalShapeErrorCertified: false;
        globalBinary64ErrorCertified: false;
        manufacturingToleranceCertified: false;
        source: 'single-native-surface-model-intermediate-curve-sources-retained-as-nested-proofs';
        sourceObjectLimitUnchanged: 16;
        ownership: 'copied-cpu-data-gc-no-renderer-resources';
    };
    budgetFailure: 'atomic-refusal-no-partial-interpolating-surface';
    limits: {
        maximumAxisPoints: 16;
        maximumDegree: 3;
        maximumSurfacePoles: 256;
        maximumBasisEvaluations: 8192;
        maximumEliminationSteps: 3840;
        maximumSurfaceEvaluations: 256;
        maximumCurveConstructions: 32;
        authoredIdCharacters: 48;
        parameterAbs: 10000;
        coordinateAbsMM: 10000;
        pointComparisonMM: 1e-7;
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
export interface SurfaceInterpolationResult {
    parametersU: number[];
    parametersV: number[];
    points: Point[][];
    options: SurfaceInterpolationOptions;
    surface: Surface;
    source: string;
    sourceVersion: 0;
    model: Model;
    report: SurfaceInterpolationReport;
}
/** Native tensor interpolation by the actual verified Curve constructor in U columns, then solved V rows. */
export declare function buildInterpolatingSurface(parametersUInput: number[], parametersVInput: number[], pointsInput: Point[][], optionsInput: SurfaceInterpolationOptions): SurfaceInterpolationResult;
/** Complete current native U/V child reconstruction and full bit-sensitive Surface/source/report equality. */
export declare function validateInterpolatingSurface(input: SurfaceInterpolationResult): SurfaceInterpolationReport;
