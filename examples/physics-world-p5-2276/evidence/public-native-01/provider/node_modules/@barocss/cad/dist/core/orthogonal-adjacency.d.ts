import type { FaceBundle } from './face.js';
import type { RectangleAdjacency, RectangleAdjacencyIds } from './adjacency.js';
export type OrthogonalRectangleAdjacencyIds = RectangleAdjacencyIds;
export type OrthogonalRectangleAdjacency = RectangleAdjacency;
export interface OrthogonalRectangleAdjacencyValidationReport {
    incidenceValid: true;
    geometryFamily: 'exact-orthogonal-axis-rectangles-v0';
    sharedEdges: 1;
    closed: false;
    solid: false;
}
/** Exact orthogonal coefficient/axis association. Perpendicular normals form a crease, not smooth continuity or a sewn shell. */
export declare function validateOrthogonalRectangleAdjacency(input: unknown): OrthogonalRectangleAdjacencyValidationReport;
export declare function buildOrthogonalRectangleAdjacency(leftBundle: FaceBundle, rightBundle: FaceBundle, inputIds: OrthogonalRectangleAdjacencyIds): OrthogonalRectangleAdjacency;
