import { type KernelError } from '../core/barocss-error.js';
import { SectionRationalContext } from '../section-rational-internal.js';
import type { Curve } from '../types.js';
export type ChartCode = 'INPUT' | 'SUPPORT' | 'BUDGET' | 'UNRESOLVED';
export type ChartError = KernelError & {
    readonly code: ChartCode;
};
export interface ChartOptions {
    readonly maxOperations?: number;
    readonly maxDepth?: number;
}
export type ChartHomogeneousPoint = readonly [bigint, bigint, bigint, bigint];
export type ChartHomogeneousCubic = readonly [ChartHomogeneousPoint, ChartHomogeneousPoint, ChartHomogeneousPoint, ChartHomogeneousPoint];
export interface ChartRatio {
    readonly n: bigint;
    readonly d: bigint;
}
export interface ChartBox {
    readonly slope: readonly [ChartRatio, ChartRatio];
    readonly height: readonly [ChartRatio, ChartRatio];
}
/** Exact original t interval is [index/2^depth,(index+1)/2^depth]. Not a native Curve. */
export interface ChartNode {
    readonly id: number;
    readonly curve: number;
    readonly depth: number;
    readonly index: number;
    readonly controls: ChartHomogeneousCubic;
}
export interface ChartProgress {
    readonly coordinate: 'slope' | 'height';
    readonly sign: 1 | -1;
    /** Coefficients are 10*D^2 times the original homogeneous derivative numerator. */
    readonly coefficients: readonly bigint[];
    readonly minimum: bigint;
    readonly positiveScale: 10;
}
export interface ChartCounts {
    readonly rational: ReturnType<SectionRationalContext['counts']>;
    readonly directOperations: number;
    readonly totalOperations: number;
    readonly work: number;
    readonly maximumDirectBits: number;
    readonly curves: number;
    readonly nodes: number;
}
export interface ChartCurve {
    readonly source: Curve;
    /** Root controls equal D times the exact original stored [cpX*w,cpY*w,cpZ*w,w]. */
    readonly denominator: bigint;
    readonly root: ChartNode;
    readonly progress: ChartProgress;
}
export declare const CHART_LIMITS: Readonly<{
    readonly operations: 200000;
    readonly integerBits: 8192;
    readonly work: 1048576;
    readonly curves: 2;
    readonly nodes: 256;
    readonly depth: 8;
}>;
declare const LOOP_CHART_LIMITS: Readonly<{
    readonly curves: 32;
    readonly operations: 200000;
    readonly integerBits: 8192;
    readonly work: 1048576;
    readonly nodes: 256;
    readonly depth: 8;
}>;
type ChartLimits = typeof CHART_LIMITS | typeof LOOP_CHART_LIMITS;
export declare function chartFailure(code: ChartCode, detail: string): never;
export declare function isCylindricalWrapChartError(error: unknown): error is ChartError;
/** One ledger for all admitted curves and every child/pair/cone operation in this request. */
export declare class ChartContext {
    readonly q: SectionRationalContext;
    readonly maxOperations: number;
    readonly maxDepth: number;
    readonly limits: ChartLimits;
    constructor(options?: ChartOptions);
    check(): void;
    charge(amount?: number): void;
    integer(value: bigint): bigint;
    add(a: bigint, b: bigint): bigint;
    sub(a: bigint, b: bigint): bigint;
    mul(a: bigint, b: bigint): bigint;
    neg(a: bigint): bigint;
    abs(a: bigint): bigint;
    compare(a: bigint, b: bigint): number;
    div(a: bigint, b: bigint): bigint;
    /** Negative bits use the exact BigInt right-shift operation, not an exact rational division. */
    shift(value: bigint, bits: number): bigint;
    bitAnd(a: bigint, b: bigint): bigint;
    requireCurve(curve: ChartCurve): void;
    requireNode(node: ChartNode): void;
    counts(): ChartCounts;
}
/** Private loop-family ledger. The ordinary constructor remains fixed at two curves. */
export declare function createChartLoopContext(options?: ChartOptions): ChartContext;
/** Private projection data and one-coordinate progress only; no cylinder, B-rep, volume or Number-evaluator authority. */
export declare function prepareChartCurve(input: Curve, ctx: ChartContext): ChartCurve;
/** Ratios are internal exact pairs, not Number coordinates or a serialized proof format. */
export declare function chartCompareRatios(a: ChartRatio, b: ChartRatio, ctx: ChartContext): number;
export declare function chartBox(node: ChartNode, ctx: ChartContext): ChartBox;
/** Exact de Casteljau halves. Every child control has one common factor8, not independent row scales. */
export declare function splitChartNode(node: ChartNode, ctx: ChartContext): readonly [ChartNode, ChartNode];
export {};
