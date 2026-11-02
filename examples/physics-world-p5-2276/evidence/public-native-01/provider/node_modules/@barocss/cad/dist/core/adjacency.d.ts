import type { FaceBundle } from './face.js';
import type { Point } from '../types.js';
type Six<T> = [T, T, T, T, T, T];
type Seven<T> = [T, T, T, T, T, T, T];
export interface RectangleAdjacencyIds {
    adjacencyId: string;
    faceIds: [string, string];
    vertexIds: Six<string>;
    edgeIds: Seven<string>;
}
export interface QualifiedEdgeReference {
    faceId: string;
    edgeId: string;
    curveId: string;
}
export interface RectangleAdjacencyUse extends QualifiedEdgeReference {
    sense: 'forward' | 'reverse';
}
export interface RectangleAdjacencyFace {
    id: string;
    bundle: FaceBundle;
}
export interface RectangleAdjacencyVertex {
    id: string;
    point: Point;
}
export interface RectangleAdjacencyEdge {
    id: string;
    vertexIds: [string, string];
    canonical: QualifiedEdgeReference;
    uses: RectangleAdjacencyUse[];
}
export interface RectangleAdjacency {
    version: 0;
    id: string;
    faces: [RectangleAdjacencyFace, RectangleAdjacencyFace];
    vertices: Six<RectangleAdjacencyVertex>;
    edges: Seven<RectangleAdjacencyEdge>;
}
export interface RectangleAdjacencyValidationReport {
    incidenceValid: true;
    geometryFamily: 'exact-axis-rectangles-v0';
    sharedEdges: 1;
    closed: false;
    solid: false;
}
/** Exact restricted coefficient/axis association, not a sewn shell or general face certificate. */
export declare function validateRectangleAdjacency(input: unknown): RectangleAdjacencyValidationReport;
export declare function buildRectangleAdjacency(leftBundle: FaceBundle, rightBundle: FaceBundle, inputIds: RectangleAdjacencyIds): RectangleAdjacency;
export {};
