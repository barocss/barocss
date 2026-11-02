import type { CurveBezierSpanExtractionResult } from '../curves/curve-bezier-spans.js';
import type { CubicCurveAffinePlaneIntersectionResult } from '../../intersect/own-cubic-curve-plane-intersection.js';
import type { CurvePlanePointEvent, CurveAffinePlaneIntersectionReport, CurveAffinePlaneIntersectionResult } from '../../intersect/own-multispan-curve-plane.js';
import type { CurveAffinePlaneAxes } from '../../intersect/own-curve-plane-intersection.js';
import type { Curve, Surface, Model } from '../../types.js';
import { KernelError } from '../../core/barocss-error.js';
export declare const WideCubicCurveAffinePlaneIntersectionDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly SPAN: "SPAN";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly BUDGET: "BUDGET";
    readonly NATIVE: "NATIVE";
    readonly BINDING: "BINDING";
    readonly OWNED: "OWNED";
}>;
export type WideCubicCurveAffinePlaneIntersectionDiagnosticCode = typeof WideCubicCurveAffinePlaneIntersectionDiagnosticCode[keyof typeof WideCubicCurveAffinePlaneIntersectionDiagnosticCode];
export declare class WideCubicCurveAffinePlaneIntersectionError extends KernelError {
    readonly code: WideCubicCurveAffinePlaneIntersectionDiagnosticCode;
    constructor(code: WideCubicCurveAffinePlaneIntersectionDiagnosticCode, detail: string, cause?: unknown);
}
export interface WideCubicCurveAffinePlaneIntersectionOptions {
    evaluationId: string;
    resultIdPrefix: string;
    pointEventIds: string[];
}
export interface WideCubicCurveAffinePlaneSpan {
    spanId: string;
    spanIndex: number;
    domain: [number, number];
    curve: Curve;
    intersection: CubicCurveAffinePlaneIntersectionResult;
    source: string;
    sourceVersion: 0;
    model: Model;
}
export interface WideCubicCurveAffinePlaneIntersectionReport {
    family: 'own-wide-cubic-curve-affine-plane-surface';
    dto: {
        schema: 'barocss-native-wide-cubic-curve-plane-intersection';
        version: 0;
        lengthUnit: 'mm';
        frame: 'raw-authored-xyz-no-axis-conversion';
        representation: 'original-wide-cubic-curve-plane-events-not-sewn-topology';
    };
    kind: WideCubicCurveAffinePlaneIntersectionResult['kind'];
    evaluationId: string;
    curveId: string;
    planeId: string;
    curveDomain: [number, number];
    curveDegree: 3;
    planeAxes: CurveAffinePlaneAxes;
    spanCount: number;
    primitiveCallCount: number;
    cubicScalarEvaluationCount: number;
    contributionCount: number;
    supportEventCount: number;
    finiteEventCount: number;
    outsideEventCount: number;
    derivativeSearchCounts: {
        executed: number;
        notRequiredCoincident: number;
        notRequiredStrictCubicSignExclusion: number;
    };
    strictSignExcludedSpanIds: string[];
    coincidentSpans: CurveAffinePlaneIntersectionReport['coincidentSpans'];
    supportDisjointSpanIds: string[];
    originalGuardedParameters: number[];
    privateIdAllocationAttempts: number;
    authority: 'original-complete-cubic-curve-coefficients';
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    inputProfile: {
        curveDegree: 3;
        poleRange: [4, 64];
        maximumKnots: 70;
        maximumNonzeroSpans: 64;
        weightRange: [1e-6, 1e6];
        coordinateAbsMM: 10000;
        clamped: true;
        nonperiodic: true;
        planeDegree: [1, 1];
        planeControlGrid: [2, 2];
        planeEqualWeights: true;
        planeAffine: true;
    };
    numericPolicy: CurveAffinePlaneIntersectionReport['numericPolicy'];
    quality: {
        extraction: 'actual-public-native-bezier-span-extraction';
        primitive: 'actual-public-cubic-bezier-curve-plane-intersection';
        assembly: 'shared-whole-original-curve-event-uv-bracket-assembly';
        localUncertainty: 'atomic-refusal';
        derivativeSearchEvidence: 'per-span-executed-or-explicitly-not-required';
        globalBinary64ErrorCertified: false;
        manufacturingToleranceCertified: false;
        coincidenceClippingCertified: false;
        ownership: 'copied-cpu-data-gc-no-renderer-resources';
    };
    budgetFailure: 'atomic-refusal-no-partial-result';
    limits: {
        maximumOriginalPoles: 64;
        maximumOriginalKnots: 70;
        maximumSpans: 64;
        maximumLocalBezierPoles: 4;
        maximumContributions: 192;
        maximumEvents: 192;
        maximumPrimitiveCalls: 64;
        maximumScalarEvaluations: 65536;
        maximumEventsPerPrimitive: 3;
        maximumDerivativeRootsPerPrimitive: 2;
        maximumRootSteps: 64;
        maximumScalarEvaluationsPerPrimitive: 1024;
        maximumPrivateIdAllocationAttempts: 1024;
        privateRolesPerSpan: 4;
        reservedExtractionRoleIds: 65;
        inputValues: 32768;
        inputDepth: 8;
        inputArrayElements: 256;
        inputRecordFields: 16;
        inputStringCharacters: 128;
        snapshotValues: 4194304;
        snapshotDepth: 48;
        arrayElements: 4096;
        recordFields: 64;
        sourceStringCharacters: 262144;
        authoredIdCharacters: 48;
        resultIdPrefixCharacters: 20;
    };
}
export interface WideCubicCurveAffinePlaneIntersectionResult {
    kind: CurveAffinePlaneIntersectionResult['kind'];
    curve: Curve;
    plane: Surface;
    options: WideCubicCurveAffinePlaneIntersectionOptions;
    source: string;
    sourceVersion: 0;
    model: Model;
    extraction: CurveBezierSpanExtractionResult;
    spans: WideCubicCurveAffinePlaneSpan[];
    events: CurvePlanePointEvent[];
    report: WideCubicCurveAffinePlaneIntersectionReport;
}
/** Compose actual analytic cubic spans and actual cubic primitives with whole-original event binding. */
export declare function intersectCubicCurveWideWithAffinePlaneSurface(curveInput: Curve, planeInput: Surface, optionInput: WideCubicCurveAffinePlaneIntersectionOptions): WideCubicCurveAffinePlaneIntersectionResult;
/** Rebuild original geometry, actual analytic/cubic spans and all whole-original event and work evidence. */
export declare function validateWideCubicCurveAffinePlaneIntersection(input: WideCubicCurveAffinePlaneIntersectionResult): WideCubicCurveAffinePlaneIntersectionReport;
