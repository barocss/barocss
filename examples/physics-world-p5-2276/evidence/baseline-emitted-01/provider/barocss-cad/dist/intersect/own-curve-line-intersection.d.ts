import type { CurveParameterSplitProvenance } from '../nurbs/curves/curve-parameter-split.js';
import type { CurveAffinePlaneIntersectionResult } from './own-multispan-curve-plane.js';
import type { CurveAffinePlaneAxes, CurvePlaneD1State } from './own-curve-plane-intersection.js';
import type { PlaneClipUVSplitProvenance } from './own-coincident-plane-clip.js';
import type { HomogeneousBernsteinEquation } from './own-homogeneous-bernstein-roots.js';
import type { Curve, Surface, Model, Point } from '../types.js';
export interface CoplanarCurveLineIntersectionOptions {
    evaluationId: string;
    derivedSpanIds: string[];
    pointEventIds: string[];
    overlapIds: string[];
    spanBindingIds: string[];
    overlapBindingIds: string[];
    boundaryContactIds: string[];
}
export type CurveLineUVSplitProvenance = PlaneClipUVSplitProvenance;
export interface CurveLineRootContribution {
    spanId: string;
    parameter: number;
    bracket: [number, number];
    normalizedParameter: number;
    normalizedBracket: [number, number];
    iterations: number;
    touch: boolean;
    spanPointMM: Point;
    originalPointMM: Point;
    pointDifferenceMM: number;
    spanCurveD1: CurvePlaneD1State;
    originalCurveD1: CurvePlaneD1State;
}
export interface CurveLineBinding {
    parameter: number;
    pointMM: Point;
    planeUV: Point;
    lineCoordinate: number;
    lineParameter: number;
    segmentDomainAdmitted: boolean;
    planeDomainAdmitted: boolean;
    linePointMM: Point | null;
    planePointMM: Point | null;
    lineBindingDifferenceMM: number | null;
    surfaceBindingDifferenceMM: number | null;
    dimensionlessSupportResidual: number;
    originalCurveD1: CurvePlaneD1State;
    lineD1: CurvePlaneD1State | null;
}
export interface CurveLineSideObservation {
    spanId: string;
    side: 'lower' | 'upper';
    parameter: number;
    signedLineValue: number;
    pointMM: Point;
    originalCurveD1: CurvePlaneD1State;
    spanCurveD1: CurvePlaneD1State;
}
export interface CurveLinePointEvent extends CurveLineBinding {
    eventId: string;
    kind: 'knot-event' | 'span-root' | 'endpoint';
    contributions: CurveLineRootContribution[];
    sideObservations: CurveLineSideObservation[];
}
export interface CurveLineBoundaryContribution extends CurveLineRootContribution {
    boundary: 'line-start' | 'line-end';
    dimensionlessBoundaryResidual: number;
}
export interface CurveLineOverlapContact extends CurveLineBinding {
    contactId: string;
    contributions: CurveLineBoundaryContribution[];
}
export interface CurveLineSpan {
    spanId: string;
    domain: [number, number];
    uvCurve: Curve;
    coordinateSystem: 'uv';
    equation: HomogeneousBernsteinEquation;
    collinearSupport: boolean;
    boundaryEquations: {
        boundary: 'line-start' | 'line-end';
        equation: HomogeneousBernsteinEquation;
    }[];
    monotonicity: null | {
        orientation: 'forward' | 'reverse';
        derivativeNumeratorBernstein: number[];
    };
    outsideIntervals: [number, number][];
}
export interface CurveLineEndpointApproximation {
    parameter: number;
    rootEstimate: number;
    parameterOffset: number;
    bracket: [number, number];
    dimensionlessBoundaryResiduals: number[];
    policy: 'represented-inward-root-bracket-endpoint';
}
export interface CurveLineOverlapObservation extends CurveLineBinding {
    piecePointMM: Point;
    pieceCurveD1: CurvePlaneD1State;
    originalPieceDifferenceMM: number;
    piecePlaneUV: Point;
    dimensionlessBindingDifference: number;
}
export interface CurveLineOverlapPiece {
    overlapId: string;
    spanId: string;
    domain: [number, number];
    curve: Curve;
    uvCurve: Curve;
    coordinateSystem: 'uv';
    lineRange: [number, number];
    lineCoordinateRange: [number, number];
    orientation: 'forward' | 'reverse';
    bindings: CurveLineOverlapObservation[];
    endpointApproximations: [CurveLineEndpointApproximation | null, CurveLineEndpointApproximation | null];
    provenance: {
        xyz: CurveParameterSplitProvenance[];
        uv: CurveLineUVSplitProvenance[];
    };
    source: string;
    sourceVersion: 0;
    model: Model;
}
export interface CoplanarCurveLineIntersectionReport {
    family: 'own-coplanar-curve-finite-line-intersection';
    kind: CoplanarCurveLineIntersectionResult['kind'];
    evaluationId: string;
    curveId: string;
    lineId: string;
    planeId: string;
    curveDomain: [number, number];
    lineDomain: [number, number];
    planeAxes: CurveAffinePlaneAxes;
    lineUV: {
        start: Point;
        end: Point;
        direction: Point;
        dominantAxis: 0 | 1;
    };
    spanCount: number;
    pointEventCount: number;
    finitePointEventCount: number;
    outsidePointEventCount: number;
    overlapCount: number;
    boundaryContributionCount: number;
    overlapContactCount: number;
    isolatedOverlapContactIds: string[];
    authority: 'original-complete-curve-and-line-coefficients';
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    numericPolicy: {
        parameterWidthTarget: 1e-12;
        maximumRootSteps: 64;
        pointBindingComparisonMM: number;
        exactParameterDedupOnly: true;
        uvBindingUnits: 'dimensionless-not-mm-source';
        orientationProof: 'positive-weight-rational-derivative-numerator-Bernstein-sign';
    };
    limits: {
        maximumSpans: 8;
        maximumPointEvents: 16;
        maximumOverlaps: 32;
        maximumBoundaryContributions: 64;
        maximumTemporaryPoles: 16;
        snapshotValues: 131072;
        snapshotDepth: 24;
        resultRecordFields: 32;
    };
}
export interface CoplanarCurveLineIntersectionResult {
    kind: 'points' | 'overlaps' | 'mixed' | 'outside-segment' | 'finite-disjoint' | 'isolated-contacts';
    curve: Curve;
    line: Curve;
    plane: Surface;
    options: CoplanarCurveLineIntersectionOptions;
    parent: CurveAffinePlaneIntersectionResult;
    source: string;
    sourceVersion: 0;
    model: Model;
    spans: CurveLineSpan[];
    events: CurveLinePointEvent[];
    overlaps: CurveLineOverlapPiece[];
    overlapContacts: CurveLineOverlapContact[];
    report: CoplanarCurveLineIntersectionReport;
}
/** Actual coplanar rational spans against an original finite native Line Curve. */
export declare function intersectCoplanarCurveWithLineSegment(curveInput: Curve, lineInput: Curve, planeInput: Surface, inputOptions: CoplanarCurveLineIntersectionOptions): CoplanarCurveLineIntersectionResult;
/** Original coefficient/options rebuild; no supplied UV, line parameter or overlap cache adoption. */
export declare function validateCoplanarCurveLineIntersection(input: CoplanarCurveLineIntersectionResult): CoplanarCurveLineIntersectionReport;
