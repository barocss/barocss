import type { Brep } from '../brep/brep-core.js';
import type { DxfDocument } from '../io/dxf-writer.js';
import { type BendTable, type BendTableUse } from './sheet-metal.js';
import { type KernelError } from '../core/barocss-error.js';
export type XY = [number, number];
/** A piece of the flat's outline: a line, a circular arc (`ccw` from `start` to `end`), or a planar curve's exact image. */
export type FlatSegment = {
    readonly kind: 'line';
    readonly a: XY;
    readonly b: XY;
} | {
    readonly kind: 'arc';
    readonly center: XY;
    readonly radius: number;
    readonly start: XY;
    readonly end: XY;
    readonly ccw: boolean;
} | {
    readonly kind: 'spline';
    readonly degree: number;
    readonly knots: readonly number[];
    readonly control: readonly XY[];
    readonly weights: readonly number[];
};
/** A closed loop of the outline; `outer` for the boundary, else a hole. `area`: signed (outer counter-clockwise). */
export interface FlatLoop {
    readonly outer: boolean;
    readonly segments: readonly FlatSegment[];
    readonly area: number;
}
/** A bend in the flat: its strip between its tangent lines, its centre line, which way it folds, its data. */
export interface FlatBend {
    readonly name: string;
    /** `up`: towards the viewer (the flat is seen from the fixed face's outside), `down`: away. */
    readonly direction: 'up' | 'down';
    readonly angle: number;
    readonly radius: number;
    readonly kFactor: number;
    /** The developed width θ(R + K·T). */
    readonly allowance: number;
    readonly centre: readonly [XY, XY];
    readonly tangents: readonly [readonly [XY, XY], readonly [XY, XY]];
    readonly faces: readonly string[];
    /** Its K from a bend table (R12.4, D120): the rows used. */
    readonly table?: BendTableUse;
}
export interface FlatPattern {
    /** One K for every bend, or each bend's from a table (then undefined here, each bend's own). */
    readonly thickness: number;
    readonly kFactor?: number;
    /** The face the flat lies in the plane of (its outside towards the viewer). */
    readonly fixedFace: string;
    readonly loops: readonly FlatLoop[];
    readonly bends: readonly FlatBend[];
    /** The flat's area (outer loop less holes) and its box (the flat is moved so its box starts at 0, 0). */
    readonly area: number;
    readonly box: {
        readonly min: XY;
        readonly max: XY;
    };
}
export type FlatPatternErrorCode = 'NOT_A_SHEET' | 'NON_NORMAL_CUT' | 'BEND_NOT_CYLINDRICAL' | 'FLAT_OVERLAPS' | 'CUT_ACROSS_BEND' | 'BEND_TABLE_MISS';
/** A refusal: its message starts with its `[CODE]`. */
export declare const flatPatternError: (code: FlatPatternErrorCode, detail: string) => KernelError & {
    readonly code: FlatPatternErrorCode;
};
/** Whether something thrown is this module's refusal. */
export declare const isFlatPatternError: (e: unknown) => e is KernelError & {
    readonly code: FlatPatternErrorCode;
};
export interface FlatPatternOptions {
    /** One K-factor for every bend, or a bend table giving each bend's by its T, inner R and angle (R12.4): one of them. */
    readonly thickness: number;
    readonly kFactor?: number;
    readonly bendTable?: BendTable;
    /** The fixed face by name (its pieces `#k`: the largest); else the largest planar face. */
    readonly fixedFace?: string;
    /** Names for the bends, matched by a face of theirs (the sheet report's: `bend<k>` for others). */
    readonly bendNames?: readonly {
        readonly name: string;
        readonly faces: readonly string[];
    }[];
}
/** The flat pattern of a sheet-metal body (see the top of this file); refusals typed (flatPatternError). */
export declare function flatPattern(brep: Brep, options: FlatPatternOptions): FlatPattern;
/** An arc's signed sweep (radians, counter-clockwise positive); a closed arc a full turn. */
export declare function arcSweep(s: Extract<FlatSegment, {
    kind: 'arc';
}>): number;
/**
 * The flat as a DXF document for the writer (R11b): its outline on OUTLINE, each bend's centre line on BEND_UP or
 * BEND_DOWN (dashed), and a note at its middle on BEND_NOTES (`UP 90° R1.5`), in mm.
 */
export declare function flatPatternDxf(flat: FlatPattern, options?: {
    readonly textHeight?: number;
}): DxfDocument;
