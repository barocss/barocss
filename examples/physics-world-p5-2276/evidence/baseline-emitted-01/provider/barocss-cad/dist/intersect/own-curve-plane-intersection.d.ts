import type { HomogeneousBernsteinEquation, HomogeneousBernsteinRoot } from './own-homogeneous-bernstein-roots.js';
import type { CurveD1Result } from '../core/derivatives.js';
import type { Curve, Surface, Model, Point } from '../types.js';
export interface BezierCurveAffinePlaneIntersectionOptions {
    evaluationId: string;
    pointEventIds: string[];
}
export interface CurveAffinePlaneAxes {
    originMM: Point;
    uDirectionMM: Point;
    vDirectionMM: Point;
    unitNormal: Point;
    gram: {
        uu: number;
        uv: number;
        vv: number;
        determinant: number;
        unsafeThreshold: number;
    };
    domains: {
        u: [number, number];
        v: [number, number];
    };
}
export type CurvePlaneD1State = {
    status: 'evaluated';
    value: CurveD1Result;
} | {
    status: 'native-refused';
    reason: string;
};
export interface BezierCurvePlanePointEvent {
    eventId: string;
    parameter: number;
    normalizedParameter: number;
    bracket: [number, number];
    normalizedBracket: [number, number];
    iterations: number;
    kind: 'crossing' | 'touch' | 'endpoint';
    rootTouch: boolean;
    pointMM: Point;
    planeUV: Point;
    planePointMM: Point | null;
    residualMM: number;
    classification: 'finite-domain-admitted' | 'outside-domain';
    finiteDomainAdmitted: boolean;
    sideObservations: {
        parameter: number;
        signedDistanceMM: number;
    }[];
    curveD1: CurvePlaneD1State;
    semantics: 'original-curve-point-at-numerical-root-not-projected-or-sewn';
}
export interface BezierCurveAffinePlaneIntersectionReport {
    family: 'own-bezier-curve-affine-plane-surface';
    kind: BezierCurveAffinePlaneIntersectionResult['kind'];
    evaluationId: string;
    curveId: string;
    planeId: string;
    curveDomain: [number, number];
    curveDegree: 1 | 2;
    planeAxes: CurveAffinePlaneAxes;
    equation: HomogeneousBernsteinEquation;
    supportEventCount: number;
    finiteEventCount: number;
    outsideEventCount: number;
    coincident: {
        support: boolean;
        finiteContainment: 'control-hull-contained' | 'not-proven' | 'not-applicable';
        controlPoleUV: Point[];
    };
    numericPolicy: {
        parameterWidthTarget: 1e-12;
        normalizedParameterWidthTarget: number;
        maximumRootSteps: 64;
        pointBindingComparisonMM: number;
        uvBoundaryPolicy: 'original-estimate-and-bracket-domain-agreement-no-clamp';
        gramPolicy: '64-epsilon-scaled-determinant-refusal';
        exactParameterDedupOnly: true;
    };
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    limits: {
        maximumEvents: 4;
        snapshotValues: 4096;
        snapshotDepth: 8;
        arrayElements: 64;
        recordFields: 16;
        authoredIdCharacters: 48;
    };
}
export interface BezierCurveAffinePlaneIntersectionResult {
    kind: 'isolated' | 'support-disjoint' | 'finite-disjoint' | 'coincident-support';
    curve: Curve;
    plane: Surface;
    options: BezierCurveAffinePlaneIntersectionOptions;
    source: string;
    sourceVersion: 0;
    model: Model;
    events: BezierCurvePlanePointEvent[];
    report: BezierCurveAffinePlaneIntersectionReport;
}
/** Trusted shared original affine-plane admission and axes; caller snapshots exact fields first. */
export declare function prepareCurvePlaneAxesTrusted(p: Surface): CurveAffinePlaneAxes;
/** Trusted original homogeneous plane projection; weights and coordinates are never normalized. */
export declare function curvePlaneCoefficientsTrusted(c: Curve, axes: CurveAffinePlaneAxes): number[];
/** Trusted shared binding of numerical roots to original native points/UV and unchanged bracket policy. */
export declare function bindCurvePlaneRootsTrusted(c: Curve, p: Surface, domain: [number, number], axes: CurveAffinePlaneAxes, roots: HomogeneousBernsteinRoot[], pointEventIds: string[]): BezierCurvePlanePointEvent[];
/** Trusted shared support/finite-containment classification; no coincident clipping is inferred. */
export declare function classifyCurvePlaneSupportTrusted(c: Curve, axes: CurveAffinePlaneAxes, coincident: boolean, events: BezierCurvePlanePointEvent[]): {
    controlPoleUV: Point[];
    contained: boolean;
    finiteCount: number;
    kind: BezierCurveAffinePlaneIntersectionResult['kind'];
};
/** Own homogeneous support roots; original Curve points are never projected/clamped. */
export declare function intersectBezierCurveWithAffinePlaneSurface(curveInput: Curve, planeInput: Surface, inputOptions: BezierCurveAffinePlaneIntersectionOptions): BezierCurveAffinePlaneIntersectionResult;
/** Original geometry/options rebuild; altered event/UV/bracket/source data refuses. */
export declare function validateBezierCurveAffinePlaneIntersection(input: BezierCurveAffinePlaneIntersectionResult): BezierCurveAffinePlaneIntersectionReport;
