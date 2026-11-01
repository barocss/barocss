import { type KernelError } from '../core/barocss-error.js';
import { SectionRationalContext, type SectionFraction } from '../section-rational-internal.js';
import type { Surface } from '../types.js';
export interface WrapMomentRectangle {
    readonly u: readonly [number, number];
    readonly v: readonly [number, number];
}
export interface WrapMomentOptions {
    readonly panels?: number;
    readonly maxOperations?: number;
    readonly errorBudgets?: readonly number[];
}
export interface WrapMomentValue {
    readonly estimate: number;
    readonly lower: SectionFraction;
    readonly upper: SectionFraction;
    readonly estimateError: {
        readonly exact: SectionFraction;
        readonly upper: number;
    };
    readonly roundingWidth: SectionFraction;
    readonly remainderRadius: SectionFraction;
}
export interface CylindricalWrapMoments {
    readonly source: Surface;
    readonly rectangles: readonly WrapMomentRectangle[];
    readonly authority: 'original-stored-quarter-parameter-rectangles';
    readonly method: 'exact-simpson-with-fourth-derivative-bound';
    readonly order: readonly ['V', 'X', 'Y', 'Z', 'XX', 'YY', 'ZZ', 'XY', 'XZ', 'YZ'];
    readonly radialScale: 2;
    readonly panels: number;
    readonly fractionBits: 128;
    readonly moments: readonly WrapMomentValue[];
    readonly positiveAddedVolume: boolean;
    readonly solidQualified: false;
    readonly counts: ReturnType<SectionRationalContext['counts']> & {
        readonly directWork: number;
        readonly totalOperations: number;
        readonly nodes: number;
    };
}
export type WrapMomentCode = 'INPUT' | 'SUPPORT' | 'BUDGET' | 'REPRESENTABILITY';
export type WrapMomentError = KernelError & {
    readonly code: WrapMomentCode;
};
export declare function isWrapMomentError(error: unknown): error is WrapMomentError;
/** Private added-band moments only. Cell-cover/cylinder/embedding/topology and full source mass remain external. */
export declare function cylindricalWrapMoments(sourceInput: Surface, rectanglesInput: readonly WrapMomentRectangle[], optionsInput?: WrapMomentOptions): CylindricalWrapMoments;
