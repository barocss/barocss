import type { FrameEndReport, FrameMemberReport } from './frame-section.js';
import { KernelError } from '../core/barocss-error.js';
import { type CadPartOutput } from '../part/part-model.js';
/** One end of a piece as cut: what finishes it, and for a plane its angles from square (degrees). */
export interface CutEnd {
    readonly end: 'start' | 'end';
    /** square (or a through member's run-on, cut square), mitre, butt or trim to a plane — planes; cope or trim to an envelope or a body — not. */
    readonly kind: FrameEndReport['kind'];
    readonly gap?: number;
    readonly notch?: FrameEndReport['notch'];
    readonly point: number;
    /** The plane's tilt about the section's y (a mitre box's angle) and about its x (the saw's bevel); null where the end is no plane. */
    readonly mitre: number | null;
    readonly bevel: number | null;
    readonly with?: number;
}
/** A member as a piece to cut (`cutPiece`). */
export interface CutPiece {
    /** The output it is. */
    readonly id: string;
    readonly curve?: FrameMemberReport['curve'];
    readonly section: string;
    readonly area: number;
    /** Turned over across its section's y axis (FR2). */
    readonly mirrored: boolean;
    /** Whether a reversed piece is the same piece: its section symmetric about its own x or y through its centroid (a tube, a channel); else (an angle) its ends are told apart in order. */
    readonly reversible: boolean;
    /** Its centroidal axis between its end planes (closed form), or its volume over its area where an end is no plane (`fromVolume`). */
    readonly axisLength: number;
    readonly fromVolume: boolean;
    /** Its extent along its line, from the body (vertices, and curved edges at 64 points each). */
    readonly longPoint: number;
    readonly volume: number;
    readonly ends: readonly [CutEnd, CutEnd];
    /** Its own material and density (g/cm³), where the caller gives one (a body's material): grouped by it, its mass by it. */
    readonly material?: string;
    readonly density?: number;
}
/** One row of a cut list: identical pieces. */
export interface CutRow {
    readonly item: number;
    readonly section: string;
    readonly mirrored: boolean;
    readonly quantity: number;
    readonly pieces: readonly string[];
    readonly material?: string;
    readonly axisLength: number;
    readonly fromVolume: boolean;
    readonly longPoint: number;
    readonly ends: readonly [CutEnd, CutEnd];
    /** A piece's mass: ρ·A·L (closed form) where both ends are planes, else ρ·V (the body's volume); and the row's. */
    /** Each piece's mass and the row's (g, R7.3b). */
    readonly mass: number;
    readonly totalMass: number;
}
export interface CutList {
    readonly rows: readonly CutRow[];
    readonly totals: {
        readonly quantity: number;
        readonly axisLength: number;
        readonly mass: number;
    };
    readonly density: number;
    readonly material?: string;
}
/** A cut list refused: its message starts with `[CODE]`. */
export declare class CutListError extends KernelError {
    constructor(detail: string);
}
/** A frame member's output as a piece to cut; refused `[NOT_A_MEMBER]` for a body that is no member. */
export declare function cutPiece(output: CadPartOutput & {
    readonly member?: FrameMemberReport;
}, options?: {
    readonly volume?: number;
}): CutPiece;
/**
 * The cut list of pieces (FR4a, D127): identical pieces on one row — the same section (mirrored apart), axis length and
 * long point to 1e-6 mm, and end cuts (kind, mitre and bevel to 1e-6°; as an unordered pair where the piece is reversible,
 * in order where it is not); a piece with an end that is no plane also by its volume (to 1e-3 mm³). In first-seen
 * order; pieces of different materials apart. Mass (g) by each piece's density, else `density` (g/cm³), the caller's.
 */
export declare function cutList(pieces: readonly CutPiece[], options: {
    readonly density: number;
    readonly material?: string;
}): CutList;
/** A cut list as CSV (RFC 4180 quoting; lengths in mm to 1e-3, angles to 1e-3°, mass shown in kg to 1e-6, a person's unit for a cut list). */
export declare function cutListCsv(list: CutList): string;
