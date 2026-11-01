import { validateOwnPlateCircularHoleBundle } from '../own-plate-circular-hole.js';
import type { OwnPlateCircularHoleBundle } from '../own-plate-circular-hole.js';
import type { Point } from '../types.js';
export interface OwnPlateHolePreviewContext {
    documentId: string;
    bodyId: string;
    documentRevision: string;
    kernelResultRevision: string;
    topologyRevision: string;
    taskToken: string;
}
export interface OwnPlateHolePreviewOptions {
    context: OwnPlateHolePreviewContext;
    segmentsPerQuarter?: number;
}
export interface OwnNativeFaceMeshChunk {
    faceToken: string;
    nativeFaceId: string;
    faceOrientation: 'forward' | 'reversed';
    normalSource: 'own-tessellation' | 'native-surface-evaluation' | 'mesh-computed';
    positionsMM: number[];
    normals: number[];
    parametersUV: number[];
    indices: number[];
}
export interface OwnNativeFaceMesh {
    format: 'barocss-native-face-mesh';
    version: 0;
    lengthUnit: 'mm';
    nativeFrame: 'part-xyz';
    context: OwnPlateHolePreviewContext;
    chunks: OwnNativeFaceMeshChunk[];
}
export interface OwnPlateHolePreviewFaceProvenance {
    faceToken: string;
    nativeFaceId: string;
    nativeSurfaceId: string;
    role: string;
    orientation: 'forward' | 'reverse';
    nativeLoopIds: string[];
    nativeEdgeIds: string[];
    panels: {
        vertexRange: [number, number];
        indexRange: [number, number];
        normalSampleUV: [number, number];
        normal: Point;
    }[];
}
export interface OwnPlateHolePreviewReport {
    kind: 'own-plate-circular-hole-preview';
    native: ReturnType<typeof validateOwnPlateCircularHoleBundle>;
    segmentsPerQuarter: number;
    ringParameters: number[];
    faceCount: number;
    vertexCount: number;
    triangleCount: number;
    cornerRayObservations: {
        cornerMM: [number, number];
        parameter: number;
        iterations: number;
        observedRayResidualMM: number;
    }[];
    maximumCornerRayResidualMM: number;
    maximumNativeBoundaryDifferenceMM: number;
    normalMethod: 'actual-native-surface-D1-with-face-sense';
    approximation: 'sampled-native-circle-ring-and-faceted-surface';
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    limits: {
        maximumFaces: 64;
        maximumVertices: 4096;
        maximumTriangles: 7938;
        maximumCornerRayIterations: 56;
        localBindingComparisonMM: 1e-7;
    };
}
export interface OwnPlateHolePreviewResult {
    mesh: OwnNativeFaceMesh;
    provenance: OwnPlateHolePreviewFaceProvenance[];
    report: OwnPlateHolePreviewReport;
}
export declare function validateOwnPlateHolePreviewContext(input: unknown): asserts input is OwnPlateHolePreviewContext;
export declare function validateOwnNativeFaceMesh(input: unknown): asserts input is OwnNativeFaceMesh;
/** Approximate actual own native cap trims and cavity wall; never a solid gate. */
export declare function tessellateOwnPlateCircularHole(input: OwnPlateCircularHoleBundle, inputOptions: OwnPlateHolePreviewOptions): OwnPlateHolePreviewResult;
