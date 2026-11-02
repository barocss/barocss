import type { XYCircleFaceProfile, XYCirclePlanarFaceResult, XYCirclePlanarFaceReport } from './planar-solids/xy-circle-planar-face.js';
import type { XYArcResult } from './xy-arc.js';
import type { Curve, Model, Point } from './types.js';
import type { XYPoint } from './sketch/xy-profile.js';
type Sense = 'forward' | 'reverse';
export interface XYCirclePrismShellOptions {
    shellId: string;
    heightMM: number;
}
export interface XYCirclePrismShellUse {
    id: string;
    edgeId: string;
    sense: Sense;
    pcurve: {
        coordinateSystem: 'uv';
        domain: [number, number];
        curve: Curve;
    };
}
export interface XYCirclePrismShellBundle {
    construction: {
        profile: XYCircleFaceProfile;
        shellId: string;
        heightMM: number;
    };
    geometry: Model;
    topology: {
        version: 0;
        kind: 'xy-circle-prism-shell';
        id: string;
        sourceCurveId: string;
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
        faces: {
            id: string;
            surfaceId: string;
            outerLoopId: string;
            orientation: Sense;
            role: 'bottom-cap' | 'top-cap' | 'wall';
        }[];
        loops: {
            id: string;
            faceId: string;
            uses: XYCirclePrismShellUse[];
        }[];
    };
}
export interface XYCirclePrismShellReport {
    trimFamily: 'xy-circle-prism-shell-v0';
    sourceCurveId: string;
    shellId: string;
    heightMM: number;
    centerMM: XYPoint;
    radiusMM: number;
    baseFaceReport: XYCirclePlanarFaceReport;
    geometryIds: {
        bottomCurveId: string;
        topCurveId: string;
        seamCurveId: string;
        bottomSurfaceId: string;
        topSurfaceId: string;
        wallSurfaceId: string;
    };
    domains: {
        bottomCurve: [number, number];
        topCurve: [number, number];
        seamCurve: [number, number];
        bottomSurface: {
            u: [number, number];
            v: [number, number];
        };
        topSurface: {
            u: [number, number];
            v: [number, number];
        };
        wallSurface: {
            u: [number, number];
            v: [number, number];
        };
    };
    vertexCount: 2;
    edgeCount: 3;
    edgeUseCount: 6;
    faceCount: 3;
    loopCount: 3;
    nativeObjectCount: 6;
    boundsMM: {
        min: Point;
        max: Point;
    };
    edgeIncidence: {
        edgeId: string;
        uses: {
            faceId: string;
            loopId: string;
            useId: string;
            sense: Sense;
        }[];
    }[];
    loopObservations: {
        loopId: string;
        faceId: string;
        useCount: number;
        closed: true;
    }[];
    normalObservations: {
        faceId: string;
        surfaceId: string;
        uv: [number, number];
        pointMM: Point;
        normal: Point;
    }[];
    referenceVolumeMM3: number;
    referenceLateralAreaMM2: number;
    referenceBoundaryAreaMM2: number;
    incidenceValid: true;
    candidateClosedShell: true;
    periodic: false;
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    limits: {
        authoredIdCharacters: 48;
        derivedIdCharacters: 80;
        snapshotValues: 32768;
        snapshotDepth: 14;
        arrayElements: 128;
        recordFields: 24;
        stringCharacters: 128;
        evaluationComparisonMM: 1e-7;
    };
}
export interface XYCirclePrismShellResult {
    profile: XYArcResult;
    baseFace: XYCirclePlanarFaceResult;
    bundle: XYCirclePrismShellBundle;
    report: XYCirclePrismShellReport;
}
export declare function buildXYCirclePrismShell(profile: XYCircleFaceProfile, inputOptions: XYCirclePrismShellOptions): XYCirclePrismShellResult;
export declare function validateXYCirclePrismShellBundle(bundle: XYCirclePrismShellBundle): XYCirclePrismShellReport;
export {};
