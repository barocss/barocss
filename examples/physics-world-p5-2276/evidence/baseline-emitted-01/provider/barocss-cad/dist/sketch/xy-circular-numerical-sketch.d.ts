import type { Model } from '../types.js';
import type { CadModelIR1 } from '../model-compiler.js';
import type { XYPoint } from './xy-profile.js';
import type { XYNumericalSketchPoint, XYNumericalSketchSegment, XYNumericalSketchConstraint, XYNumericalSketchBranchGuard, XYNumericalSketchReport } from './xy-numerical-sketch.js';
import type { XYCircularNumericalSketchDiagnosticCode } from './xy-circular-numerical-sketch-admission-internal.js';
export { XYCircularNumericalSketchError, XYCircularNumericalSketchDiagnosticCode } from './xy-circular-numerical-sketch-admission-internal.js';
export type XYCircularNumericalSketchPoint = XYNumericalSketchPoint;
export type XYCircularNumericalSketchSegment = XYNumericalSketchSegment;
export type XYCircularNumericalSketchBranchGuard = XYNumericalSketchBranchGuard;
export interface XYCircularNumericalSketchCircle {
    id: string;
    centerPointId: string;
    radius: {
        id: string;
        valueMM: number;
    };
    seamId: string;
}
export type XYCircularNumericalSketchConstraint = XYNumericalSketchConstraint | {
    id: string;
    kind: 'radius';
    circleId: string;
    radiusMM: number;
} | {
    id: string;
    kind: 'line-circle-tangent';
    segmentId: string;
    circleId: string;
    side: 'left' | 'right';
};
export interface XYCircularNumericalSketchDocumentV0 {
    format: 'barocss-xy-circular-numerical-sketch';
    version: 0;
    profile: 'bounded-radius-interior-tangent-v0';
    id: string;
    lengthUnit: 'mm';
    angleUnit: 'rad';
    points: XYCircularNumericalSketchPoint[];
    segments: XYCircularNumericalSketchSegment[];
    circles: XYCircularNumericalSketchCircle[];
    constraints: XYCircularNumericalSketchConstraint[];
    branchGuards: XYCircularNumericalSketchBranchGuard[];
}
export interface XYCircularNumericalSketchRadius {
    circleId: string;
    radiusId: string;
    valueMM: number;
}
export interface XYCircularNumericalSketchContact {
    constraintId: string;
    segmentId: string;
    circleId: string;
    side: 'left' | 'right';
    signedDistanceMM: number;
    radiusMM: number;
    contactParameter: number;
    contactXY: XYPoint;
}
export interface XYCircularNumericalSketchBinding {
    circleId: string;
    centerPointId: string;
    radiusId: string;
    seamId: string;
    seamParameters: [0, 4];
    seamPoleIndices: [0, 8];
}
export interface XYCircularNumericalSketchReport extends Omit<XYNumericalSketchReport, 'limits' | 'quality'> {
    contacts: XYCircularNumericalSketchContact[];
    limits: XYNumericalSketchReport['limits'] & {
        circles: number;
        minimumRadiusMM: number;
        maximumRadiusMM: number;
        sourceCharacters: number;
        sourceBytes: number;
    };
    quality: Omit<XYNumericalSketchReport['quality'], 'branch' | 'constraints' | 'nativeGeometry'> & {
        branch: 'authored-guards-radius-envelope-and-strict-interior-sided-contact-on-seed-and-accepted-iterates';
        constraints: 'authored-order-points-xy-then-circle-radii-order';
        nativeGeometry: 'degree1-lines-degree2-rational-circles-xy-z-zero';
        contact: 'analytic-finite-segment-construction-point-not-native-curve-parameter';
        regionCertified: false;
        solid: false;
    };
}
export interface XYCircularNumericalSketchSuccess {
    ok: true;
    document: XYCircularNumericalSketchDocumentV0;
    solution: {
        points: XYCircularNumericalSketchPoint[];
        radii: XYCircularNumericalSketchRadius[];
        bindings: XYCircularNumericalSketchBinding[];
        source: string;
        sourceVersion: 0;
        model: Model;
        ir: CadModelIR1;
    };
    report: XYCircularNumericalSketchReport;
}
export interface XYCircularNumericalSketchDiagnostic {
    code: XYCircularNumericalSketchDiagnosticCode;
    message: string;
    path: string;
}
export type XYCircularNumericalSketchResult = XYCircularNumericalSketchSuccess | {
    ok: false;
    diagnostics: XYCircularNumericalSketchDiagnostic[];
};
/** Atomic local numerical solve followed by actual native circle/line compilation. */
export declare function buildXYCircularNumericalSketch(input: XYCircularNumericalSketchDocumentV0): XYCircularNumericalSketchSuccess;
export declare function solveXYCircularNumericalSketch(document: XYCircularNumericalSketchDocumentV0): XYCircularNumericalSketchResult;
/** Full deterministic reconstruction checks self-consistency, not provenance or authenticity. */
export declare function validateXYCircularNumericalSketch(input: XYCircularNumericalSketchSuccess): XYCircularNumericalSketchReport;
