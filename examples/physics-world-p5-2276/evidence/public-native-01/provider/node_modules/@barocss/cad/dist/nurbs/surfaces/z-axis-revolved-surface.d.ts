import type { Curve, Surface, Model, Point } from '../../types.js';
export interface ZAxisRevolvedSurfaceOptions {
    surfaceId: string;
}
export interface ZAxisRevolvedSurfaceConstruction {
    kind: 'z-axis-full-turn-revolve';
    meridianId: string;
    surfaceId: string;
    lengthUnit: 'mm';
    axis: {
        originMM: Point;
        direction: Point;
    };
    turnDegrees: 360;
    uRole: 'meridian';
    vRole: 'angle';
    angularBasis: 'original-xy-circle';
}
export interface ZAxisRevolveBoundaryObservation {
    boundary: 'meridian-start' | 'meridian-end' | 'angle-start' | 'angle-end';
    u: number;
    v: number;
    pointMM: Point;
    expectedPointMM: Point;
    differenceMM: number;
}
export interface ZAxisRevolvedSurfaceReport {
    kind: 'z-axis-revolved-surface';
    meridianId: string;
    surfaceId: string;
    lengthUnit: 'mm';
    domains: {
        meridian: [number, number];
        surface: {
            u: [number, number];
            v: [number, number];
        };
    };
    degrees: {
        u: number;
        v: 2;
    };
    controlPointCounts: {
        u: number;
        v: 9;
        total: number;
    };
    meridianEndpoints: {
        parameter: number;
        pointMM: Point;
    }[];
    angularSeam: {
        coefficientClosed: true;
        sampledU: number[];
        maximumDifferenceMM: number;
        periodic: false;
    };
    boundaryObservations: ZAxisRevolveBoundaryObservation[];
    maximumBoundaryDifferenceMM: number;
    derivativeGuardKnots: {
        u: number[];
        v: number[];
    };
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    limits: {
        maximumMeridianPoles: 16;
        maximumMeridianDegree: 3;
        authoredIdCharacters: 48;
        snapshotValues: 1024;
        snapshotDepth: 6;
        arrayElements: 64;
        recordFields: 8;
        stringCharacters: 128;
    };
}
export interface ZAxisRevolvedSurfaceResult {
    meridian: Curve;
    source: string;
    sourceVersion: 0;
    model: Model;
    surface: Surface;
    construction: ZAxisRevolvedSurfaceConstruction;
    report: ZAxisRevolvedSurfaceReport;
}
/** Full global +Z revolution from actual original meridian and circle bases. */
export declare function buildZAxisRevolvedSurface(meridianInput: Curve, options: ZAxisRevolvedSurfaceOptions): ZAxisRevolvedSurfaceResult;
