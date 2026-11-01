import type { BezierCurvePlanePointEvent, BezierCurveAffinePlaneIntersectionResult, CurveAffinePlaneAxes } from './own-curve-plane-intersection.js';
import type { CubicBernsteinRootEvidence } from './own-cubic-bernstein-roots.js';
import type { Curve, Surface, Model, Point } from '../types.js';
import { KernelError } from '../core/barocss-error.js';
export declare const CubicCurveAffinePlaneIntersectionDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly BUDGET: "BUDGET";
    readonly NATIVE: "NATIVE";
    readonly BINDING: "BINDING";
    readonly OWNED: "OWNED";
}>;
export type CubicCurveAffinePlaneIntersectionDiagnosticCode = typeof CubicCurveAffinePlaneIntersectionDiagnosticCode[keyof typeof CubicCurveAffinePlaneIntersectionDiagnosticCode];
export declare class CubicCurveAffinePlaneIntersectionError extends KernelError {
    readonly code: CubicCurveAffinePlaneIntersectionDiagnosticCode;
    constructor(code: CubicCurveAffinePlaneIntersectionDiagnosticCode, detail: string, cause?: unknown);
}
export interface CubicCurveAffinePlaneIntersectionOptions {
    evaluationId: string;
    pointEventIds: string[];
}
export type CubicCurvePlaneRootEvidence = CubicBernsteinRootEvidence;
export interface CubicCurveAffinePlaneIntersectionReport {
    family: 'own-cubic-bezier-curve-affine-plane-surface';
    dto: {
        schema: 'barocss-native-cubic-curve-plane-intersection';
        version: 0;
        lengthUnit: 'mm';
        frame: 'raw-authored-xyz-no-axis-conversion';
        representation: 'original-cubic-curve-plane-events-not-sewn-topology';
    };
    kind: CubicCurveAffinePlaneIntersectionResult['kind'];
    evaluationId: string;
    curveId: string;
    planeId: string;
    curveDomain: [number, number];
    curveDegree: 3;
    planeAxes: CurveAffinePlaneAxes;
    rootEvidence: CubicCurvePlaneRootEvidence;
    supportEventCount: number;
    finiteEventCount: number;
    outsideEventCount: number;
    coincident: {
        support: boolean;
        finiteContainment: 'control-hull-contained' | 'not-proven' | 'not-applicable';
        controlPoleUV: Point[];
    };
    authority: 'original-cubic-homogeneous-coefficients-and-original-native-geometry';
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    inputProfile: {
        curveDegree: 3;
        originalCurvePoles: 4;
        originalCurveKnots: 8;
        originalNonzeroSpans: 1;
        planeDegree: [1, 1];
        planeControlGrid: [2, 2];
        planeEqualWeights: true;
        coordinateAbsMM: 10000;
        weightRange: [1e-6, 1e6];
        positive: true;
        clamped: true;
        nonperiodic: true;
    };
    numericPolicy: {
        parameterWidthTarget: 1e-12;
        normalizedParameterWidthTarget: number;
        maximumRootSteps: 64;
        maximumScalarEvaluations: 1024;
        pointBindingComparisonMM: number;
        criticalBracketPolicy: 'derivative-control-hull-lipschitz-plus64-epsilon-exclusion';
        nearZeroMidpointPolicy: 'represented-quarter-points-with-safely-opposite-ordered-signs-or-refusal';
        uvBoundaryPolicy: 'original-estimate-and-bracket-domain-agreement-no-clamp';
        gramPolicy: '64-epsilon-scaled-determinant-refusal';
        exactParameterDedupOnly: true;
    };
    quality: {
        scalarScaleDerivedOnly: true;
        originalGeometryBitsPreserved: true;
        derivativeSolver: 'actual-existing-quadratic-bernstein-root-solver';
        simpleCrossingsOnlyInInterior: true;
        interiorTangentOrStationaryAmbiguity: 'atomic-refusal';
        localNumericalEvidenceOnly: true;
        globalBinary64ErrorCertified: false;
        manufacturingToleranceCertified: false;
        coincidenceClippingCertified: false;
        ownership: 'copied-cpu-data-gc-no-renderer-resources';
    };
    budgetFailure: 'atomic-refusal-no-partial-result';
    limits: {
        maximumEvents: 3;
        maximumDerivativeRoots: 2;
        maximumMonotoneIntervals: 3;
        maximumCriticalBrackets: 2;
        maximumRootSteps: 64;
        maximumScalarEvaluations: 1024;
        inputValues: 4096;
        inputDepth: 8;
        inputArrayElements: 64;
        inputRecordFields: 16;
        inputStringCharacters: 128;
        snapshotValues: 262144;
        snapshotDepth: 32;
        arrayElements: 4096;
        recordFields: 64;
        sourceStringCharacters: 262144;
        authoredIdCharacters: 48;
    };
}
export interface CubicCurveAffinePlaneIntersectionResult {
    kind: BezierCurveAffinePlaneIntersectionResult['kind'];
    curve: Curve;
    plane: Surface;
    options: CubicCurveAffinePlaneIntersectionOptions;
    source: string;
    sourceVersion: 0;
    model: Model;
    events: BezierCurvePlanePointEvent[];
    report: CubicCurveAffinePlaneIntersectionReport;
}
/** Own bounded cubic support roots with the exact shared original Curve/Plane binding policy. */
export declare function intersectCubicBezierCurveWithAffinePlaneSurface(curveInput: Curve, planeInput: Surface, inputOptions: CubicCurveAffinePlaneIntersectionOptions): CubicCurveAffinePlaneIntersectionResult;
/** Rebuild every original source/coefficient/scalar/root/point/UV/bracket/ID/report field. */
export declare function validateCubicBezierCurveAffinePlaneIntersection(input: CubicCurveAffinePlaneIntersectionResult): CubicCurveAffinePlaneIntersectionReport;
