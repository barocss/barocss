import type { CurveInterpolationResult } from './curve-interpolation.js';
import type { Point } from '../../types.js';
import { KernelError } from '../../core/barocss-error.js';
export declare const CurveParameterizationDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly BUDGET: "BUDGET";
    readonly NATIVE: "NATIVE";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly CONDITIONING: "CONDITIONING";
    readonly BINDING: "BINDING";
    readonly OWNED: "OWNED";
}>;
export type CurveParameterizationDiagnosticCode = typeof CurveParameterizationDiagnosticCode[keyof typeof CurveParameterizationDiagnosticCode];
export declare class CurveParameterizationError extends KernelError {
    readonly code: CurveParameterizationDiagnosticCode;
    constructor(code: CurveParameterizationDiagnosticCode, detail: string, cause?: unknown);
}
export type CurveParameterizationMethod = 'uniform' | 'chord-length' | 'centripetal';
export interface CurveParameterizationOptions {
    curveId: string;
    degree: number;
    method: CurveParameterizationMethod;
    domain: [number, number];
    maximumMetricEvaluations: number;
    maximumBasisEvaluations: number;
    maximumEliminationSteps: number;
}
export interface CurveParameterizationReport {
    schema: 'barocss-native-curve-parameterization';
    version: 0;
    curveId: string;
    degree: number;
    lengthUnit: 'mm';
    sourceFrame: 'authored-xyz-no-axis-conversion';
    method: CurveParameterizationMethod;
    requestedDomain: [number, number];
    pointCount: number;
    distanceUnit: 'mm';
    incrementUnit: 'dimensionless' | 'mm' | 'sqrt-mm';
    segments: {
        index: number;
        fromPointIndex: number;
        toPointIndex: number;
        deltaMM: Point;
        distanceMM: number;
        increment: number;
        cumulative: number;
    }[];
    cumulativeIncrements: number[];
    totalIncrement: number;
    fractions: number[];
    generatedParameters: number[];
    metricEvaluationCount: number;
    childConstructionCount: 1;
    basisEvaluationCount: number;
    eliminationStepCount: number;
    pointEvaluationCount: number;
    maximumPointDifferenceMM: number;
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    quality: {
        metricMeaning: 'authored-consecutive-xyz-polyline-chords-not-native-curve-arc-length';
        inputPointsAndOrderPreserved: true;
        requestedEndpointBitsPreserved: true;
        generatedParameters: 'strictly-represented-requested-domain-no-ties-dedup-or-output-normalization';
        interpolationAuthority: 'one-actual-public-native-curve-interpolation';
        methodShapePolicy: 'choice-may-change-native-curve-shape';
        workScope: 'actual-consecutive-chord-metrics-and-one-native-child-with-separate-actual-child-counts';
        bestFitCertified: false;
        noLoopCertified: false;
        regularityCertified: false;
        rationalFit: false;
        leastSquaresFit: false;
        arcLengthCertified: false;
        globalShapeErrorCertified: false;
        globalBinary64ErrorCertified: false;
        manufacturingToleranceCertified: false;
        ownership: 'copied-cpu-data-gc-no-renderer-resources';
    };
    budgetFailure: 'atomic-refusal-no-partial-parameterized-curve';
    limits: {
        maximumPoints: 16;
        maximumDegree: 3;
        maximumMetricEvaluations: 15;
        maximumBasisEvaluations: 256;
        maximumEliminationSteps: 120;
        authoredIdCharacters: 48;
        parameterAbs: 10000;
        coordinateAbsMM: 10000;
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
export interface CurveParameterizationResult {
    points: Point[];
    options: CurveParameterizationOptions;
    interpolation: CurveInterpolationResult;
    report: CurveParameterizationReport;
}
/** Caller-selected point-polyline parameter rule followed by exactly one actual native interpolation. */
export declare function buildParameterizedInterpolatingCurve(pointsInput: Point[], optionsInput: CurveParameterizationOptions): CurveParameterizationResult;
/** Rebuild original chords/parameters and the unchanged native child, with full bit-sensitive equality. */
export declare function validateParameterizedInterpolatingCurve(input: CurveParameterizationResult): CurveParameterizationReport;
