import type { CurveParameterSplitProvenance } from '../nurbs/curves/curve-parameter-split.js';
import type { CurveAffinePlaneIntersectionResult, CurvePlanePointEvent } from './own-multispan-curve-plane.js';
import type { CurvePlaneD1State } from './own-curve-plane-intersection.js';
import type { HomogeneousBernsteinEquation } from './own-homogeneous-bernstein-roots.js';
import type { Curve, Model, Point } from '../types.js';
export type PlaneClipBoundary = 'u-min' | 'u-max' | 'v-min' | 'v-max';
export interface CurvePlaneCoincidentClipOptions {
    evaluationId: string;
    pieceIds: string[];
    contactIds: string[];
    spanBindingIds: string[];
    pieceBindingIds: string[];
}
export interface PlaneClipBoundaryContribution {
    spanId: string;
    boundary: PlaneClipBoundary;
    parameter: number;
    normalizedParameter: number;
    bracket: [number, number];
    normalizedBracket: [number, number];
    iterations: number;
    touch: boolean;
    dimensionlessBoundaryResidual: number;
    spanPointMM: Point;
    originalPointMM: Point;
    originalSpanDifferenceMM: number;
    spanPlaneUV: Point;
    originalPlaneUV: Point;
    dimensionlessBindingDifference: number;
    spanCurveD1: CurvePlaneD1State;
}
export interface PlaneClipContact {
    contactId: string;
    parameter: number;
    pointMM: Point;
    planeUV: Point;
    finiteDomainAdmitted: boolean;
    planePointMM: Point | null;
    originalCurveD1: CurvePlaneD1State;
    supportResidualMM: number;
    contributions: PlaneClipBoundaryContribution[];
}
export interface PlaneClipSpan {
    spanId: string;
    domain: [number, number];
    uvCurve: Curve;
    coordinateSystem: 'uv';
    equations: {
        boundary: PlaneClipBoundary;
        equation: HomogeneousBernsteinEquation;
    }[];
    overlapBoundaries: PlaneClipBoundary[];
    outsideIntervals: [number, number][];
}
export interface PlaneClipEndpointApproximation {
    parameter: number;
    rootEstimate: number;
    parameterOffset: number;
    bracket: [number, number];
    policy: 'represented-inward-root-bracket-endpoint';
    dimensionlessBoundaryResiduals: {
        boundary: PlaneClipBoundary;
        residual: number;
    }[];
}
export interface PlaneClipBindingObservation {
    parameter: number;
    originalPointMM: Point;
    piecePointMM: Point;
    planeUV: Point;
    planePointMM: Point;
    originalPieceDifferenceMM: number;
    surfaceBindingDifferenceMM: number;
    originalPlaneUV: Point;
    dimensionlessBindingDifference: number;
    originalCurveD1: CurvePlaneD1State;
    pieceCurveD1: CurvePlaneD1State;
}
export interface PlaneClipUVSplitProvenance {
    sourceCurveId: string;
    parameter: number;
    firstRefinedKnotIndex: number;
    refinement: {
        kind: 'knot-insertion' | 'direct-copy';
        insertions: number;
    };
    lower: CurveParameterSplitProvenance['lower'];
    upper: CurveParameterSplitProvenance['upper'];
    shared: {
        refinedPoleIndex: number;
        lowerPoleIndex: number;
        upperPoleIndex: number;
        pointUV: Point;
        weight: number;
    };
}
export interface PlaneClipPiece {
    pieceId: string;
    spanId: string;
    domain: [number, number];
    curve: Curve;
    uvCurve: Curve;
    coordinateSystem: 'uv';
    bindings: PlaneClipBindingObservation[];
    endpointApproximations: [PlaneClipEndpointApproximation | null, PlaneClipEndpointApproximation | null];
    provenance: {
        xyz: CurveParameterSplitProvenance[];
        uv: PlaneClipUVSplitProvenance[];
    };
    overlapBoundaries: PlaneClipBoundary[];
    source: string;
    sourceVersion: 0;
    model: Model;
}
export interface CurvePlaneCoincidentClipReport {
    family: 'own-coincident-curve-finite-affine-plane-clip';
    kind: CurvePlaneCoincidentClipResult['kind'];
    evaluationId: string;
    originalCurveId: string;
    planeId: string;
    parentEvaluationId: string;
    coincidentSpanCount: number;
    pieceCount: number;
    contactCount: number;
    boundaryContributionCount: number;
    isolatedContactIds: string[];
    referencedEventIds: string[];
    outsideIntervalCount: number;
    authority: 'original-complete-curve-coefficients';
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    numericPolicy: {
        parameterWidthTarget: 1e-12;
        maximumRootSteps: 64;
        pointBindingComparisonMM: 1e-7;
        exactParameterDedupOnly: true;
        intervalClassification: 'all-native-boundary-roots-and-original-midpoint';
        uvBindingUnits: 'dimensionless-not-mm-source';
        uvNumericBounds: 'inherited-native-curve-coefficient-split-bounds';
    };
    limits: {
        maximumPieces: 32;
        maximumBoundaryContributions: 64;
        maximumSpans: 8;
        maximumTemporaryPoles: 16;
        snapshotValues: 131072;
        snapshotDepth: 24;
        resultRecordFields: 32;
    };
}
export interface CurvePlaneCoincidentClipResult {
    kind: 'pieces' | 'finite-disjoint' | 'isolated-contacts' | 'overlap-boundary' | 'mixed' | 'no-coincident-spans';
    parent: CurveAffinePlaneIntersectionResult;
    options: CurvePlaneCoincidentClipOptions;
    source: string;
    sourceVersion: 0;
    model: Model;
    spans: PlaneClipSpan[];
    contacts: PlaneClipContact[];
    pieces: PlaneClipPiece[];
    referencedEvents: CurvePlanePointEvent[];
    report: CurvePlaneCoincidentClipReport;
}
/** Clip actual coincident spans; UV coefficients remain dimensionless binding artifacts. */
export declare function clipCurvePlaneCoincidentIntervals(parentInput: CurveAffinePlaneIntersectionResult, inputOptions: CurvePlaneCoincidentClipOptions): CurvePlaneCoincidentClipResult;
/** Rebuild the actual parent and every accepted interval/UV/contact/source binding. */
export declare function validateCurvePlaneCoincidentClip(input: CurvePlaneCoincidentClipResult): CurvePlaneCoincidentClipReport;
