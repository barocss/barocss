import type { ConvexPlanarFaceLoop, ConvexPlanarFaceOptions, ConvexPlanarFaceVertex, ConvexPlanarFaceEdge, ConvexPlanarFaceUse, ConvexPlanarFacePcurve, ConvexPlanarFaceBinding, ConvexPlanarFaceBoundaryClassification } from '../own-convex-planar-face.js';
import type { Surface, Model, Point } from '../types.js';
export type ConvexPlanarFaceWithHolesLoop = ConvexPlanarFaceLoop;
export type ConvexPlanarFaceWithHolesOptions = ConvexPlanarFaceOptions;
export type ConvexPlanarLoopRole = 'outer' | 'inner';
export interface ConvexPlanarHoleVertex extends ConvexPlanarFaceVertex {
    loopId: string;
    loopRole: ConvexPlanarLoopRole;
}
export interface ConvexPlanarHoleEdge extends ConvexPlanarFaceEdge {
    loopId: string;
    loopRole: ConvexPlanarLoopRole;
}
export interface ConvexPlanarHoleUse extends ConvexPlanarFaceUse {
    loopId: string;
    loopRole: ConvexPlanarLoopRole;
}
export interface ConvexPlanarHolePcurve extends ConvexPlanarFacePcurve {
    loopId: string;
    loopRole: ConvexPlanarLoopRole;
}
export interface ConvexPlanarHoleBinding extends ConvexPlanarFaceBinding {
    loopId: string;
    loopRole: ConvexPlanarLoopRole;
}
export interface ConvexPlanarFaceHoleTopology {
    version: 0;
    face: {
        id: string;
        surfaceId: string;
        outerLoopId: string;
        innerLoopIds: string[];
        orientation: 'forward' | 'reverse';
    };
    vertices: ConvexPlanarHoleVertex[];
    edges: ConvexPlanarHoleEdge[];
    loops: {
        id: string;
        role: ConvexPlanarLoopRole;
        authoredOrientation: 'ccw' | 'cw';
        useOrientation: 'ccw' | 'cw';
        uses: ConvexPlanarHoleUse[];
    }[];
}
export interface ConvexHoleContainmentEvidence {
    holeId: string;
    vertexIndex: number;
    outerEdgeIndex: number;
    value: number;
    unsafeThreshold: number;
}
export interface ConvexHolesSeparationEvidence {
    holeAId: string;
    holeBId: string;
    axisLoopId: string;
    axisEdgeIndex: number;
    anchorUV: Point;
    edgeDirectionUV: Point;
    projectionsA: number[];
    projectionsB: number[];
    rangeA: [number, number];
    rangeB: [number, number];
    gap: number;
    unsafeThreshold: number;
    order: 'a-before-b' | 'b-before-a';
}
export interface ConvexPlanarFaceWithHolesReport {
    family: 'own-affine-convex-native-line-planar-face-with-holes';
    faceId: string;
    evaluationId: string;
    surfaceId: string;
    outerLoopId: string;
    holeIds: string[];
    faceSense: 'forward' | 'reverse';
    authoredCurveIds: string[];
    incidenceValid: true;
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    loopCount: number;
    edgeCount: number;
    bindingCount: number;
    containmentEvidence: ConvexHoleContainmentEvidence[];
    separationEvidence: ConvexHolesSeparationEvidence[];
    convexityEvidence: {
        loopId: string;
        evidence: {
            edgeIndex: number;
            vertexIndex: number;
            determinant: number;
            unsafeThreshold: number;
        }[];
    }[];
    numericPolicy: {
        pointBindingComparisonMM: 1e-7;
        relativeD1Comparison: 1e-7;
        boundaryClassification: 'exact-zero-or-64-epsilon-uncertainty-refusal';
        holeSeparation: 'all-vertex-native-edge-normal-separating-axis';
        uvBindingUnits: 'dimensionless-not-mm-source';
    };
    limits: {
        maximumHoles: 2;
        maximumEdgesPerLoop: 8;
        maximumTotalLines: 15;
        maximumSourceObjects: 16;
        snapshotValues: 65536;
        snapshotDepth: 20;
        arrayElements: 512;
        recordFields: 48;
        resultIdPrefixCharacters: 20;
    };
}
export interface ConvexPlanarFaceWithHolesResult {
    plane: Surface;
    outerLoop: ConvexPlanarFaceWithHolesLoop;
    holeLoops: ConvexPlanarFaceWithHolesLoop[];
    options: ConvexPlanarFaceWithHolesOptions;
    source: string;
    sourceVersion: 0;
    model: Model;
    topology: ConvexPlanarFaceHoleTopology;
    pcurves: ConvexPlanarHolePcurve[];
    bindings: ConvexPlanarHoleBinding[];
    report: ConvexPlanarFaceWithHolesReport;
}
export interface ConvexPlanarHoleBoundaryClassification extends ConvexPlanarFaceBoundaryClassification {
    loopId: string;
    loopRole: ConvexPlanarLoopRole;
}
export interface ConvexPlanarFaceWithHolesUVClassification {
    classification: 'inside' | 'inside-hole' | 'boundary' | 'outside' | 'outside-domain';
    material: boolean;
    holeId: string | null;
    uv: [number, number];
    pointMM: Point | null;
    faceNormal: Point | null;
    loopHalfspaces: {
        loopId: string;
        loopRole: ConvexPlanarLoopRole;
        values: number[];
    }[];
    boundaries: ConvexPlanarHoleBoundaryClassification[];
}
/** One actual native affine face with owned outer and opposite inner loop incidence. */
export declare function buildConvexPlanarFaceWithHoles(planeInput: Surface, outerInput: ConvexPlanarFaceWithHolesLoop, holesInput: ConvexPlanarFaceWithHolesLoop[], inputOptions: ConvexPlanarFaceWithHolesOptions): ConvexPlanarFaceWithHolesResult;
/** Incidence and local native bindings only, without a geometric/topological certificate. */
export declare function validateConvexPlanarFaceWithHoles(input: ConvexPlanarFaceWithHolesResult): ConvexPlanarFaceWithHolesReport;
/** Material/hole classification in actual native UV, with no out-of-chart Surface evaluation. */
export declare function classifyConvexPlanarFaceWithHolesUV(input: ConvexPlanarFaceWithHolesResult, uvInput: [number, number]): ConvexPlanarFaceWithHolesUVClassification;
