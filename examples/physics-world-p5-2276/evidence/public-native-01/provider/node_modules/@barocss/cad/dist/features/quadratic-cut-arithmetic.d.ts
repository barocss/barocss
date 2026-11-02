export interface CutDyadic {
    readonly n: bigint;
    readonly e: number;
}
export type CutRefuse = (code: 'INPUT' | 'CAPABILITY' | 'PARAMETER', message: string) => never;
export interface CutWorkCounts {
    operations: number;
    maximumIntegerBits: number;
    speedEvaluations: number;
    subdivisions: number;
    integrationDepth: number;
    inverseIterations: number;
}
export declare class QuadraticCutWork {
    readonly fail: CutRefuse;
    readonly counts: CutWorkCounts;
    private readonly storage;
    constructor(fail: CutRefuse);
    take(amount?: number): void;
    bits(n: bigint): number;
    plus(a: bigint, b: bigint): bigint;
    minus(a: bigint, b: bigint): bigint;
    times(a: bigint, b: bigint): bigint;
    shift(a: bigint, power: number): bigint;
    quotient(a: bigint, b: bigint): bigint;
    compare(a: bigint, b: bigint): number;
    abs(a: bigint): bigint;
    canonical(value: CutDyadic): CutDyadic;
    from(value: number): CutDyadic;
    add(a: CutDyadic, b: CutDyadic): CutDyadic;
    sub(a: CutDyadic, b: CutDyadic): CutDyadic;
    mul(a: CutDyadic, b: CutDyadic): CutDyadic;
    cmp(a: CutDyadic, b: CutDyadic): number;
    magnitude(a: CutDyadic): CutDyadic;
    scale(a: CutDyadic, power: number): CutDyadic;
    midpoint(a: CutDyadic, b: CutDyadic): CutDyadic;
    floorLogRatio(n: bigint, d: bigint): number;
    ratio(n: bigint, d: bigint, power: number, upward: boolean): bigint;
    root(n: bigint): bigint;
    sqrt(value: CutDyadic, quantum: number): [CutDyadic, CutDyadic];
    sqrtRatioLower(n: bigint, d: bigint, exponent: number): CutDyadic;
    /** Number only proposes an inverse step; it never decides geometry or admission. */
    estimate(value: CutDyadic): number;
    private roundedInteger;
    /** Exact dyadic to binary64 under this SAME before-operation counter, including ties/subnormals. */
    number(value: CutDyadic, mode?: 'nearest' | 'down' | 'up'): number;
}
