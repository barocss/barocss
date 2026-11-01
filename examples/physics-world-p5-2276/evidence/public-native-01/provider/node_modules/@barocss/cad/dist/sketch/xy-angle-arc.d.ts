import type { CurveD1Result } from '../core/derivatives.js';
import type { Curve, Model, Point } from '../types.js';
import type { XYPoint } from './xy-profile.js';
import { KernelError } from '../core/barocss-error.js';
export declare const XYAngleArcDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly UNIT: "UNIT";
    readonly RANGE: "RANGE";
    readonly ARITHMETIC: "ARITHMETIC";
    readonly NATIVE: "NATIVE";
    readonly SOURCE: "SOURCE";
    readonly BUDGET: "BUDGET";
    readonly OWNED: "OWNED";
}>;
export type XYAngleArcDiagnosticCode = typeof XYAngleArcDiagnosticCode[keyof typeof XYAngleArcDiagnosticCode];
export declare class XYAngleArcError extends KernelError {
    readonly code: XYAngleArcDiagnosticCode;
    constructor(code: XYAngleArcDiagnosticCode, detail: string, cause?: unknown);
}
export interface XYAngleArcRequest {
    id: string;
    lengthUnit: 'mm';
    angleUnit: 'rad';
    centerMM: XYPoint;
    radiusMM: number;
    startAngleRad: number;
    sweepAngleRad: number;
}
type Span = {
    index: number;
    startAngleRad: number;
    endAngleRad: number;
    midAngleRad: number;
    middleWeight: number;
    nativeInterval: [number, number];
    controlPointIndices: [number, number, number];
};
type D1 = {
    status: 'evaluated';
    value: CurveD1Result;
} | {
    status: 'native-refused';
    reason: string;
    nativeErrorName: string;
};
type Observation = {
    parameter: number;
    spanIndex: number;
    localParameter: number;
    analyticAngleRad: number;
    analyticPointMM: Point;
    pointMM: Point;
    pointDifferenceMM: number;
    radialResidualMM: number;
    d1: D1;
    derivativeDifferenceMM: number | null;
    tangentRadialResidual: number | null;
};
export interface XYAngleArcReport {
    schema: 'barocss-xy-angle-arc-evaluation';
    version: 0;
    curveId: string;
    lengthUnit: 'mm';
    angleUnit: 'rad';
    direction: 'counter-clockwise' | 'clockwise';
    spanCount: number;
    controlPointCount: number;
    nativeDomain: [number, number];
    endpointClosed: boolean;
    periodic: false;
    angleBreaksRad: number[];
    spans: Span[];
    observations: Observation[];
    observationCount: number;
    derivativeEvaluationCount: number;
    derivativeRefusalCount: number;
    maximumPointDifferenceMM: number;
    maximumRadialResidualMM: number;
    maximumDerivativeDifferenceMM: number;
    maximumTangentRadialResidual: number;
    directCounts: {
        sourceCompilationCount: 1;
        curvePointEvaluationCount: number;
        curveDerivativeEvaluationCount: number;
    };
    quality: {
        authoredAngleIntentRetained: true;
        nativeParameterIsAngle: false;
        sampledAnalyticAgreementAccepted: true;
        globalExactCircleCertified: false;
        periodicContinuityCertified: false;
        regionCertified: false;
        solid: false;
        ownership: 'independent-copied-cpu-data-gc';
    };
    limits: {
        idCharacters: 48;
        coordinateAbsMM: 10000;
        minimumRadiusMM: 0.001;
        maximumRadiusMM: 10000;
        maximumStartAbsRad: number;
        minimumSweepAbsRad: 0.000001;
        maximumSweepAbsRad: number;
        maximumSpans: 4;
        maximumPoles: 9;
        maximumObservations: 17;
        sourceUTF16: 262144;
        sourceUTF8: 262144;
        pointToleranceMM: 0.0000001;
        derivativeToleranceMM: 0.0000001;
        tangentTolerance: 0.0000001;
    };
    trigPolicy: 'exact-authored-cardinal-quarter-lookup-otherwise-native-math-sin-cos';
    closurePolicy: 'exact-full-turn-copies-first-endpoint-bits-otherwise-generated-endpoint';
    workScope: 'direct-native-angle-arc-construction-and-observations';
    budgetFailure: 'atomic-no-partial-native-angle-arc';
}
export interface XYAngleArcResult {
    request: XYAngleArcRequest;
    source: string;
    sourceVersion: 0;
    model: Model;
    curve: Curve;
    report: XYAngleArcReport;
}
/** Construct a bounded rational quadratic arc from original signed angular intent. */
export declare function buildXYAngleArc(input: XYAngleArcRequest): XYAngleArcResult;
/** Rebuild the whole native/source operation once and compare every retained bit. */
export declare function validateXYAngleArc(input: XYAngleArcResult): XYAngleArcReport;
export {};
