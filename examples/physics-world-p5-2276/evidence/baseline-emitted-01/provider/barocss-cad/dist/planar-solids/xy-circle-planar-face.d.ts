import type { XYArcRequest, XYArcResult } from '../xy-arc.js';
import type { Curve, Model, Point } from '../types.js';
import type { XYPoint } from '../sketch/xy-profile.js';
export type XYCircleFaceProfile = Extract<XYArcRequest, {
    kind: 'circle';
}>;
export interface XYCirclePlanarFaceOptions {
    faceId: string;
}
export interface XYCirclePlanarFaceBundle {
    construction: XYCircleFaceProfile;
    geometry: Model;
    topology: {
        version: 0;
        kind: 'xy-circle-planar-face';
        sourceCurveId: string;
        face: {
            id: string;
            surfaceId: string;
            outerLoopId: string;
            orientation: 'forward';
        };
        vertices: {
            id: string;
            point: Point;
        }[];
        edges: {
            id: string;
            curveId: string;
            vertexIds: [string, string];
            sourceParameterRange: [number, number];
        }[];
        loop: {
            id: string;
            uses: {
                edgeId: string;
                sense: 'forward';
                pcurve: {
                    coordinateSystem: 'uv';
                    domain: [number, number];
                    curve: Curve;
                };
            }[];
        };
    };
}
export interface XYCirclePlanarFaceReport {
    trimFamily: 'xy-circle-planar-face-v0';
    sourceCurveId: string;
    faceId: string;
    surfaceId: string;
    outerLoopId: string;
    edgeId: string;
    pcurveId: string;
    seamVertexId: string;
    nativeDomain: [number, number];
    uvDomain: [number, number];
    surfaceDomain: {
        u: [number, number];
        v: [number, number];
    };
    centerMM: XYPoint;
    radiusMM: number;
    boundsMM: {
        min: Point;
        max: Point;
    };
    vertexCount: 1;
    edgeCount: 1;
    loopUseCount: 1;
    nativeObjectCount: 2;
    referenceDiskAreaMM2: number;
    incidenceValid: true;
    periodic: false;
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    limits: {
        authoredIdCharacters: 64;
        derivedIdCharacters: 80;
        snapshotValues: 8192;
        snapshotDepth: 10;
        arrayElements: 64;
        recordFields: 12;
        stringCharacters: 128;
        evaluationComparisonMM: 1e-7;
        derivativeComparisonRelative: 1e-9;
        planeToleranceMM: 1e-7;
        boundaryToleranceMM: 1e-7;
    };
}
export interface XYCirclePlanarFaceResult {
    profile: XYArcResult;
    bundle: XYCirclePlanarFaceBundle;
    report: XYCirclePlanarFaceReport;
}
export interface XYCirclePlanarFacePointResult {
    classification: 'inside' | 'outside' | 'boundary' | 'off-plane';
    pointMM: Point;
    faceId: string;
    surfaceId: string;
    sourceCurveId: string;
    edgeId: string | null;
    surfaceUV: [number, number] | null;
    policy: {
        planeToleranceMM: 1e-7;
        boundaryToleranceMM: 1e-7;
    };
}
export declare function buildXYCirclePlanarFace(profile: XYCircleFaceProfile, options: XYCirclePlanarFaceOptions): XYCirclePlanarFaceResult;
export declare function validateXYCirclePlanarFaceBundle(bundle: XYCirclePlanarFaceBundle): XYCirclePlanarFaceReport;
export declare function classifyXYCirclePlanarFacePoint(bundle: XYCirclePlanarFaceBundle, pointMM: Point): XYCirclePlanarFacePointResult;
