import type { Brep } from './brep-core.js';
import type { Point } from '../types.js';
export type ProjectedXY = readonly [number, number];
/** `toward`: from the model to the viewer; `up`: the direction shown upwards (need not be orthogonal). */
export interface HiddenLineView {
    readonly toward: Point;
    readonly up: Point;
}
/** An arc is `center + u·cos t + v·sin t` for t from t0 to t1 (an ellipse unless u, v are orthogonal and equal). */
export type ProjectedCurve = {
    readonly kind: 'line';
    readonly a: ProjectedXY;
    readonly b: ProjectedXY;
} | {
    readonly kind: 'arc';
    readonly center: ProjectedXY;
    readonly u: ProjectedXY;
    readonly v: ProjectedXY;
    readonly t0: number;
    readonly t1: number;
} | {
    readonly kind: 'polyline';
    readonly points: readonly ProjectedXY[];
};
export interface ProjectedPiece {
    readonly curve: ProjectedCurve;
    readonly visible: boolean;
}
/**
 * One curve of the view: a B-rep edge (by its persistent name) or a face's silhouette (`<face>~sil<k>`).
 * `ends`: its 3D end points (none for a closed circle); `circle`: a circular edge's exact geometry (`sweep`: its angle).
 * `pieces` is empty when the whole curve lies on visible ink (a hole's rim seen edge-on along the outline).
 */
export interface ProjectedEdge {
    readonly name: string;
    readonly kind: 'line' | 'circle' | 'curve' | 'silhouette';
    /** A tangent edge: a smooth joint between two different surfaces (only with `tangentEdges`). */
    readonly tangent?: true;
    readonly ends: readonly [Point, Point] | null;
    readonly circle: {
        readonly center: Point;
        readonly radius: number;
        readonly normal: Point;
        readonly full: boolean;
        readonly sweep: number;
    } | null;
    readonly pieces: readonly ProjectedPiece[];
}
/** 2D coordinates are `p·right`, `p·up`; `min`/`max` bound every piece. */
export interface BrepProjection {
    readonly right: Point;
    readonly up: Point;
    readonly toward: Point;
    readonly edges: readonly ProjectedEdge[];
    readonly min: ProjectedXY;
    readonly max: ProjectedXY;
}
export interface HiddenLineOptions {
    readonly segmentsPerQuarter?: number;
    readonly prefixes?: readonly string[];
    readonly tangentEdges?: boolean;
}
export declare function projectBrepHiddenLines(breps: readonly Brep[], view: HiddenLineView, options?: HiddenLineOptions): BrepProjection;
