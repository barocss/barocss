import { type Brep, type BrepFace } from '../brep/brep-core.js';
import type { Point, Surface } from '../types.js';
export interface OffsetCavityReport {
    /** The largest distance of a fitted face or edge from the exact offset, where measured (mm). */
    readonly deviationMM: number;
    /** The deviation allowed: 1e-6 of the body's size. */
    readonly targetMM: number;
    /** Faces of the cavity (the body's faces, cut into cells where the fit needs it). */
    readonly faces: number;
    /** The tightest convex curvature radius on the body (mm), against the wall. */
    readonly minRadiusMM: number;
}
/** Whether this route takes the body closed: every face an untrimmed NURBS patch or a plane or cylinder, every edge smooth. */
export declare function smoothClosedBody(body: Brep): boolean;
/**
 * Whether this route takes the body with the faces named in `open` opened: one closed body; every kept face an untrimmed
 * NURBS patch (offset fitted) or a plane or a circular cylinder however trimmed (offset exactly, R11.2c-1, D112); every
 * edge between two kept faces smooth — the opening may take away the body's sharp edges, as a pipe's open ends do.
 */
export declare function smoothOffsetBody(body: Brep, open: ReadonlySet<string>): boolean;
/** The cavity t inside `body` (its faces turned as the body's: `withCavities` turns them inside out). */
/** (Tests: a face's derivatives by this route's own evaluator.) */
export declare function derivativesForTest(f: BrepFace, u: number, v: number): {
    P: Point;
    Su: Point;
    Sv: Point;
    Suu: Point;
    Suv: Point;
    Svv: Point;
    convex: number;
};
export declare function offsetCavity(body: Brep, t: number, id: string, label?: string): {
    cavity: Brep;
    report: OffsetCavityReport;
};
/**
 * The shell of the body t thick with the faces named in `open` taken away (R11.2b, D111): its kept faces, their offset
 * (the cavity's cells, turned inside out) and, along each edge between a kept face and an opened one, the wall's end — the
 * band from the edge to its offset, square to the kept face (ruled along its normal): the wall is the union of the faces'
 * normal bands, so taking a face away takes its band. No Boolean.
 */
export declare function offsetShell(body: Brep, t: number, open: ReadonlySet<string>, id: string, label?: string): {
    shell: Brep;
    report: OffsetCavityReport;
};
/**
 * A region's slab (R11.2c-2, D113): the faces whose ids `region` names — a smooth region of untrimmed patches, planes and
 * cylinders — offset t in (the inner sheet, turned inside out) and out by 1.37 t (or half the tightest concave radius),
 * closed along every edge of the region by bands ruled along its normals. Its reach out is reported as `reachMM`.
 */
export declare function regionSlab(body: Brep, region: ReadonlySet<string>, t: number, id: string, label?: string): {
    slab: Brep;
    report: OffsetCavityReport;
};
/**
 * Refused where a surface thickened from `lo` to `hi` along its normal (∂S/∂u × ∂S/∂v) turns over (R11.3, D114): an
 * offset towards the side it curves to, deeper than its radius there (t·κ ≥ 1) — the same check as a shell's, each knot
 * span sampled with its edges and climbed (D110). Degrees above 3: sampled on a fine grid.
 */
export declare function thickenFoldCheck(surface: Surface, name: string, lo: number, hi: number): void;
/** The faces' smooth edges: each edge between two of the faces named by id, its largest angle between their normals. */
export declare function edgeAngles(body: Brep, faceIds: ReadonlySet<string>): Map<string, number>;
/** Whether a face is one this route offsets (an untrimmed patch, a plane or a cylinder). */
export declare function offsetFace(body: Brep, f: BrepFace): boolean;
/** The angle (rad) below which this route takes an edge as smooth. */
export declare const SMOOTH_EDGE = 0.0001;
