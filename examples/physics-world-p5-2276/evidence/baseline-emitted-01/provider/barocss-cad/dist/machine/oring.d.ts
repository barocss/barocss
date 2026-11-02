import type { Brep } from '../brep/brep-core.js';
import { type FitTable } from './fits.js';
import type { Point } from '../types.js';
import { type KernelError } from '../core/barocss-error.js';
export type GlandCode = 'INVALID_INPUT' | 'GLAND_DIMENSIONS' | 'SQUEEZE_RANGE' | 'FILL_RANGE' | 'STRETCH_RANGE';
/** This module's refusal (R7.3a batch 2: the GlandError class folded, D279): a BarocssError, `details.source` 'gland'. */
export declare const glandError: (code: GlandCode, detail: string) => KernelError & {
    readonly code: GlandCode;
};
/** Whether something thrown is this module's refusal. */
export declare const isGlandError: (e: unknown) => e is KernelError & {
    readonly code: GlandCode;
};
export interface ORingRow {
    readonly id: string;
    readonly dash?: string;
    readonly insideDiameter: number;
    readonly crossSection: number;
    readonly source?: string;
    readonly estimate?: boolean;
}
export interface GlandRanges {
    readonly squeezePercent: readonly [number, number];
    readonly fillPercent: readonly [number, number];
    readonly stretchMaxPercent: number;
    readonly source?: string;
    readonly estimate?: boolean;
}
/** D139's O2 (Fictiv's O-ring groove design guide, read 2026-10-21): guidance ranges, shipped as estimates. */
export declare const O2_RANGES: {
    readonly radial: GlandRanges;
    readonly face: GlandRanges;
};
export interface GlandSpec {
    readonly kind: 'piston' | 'rod' | 'face';
    readonly ring: ORingRow;
    /** piston: the groove's bottom Ø; rod: its bottom (outer) Ø; face: its inner Ø. */
    readonly grooveDiameter: number;
    readonly width: number;
    /** piston: the bore's Ø; rod: the rod's Ø (radial glands). */
    readonly sealDiameter?: number;
    /** face: the groove's depth. */
    readonly depth?: number;
    readonly ranges?: GlandRanges;
    /** The seal's and the groove's classes (R12c.2): the depth at their extremes. */
    readonly fit?: {
        readonly tables: readonly FitTable[];
        readonly seal?: string;
        readonly groove?: string;
    };
}
export interface GlandReport {
    readonly kind: 'piston' | 'rod' | 'face';
    readonly ring: string;
    readonly ringEstimate: boolean;
    readonly ringSource?: string;
    readonly insideDiameter: number;
    readonly crossSection: number;
    readonly grooveDiameter: number;
    readonly width: number;
    readonly depth: number;
    readonly sealDiameter?: number;
    readonly stretchPercent: number;
    readonly stretchedCrossSection: number;
    readonly squeezePercent: number;
    readonly squeezeStretchedPercent: number;
    readonly fillPercent: number;
    readonly fillStretchedPercent: number;
    /** At the fit's extremes (stretched section): the least and the greatest squeeze. */
    readonly squeezeRangePercent?: readonly [number, number];
    readonly ranges: GlandRanges;
    readonly warnings: readonly {
        readonly code: 'SQUEEZE_RANGE' | 'FILL_RANGE' | 'STRETCH_RANGE';
        readonly message: string;
    }[];
}
/** Why an O-ring row is not one, or null. */
export declare function oringRowProblem(r: unknown): string | null;
/** A gland's arithmetic: its depth, stretch, stretched section, squeeze, fill; checked against the ranges. */
export declare function glandCheck(spec: GlandSpec): GlandReport;
/** Where a gland stands: its axis (a point and direction), its groove's span along it, the side of the ring. */
export interface GlandPlace {
    readonly origin: Point;
    readonly axis: Point;
    readonly from: number;
    readonly to: number;
    readonly ringCenterRadius: number;
    readonly ringCenterAlong: number;
}
/** The gland's groove cut into `target` at its face, with the gland's check. */
export declare function glandCut(target: Brep, spec: GlandSpec & {
    readonly face: string;
    readonly at?: number;
    readonly center?: Point;
}, id: string): {
    readonly brep: Brep;
    readonly report: GlandReport;
    readonly place: GlandPlace;
};
/** The O-ring in its gland as an exact torus (stretched section, at rest where it is stretched: a piston's groove bottom, a rod), and the free ring's overlap with what squeezes it (the bore, the rod gland's groove bottom, the face's flange) by the analytic Boolean. */
export declare function oringInGland(report: GlandReport, place: GlandPlace, id: string): {
    readonly brep: Brep;
    readonly overlap: number;
};
