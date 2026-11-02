import { type KernelError } from '../core/barocss-error.js';
import type { SectionRationalContext, SectionFraction } from '../section-rational-internal.js';
import type { Point } from '../types.js';
export interface WallCycleContext {
    readonly q: SectionRationalContext;
    direct(amount: number): void;
    integer(value: bigint): bigint;
    structure(amount: number): void;
    check(): void;
}
/** Private mathematical operands, already owned by the caller. No provenance flag is consumed. */
export interface WallCycleSpan {
    readonly face: string;
    readonly span: 0 | 1;
    readonly sense: 'forward' | 'reversed';
    readonly controlPoints: readonly Point[];
    readonly weights: readonly number[];
}
export interface WallCycleSpanProof {
    readonly face: string;
    readonly span: 0 | 1;
    readonly sense: 'forward' | 'reversed';
    readonly minimumWeight: SectionFraction;
    readonly radialDefectCoefficients: readonly SectionFraction[];
    /** Degree two Bernstein coefficients of X Y' - Y X', in directed local t in [0,1]. */
    readonly angularCoefficients: readonly SectionFraction[];
    readonly halfPlane: {
        readonly normal: readonly [number, number];
        readonly minimum: SectionFraction;
    };
    readonly radial: SectionFraction;
}
export interface WallCycleProof {
    readonly spans: readonly WallCycleSpanProof[];
    readonly cycle: readonly number[];
    readonly radial: SectionFraction;
    readonly radialNormalizationL1: SectionFraction;
    readonly winding: 1;
    readonly simpleRadialGraph: true;
    readonly projection: 'xy';
    readonly authority: 'exact-stored-rational-coefficients';
    readonly nativeEvaluatorCertified: false;
}
export type WallCycleCode = 'SUPPORT' | 'BUDGET';
export type WallCycleError = KernelError & {
    readonly code: WallCycleCode;
};
export declare function wallCycleFailure(code: WallCycleCode, detail: string): never;
export declare function isWallCycleError(error: unknown): error is WallCycleError;
/**
 * Private coefficient theorem. The caller owns finite operands and the aggregate ledger.
 * This function proves no producer identity, topology, cap, native evaluation or mass claim.
 */
export declare function certifyCylindricalWallCycle(spans: readonly WallCycleSpan[], radius: number, ctx: WallCycleContext): WallCycleProof;
/** Private cap continuation: XY means exact normalized (2u-1,2v-1), without Number lifting. */
export declare function certifyCylindricalCapCycle(spans: readonly WallCycleSpan[], ctx: WallCycleContext): WallCycleProof;
