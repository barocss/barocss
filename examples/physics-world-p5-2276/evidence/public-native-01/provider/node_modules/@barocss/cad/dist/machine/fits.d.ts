import type { Brep } from '../brep/brep-core.js';
import { KernelError } from '../core/barocss-error.js';
export type FitErrorCode = 'FIT_TABLE' | 'FIT_TABLE_MISS' | 'FIT_FACE' | 'FIT_PAIR';
export declare class FitError extends KernelError {
    readonly code: FitErrorCode;
    constructor(code: FitErrorCode, detail: string);
}
export interface FitSource {
    readonly id: string;
    readonly label: string;
    readonly url?: string;
    readonly read?: string;
    readonly note?: string;
}
/** A class's limits over a range of nominal sizes: over < size ≤ up to (mm), the upper and lower deviations (mm). */
export interface FitRow {
    readonly class: string;
    readonly over: number;
    readonly upTo: number;
    readonly upper: number;
    readonly lower: number;
    readonly source?: string;
    readonly estimate?: boolean;
}
export interface FitTable {
    readonly id: string;
    readonly sources?: readonly FitSource[];
    readonly rows: readonly FitRow[];
}
/** Whether a class is a hole's (capital letters). */
export declare const isHoleClass: (c: string) => boolean;
/** Why a fit table is not one, or null. */
export declare function fitTableProblem(t: unknown): string | null;
/** A class's limits at a nominal size: the deviations, the limit sizes and the row they come from. */
export interface FitLimit {
    readonly class: string;
    readonly nominal: number;
    readonly upper: number;
    readonly lower: number;
    /** The greatest and least sizes: nominal + upper, nominal + lower. */
    readonly max: number;
    readonly min: number;
    readonly table: string;
    readonly row: number;
    readonly estimate: boolean;
    readonly source?: string;
}
/** A class's row at a nominal size, from the first table holding one ([FIT_TABLE_MISS] says what to load). */
export declare function lookupFit(tables: readonly FitTable[], cls: string, size: number): FitLimit;
export interface FitLimits {
    readonly hole: FitLimit;
    readonly shaft: FitLimit;
    /** EI − es and ES − ei (mm): the least and the greatest clearance; negative is interference. */
    readonly clearanceMin: number;
    readonly clearanceMax: number;
    readonly kind: 'clearance' | 'transition' | 'interference';
    /** Whether either row is an estimate. */
    readonly estimate: boolean;
}
/** A hole class and a shaft class at one nominal size. */
export declare function fitLimits(tables: readonly FitTable[], holeClass: string, shaftClass: string, nominal: number): FitLimits;
/** A cylindrical face of a B-rep, by name or id, and its class. */
export interface FitFace {
    readonly brep: Brep;
    readonly face: string;
    readonly class: string;
}
/** One material condition: the sizes, the overlap the Boolean finds and the closed form for coaxial cylinders. */
export interface FitCondition {
    readonly hole: number;
    readonly shaft: number;
    readonly overlap: number;
    readonly coaxial: number;
}
export interface FitCheck {
    readonly limits: FitLimits;
    /** The axes' distance, and the length along them both faces cover. */
    readonly offset: number;
    readonly length: number;
    /** The least radial clearance at MMC less the offset (negative: they meet). */
    readonly margin: number;
    readonly mmc: FitCondition;
    readonly lmc: FitCondition;
    /** A clearance fit whose bodies overlap at MMC. */
    readonly contradicted: boolean;
    readonly message: string;
}
/** A hole face and a shaft face: their limits and the pair at MMC and LMC by the analytic Boolean. */
export declare function checkFit(tables: readonly FitTable[], hole: FitFace, shaft: FitFace): FitCheck;
