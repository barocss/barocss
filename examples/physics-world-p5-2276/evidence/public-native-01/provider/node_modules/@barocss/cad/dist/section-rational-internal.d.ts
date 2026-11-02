/** Private, request-local exact arithmetic for the bounded section construction. */
export type SectionRational = {
    n: bigint;
    d: bigint;
};
export type SectionFraction = {
    numerator: string;
    denominator: string;
};
export declare class SectionRationalContext {
    private readonly fail;
    private operations;
    private gcdSteps;
    private floatSearchSteps;
    private floatConversions;
    private maximumObservedBits;
    private readonly storage;
    private readonly maximumFiniteBits;
    constructor(fail: (kind: 'BUDGET' | 'REPRESENTABILITY', detail: string) => never);
    private work;
    private sized;
    private multiply;
    private gcd;
    rat(n: bigint, d?: bigint): SectionRational;
    integer(value: number): SectionRational;
    private atBits;
    from(value: number): SectionRational;
    add(a: SectionRational, b: SectionRational): SectionRational;
    neg(a: SectionRational): SectionRational;
    sub(a: SectionRational, b: SectionRational): SectionRational;
    mul(a: SectionRational, b: SectionRational): SectionRational;
    div(a: SectionRational, b: SectionRational): SectionRational;
    compare(a: SectionRational, b: SectionRational): number;
    abs(a: SectionRational): SectionRational;
    max(a: SectionRational, b: SectionRational): SectionRational;
    sum(values: SectionRational[]): SectionRational;
    /** A Number estimate only proposes a code; exact neighbor comparisons certify the floor. */
    private candidateFloorBits;
    /** Search positive finite float codes, which have the same order as their values. */
    private floorBits;
    nearest(value: SectionRational): number;
    upward(value: SectionRational): number;
    exactFloat(value: SectionRational): number;
    text(value: SectionRational): SectionFraction;
    bound(value: SectionRational): {
        exact: SectionFraction;
        upper: number;
    };
    counts(): {
        operations: number;
        gcdSteps: number;
        floatSearchSteps: number;
        floatConversions: number;
        maximumObservedBits: number;
    };
}
