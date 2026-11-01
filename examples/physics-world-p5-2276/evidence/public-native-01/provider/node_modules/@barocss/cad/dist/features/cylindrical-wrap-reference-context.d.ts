import { type KernelError } from '../core/barocss-error.js';
import { SectionRationalContext, type SectionRational, type SectionFraction } from '../section-rational-internal.js';
import type { WallCycleContext } from './cylindrical-wrap-wall-cycle.js';
export type ClosedReferenceCode = 'SUPPORT' | 'BUDGET' | 'REPRESENTABILITY';
export type ClosedReferenceError = KernelError & {
    readonly code: ClosedReferenceCode;
};
export declare function closedReferenceFailure(code: ClosedReferenceCode, detail: string): never;
export declare function isCylindricalWrapClosedReferenceError(error: unknown): error is ClosedReferenceError;
export declare class ReferenceProofContext implements WallCycleContext {
    readonly prior: {
        readonly exactOperations: number;
        readonly work: number;
        readonly maximumBits: number;
    };
    readonly maximum: number;
    readonly q: SectionRationalContext;
    directOperations: number;
    structural: number;
    integerBits: number;
    private readonly indices;
    constructor(prior: {
        readonly exactOperations: number;
        readonly work: number;
        readonly maximumBits: number;
    }, maximum: number);
    localWork(): number;
    check(): void;
    integer(value: bigint): bigint;
    direct(amount: number): void;
    structure(amount: number): void;
    from(value: number): SectionRational;
    read(value: SectionFraction): SectionRational;
    text(value: SectionRational): SectionFraction;
    /** Exact common-denominator receipts need no Euclidean reduction. */
    fraction(n: bigint, d?: bigint): SectionFraction;
    entity<T extends {
        readonly id: string;
    }>(values: readonly T[], id: string): T;
    counts(): {
        exactOperations: number;
        priorOperations: number;
        rationalOperations: number;
        directOperations: number;
        work: number;
        localWork: number;
        maximumBits: number;
        localGcdSteps: number;
    };
}
export declare function freezeReferenceProof(value: unknown, ctx: ReferenceProofContext): void;
export declare function referenceSameNumbers(a: readonly number[], b: readonly number[], ctx: ReferenceProofContext): void;
export declare function referenceEntity<T extends {
    readonly id: string;
}>(values: readonly T[], id: string, ctx: ReferenceProofContext): T;
