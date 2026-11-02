import type { Curve, Surface, Model, Point } from './types.js';
export interface OwnPlateCircularHoleRequest {
    bodyId: string;
    featureId: string;
    parameterIds: {
        width: string;
        height: string;
        thickness: string;
        centerX: string;
        centerY: string;
        radius: string;
    };
    widthMM: number;
    heightMM: number;
    thicknessMM: number;
    centreMM: [number, number];
    radiusMM: number;
}
export interface OwnPlateCircularHoleUse {
    id: string;
    edgeId: string;
    sense: 'forward' | 'reverse';
    pcurve: {
        coordinateSystem: 'uv';
        domain: [number, number];
        curve: Curve;
    };
}
export interface OwnPlateCircularHoleLoop {
    id: string;
    faceId: string;
    role: 'outer' | 'inner';
    uses: OwnPlateCircularHoleUse[];
}
export interface OwnPlateCircularHoleFace {
    id: string;
    role: 'outer-side' | 'bottom-cap' | 'top-cap' | 'hole-wall';
    surface: Surface;
    orientation: 'forward' | 'reverse';
    outerLoopId: string;
    innerLoopIds: string[];
}
export interface OwnPlateCircularHoleEdge {
    id: string;
    curve: Curve;
    vertexIds: [string, string];
    sourceParameterRange: [number, number];
}
export interface OwnPlateCircularHoleBundle {
    request: OwnPlateCircularHoleRequest;
    faces: OwnPlateCircularHoleFace[];
    topology: {
        id: string;
        vertices: {
            id: string;
            point: Point;
        }[];
        edges: OwnPlateCircularHoleEdge[];
        loops: OwnPlateCircularHoleLoop[];
    };
    sourceModels: {
        faceId: string;
        source: string;
        sourceVersion: 0;
        model: Model;
    }[];
}
export interface OwnPlateCircularHoleReport {
    kind: 'own-axis-plate-circular-through-hole-candidate';
    bodyId: string;
    featureId: string;
    lengthUnit: 'mm';
    boundsMM: {
        min: Point;
        max: Point;
    };
    clearanceMM: [number, number, number, number];
    faceCount: number;
    vertexCount: number;
    edgeCount: number;
    loopCount: number;
    edgeUseCount: number;
    edgeIncidence: {
        edgeId: string;
        uses: {
            faceId: string;
            loopId: string;
            useId: string;
            sense: 'forward' | 'reverse';
        }[];
    }[];
    loopObservations: {
        loopId: string;
        directedClosed: true;
        signedUVAreaObservation: number;
    }[];
    normalObservations: {
        faceId: string;
        uv: [number, number];
        pointMM: Point;
        normal: Point;
    }[];
    referenceVolumeMM3: number;
    referenceCapAreaMM2: number;
    referenceCavityAreaMM2: number;
    referenceSemantics: 'analytic-authored-family-formula-not-certified';
    incidenceValid: true;
    candidateClosedShell: true;
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
    limits: {
        authoredBodyIdCharacters: 32;
        authoredIdCharacters: 48;
        dimensionsIntegerMM: [1, 10000];
        nativeRadiusMM: [0.001, 10000];
        nativeComparisonMM: 1e-7;
    };
}
export interface OwnPlateCircularHoleResult {
    bundle: OwnPlateCircularHoleBundle;
    report: OwnPlateCircularHoleReport;
}
export declare function buildOwnPlateCircularHole(input: OwnPlateCircularHoleRequest): OwnPlateCircularHoleResult;
export declare function validateOwnPlateCircularHoleBundle(input: OwnPlateCircularHoleBundle): OwnPlateCircularHoleReport;
