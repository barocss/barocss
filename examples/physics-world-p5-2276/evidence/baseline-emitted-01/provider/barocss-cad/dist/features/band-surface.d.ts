import { KernelError } from '../core/barocss-error.js';
import { type Brep } from '../brep/brep-core.js';
/** A band's report (the output's `band`): what was joined, how exactly, and the measured distance of the patches' boundary from the source edges. */
export interface CadBandReport {
    /** Exact ruled patches (`${id}.band<k>`). */
    readonly pairs: number;
    readonly closed: boolean;
    readonly exact: true;
    /** The largest distance (mm) of a patch boundary sample from the unmodified source edge, over 33 samples per patch and side. */
    readonly boundaryDeviation: number;
    /** `pieces`: equal piece counts paired k↔k; `length`: split at normalized arc length. */
    readonly pairing: 'pieces' | 'length';
    /** Source pieces on side A and side B. */
    readonly pieces: readonly [number, number];
    /** The sentence the Studio shows. */
    readonly note: string;
}
export type BandRefusal = 'BAND_EDGE_LOST' | 'BAND_CHAIN' | 'BAND_OBLIQUE' | 'BAND_PROFILE' | 'BAND_TOUCH' | 'BAND_DEGENERATE';
export type BandCode = 'INPUT' | 'SELECTION' | 'CAPABILITY' | 'GEOMETRY';
/** A band refusal: the kernel code part-band.ts reports it under, and the `[BAND_*]` tag its message starts with. */
export declare class BandError extends KernelError {
    readonly refusal: BandCode;
    readonly tag: BandRefusal | null;
    constructor(refusal: BandCode, tag: BandRefusal | null, detail: string);
}
export interface BandSideInput {
    /** The body's feature id (for messages). */
    readonly body: string;
    readonly brep: Brep;
    readonly names: readonly string[];
}
export interface BandInput {
    readonly id: string;
    readonly a: BandSideInput;
    readonly b: BandSideInput;
    readonly flip?: boolean;
}
export interface BandResult {
    readonly brep: Brep;
    readonly report: CadBandReport;
}
/** A band surface between two edge chains, as one exact sheet body (faces `${id}.band<k>`) and its report. */
export declare function bandSurface(input: BandInput): BandResult;
