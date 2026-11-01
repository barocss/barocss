import type { XYCirclePrismShellBundle } from '../xy-circle-prism-shell.js';
import type { CurveD1Result, SurfaceD1Result } from '../core/derivatives.js';
import type { Curve, Surface, Model, Point } from '../types.js';
export interface XYCirclePrismPlaneIntersectionOptions {
    curveId: string;
    planeId: string;
    planePcurveId: string;
    wallPcurveId: string;
    evaluationId: string;
    slopeX: number;
    slopeY: number;
    zInterceptMM: number;
}
export interface XYCirclePrismPlaneBindings {
    coordinateSystem: 'uv';
    domain: [number, number];
    evaluationId: string;
    plane: {
        surfaceId: string;
        curve: Curve;
    };
    wall: {
        surfaceId: string;
        curve: Curve;
    };
}
export type PlaneCylinderCurveD1State = {
    status: 'evaluated';
    value: CurveD1Result;
} | {
    status: 'native-refused';
    reason: string;
};
export type PlaneCylinderSurfaceD1State = {
    status: 'evaluated';
    value: SurfaceD1Result;
} | {
    status: 'native-refused';
    reason: string;
};
export interface PlaneCylinderIntersectionObservation {
    parameter: number;
    pointMM: Point;
    planeUV: Point;
    wallUV: Point;
    planePointMM: Point;
    wallPointMM: Point;
    planeResidualMM: number;
    wallResidualMM: number;
    wallParameterResidual: number;
    d1: {
        section: PlaneCylinderCurveD1State;
        planePcurve: PlaneCylinderCurveD1State;
        wallPcurve: PlaneCylinderCurveD1State;
        planeSurface: PlaneCylinderSurfaceD1State;
        wallSurface: PlaneCylinderSurfaceD1State;
        mappedPlaneTangent?: Point;
        mappedWallTangent?: Point;
        planeTangentResidual?: number;
        wallTangentResidual?: number;
    };
}
export interface PlaneCylinderHomogeneousSpan {
    domain: [number, number];
    originalPoleIndices: [number, number, number];
    outputPoleIndices: [number, number, number, number];
    denominatorCoefficients: number[];
    uNumeratorCoefficients: number[];
    vNumeratorCoefficients: number[];
}
export interface XYCirclePrismPlaneIntersectionReport {
    family: 'own-transverse-affine-plane-circle-cylinder';
    classification: 'full-closed-section' | 'control-hull-disjoint-above' | 'control-hull-disjoint-below';
    evaluationId: string;
    sourceCircleId: string;
    wallSurfaceId: string;
    planeSurfaceId: string;
    axialControlHullMM: [number, number];
    axialWallDomainMM: [number, number];
    hullSemantics: 'positive-weight-native-section-control-hull-sufficient-bound';
    originalDomain: [number, number];
    planeSupportMM: {
        minXY: [number, number];
        maxXY: [number, number];
        representedSpansMM: [number, number];
    };
    homogeneousSpans: PlaneCylinderHomogeneousSpan[];
    observations: PlaneCylinderIntersectionObservation[];
    seam?: {
        startXYZ: Point;
        endXYZ: Point;
        startWallUV: Point;
        endWallUV: Point;
        closed: true;
        distinctUVEndpoints: true;
    };
    periodic: false;
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    limits: {
        slopes: [number, number];
        interceptMM: [number, number];
        nativeResidualObservationMM: number;
        wallParameterObservation: number;
        snapshotValues: number;
        snapshotDepth: number;
    };
}
interface PlaneCylinderResultBase {
    shell: XYCirclePrismShellBundle;
    options: XYCirclePrismPlaneIntersectionOptions;
    plane: Surface;
    wallSurface: Surface;
    source: string;
    sourceVersion: 0;
    model: Model;
    report: XYCirclePrismPlaneIntersectionReport;
}
export interface XYCirclePrismPlaneSection extends PlaneCylinderResultBase {
    kind: 'intersection';
    curve: Curve;
    bindings: XYCirclePrismPlaneBindings;
}
export interface XYCirclePrismPlaneDisjoint extends PlaneCylinderResultBase {
    kind: 'disjoint';
}
export type XYCirclePrismPlaneIntersectionResult = XYCirclePrismPlaneSection | XYCirclePrismPlaneDisjoint;
/** Supported full interior sections only. Mixed/touching hull bounds never imply disjointness. */
export declare function intersectXYCirclePrismWallWithPlane(input: XYCirclePrismShellBundle, inputOptions: XYCirclePrismPlaneIntersectionOptions): XYCirclePrismPlaneIntersectionResult;
/** Reconstruct the bounded native result; reject altered UV, geometry, context, source or report data. */
export declare function validateXYCirclePrismPlaneIntersection(input: XYCirclePrismPlaneIntersectionResult): XYCirclePrismPlaneIntersectionReport;
export {};
