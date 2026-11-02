import type { Curve, Model, Point } from '../../types.js';
import { KernelError } from '../../core/barocss-error.js';
export declare const CurveInterpolationDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly BUDGET: "BUDGET";
    readonly NATIVE: "NATIVE";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly CONDITIONING: "CONDITIONING";
    readonly BINDING: "BINDING";
    readonly OWNED: "OWNED";
}>;
export type CurveInterpolationDiagnosticCode = typeof CurveInterpolationDiagnosticCode[keyof typeof CurveInterpolationDiagnosticCode];
export declare class CurveInterpolationError extends KernelError {
    readonly code: CurveInterpolationDiagnosticCode;
    constructor(code: CurveInterpolationDiagnosticCode, detail: string, cause?: unknown);
}
export interface CurveInterpolationPoint {
    parameter: number;
    pointMM: Point;
}
export interface CurveInterpolationOptions {
    curveId: string;
    degree: number;
    maximumBasisEvaluations: number;
    maximumEliminationSteps: number;
}
export interface CurveInterpolationReport {
    schema: 'barocss-native-curve-interpolation';
    version: 0;
    curveId: string;
    degree: number;
    lengthUnit: 'mm';
    sourceFrame: 'authored-xyz-no-axis-conversion';
    parameters: number[];
    domain: [number, number];
    knots: number[];
    pointCount: number;
    knotConstruction: {
        method: 'original-parameter-clamped-averaging';
        endpointCopies: number;
        averages: {
            knotIndex: number;
            parameterIndices: number[];
            origin: number;
            offsetSum: number;
            mean: number;
        }[];
    };
    basisCurveIds: string[];
    basisEvaluations: {
        row: number;
        column: number;
        parameter: number;
        basisCurveId: string;
        nativePointMM: Point;
        coefficient: number;
    }[];
    basisMatrix: number[][];
    pointRHS: Point[];
    solver: {
        method: 'deterministic-scaled-partial-pivot-xyz';
        originalRowScales: number[];
        rowOrder: number[];
        pivots: {
            column: number;
            selectedCurrentRow: number;
            pivotRowOriginalIndex: number;
            score: number;
            pivotMagnitude: number;
            rowScale: number;
            threshold: number;
            swappedCurrentRows: [number, number] | null;
            rowOrder: number[];
        }[];
        eliminations: {
            column: number;
            row: number;
            rowOriginalIndex: number;
            pivotRowOriginalIndex: number;
            factor: number;
        }[];
        upperTriangularMatrix: number[][];
        transformedRHS: Point[];
        solvedPolesBeforeEndpointCopy: Point[];
        endpointRowsVerified: true;
        endpointBitsCopied: true;
    };
    solvedPoles: Point[];
    basisEvaluationCount: number;
    eliminationStepCount: number;
    pointEvaluationCount: number;
    observations: {
        parameter: number;
        inputPointMM: Point;
        actualPointMM: Point;
        differenceMM: number;
    }[];
    maximumPointDifferenceMM: number;
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    quality: {
        authority: 'actual-original-native-normalized-basis-and-through-point-evaluator';
        weights: 'polynomial-all-one-no-rational-weight-solving';
        parameters: 'explicit-original-values-no-chord-length-or-normalization';
        solver: 'condition-limited-no-singularity-repair-qr-or-svd';
        endpoints: 'native-clamped-endpoint-rows-verified-then-authored-bit-copy';
        localInterpolationAccuracyOnly: true;
        nativeWork: 'actual-n-squared-basis-plus-all-lower-row-stages-and-final-point-checks-sourcecompiler-separate';
        periodicCertified: false;
        leastSquaresFit: false;
        tangentConstraintsSolved: false;
        curvatureConstraintsSolved: false;
        continuityConstraintsSolved: false;
        regularityCertified: false;
        globalShapeErrorCertified: false;
        globalBinary64ErrorCertified: false;
        manufacturingToleranceCertified: false;
        sourceObjectLimitUnchanged: 16;
        ownership: 'copied-cpu-data-gc-no-renderer-resources';
    };
    budgetFailure: 'atomic-refusal-no-partial-interpolating-curve';
    limits: {
        maximumPoints: 16;
        maximumDegree: 3;
        maximumBasisEvaluations: 256;
        maximumEliminationSteps: 120;
        authoredIdCharacters: 48;
        parameterAbs: 10000;
        coordinateAbsMM: 10000;
        pivotRelativeThreshold: number;
        pointComparisonMM: 1e-7;
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
    };
}
export interface CurveInterpolationResult {
    points: CurveInterpolationPoint[];
    options: CurveInterpolationOptions;
    curve: Curve;
    source: string;
    sourceVersion: 0;
    model: Model;
    report: CurveInterpolationReport;
}
/** Global polynomial through-point interpolation in caller-supplied native parameter units. */
export declare function buildInterpolatingCurve(pointsInput: CurveInterpolationPoint[], optionsInput: CurveInterpolationOptions): CurveInterpolationResult;
/** Rebuild the native basis, deterministic solve, actual Source0 Curve and complete report bit-for-bit. */
export declare function validateInterpolatingCurve(input: CurveInterpolationResult): CurveInterpolationReport;
