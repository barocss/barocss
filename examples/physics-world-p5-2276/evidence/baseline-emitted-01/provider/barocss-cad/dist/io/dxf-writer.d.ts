import { type KernelError } from '../core/barocss-error.js';
export declare const DXF_WRITER_VERSION = "barocss-dxf-writer-v1";
export type DxfVersion = 'AC1015' | 'AC1009';
export type DxfUnits = 'unitless' | 'in' | 'ft' | 'mm' | 'cm' | 'm';
export type DxfXY = readonly [number, number];
/** `color`: an AutoCAD colour index 1–255 (7: black on paper, white on screen); `lineweight`: 1/100 mm (AC1015 only). */
export interface DxfLayer {
    name: string;
    color?: number;
    linetype?: string;
    lineweight?: number;
}
/** `pattern`: dash lengths (positive), gaps (negative) and dots (0), in drawing units. */
export interface DxfLinetype {
    name: string;
    description: string;
    pattern: readonly number[];
}
/** `font`: the font file a CAD program looks for (e.g. `arial.ttf`). */
export interface DxfTextStyle {
    name: string;
    font: string;
}
/** A boundary loop of a hatch: closed, `bulges[i]` the bulge of the side from point i to point i + 1. */
export interface DxfHatchLoop {
    points: readonly DxfXY[];
    bulges?: readonly number[];
}
/** `lines`: a family of parallel lines `spacing` apart at `angle`, one through `origin` (default 0, 0). */
export type DxfHatchFill = {
    kind: 'solid';
} | {
    kind: 'lines';
    angle: number;
    spacing: number;
    origin?: DxfXY;
};
/** The definition points of a dimension (drawing coordinates). */
export type DxfDimensionGeometry = 
/** `p1`, `p2`: the measured points; `line`: a point on the dimension line; `angle`: the dimension line's direction. */
{
    kind: 'linear';
    p1: DxfXY;
    p2: DxfXY;
    line: DxfXY;
    angle: number;
} | {
    kind: 'aligned';
    p1: DxfXY;
    p2: DxfXY;
    line: DxfXY;
}
/** The two lines (each start → end) and a point on the dimension arc. */
 | {
    kind: 'angular';
    line1: readonly [DxfXY, DxfXY];
    line2: readonly [DxfXY, DxfXY];
    arc: DxfXY;
}
/** `rim`: the point on the circle the dimension points at; `opposite`: the point across from it. */
 | {
    kind: 'diameter';
    rim: DxfXY;
    opposite: DxfXY;
} | {
    kind: 'radius';
    center: DxfXY;
    rim: DxfXY;
};
interface DxfEntityBase {
    layer?: string;
    linetype?: string;
    color?: number;
}
export type DxfEntity = DxfEntityBase & ({
    type: 'line';
    a: DxfXY;
    b: DxfXY;
} | {
    type: 'circle';
    center: DxfXY;
    radius: number;
}
/** Counter-clockwise from `start` to `end`. */
 | {
    type: 'arc';
    center: DxfXY;
    radius: number;
    start: number;
    end: number;
}
/** `major`: the major semi-axis from the centre; `ratio`: minor / major (0, 1]; counter-clockwise from parameter `start` to `end` (radians). */
 | {
    type: 'ellipse';
    center: DxfXY;
    major: DxfXY;
    ratio: number;
    start: number;
    end: number;
}
/** `bulges[i]`: tan(sweep / 4) of the side from point i to i + 1 (positive counter-clockwise). */
 | {
    type: 'lwpolyline';
    points: readonly DxfXY[];
    bulges?: readonly number[];
    closed?: boolean;
}
/** A NURBS curve: `knots` = control points + degree + 1, nondecreasing; `weights` (all positive) make it rational. */
 | {
    type: 'spline';
    degree: number;
    knots: readonly number[];
    control: readonly DxfXY[];
    weights?: readonly number[];
}
/** One line of text; `at` is its baseline point at the `align` side. */
 | {
    type: 'text';
    at: DxfXY;
    height: number;
    text: string;
    rotation?: number;
    align?: 'left' | 'center' | 'right';
    style?: string;
}
/** Lines of text (\n between them), `at` the top left corner. */
 | {
    type: 'mtext';
    at: DxfXY;
    height: number;
    text: string;
    rotation?: number;
    style?: string;
}
/** A filled triangle or quadrilateral, its corners in order round it. */
 | {
    type: 'solid';
    points: readonly DxfXY[];
} | {
    type: 'hatch';
    loops: readonly DxfHatchLoop[];
    fill: DxfHatchFill;
} | {
    type: 'insert';
    block: string;
    at: DxfXY;
    scale?: number;
    rotation?: number;
}
/** `block`: what the dimension shows (lines, solids, text) in drawing coordinates; `text`: its text as shown; `measurement`: the measured value. */
 | {
    type: 'dimension';
    geometry: DxfDimensionGeometry;
    block: readonly DxfEntity[];
    text: string;
    textAt: DxfXY;
    measurement?: number;
});
export interface DxfBlock {
    name: string;
    base?: DxfXY;
    entities: readonly DxfEntity[];
}
export interface DxfDocument {
    units: DxfUnits;
    /** Dimension style defaults in drawing units; anonymous display blocks are unchanged. Omitted: legacy defaults. */
    dimensionStyle?: {
        textHeight: number;
        textPlacement: 'above' | 'center';
        textOrientation: 'aligned' | 'horizontal';
    };
    layers?: readonly DxfLayer[];
    linetypes?: readonly DxfLinetype[];
    styles?: readonly DxfTextStyle[];
    blocks?: readonly DxfBlock[];
    entities: readonly DxfEntity[];
}
/** `r12ChordTolerance`: for R12, the largest distance (drawing units) allowed between an ellipse or spline and the polyline written for it. */
export interface DxfWriteOptions {
    version?: DxfVersion;
    r12ChordTolerance?: number;
}
export interface DxfWriteReport {
    contract: typeof DXF_WRITER_VERSION;
    version: DxfVersion;
    /** Entities written in model space, by DXF type. */
    modelSpace: Record<string, number>;
    /** Entities written in each block (dimension blocks `*D1`, `*D2`, … included), by DXF type. */
    blocks: Record<string, Record<string, number>>;
    /** R12 only: what was changed to fit it. `maxChordDeviation`: measured at 7 points a polyline side. */
    r12?: {
        ellipses: number;
        splines: number;
        polylines: number;
        mtexts: number;
        hatches: number;
        maxChordDeviation: number;
        unitsNotStored: boolean;
        lineweightsDropped: boolean;
    };
    extents: {
        min: [number, number];
        max: [number, number];
    } | null;
}
/** `text`: the file as characters; `bytes`: the file as written (Windows-1252). */
export interface DxfWriteResult {
    text: string;
    bytes: Uint8Array;
    report: DxfWriteReport;
}
export type DxfWriteErrorCode = 'NOT_FINITE' | 'BAD_ENTITY' | 'BAD_NAME' | 'DUPLICATE_NAME' | 'UNKNOWN_LAYER' | 'UNKNOWN_LINETYPE' | 'UNKNOWN_STYLE' | 'UNKNOWN_BLOCK' | 'BLOCK_CYCLE' | 'BAD_TEXT' | 'TEXT_TOO_LONG' | 'R12_UNSUPPORTED' | 'R12_NEEDS_TOLERANCE' | 'APPROX_TOLERANCE_NOT_MET';
/** This module's refusal (R7.3a batch 2: the DxfWriteError class folded, D279): a BarocssError, `details.source` 'dxf-write'. */
export declare const dxfWriteError: (code: DxfWriteErrorCode, detail: string) => KernelError & {
    readonly code: DxfWriteErrorCode;
};
/** Whether something thrown is this module's refusal. */
export declare const isDxfWriteError: (e: unknown) => e is KernelError & {
    readonly code: DxfWriteErrorCode;
};
/** A number as DXF text: the shortest form that reads back to the same binary64, never in exponent form. */
export declare function dxfNumber(x: number): string;
/**
 * Text as DXF writes it: Ø ° ± as the control codes %%c %%d %%p, % as %%%, other characters of Windows-1252
 * as they are, any other as \U+XXXX; multi-line text (`mtext`) escapes \ { } and writes \P between lines.
 * Characters outside the Basic Multilingual Plane and control characters are refused.
 */
export declare function dxfText(s: string, mtext: boolean): string;
/** Lines of a line hatch over straight-sided loops (even–odd), the family through `origin`. */
export declare function dxfHatchLines(loops: readonly DxfHatchLoop[], angle: number, spacing: number, origin?: DxfXY): [DxfXY, DxfXY][];
/** Writes a DXF file of the document. Throws a typed refusal (dxfWriteError) for anything it cannot write as given. */
export declare function writeDxf(doc: DxfDocument, options?: DxfWriteOptions): DxfWriteResult;
export {};
