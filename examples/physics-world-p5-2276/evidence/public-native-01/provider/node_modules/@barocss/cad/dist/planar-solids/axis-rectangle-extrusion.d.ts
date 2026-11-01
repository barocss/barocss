import type { XYProfileRequest, XYProfileResult } from '../sketch/xy-profile.js';
import type { CadModelIR2 } from '../model-compiler.js';
import type { FaceBundle } from '../core/face.js';
import type { AxisBoxShell } from '../core/box-shell.js';
import type { AxisBoxSolidValidationReport } from '../core/box-solid.js';
import type { Model, Point } from '../types.js';
type Six<T> = [T, T, T, T, T, T];
export interface AxisRectangleExtrusionRequest {
    bodyId: string;
    profile: Extract<XYProfileRequest, {
        kind: 'rectangle';
    }>;
    distance: number;
}
export interface AxisRectangleExtrusionConstruction {
    operation: 'axis-rectangle-extrude';
    inputCurveId: string;
    outputBodyId: string;
    direction: Point;
    distanceMM: number;
    parameterIds: {
        originX: string;
        originY: string;
        width: string;
        height: string;
        distance: string;
    };
    footprintRanges: {
        inputRange: [number, number];
        edgeId: string;
        sense: 'forward' | 'reverse';
    }[];
}
export interface AxisRectangleExtrusionResult {
    source: string;
    sourceVersion: 2;
    model: Model;
    ir: CadModelIR2;
    profile: XYProfileResult;
    faces: Six<FaceBundle>;
    shell: AxisBoxShell;
    solidReport: AxisBoxSolidValidationReport;
    construction: AxisRectangleExtrusionConstruction;
}
/** One supported filled family, rebuilt from actual parameter-bound source. */
export declare function buildAxisRectangleExtrusion(request: AxisRectangleExtrusionRequest): AxisRectangleExtrusionResult;
export {};
