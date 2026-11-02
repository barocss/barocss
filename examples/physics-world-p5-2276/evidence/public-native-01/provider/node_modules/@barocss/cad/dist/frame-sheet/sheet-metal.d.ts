import type { Point } from '../types.js';
import type { ProfileSegmentInput, XY } from '../features/extruded-profile-solid.js';
import { type KernelError } from '../core/barocss-error.js';
/** The developed length of a bend, θ (radians) at the neutral radius: BA = θ(R + K·T). */
export declare const bendAllowance: (angle: number, radius: number, thickness: number, kFactor: number) => number;
/** The outside setback, from a bend's tangent line to its outer virtual sharp: OSSB = (R + T)·tan(θ/2) (θ < π). */
export declare const outsideSetback: (angle: number, radius: number, thickness: number) => number;
/** The bend deduction: BD = 2·OSSB − BA (the outside dimensions to the virtual sharps less BD is the flat length). */
export declare const bendDeduction: (angle: number, radius: number, thickness: number, kFactor: number) => number;
/** One bend as built: its faces, inner radius, angle, axis and its allowance, setback and deduction. */
export interface SheetBendReport {
    /** `<feature>.bend<k>`, k the path's vertex it rounds. */
    readonly name: string;
    /** Its concave face (radius R) and its convex face (radius R + T). */
    readonly inner: string;
    readonly outer: string;
    readonly radius: number;
    readonly angle: number;
    /** The bend's axis, through its centre along the sheet's width. */
    readonly axis: {
        readonly origin: Point;
        readonly direction: Point;
    };
    readonly allowance: number;
    readonly setback: number;
    readonly deduction: number;
    /** Its K-factor: the sheet's, or its bend table's for its T, R and angle (R12.4), with the rows used. */
    readonly kFactor: number;
    readonly table?: BendTableUse;
}
/** A sheet-metal body's rules and bends (R12.1, D116). */
export interface SheetReport {
    readonly thickness: number;
    readonly bendRadius: number;
    /** One K-factor for every bend, or (R12.4, D120) a bend table giving each bend's by its T, R and angle: one of them. */
    readonly kFactor?: number;
    readonly bendTable?: BendTable;
    /** The face its flat lies in by default (R12.2): a plate's `top`, a profile's `leg0.a`. */
    readonly fixedFace: string;
    readonly bends: readonly SheetBendReport[];
}
/** A sheet-metal refusal: the part model's code, the message starting with its own `[CODE]`. */
export declare const sheetMetalError: (code: "PARAMETER" | "GEOMETRY", detail: string) => KernelError & {
    readonly code: "PARAMETER" | "GEOMETRY";
};
/** Whether something thrown is this module's refusal. */
export declare const isSheetMetalError: (e: unknown) => e is KernelError & {
    readonly code: "PARAMETER" | "GEOMETRY";
};
/** A bend of the section: its centre, signed turn (radians, + to the left) and its two faces' names. */
export interface ContourBend {
    readonly vertex: number;
    readonly center: XY;
    readonly angle: number;
    readonly inner: string;
    readonly outer: string;
}
/** A contour flange's section: one closed loop of lines and arcs, a name for each of its segments, its bends. */
export interface ContourSection {
    readonly segments: readonly ProfileSegmentInput[];
    readonly names: readonly string[];
    readonly bends: readonly ContourBend[];
}
/**
 * The section of a contour flange: the open `path` (its corners the reference skin's virtual sharps) is one skin of the
 * sheet, the material T thick to its `side` (left or right, looking along it), a bend at every corner — the radius on
 * the path's skin R where the material lies outside the turn, R + T where it lies inside it, so the inner radius is R
 * either way. Faces: `<id>.leg<i>.a` (on the path) and `.b` (the other skin), `<id>.bend<k>.inner` / `.outer`,
 * `<id>.start` and `<id>.end` (the thickness at the path's ends). Refused by name: a turn of 0 or 180°
 * (`BEND_ANGLE`), a leg too short for its bends (`BEND_DOES_NOT_FIT`), a section crossing or touching itself
 * (`SHEET_CROSSES_ITSELF`).
 */
export declare function contourFlangeSection(path: readonly XY[], side: 'left' | 'right', thickness: number, radius: number, id: string): ContourSection;
/** An edge flange's section in its edge's frame (x out of the plate across the edge, y up from the picked skin). */
export interface FlangeSection {
    readonly segments: readonly ProfileSegmentInput[];
    readonly names: readonly string[];
    readonly center: XY;
}
/**
 * The section of an edge flange (R12.3, D118): the plate at x ≤ 0 between y = −T and the picked skin at y = 0, trimmed
 * back to x = −trim; a bend of inner radius R from there, turning θ up (towards +y), then a straight leg `straight` long.
 * Faces `<id>.root` (where it joins the plate), `.bend.inner` / `.outer`, `.leg.inner` (going on from the picked skin) /
 * `.outer`, `.tip`.
 */
export declare function flangeSection(id: string, thickness: number, radius: number, angle: number, trim: number, straight: number): FlangeSection;
/** Where a table's values come from: a named source (its page, the date it was read), cited by id from its rows. */
export interface BendTableSource {
    readonly id: string;
    readonly label: string;
    readonly url?: string;
    readonly read?: string;
    readonly note?: string;
}
/**
 * One row: a sheet T thick bent at inner radius R (at `angle`, or at any angle for a K row without one) has
 * K-factor `kFactor`, or bend allowance `allowance`, or bend deduction `deduction` (one of them; the last two need the
 * angle). It cites a `source` by id, or says `estimate: true` — never neither.
 */
export interface BendTableRow {
    readonly thickness: number;
    readonly radius: number;
    readonly angle?: number;
    readonly kFactor?: number;
    readonly allowance?: number;
    readonly deduction?: number;
    readonly source?: string;
    readonly estimate?: boolean;
}
/** A bend table carried in the part (R12.4): its rows and the sources they cite. */
export interface BendTable {
    readonly id: string;
    readonly material?: string;
    readonly sources?: readonly BendTableSource[];
    readonly rows: readonly BendTableRow[];
}
/** How a bend's K came from a table: the rows used (indices), exactly or by linear interpolation, and whether any is an estimate. */
export interface BendTableUse {
    readonly table: string;
    readonly rows: readonly number[];
    readonly how: 'exact' | 'interpolated';
    readonly estimate: boolean;
}
/** A row's K-factor: given, or from its allowance (K = (BA/θ − R)/T) or its deduction (BA = 2·OSSB − BD). */
export declare function rowKFactor(row: BendTableRow): number;
export declare function bendTableProblem(t: unknown): string | null;
/**
 * A bend's K from a table (D120): the row of its T, R and angle exactly; else linear in R between the rows of its T
 * either side (rows for any angle), or bilinear in R and the angle inside a grid of four rows of its T. Outside the
 * table's rows: a miss, said why.
 */
export declare function lookupBend(t: BendTable, thickness: number, radius: number, angle: number): {
    use: BendTableUse;
    kFactor: number;
} | {
    miss: string;
};
