import { ChartContext, type ChartCurve } from './cylindrical-wrap-chart.js';
export interface ChartSeparationOptions {
    /** A tighter limit than the caller context, whose hard depth is8. */
    readonly maxDepth?: number;
    /** Counts every visited pair cell, including the initial cell. At most512. */
    readonly maxPairs?: number;
    /** If requested, record every accepted leaf, never a partial witness list. */
    readonly witnesses?: boolean;
}
export interface ChartSeparationInterval {
    readonly depth: number;
    readonly index: number;
    /** Exact dyadic endpoints in the original normalized t domain [0,1]. */
    readonly range: readonly [number, number];
}
export interface ChartSeparationWitness {
    readonly first: ChartSeparationInterval;
    readonly second: ChartSeparationInterval;
    readonly axis: 'slope' | 'height';
    readonly before: 'first' | 'second';
    /** The exact strict comparison upper<lower; fractions need not be reduced. */
    readonly upper: {
        readonly numerator: string;
        readonly denominator: string;
    };
    readonly lower: {
        readonly numerator: string;
        readonly denominator: string;
    };
}
export interface ChartSeparationCertificate {
    readonly relation: 'strict-disjoint-projected-images';
    readonly curves: readonly [string, string];
    readonly parameterFrame: 'original-normalized-bezier-t';
    readonly axisUnits: {
        readonly slope: 'dimensionless-y-over-x';
        readonly height: 'mm';
    };
    readonly cover: {
        readonly domain: readonly [readonly [0, 1], readonly [0, 1]];
        readonly complete: true;
        readonly leaves: number;
        readonly visits: number;
        readonly splits: number;
        readonly witnessesRecorded: boolean;
    };
    readonly limits: {
        readonly depth: number;
        readonly pairs: number;
        readonly witnessLeaves: 256;
    };
    readonly witnesses: readonly ChartSeparationWitness[];
    readonly counts: ReturnType<ChartContext['counts']>;
    readonly meaning: {
        readonly storedProjectedPairOnly: true;
        readonly individualProgressFromOwnedCharts: true;
        readonly sourceCertified: false;
        readonly carrierCertified: false;
        readonly loopCertified: false;
        readonly solidQualified: false;
        readonly volumeCertified: false;
        readonly globalEvaluatorErrorCertified: false;
    };
}
/** Exact nonadjacent-pair diagnostic. Shared endpoints, contact and uncertain separation never succeed. */
export declare function certifyCylindricalWrapChartSeparation(first: ChartCurve, second: ChartCurve, ctx: ChartContext, options?: ChartSeparationOptions): ChartSeparationCertificate;
