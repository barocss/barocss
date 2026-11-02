import type { FaceBundle } from './face.js';
import type { Point } from '../types.js';
import type { QualifiedEdgeReference, RectangleAdjacencyFace, RectangleAdjacencyVertex, RectangleAdjacencyUse } from './adjacency.js';
type Six<T> = [T, T, T, T, T, T];
type Eight<T> = [T, T, T, T, T, T, T, T];
type Twelve<T> = [T, T, T, T, T, T, T, T, T, T, T, T];
export interface AxisBoxShellIds {
    shellId: string;
    faceIds: Six<string>;
    vertexIds: Eight<string>;
    edgeIds: Twelve<string>;
}
interface ShellEdge {
    id: string;
    vertexIds: [string, string];
    canonical: QualifiedEdgeReference;
    uses: [RectangleAdjacencyUse, RectangleAdjacencyUse];
}
export interface AxisBoxShell {
    version: 0;
    id: string;
    origin: Point;
    sides: Point;
    faces: Six<RectangleAdjacencyFace>;
    vertices: Eight<RectangleAdjacencyVertex>;
    edges: Twelve<ShellEdge>;
}
export interface AxisBoxShellValidationReport {
    incidenceValid: true;
    geometryFamily: 'exact-axis-box-shell-v0';
    closed: true;
    solid: false;
    solidProductImplemented: false;
}
/** Restricted outward closed boundary only. No global solid certificate or volume report. */
export declare function validateAxisBoxShell(input: unknown): AxisBoxShellValidationReport;
export declare function buildAxisBoxShell(origin: Point, sides: Point, inputBundles: Six<FaceBundle>, inputIds: AxisBoxShellIds): AxisBoxShell;
export {};
