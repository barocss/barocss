import { qr as lineQR } from './xy-numerical-sketch-solver-internal.js';
import type { XYNumericalSketchResidual } from './xy-numerical-sketch.js';
import type { XYCircularNumericalSketchDocumentV0, XYCircularNumericalSketchPoint, XYCircularNumericalSketchRadius, XYCircularNumericalSketchReport, XYCircularNumericalSketchContact } from './xy-circular-numerical-sketch.js';
export declare const limits: Readonly<{
    points: 16;
    segments: 8;
    circles: 4;
    constraints: 32;
    scalarResiduals: 64;
    unknowns: 32;
    branchGuards: 16;
    coordinateAbs: 10000;
    minimumSegment: 0.001;
    minimumRadiusMM: 0.001;
    maximumRadiusMM: 10000;
    iterations: 100;
    evaluations: 1200;
    sourceCharacters: 262144;
    sourceBytes: 262144;
}>;
export declare function qr(matrix: number[][], rhs: number[], columns: number): ReturnType<typeof lineQR>;
/** Every evaluation validates radius/envelope and the finite contact domain before producing rows. */
export declare function evaluate(d: XYCircularNumericalSketchDocumentV0, x: number[]): {
    jacobian: number[][];
    residuals: XYNumericalSketchResidual[];
    objective: number;
    contacts: XYCircularNumericalSketchContact[];
};
export declare function solve(d: XYCircularNumericalSketchDocumentV0): {
    points: XYCircularNumericalSketchPoint[];
    radii: XYCircularNumericalSketchRadius[];
    report: XYCircularNumericalSketchReport;
};
