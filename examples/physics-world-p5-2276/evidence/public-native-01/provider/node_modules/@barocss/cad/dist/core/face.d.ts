import type { SurfaceBoundary } from './boundary.js';
import type { Model, Point, Surface } from '../types.js';
export type Four<T> = [T, T, T, T];
export type UV = [number, number];
export interface FaceIds {
    faceId: string;
    loopId: string;
    vertexIds: Four<string>;
    edgeIds: Four<string>;
    curveIds: Four<string>;
}
export interface FaceVertex {
    id: string;
    point: Point;
}
export interface FaceEdge {
    id: string;
    curveId: string;
    vertexIds: [string, string];
}
export interface FaceUse {
    edgeId: string;
    sense: 'forward';
    boundary: SurfaceBoundary;
    pcurve: {
        domain: UV;
        uv0: UV;
        uv1: UV;
    };
}
export interface FaceBundle {
    geometry: Model;
    topology: {
        version: 0;
        face: {
            id: string;
            surfaceId: string;
            outerLoopId: string;
            orientation: 'forward';
        };
        vertices: Four<FaceVertex>;
        edges: Four<FaceEdge>;
        loop: {
            id: string;
            uses: Four<FaceUse>;
        };
    };
}
export interface FaceValidationReport {
    incidenceValid: true;
    geometricValidity: 'not-certified';
    solid: false;
}
/** Validate incidence only. A connected parameter rectangle is not certified geometry. */
export declare function validateFaceBundle(input: unknown): FaceValidationReport;
/** Build the fixed one-surface/four-boundary incidence subset with explicit IDs. */
export declare function buildParametricFace(input: Surface, inputIds: FaceIds): FaceBundle;
