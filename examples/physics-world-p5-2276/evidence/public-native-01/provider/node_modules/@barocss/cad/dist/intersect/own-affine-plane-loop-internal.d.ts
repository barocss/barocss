import type { CurveAffinePlaneAxes } from './own-curve-plane-intersection.js';
import type { Curve, Surface, Point } from '../types.js';
export interface AffineConvexLineLoopAdmission {
    orientation: 'ccw' | 'cw';
    verticesUV: Point[];
    convexityEvidence: {
        edgeIndex: number;
        vertexIndex: number;
        determinant: number;
        unsafeThreshold: number;
    }[];
}
/** INTERNAL trusted own input. Callers perform their descriptor/shape snapshots before this admission. */
export declare function buildAffinePlaneAxes(plane: Surface, label?: string): CurveAffinePlaneAxes;
export declare function mapAffinePlanePointToUV(point: Point, axes: CurveAffinePlaneAxes, label?: string): Point;
export declare function directedUVDeterminant(direction: Point, relative: Point, label?: string): {
    value: number;
    threshold: number;
};
/** Actual supplied Plane axes/native Lines only; no synthetic Curve probe or source construction. */
export declare function admitConvexNativeLineLoop(edges: Curve[], axes: CurveAffinePlaneAxes, label: string, plane: Surface): AffineConvexLineLoopAdmission;
