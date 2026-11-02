import { type Brep, type BrepFace } from '../brep/brep-core.js';
import { type ProfileSegmentInput } from '../features/extruded-profile-solid.js';
import type { Point } from '../types.js';
import type { CadPartErrorCode, Solid, CadPartFeature, Result, Tools } from './part-model.js';
/** A face-fillet feature's evaluation (part-model.ts's operation() for this kind). */
export declare function faceFilletOperation(f: CadPartFeature & Record<string, unknown>, t: Tools): () => Result;
/** A face's analytic surface, for the corner restore: its signed distance (outside +) and a shell d thick beside it. */
export interface Analytic {
    readonly dist: (x: Point) => number;
    readonly shell: (d: number, side: 1 | -1, margin: number, tag: string) => Solid | null;
}
export declare function analyticOf(S: {
    name: string;
    faces: readonly BrepFace[];
}, brep: Brep, size: number): Analytic | null;
/**
 * The corner between two faces that do not meet, restored (F1): whatever lies within d of both their surfaces on the
 * corner's side — an earlier round, a chamfer, a step — removed (an inside corner: the body less the outer shells'
 * overlap W) or filled (an outside corner: the body and the inner shells' overlap), so the two meet along their
 * surfaces' intersection. Which side, from a face between them (its vertices within d of both, outside both or inside
 * both). W's faces on A's or B's surface take their names. Null when the faces are not planes or surfaces of revolution.
 */
export declare function restoreCorner(brep: Brep, source: Solid, sides: readonly {
    name: string;
    faces: readonly BrepFace[];
}[], r: number, at: string, fail: (code: CadPartErrorCode, detail: string) => never): Solid | null;
/** The names of the edges two named faces share (each face with its pieces `#k`), in the body's order; none when one has no name (the edge fillet finds edges by name). */
export declare function sharedEdges(brep: Brep, names: readonly string[]): string[];
/** A face's boundary: the edges of its pieces not shared between them, each sampled as a polyline (lines as their ends). */
export declare function boundaryOf(brep: Brep, faces: readonly BrepFace[]): Point[][];
/** A circle through a polyline's points (its centre and unit normal), or null when they are not on one. */
export declare function circleOf(pts: readonly Point[]): {
    c: Point;
    n: Point;
    R: number;
} | null;
/**
 * A face fillet between two faces that turn about one axis — a plane across it, a cylinder, a cone, a sphere, a torus
 * (a boss on a plate, a tapered boss, a disc's rim, a hole's or countersink's edge, a chamfer meeting a shaft, a ball
 * on a stem, a dome on a plate, beside an earlier round). In the half-plane through the axis (radius, height) each is a
 * line or a circle: the round's centre is where they meet pushed off by its radius (outward: an inside corner, filled;
 * inward: an outside one, cut), and its section — the corner, along one face to its tangent point, the round's short
 * arc, back along the other — is revolved about the axis; corners on several circles are each rounded. A cylinder,
 * cone, sphere or torus must be whole round and hold its tangent point along its generator; a plane must hold the
 * tangent circle; the volume is checked by Pappus (the section's area and first moment, its arcs exact).
 */
export declare function revolvedFillet(brep: Brep, source: Solid, A0: {
    name: string;
    faces: readonly BrepFace[];
}, B0: {
    name: string;
    faces: readonly BrepFace[];
}, r: number, at: string, fail: (code: CadPartErrorCode, detail: string) => never): Solid;
export type XY2 = [number, number];
/** A face seen in the section square to the fillet's direction: a line (a point, its outward normal) or a circle. */
export type Section2 = {
    kind: 'line';
    p: XY2;
    n: XY2;
} | {
    kind: 'circle';
    c: XY2;
    R: number;
    out: 1 | -1;
};
export declare const sub2: (a: XY2, b: XY2) => XY2, cross2: (a: XY2, b: XY2) => number, len2: (a: XY2) => number;
export declare const unit2: (a: XY2) => XY2;
/** A section curve pushed off by `by` along its outward normal. */
export declare function offset2(c: Section2, by: number): Section2;
/** Where two section curves meet (none, one or two points). */
export declare function meet2(a: Section2, b: Section2): XY2[];
/** The point of a section curve nearest X (a ball's tangent point). */
export declare function foot2(c: Section2, X: XY2): XY2;
/** The short way round a circle from P to Q about M. */
export declare const shortWay: (P: XY2, Q: XY2, M: XY2) => "cw" | "ccw";
/** A closed loop's signed area (counter-clockwise positive), its arcs exact: each chord's triangle plus the arc's segment. */
export declare function loopArea2(loop: readonly ProfileSegmentInput[]): number;
/**
 * A closed loop's signed area and first moment about the y axis (∫∫ x dA), by Green's theorem (∮ x dy, ∮ x²/2 dy):
 * lines in closed form, arcs integrated exactly over their sweep.
 */
export declare function loopMoments2(loop: readonly ProfileSegmentInput[]): {
    area: number;
    moment: number;
};
/** Whether the segment y = h, x in [x0, x1] lies inside the region bounded by these polylines (even-odd), its boundary included. */
export declare function lineInSoup(lines: readonly (readonly XY2[])[], h: number, x0: number, x1: number, tol: number): boolean;
/**
 * A face fillet between faces that all run along one direction — a plane along a cylinder's axis (a tube on a plate),
 * or two parallel cylinders (two bosses joined) — that need not touch. In the section square to the direction the faces
 * are lines and circles: the round's centre is where their curves pushed off by the radius meet (outward for an inside
 * corner, filled; inward for an outside one, cut), and its section — the corner where the curves meet, along one face
 * to its tangent point, the round's short arc, back along the other — is extruded over the length both faces run.
 * Faces that meet at two corners (a tube on a plate, two joined bosses) are rounded at both.
 * Each face (a cylinder may be partial) must hold its tangent line there; the volume is checked against the section's
 * exact area.
 */
export declare function parallelFillet(brep: Brep, source: Solid, A0: {
    name: string;
    faces: readonly BrepFace[];
}, B0: {
    name: string;
    faces: readonly BrepFace[];
}, r: number, at: string, fail: (code: CadPartErrorCode, detail: string) => never): Solid;
/**
 * Whether the segment y = h, x in [x0, x1] lies in a face (its rings in the plane's coordinates; the first of each
 * piece outer, the rest holes — tested by even-odd crossing, so the order does not matter), its boundary included.
 */
export declare function lineInFace(rings: readonly (readonly [number, number][])[], h: number, x0: number, x1: number, tol: number): boolean;
