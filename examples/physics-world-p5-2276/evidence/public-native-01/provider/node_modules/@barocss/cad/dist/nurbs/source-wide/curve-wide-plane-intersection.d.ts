import type { CurveBezierSpanExtractionResult } from '../curves/curve-bezier-spans.js';
import type { CurveAffinePlaneAxes } from '../../intersect/own-curve-plane-intersection.js';
import type { CurveAffinePlaneSpan, CurvePlanePointEvent, CurveAffinePlaneIntersectionReport, CurveAffinePlaneIntersectionResult } from '../../intersect/own-multispan-curve-plane.js';
import type { Curve, Surface, Model } from '../../types.js';
import { KernelError } from '../../core/barocss-error.js';
export declare const WideCurveAffinePlaneIntersectionDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly SPAN: "SPAN";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly BUDGET: "BUDGET";
    readonly NATIVE: "NATIVE";
    readonly BINDING: "BINDING";
    readonly OWNED: "OWNED";
}>;
export type WideCurveAffinePlaneIntersectionDiagnosticCode = typeof WideCurveAffinePlaneIntersectionDiagnosticCode[keyof typeof WideCurveAffinePlaneIntersectionDiagnosticCode];
export declare class WideCurveAffinePlaneIntersectionError extends KernelError {
    readonly code: WideCurveAffinePlaneIntersectionDiagnosticCode;
    constructor(code: WideCurveAffinePlaneIntersectionDiagnosticCode, detail: string, cause?: unknown);
}
export interface WideCurveAffinePlaneIntersectionOptions {
    evaluationId: string;
    resultIdPrefix: string;
    pointEventIds: string[];
}
export interface WideCurveAffinePlaneIntersectionReport {
    family: 'own-wide-multispan-curve-affine-plane-surface';
    dto: {
        schema: 'barocss-native-wide-curve-plane-intersection';
        version: 0;
        lengthUnit: 'mm';
        frame: 'authored-xyz-no-axis-conversion';
        representation: 'native-curve-plane-events-not-sewn-topology';
    };
    kind: WideCurveAffinePlaneIntersectionResult['kind'];
    evaluationId: string;
    curveId: string;
    planeId: string;
    curveDomain: [number, number];
    curveDegree: 1 | 2;
    planeAxes: CurveAffinePlaneAxes;
    spanCount: number;
    contributionCount: number;
    supportEventCount: number;
    finiteEventCount: number;
    outsideEventCount: number;
    coincidentSpans: CurveAffinePlaneIntersectionReport['coincidentSpans'];
    supportDisjointSpanIds: string[];
    originalGuardedParameters: number[];
    privateIdAllocationAttempts: number;
    authority: 'original-complete-curve-coefficients';
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    inputProfile: {
        degreeRange: [1, 2];
        poleRange: [2, 64];
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
        primitive: 'actual-public-bezier-curve-affine-plane-intersection';
        assembly: 'shared-whole-original-curve-event-uv-bracket-assembly';
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
        maximumLocalBezierPoles: 3;
        maximumContributions: 128;
        maximumEvents: 128;
        maximumRootSteps: 64;
        maximumPrivateIdAllocationAttempts: 512;
        reservedExtractionRoleIds: 65;
        inputValues: 32768;
        inputDepth: 8;
        inputArrayElements: 128;
        inputRecordFields: 16;
        inputStringCharacters: 128;
        snapshotValues: 1048576;
        snapshotDepth: 40;
        arrayElements: 4096;
        recordFields: 64;
        sourceStringCharacters: 262144;
        authoredIdCharacters: 48;
        resultIdPrefixCharacters: 20;
    };
}
export interface WideCurveAffinePlaneIntersectionResult {
    kind: CurveAffinePlaneIntersectionResult['kind'];
    curve: Curve;
    plane: Surface;
    options: WideCurveAffinePlaneIntersectionOptions;
    source: string;
    sourceVersion: 0;
    model: Model;
    extraction: CurveBezierSpanExtractionResult;
    spans: CurveAffinePlaneSpan[];
    events: CurvePlanePointEvent[];
    report: WideCurveAffinePlaneIntersectionReport;
}
/** Intersect actual analytic Bezier spans while retaining the whole original wide Curve as authority. */
export declare function intersectCurveWideWithAffinePlaneSurface(curveInput: Curve, planeInput: Surface, optionInput: WideCurveAffinePlaneIntersectionOptions): WideCurveAffinePlaneIntersectionResult;
/** Rebuild original sources, analytic extraction, all actual primitive spans and whole-original events. */
export declare function validateWideCurveAffinePlaneIntersection(input: WideCurveAffinePlaneIntersectionResult): WideCurveAffinePlaneIntersectionReport;
