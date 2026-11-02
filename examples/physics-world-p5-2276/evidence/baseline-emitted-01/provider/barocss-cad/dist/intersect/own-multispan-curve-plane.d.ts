import type { CurveParameterSplitResult } from '../nurbs/curves/curve-parameter-split.js';
import type { BezierCurveAffinePlaneIntersectionResult, BezierCurvePlanePointEvent, CurveAffinePlaneAxes, CurvePlaneD1State } from './own-curve-plane-intersection.js';
import type { Curve, Surface, Model, Point } from '../types.js';
export interface CurveAffinePlaneIntersectionOptions {
    evaluationId: string;
    derivedSpanIds: string[];
    pointEventIds: string[];
}
export interface CurveAffinePlaneSpan {
    spanId: string;
    spanIndex: number;
    domain: [number, number];
    curve: Curve;
    intersection: BezierCurveAffinePlaneIntersectionResult;
    source: string;
    sourceVersion: 0;
    model: Model;
}
/** Internal structural span needed by unchanged whole-original event assembly. */
export interface CurvePlaneEventAssemblySpan {
    spanId: string;
    spanIndex: number;
    domain: [number, number];
    curve: Curve;
    intersection: {
        kind: BezierCurveAffinePlaneIntersectionResult['kind'];
        events: BezierCurvePlanePointEvent[];
        report: {
            planeAxes: CurveAffinePlaneAxes;
            coincident: BezierCurveAffinePlaneIntersectionResult['report']['coincident'];
        };
    };
}
export interface CurvePlaneSpanContribution {
    spanId: string;
    spanIndex: number;
    event: BezierCurvePlanePointEvent;
    childPointMM: Point;
    originalPointMM: Point;
    pointDifferenceMM: number;
    childCurveD1: CurvePlaneD1State;
    originalCurveD1: CurvePlaneD1State;
    derivativeComparison: {
        status: 'compared';
        maximumAbsoluteDifference: number;
    } | {
        status: 'unavailable';
        reason: string;
    };
}
export interface CurvePlaneSideObservation {
    spanId: string;
    spanIndex: number;
    side: 'lower' | 'upper';
    parameter: number;
    pointMM: Point;
    childPointMM: Point;
    pointDifferenceMM: number;
    signedDistanceMM: number;
    originalCurveD1: CurvePlaneD1State;
    childCurveD1: CurvePlaneD1State;
}
export interface CurvePlanePointEvent {
    eventId: string;
    parameter: number;
    kind: 'knot-event' | 'span-root' | 'endpoint';
    pointMM: Point;
    planeUV: Point;
    planePointMM: Point | null;
    classification: 'finite-domain-admitted' | 'outside-domain';
    finiteDomainAdmitted: boolean;
    residualMM: number;
    originalCurveD1: CurvePlaneD1State;
    contributions: CurvePlaneSpanContribution[];
    sideObservations: CurvePlaneSideObservation[];
}
export interface CurveAffinePlaneIntersectionReport {
    family: 'own-multispan-curve-affine-plane-surface';
    kind: CurveAffinePlaneIntersectionResult['kind'];
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
    coincidentSpans: {
        spanId: string;
        domain: [number, number];
        finiteContainment: 'control-hull-contained' | 'finite-containment-not-proven';
    }[];
    supportDisjointSpanIds: string[];
    originalGuardedParameters: number[];
    authority: 'original-complete-curve-coefficients';
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    numericPolicy: {
        parameterWidthTarget: 1e-12;
        maximumRootSteps: 64;
        pointBindingComparisonMM: 1e-7;
        exactParameterDedupOnly: true;
        sideSampling: 'represented-midpoint-between-event-and-nearest-span-root-or-boundary';
        uvBoundaryPolicy: 'original-estimate-and-bracket-domain-agreement-no-clamp';
    };
    limits: {
        maximumOriginalPoles: 12;
        maximumSpans: 8;
        maximumTemporaryPoles: 16;
        maximumContributions: 32;
        maximumEvents: 16;
        snapshotValues: 131072;
        snapshotDepth: 24;
        resultRecordFields: 32;
        authoredIdCharacters: 48;
    };
}
export interface CurveAffinePlaneIntersectionResult {
    kind: 'isolated' | 'support-disjoint' | 'finite-disjoint' | 'coincident-spans' | 'mixed';
    curve: Curve;
    plane: Surface;
    options: CurveAffinePlaneIntersectionOptions;
    source: string;
    sourceVersion: 0;
    model: Model;
    extraction: {
        parameter: number;
        result: CurveParameterSplitResult;
    }[];
    spans: CurveAffinePlaneSpan[];
    events: CurvePlanePointEvent[];
    report: CurveAffinePlaneIntersectionReport;
}
/** Trusted shared whole-original event assembly; callers establish geometry and work bounds. */
export declare function assembleCurvePlaneEventsTrusted(c: Curve, p: Surface, spans: CurvePlaneEventAssemblySpan[], pointEventIds: string[], maximumContributions: number, maximumEvents: number): {
    axes: CurveAffinePlaneAxes;
    events: CurvePlanePointEvent[];
    contributionCount: number;
    coincidentSpans: CurveAffinePlaneIntersectionReport['coincidentSpans'];
    finiteCount: number;
    kind: CurveAffinePlaneIntersectionResult['kind'];
    originalGuardedParameters: number[];
};
/** Actual knot splits and actual Bezier intersections; the whole original Curve remains authority. */
export declare function intersectCurveWithAffinePlaneSurface(curveInput: Curve, planeInput: Surface, inputOptions: CurveAffinePlaneIntersectionOptions): CurveAffinePlaneIntersectionResult;
/** Rebuild from owned original coefficients/options, including all extraction and contribution data. */
export declare function validateCurveAffinePlaneIntersection(input: CurveAffinePlaneIntersectionResult): CurveAffinePlaneIntersectionReport;
