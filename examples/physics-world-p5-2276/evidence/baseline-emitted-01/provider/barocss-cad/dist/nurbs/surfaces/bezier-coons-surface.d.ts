import type { Curve, Model, Surface } from '../../types.js';
/** Bottom/top run in increasing U; left/right run in increasing V. All coordinates are mm. */
export interface BezierCoonsBoundaries {
    bottom: Curve;
    top: Curve;
    left: Curve;
    right: Curve;
}
export interface BezierCoonsSurfaceOptions {
    surfaceId: string;
}
export interface BezierCoonsSurfaceReport {
    kind: 'bezier-coons-surface';
    lengthUnit: 'mm';
    degreeU: number;
    degreeV: number;
    boundaryIds: {
        bottom: string;
        top: string;
        left: string;
        right: string;
    };
    geometricValidity: 'not-certified';
    solid: false;
    topologyCertified: false;
}
export interface BezierCoonsSurfaceResult {
    boundaries: BezierCoonsBoundaries;
    surface: Surface;
    model: Model;
    source: string;
    report: BezierCoonsSurfaceReport;
}
/**
 * Polynomial Coons blending of four degree1..3 Bezier boundaries with exact shared corners.
 * The first grid index is U. This returns a native surface, without sewing, regularity or solid certification.
 */
export declare function buildBezierCoonsSurface(boundaries: BezierCoonsBoundaries, options: BezierCoonsSurfaceOptions): BezierCoonsSurfaceResult;
