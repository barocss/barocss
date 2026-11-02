import type { CurveD1Result, SurfaceD1Result } from '../core/derivatives.js';
import type { Curve, Surface, Model, Point } from '../types.js';
import { KernelError } from '../core/barocss-error.js';
export declare const AffineGeometryTransformDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly MATRIX: "MATRIX";
    readonly BUDGET: "BUDGET";
    readonly NATIVE: "NATIVE";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly BINDING: "BINDING";
    readonly OWNED: "OWNED";
}>;
export type AffineGeometryTransformDiagnosticCode = typeof AffineGeometryTransformDiagnosticCode[keyof typeof AffineGeometryTransformDiagnosticCode];
export declare class AffineGeometryTransformError extends KernelError {
    readonly code: AffineGeometryTransformDiagnosticCode;
    constructor(code: AffineGeometryTransformDiagnosticCode, detail: string, cause?: unknown);
}
export type CadAffineMatrix3x4 = [number, number, number, number, number, number, number, number, number, number, number, number];
export interface AffineGeometryTransformOptions {
    geometryId: string;
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
type PointObservation = {
    originalPoint: Point;
    expectedPoint: Point;
    actualPoint: Point;
    difference: number;
};
export type AffineGeometryTransformObservation = PointObservation & {
    kind: 'curve';
    parameter: number;
    originalD1: D1State<CurveD1Result>;
    targetD1: D1State<CurveD1Result>;
    expectedDerivative: Point | null;
    relativeDerivativeDifference: number | null;
} | PointObservation & {
    kind: 'surface';
    u: number;
    v: number;
    originalD1: D1State<SurfaceD1Result>;
    targetD1: D1State<SurfaceD1Result>;
    expectedDu: Point | null;
    expectedDv: Point | null;
    relativeDuDifference: number | null;
    relativeDvDifference: number | null;
    expectedCross: Point | null;
    actualCross: Point | null;
    relativeCrossDifference: number | null;
    crossDegenerate: boolean | null;
};
export interface AffineGeometryTransformReport {
    schema: 'barocss-native-affine-geometry-transform';
    version: 0;
    originalId: string;
    geometryId: string;
    kind: 'curve' | 'surface';
    lengthUnit: 'mm';
    sourceFrame: 'authored-xyz-no-axis-conversion';
    matrixRoles: {
        order: 'row-major-three-by-four-column-vector';
        linearUnit: 'dimensionless';
        translationUnit: 'mm';
    };
    determinant: number;
    signedTripleTerms: [number, number, number, number, number, number];
    absoluteTripleSum: number;
    determinantThreshold: number;
    handedness: 'preserved' | 'reversed';
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
    coefficientMappings: {
        controlPoint: [number] | [number, number];
        originalPoint: Point;
        targetPoint: Point;
        axes: {
            axis: number;
            row: [number, number, number, number];
            terms: [number, number, number, number];
            value: number;
            policy: 'identity-axis-bit-copy' | 'guarded-affine-dot';
        }[];
    }[];
    observationCount: number;
    observations: AffineGeometryTransformObservation[];
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
    maximumPointDifference: number;
    maximumRelativeDerivativeDifference: number | null;
    maximumRelativeCrossDifference: number | null;
    degenerateCrossObservationCount: number;
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    quality: {
        authority: 'actual-native-control-coefficients-and-original-parameter-evaluators';
        basisWeightsAndParameterBitsPreserved: true;
        coefficientPolicy: 'guarded-affine-dot-with-unit-axis-zero-translation-bit-copy';
        parameterOrderPreserved: true;
        handednessMeaning: 'linear-map-parity-not-native-face-or-topology-orientation';
        nativeD1Refusals: 'actual-original-target-states-must-match-no-inferred-derivatives';
        crossMeaning: 'local-nonunit-derivative-cross-vectors-not-certified-normal-or-face-orientation';
        localObservationsOnly: true;
        workScope: 'actual-original-and-target-point-d1-observations-excludes-native-source-compiler-and-internal-validation';
        matrixInverseCertified: false;
        matrixConditionCertified: false;
        regularityCertified: false;
        topologyOrientationCertified: false;
        globalShapeErrorCertified: false;
        globalBinary64ErrorCertified: false;
        manufacturingToleranceCertified: false;
        sourceObjectLimitUnchanged: 16;
        ownership: 'copied-cpu-data-gc-no-renderer-resources';
    };
    budgetFailure: 'atomic-refusal-no-partial-transformed-native-geometry';
    limits: {
        maximumCurveDegree: 5;
        maximumCurvePoles: 64;
        maximumSurfaceAxisPoles: 16;
        maximumSurfacePoles: 256;
        maximumCurveSamples: 127;
        maximumSurfaceAxisSamples: 31;
        maximumObservations: 961;
        linearCoefficientAbs: 1000;
        translationAbs: 10000;
        coordinateAbs: 10000;
        parameterAbs: 10000;
        authoredIdCharacters: 48;
        pointComparison: 1e-7;
        relativeD1Comparison: 1e-7;
        determinantRelativeThreshold: number;
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
export interface AffineGeometryTransformResult {
    original: Curve | Surface;
    matrix: CadAffineMatrix3x4;
    options: AffineGeometryTransformOptions;
    geometry: Curve | Surface;
    source: string;
    sourceVersion: 0;
    model: Model;
    report: AffineGeometryTransformReport;
}
type AxisMapping = AffineGeometryTransformReport['coefficientMappings'][number]['axes'][number];
export declare function mapPoint(matrix: CadAffineMatrix3x4, point: Point, translation: boolean): {
    point: Point;
    axes: AxisMapping[];
};
/** Affine native coefficient copy in the unchanged original parameter basis. */
export declare function transformNativeGeometryAffine(originalInput: Curve | Surface, matrixInput: CadAffineMatrix3x4, optionsInput: AffineGeometryTransformOptions): AffineGeometryTransformResult;
/** Rebuild every native coefficient, source binding and observation from copied owned inputs. */
export declare function validateAffineGeometryTransform(input: AffineGeometryTransformResult): AffineGeometryTransformReport;
export {};
