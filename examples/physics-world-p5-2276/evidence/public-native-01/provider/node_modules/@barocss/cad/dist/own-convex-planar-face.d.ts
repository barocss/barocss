import type { CurveD1Result, SurfaceD1Result } from './core/derivatives.js';
import type { Curve, Surface, Model, Point } from './types.js';
export interface ConvexPlanarFaceLoop {
    id: string;
    edges: Curve[];
}
export interface ConvexPlanarFaceOptions {
    faceId: string;
    evaluationId: string;
    resultIdPrefix: string;
    orientation: 'forward' | 'reverse';
}
export interface ConvexPlanarFaceVertex {
    id: string;
    point: Point;
}
export interface ConvexPlanarFaceEdge {
    id: string;
    curveId: string;
    vertexIds: [string, string];
}
export interface ConvexPlanarFaceUse {
    id: string;
    edgeId: string;
    curveId: string;
    vertexIds: [string, string];
    sense: 'forward' | 'reverse';
    interval: [number, number];
    pcurveId: string;
}
export interface ConvexPlanarFaceTopology {
    version: 0;
    face: {
        id: string;
        surfaceId: string;
        outerLoopId: string;
        orientation: 'forward' | 'reverse';
    };
    vertices: ConvexPlanarFaceVertex[];
    edges: ConvexPlanarFaceEdge[];
    loop: {
        id: string;
        uses: ConvexPlanarFaceUse[];
    };
}
export interface ConvexPlanarFacePcurve {
    id: string;
    edgeId: string;
    curveId: string;
    coordinateSystem: 'uv';
    domain: [number, number];
    curve: Curve;
}
export interface ConvexPlanarFaceBinding {
    useId: string;
    edgeId: string;
    curveId: string;
    pcurveId: string;
    parameter: number;
    traversalSense: 'forward' | 'reverse';
    lineD1: CurveD1Result;
    pcurveD1: CurveD1Result;
    surfaceD1: SurfaceD1Result;
    pointDifferenceMM: number;
    orientedLineTangentMM: Point;
    orientedSurfaceChainTangentMM: Point;
    tangentDifferenceMM: number;
    orientedFaceNormal: Point;
}
export interface ConvexPlanarFaceReport {
    family: 'own-affine-convex-native-line-planar-face';
    faceId: string;
    evaluationId: string;
    surfaceId: string;
    outerLoopId: string;
    authoredOrientation: 'ccw' | 'cw';
    outerUseOrientation: 'ccw' | 'cw';
    faceSense: 'forward' | 'reverse';
    authoredCurveIds: string[];
    incidenceValid: true;
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    edgeCount: number;
    bindingCount: number;
    convexityEvidence: {
        edgeIndex: number;
        vertexIndex: number;
        determinant: number;
        unsafeThreshold: number;
    }[];
    numericPolicy: {
        pointBindingComparisonMM: 1e-7;
        relativeD1Comparison: 1e-7;
        boundaryClassification: 'exact-zero-or-64-epsilon-uncertainty-refusal';
        uvBindingUnits: 'dimensionless-not-mm-source';
    };
    limits: {
        maximumEdges: 8;
        snapshotValues: 32768;
        snapshotDepth: 16;
        arrayElements: 256;
        recordFields: 32;
        resultIdPrefixCharacters: 20;
    };
}
export interface ConvexPlanarFaceResult {
    plane: Surface;
    loop: ConvexPlanarFaceLoop;
    options: ConvexPlanarFaceOptions;
    source: string;
    sourceVersion: 0;
    model: Model;
    topology: ConvexPlanarFaceTopology;
    pcurves: ConvexPlanarFacePcurve[];
    bindings: ConvexPlanarFaceBinding[];
    report: ConvexPlanarFaceReport;
}
export interface ConvexPlanarFaceBoundaryClassification {
    edgeId: string;
    curveId: string;
    useId: string;
    pcurveId: string;
    lineParameter: number;
    traversalSense: 'forward' | 'reverse';
    lineD1: CurveD1Result;
    pointDifferenceMM: number;
    orientedLineTangentMM: Point;
}
export interface ConvexPlanarFaceUVClassification {
    classification: 'inside' | 'boundary' | 'outside' | 'outside-domain';
    uv: [number, number];
    pointMM: Point | null;
    faceNormal: Point | null;
    halfspaces: number[];
    boundaries: ConvexPlanarFaceBoundaryClassification[];
}
/** Variable3..8 native Line trim incidence, independent of the existing four-boundary FaceBundle. */
export declare function buildConvexPlanarFace(planeInput: Surface, loopInput: ConvexPlanarFaceLoop, inputOptions: ConvexPlanarFaceOptions): ConvexPlanarFaceResult;
/** Incidence/binding observations only; not geometry or topology certification. */
export declare function validateConvexPlanarFace(input: ConvexPlanarFaceResult): ConvexPlanarFaceReport;
/** Exact represented native UV halfspaces. Near-zero nonzero determinants refuse, never snap. */
export declare function classifyConvexPlanarFaceUV(input: ConvexPlanarFaceResult, uvInput: [number, number]): ConvexPlanarFaceUVClassification;
