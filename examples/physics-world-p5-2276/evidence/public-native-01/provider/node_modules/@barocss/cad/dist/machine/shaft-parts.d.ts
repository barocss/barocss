import type { Brep } from '../brep/brep-core.js';
import { type BrepAffine } from '../brep/brep-transform.js';
import { type FitLimits, type FitTable } from './fits.js';
import type { ShaftReport } from './shaft.js';
import type { Point } from '../types.js';
import { type KernelError } from '../core/barocss-error.js';
export type ShaftPartCode = 'INVALID_INPUT' | 'KEY_FIT' | 'RING_FIT' | 'PIN_FIT';
/** This module's refusal (R7.3a batch 2: the ShaftPartError class folded, D279): a BarocssError, `details.source` 'shaft-part'. */
export declare const shaftPartError: (code: ShaftPartCode, detail: string) => KernelError & {
    readonly code: ShaftPartCode;
};
/** Whether something thrown is this module's refusal. */
export declare const isShaftPartError: (e: unknown) => e is KernelError & {
    readonly code: ShaftPartCode;
};
/** The shaft as placed: its report and the map from its own frame (axis +Z) into the part. */
export interface PlacedShaft {
    readonly report: ShaftReport;
    readonly place: BrepAffine;
}
/** A hub keyway as cut: its sizes, the bore's axis and the keyway's direction from it. */
export interface KeywayReport {
    readonly face: string;
    readonly width: number;
    readonly depth: number;
    readonly boreRadius: number;
    readonly floorRadius: number;
    readonly axisPoint: Point;
    readonly axis: Point;
    readonly direction: Point;
    readonly angle: number;
    readonly from: number;
    readonly to: number;
}
export interface KeyFitClasses {
    readonly tables: readonly FitTable[];
    readonly key: string;
    readonly seat?: string;
    readonly hub?: string;
}
export interface KeyReport {
    readonly keyseat: number;
    readonly width: number;
    readonly height: number;
    readonly length: number;
    readonly ends: 'round' | 'square';
    /** The seat's width less the key's (negative: the key is the wider), how far the key stands above the shaft, its length's room in the seat. */
    readonly seatPlay: number;
    readonly stands: number;
    readonly lengthRoom: number;
    /** With a hub: the keyway's width less the key's and the clearance over the key's top. */
    readonly hub?: {
        readonly keywayPlay: number;
        readonly topClearance: number;
    };
    /** With classes: the seat's and the hub's fits on the key's width (R12c.2). */
    readonly seatFit?: FitLimits;
    readonly hubFit?: FitLimits;
}
export interface RingRow {
    readonly shaftDiameter?: number;
    readonly grooveDiameter?: number;
    readonly grooveWidth?: number;
    readonly source?: string;
    readonly estimate?: boolean;
}
export interface RingReport {
    readonly groove: number;
    readonly thickness: number;
    readonly innerDiameter: number;
    readonly outerDiameter: number;
    readonly axialPlay: number;
    readonly estimate: boolean;
    readonly source?: string;
}
export interface PinReport {
    readonly hole: number;
    readonly diameter: number;
    readonly length: number;
    readonly holeDiameter: number;
    readonly clearance: number;
}
/** The hub's keyway cut into `target` at its bore face. */
export declare function keywayCut(target: Brep, spec: {
    readonly face: string;
    readonly width: number;
    readonly depth: number;
    readonly angle?: number;
}, id: string): {
    readonly brep: Brep;
    readonly report: KeywayReport;
};
/** A parallel key in keyseat `spec.keyseat` of a placed shaft; with a hub keyway, checked against it. */
export declare function keySolid(shaft: PlacedShaft, spec: {
    readonly keyseat: number;
    readonly width?: number;
    readonly height: number;
    readonly length?: number;
    readonly ends?: 'round' | 'square';
    readonly hub?: KeywayReport;
    readonly fit?: KeyFitClasses;
}, id: string): {
    readonly brep: Brep;
    readonly report: KeyReport;
};
/** A retaining ring's envelope in groove `spec.groove` of a placed shaft, checked against the user's row. */
export declare function ringSolid(shaft: PlacedShaft, spec: {
    readonly groove: number;
    readonly thickness: number;
    readonly outerDiameter: number;
    readonly row?: RingRow;
}, id: string): {
    readonly brep: Brep;
    readonly report: RingReport;
};
/** A pin in cross hole `spec.hole` of a placed shaft. */
export declare function pinSolid(shaft: PlacedShaft, spec: {
    readonly hole: number;
    readonly diameter?: number;
    readonly length?: number;
    readonly fit?: boolean;
}, id: string): {
    readonly brep: Brep;
    readonly report: PinReport;
};
