import type { Curve, Point } from '../types.js';
export interface OffsetFrame {
    o: Point;
    x: Point;
    y: Point;
    z: Point;
}
interface OffsetInput {
    origin: Point;
    axis: Point;
    distance: number;
    radius?: number;
}
export type OffsetSupport = ({
    kind: 'plane';
    f: OffsetFrame;
} | {
    kind: 'cylinder';
    f: OffsetFrame;
    r: number;
}) & {
    input?: OffsetInput;
};
/** Raw LINE support/direction or generated conic endpoints, checked before endpoint pinning is accepted. */
export declare function checkOffsetSourceEndpoints(source: {
    kind: 'line';
    o: Point;
    z: Point;
    same: boolean;
} | {
    kind: 'conic';
    start: Point;
    end: Point;
}, a: readonly number[], b: readonly number[], tolerance: number, face: string, edge: string): void;
/**
 * Certifies the actual stored binary64 rational curve against the literal analytic offset support,
 * with conservative exact normalization/reduction budgets; not samples of the source conic.
 * Plane: its positive-weight control hull stays in the tolerance slab.
 * Cylinder: homogeneous squared radial distance is bounded using Bernstein coefficients on each
 * line/quadratic Bezier span; positive W makes [max(0,R-tol)^2 W^2,(R+tol)^2 W^2] sufficient.
 * Failure to certify is capability, unless an endpoint itself proves separation. No tolerance slack.
 */
export declare function checkOffsetBoundary(s: OffsetSupport, c: Curve, tolerance: number, face: string, edge: string): void;
export {};
