import type { Brep } from '../brep/brep-core.js';
import { type FitLimit, type FitTable } from './fits.js';
import type { PlacedShaft } from './shaft-parts.js';
import { type KernelError } from '../core/barocss-error.js';
export type BearingCode = 'INVALID_INPUT' | 'SEAT_ABUTMENT' | 'SEAT_FIT';
/** This module's refusal (R7.3a batch 2: the BearingError class folded, D279): a BarocssError, `details.source` 'bearing'. */
export declare const bearingError: (code: BearingCode, detail: string) => KernelError & {
    readonly code: BearingCode;
};
/** Whether something thrown is this module's refusal. */
export declare const isBearingError: (e: unknown) => e is KernelError & {
    readonly code: BearingCode;
};
export interface BearingRow {
    readonly id: string;
    readonly designation?: string;
    readonly bore: number;
    readonly outside: number;
    readonly width: number;
    readonly chamfer?: number;
    readonly daMin?: number;
    readonly daMax?: number;
    readonly DaMax?: number;
    readonly raMax?: number;
    readonly boreDeviation?: readonly [number, number];
    readonly outsideDeviation?: readonly [number, number];
    readonly source?: string;
    readonly estimate?: boolean;
}
export interface BearingFitClasses {
    readonly tables: readonly FitTable[];
    readonly shaft?: string;
    readonly housing?: string;
}
export interface BearingRingFit {
    readonly limit: FitLimit;
    readonly clearanceMin?: number;
    readonly clearanceMax?: number;
    readonly kind?: 'clearance' | 'transition' | 'interference';
}
export interface BearingReport {
    readonly row: string;
    readonly designation?: string;
    readonly bore: number;
    readonly outside: number;
    readonly width: number;
    readonly chamfer: number;
    readonly estimate: boolean;
    readonly source?: string;
    /** On its shaft: the step, the side against a shoulder, the bearing's span, the shoulder's diameter and fillet, the other side's location. */
    readonly seat?: {
        readonly step: number;
        readonly against: 'start' | 'end';
        readonly from: number;
        readonly to: number;
        readonly shoulder: number;
        readonly shoulderFillet: number;
        readonly located: string | null;
        readonly overlap: number;
    };
    /**
     * In its housing: the bore, the overlap, whether the bore covers the bearing, and its shoulder (FRk8a, D181): the planar
     * annulus at a face of the bearing stepping in from the bore, its diameter its inner edge's (null: none at either face).
     */
    readonly housing?: {
        readonly bore: number;
        readonly overlap: number;
        readonly covered: boolean;
        readonly shoulder: {
            readonly at: 'start' | 'end';
            readonly diameter: number;
        } | null;
    };
    readonly shaftFit?: BearingRingFit;
    readonly housingFit?: BearingRingFit;
    readonly warnings: readonly string[];
    readonly notForStructuralCalculation: true;
}
/** Why a bearing row is not one, or null. */
export declare function bearingRowProblem(r: unknown): string | null;
/** The envelope in its own frame: axis +Z, from z 0 to B, faces named under `id`. */
export declare function bearingEnvelope(row: BearingRow, id: string): Brep;
/** A bearing from `row`, on step `step` of a placed shaft against the shoulder at its `against` end; optionally in a housing. */
export declare function seatedBearing(row: BearingRow, shaft: PlacedShaft & {
    readonly brep: Brep;
}, spec: {
    readonly step: number;
    readonly against: 'start' | 'end';
    readonly housing?: Brep;
    readonly fit?: BearingFitClasses;
}, id: string): {
    readonly brep: Brep;
    readonly report: BearingReport;
};
