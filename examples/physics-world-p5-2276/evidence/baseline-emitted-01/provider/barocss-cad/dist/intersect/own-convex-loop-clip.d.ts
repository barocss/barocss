import type { CurveParameterSplitProvenance } from '../nurbs/curves/curve-parameter-split.js';
import type { CoplanarCurveLineIntersectionResult, CurveLinePointEvent, CurveLineOverlapContact, CurveLineBinding } from './own-curve-line-intersection.js';
import type { PlaneClipUVSplitProvenance } from './own-coincident-plane-clip.js';
import type { CurvePlaneD1State } from './own-curve-plane-intersection.js';
import type { Curve, Surface, Model, Point } from '../types.js';
export interface ConvexNativeLineLoop {
    id: string;
    edges: Curve[];
}
export interface ConvexLineLoopClipOptions {
    evaluationId: string;
    resultIdPrefix: string;
}
export type ConvexLoopUVSplitProvenance = PlaneClipUVSplitProvenance;
export interface ConvexLoopContactContribution {
    edgeId: string;
    edgeIndex: number;
    kind: 'point-event' | 'overlap-contact' | 'overlap-end';
    parameter: number;
    brackets: [number, number][];
    evidence: CurveLinePointEvent | CurveLineOverlapContact | CurveLineBinding;
    overlapId: string | null;
}
export interface ConvexLoopClipContact {
    contactId: string;
    parameter: number;
    pointMM: Point;
    planeUV: Point;
    loopDomainAdmitted: boolean;
    halfspaces: number[];
    originalCurveD1: CurvePlaneD1State;
    contributions: ConvexLoopContactContribution[];
}
export interface ConvexLoopClipSpan {
    spanId: string;
    originalDerivedSpanId: string;
    domain: [number, number];
    curve: Curve;
    uvCurve: Curve;
    coordinateSystem: 'uv';
}
export interface ConvexLoopEndpointApproximation {
    parameter: number;
    rootEstimates: number[];
    parameterOffsets: number[];
    brackets: [number, number][];
    halfspaces: number[];
    policy: 'represented-inward-contact-bracket-endpoint';
}
export interface ConvexLoopBoundaryBinding {
    edgeId: string;
    edgeIndex: number;
    overlapId: string;
    lineDomain: [number, number];
    lineRange: [number, number];
    orientation: 'forward' | 'reverse';
    derivativeNumeratorBernstein: number[];
    observations: CurveLineBinding[];
}
export interface ConvexLoopPieceObservation {
    parameter: number;
    originalPointMM: Point;
    piecePointMM: Point;
    planeUV: Point;
    originalPlaneUV: Point;
    planePointMM: Point;
    originalPieceDifferenceMM: number;
    surfaceBindingDifferenceMM: number;
    dimensionlessBindingDifference: number;
    halfspaces: number[];
    originalCurveD1: CurvePlaneD1State;
    pieceCurveD1: CurvePlaneD1State;
}
export interface ConvexLoopClipPiece {
    pieceId: string;
    spanId: string;
    domain: [number, number];
    classification: 'interior' | 'boundary';
    curve: Curve;
    uvCurve: Curve;
    coordinateSystem: 'uv';
    orientation: 'ccw' | 'cw';
    boundaryBindings: ConvexLoopBoundaryBinding[];
    bindings: ConvexLoopPieceObservation[];
    endpointApproximations: [ConvexLoopEndpointApproximation | null, ConvexLoopEndpointApproximation | null];
    provenance: {
        xyz: CurveParameterSplitProvenance[];
        uv: ConvexLoopUVSplitProvenance[];
    };
    source: string;
    sourceVersion: 0;
    model: Model;
}
export interface ConvexLineLoopClipReport {
    family: 'own-curve-convex-native-line-loop-clip';
    kind: ConvexLineLoopClipResult['kind'];
    evaluationId: string;
    loopId: string;
    curveId: string;
    planeId: string;
    orientation: 'ccw' | 'cw';
    edgeCount: number;
    spanCount: number;
    contactCount: number;
    pieceCount: number;
    boundaryPieceCount: number;
    contributionCount: number;
    outsideIntervalCount: number;
    isolatedContactIds: string[];
    authority: 'original-curve-native-lines-and-plane';
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    numericPolicy: {
        exactParameterDedupOnly: true;
        pointBindingComparisonMM: 1e-7;
        convexityProof: 'every-nonadjacent-vertex-strict-directed-halfspace';
        convexityUnsafeThreshold: '64-epsilon-scaled-determinant';
        uvBindingUnits: 'dimensionless-not-mm-source';
        parameterWidthTarget: 1e-12;
        maximumRootSteps: 64;
    };
    limits: {
        maximumEdges: 8;
        maximumSpans: 8;
        maximumContacts: 128;
        maximumPieces: 128;
        maximumContributions: 256;
        maximumTemporaryPoles: 16;
        snapshotValues: 262144;
        snapshotDepth: 28;
        arrayElements: 2048;
        recordFields: 48;
        resultIdPrefixCharacters: 20;
    };
}
export interface ConvexLineLoopClipResult {
    kind: 'pieces' | 'boundary-pieces' | 'mixed' | 'isolated-contacts' | 'disjoint';
    curve: Curve;
    loop: ConvexNativeLineLoop;
    plane: Surface;
    options: ConvexLineLoopClipOptions;
    source: string;
    sourceVersion: 0;
    model: Model;
    orientation: 'ccw' | 'cw';
    verticesUV: Point[];
    convexityEvidence: {
        edgeIndex: number;
        vertexIndex: number;
        determinant: number;
        unsafeThreshold: number;
    }[];
    edgeResults: CoplanarCurveLineIntersectionResult[];
    spans: ConvexLoopClipSpan[];
    contacts: ConvexLoopClipContact[];
    pieces: ConvexLoopClipPiece[];
    outsideIntervals: {
        spanId: string;
        domain: [number, number];
        midpoint: number;
        halfspaces: number[];
    }[];
    report: ConvexLineLoopClipReport;
}
/** Actual finite Line intersections plus strict convex halfspaces; no arbitrary trimmed topology. */
export declare function clipCurveWithConvexLineLoop(curveInput: Curve, loopInput: ConvexNativeLineLoop, planeInput: Surface, inputOptions: ConvexLineLoopClipOptions): ConvexLineLoopClipResult;
/** Original geometry/context rebuild; supplied contact/piece/UV/edge lineage is never adopted. */
export declare function validateConvexLineLoopClip(input: ConvexLineLoopClipResult): ConvexLineLoopClipReport;
