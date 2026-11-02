import { type Brep, type BrepFace } from './brep-core.js';
import type { Curve, Point } from '../types.js';
export type AnalyticBooleanOperation = 'union' | 'intersection' | 'difference';
type P3 = Point;
interface BooleanFaceSource {
    readonly operand: 0 | 1;
    readonly faceId: string;
}
/** Exhaustive possible sources, not an exact area attribution after coplanar/cylindrical merging. */
interface BooleanFaceSourceSet {
    readonly sources: readonly BooleanFaceSource[];
    readonly complete: boolean;
}
/** Whether far faces kept whole are frozen in the stitch (D283). A switch for the differential test against the full
 * rebuild (test/incremental-stitch-differential.test.mjs) only; not exported from the package. */
export declare const stitchFreezing: {
    on: boolean;
};
/**
 * The analytic form of a B-rep face's surface: a plane (point and outward normal), a circular
 * cylinder (axis point, unit axis, radius; `out` +1 when the outward normal points away from the axis),
 * or `other` for any other surface.
 */
export type FaceGeometry = {
    readonly kind: 'plane';
    readonly o: P3;
    readonly n: P3;
} | {
    readonly kind: 'cylinder';
    readonly c: P3;
    readonly a: P3;
    readonly r: number;
    readonly out: 1 | -1;
} | {
    readonly kind: 'other';
};
export declare function faceGeometry(face: BrepFace, scaleMM?: number): FaceGeometry;
/**
 * Edges that are an exact curve's map onto a general face and lie on a circle are made that arc
 * (`exactEdges: false` keeps them fitted).
 */
/** Each Boolean's pieces and their classes (debugging and tests; unset in use). */
declare let booleanTrace: ((pieces: {
    face: string;
    solid: number;
    where: string;
    at: P3;
    area: number;
    cuts: number;
    ends: P3[][];
    ring: P3[][];
    raw: unknown;
}[]) => void) | null;
export declare function setBooleanTrace(f: typeof booleanTrace): void;
export declare function booleanAnalytic(a: Brep, b: Brep, operation: AnalyticBooleanOperation, options?: {
    readonly id?: string;
    readonly exactEdges?: boolean; /** A tighter fit for newly created parametric boundary edges only; topology tolerances stay unchanged. */
    readonly edgeFitTolerance?: number; /** b's faces (ids) that meet a's faces named in `contactWith` (base names) only along their own edges lying on them (a fillet tool's contact faces and the faces it rounds, D89). */
    readonly contactFaces?: readonly string[];
    readonly contactWith?: readonly string[];
}): Brep;
type AnalyticOptions = {
    readonly id?: string;
    readonly exactEdges?: boolean; /** A tighter fit for newly created parametric boundary edges only; topology tolerances stay unchanged. */
    readonly edgeFitTolerance?: number; /** b's faces (ids) that meet a's faces named in `contactWith` (base names) only along their own edges lying on them (a fillet tool's contact faces and the faces it rounds, D89). */
    readonly contactFaces?: readonly string[];
    readonly contactWith?: readonly string[];
};
/**
 * INTERNAL: the ordinary Boolean plus exhaustive possible input-face sources for each returned face.
 * Not exported from the package entrypoint or stored in B-rep JSON. A merged face may list extra sources from its
 * merge cluster; source presence does not prove full-face preservation. A consumer must reject incomplete receipts.
 * Only the final returned B-rep's receipt is published, including after a rejudge or frozen-stitch retry.
 */
export declare function booleanAnalyticTraced(a: Brep, b: Brep, operation: AnalyticBooleanOperation, options?: AnalyticOptions): {
    readonly brep: Brep;
    readonly faceSources: ReadonlyMap<string, BooleanFaceSourceSet>;
    readonly complete: boolean;
};
/**
 * One piece of a split face: its name in the result; `faces`, its result faces — one, or two either side of a closed
 * general face's seam (`name` and `name#2`); for an isocline split, `side` +1 where its outward normal has n·d > 0, −1 below.
 */
export interface FaceSplitPiece {
    readonly name: string;
    readonly faces: readonly string[];
    readonly side?: 1 | -1;
}
export interface FaceSplit {
    readonly brep: Brep;
    readonly pieces: readonly FaceSplitPiece[];
}
export interface FaceSplitOptions {
    /** The result's id (its edges' and vertices' prefix; default `split`). */
    readonly id?: string;
    /** The pieces' names, in the order of `pieces` (default `<face>#1`, `<face>#2` …: the + side first, then by position). */
    readonly names?: readonly string[];
}
/**
 * The face (an id, a name, or a base name naming one face) cut along curves lying on it: each curve on its surface within
 * the tolerance (10 × the linear tolerance at the body's scale), clipped to the face, ending on its boundary at an angle
 * (or closed: a hole and a disc), not crossing itself. Every other face, edge name and the volume are kept.
 * Refusals (`face split: [TAG]`): NO_FACE, AMBIGUOUS, NOT_SOLID, CURVES (INPUT); OFF_SURFACE, OFF_FACE, ON_BOUNDARY,
 * OPEN_END, TANGENT (under 0.057° to the boundary, or touching it), SELF_CROSSING, NO_SPLIT (GEOMETRY).
 */
export declare function splitFaceAlongCurve(brep: Brep, face: string, curves: Curve | readonly Curve[], options?: FaceSplitOptions): FaceSplit;
/**
 * The face cut along its isocline n·d = 0 for the pull `pull`: its pieces each on one side (`side`). Refused on a plane
 * (WALL when it lies along the pull, NO_ISOCLINE otherwise), on a cylinder along the pull (WALL), and where n·d keeps one
 * sign over the face (NO_ISOCLINE); otherwise as `splitFaceAlongCurve` (an isocline crossing itself at a saddle: SELF_CROSSING).
 */
export declare function splitFaceAlongIsocline(brep: Brep, face: string, pull: readonly number[], options?: FaceSplitOptions): FaceSplit;
export {};
