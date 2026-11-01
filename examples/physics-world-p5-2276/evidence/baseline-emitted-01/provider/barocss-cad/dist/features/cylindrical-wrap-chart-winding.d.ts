import { ChartContext, type ChartCurve, type ChartRatio } from './cylindrical-wrap-chart.js';
type Sense = 'forward' | 'reversed';
type Endpoint = 0 | 1;
type Classification = 'slope' | 'constant-slope-height';
type TextRatio = {
    readonly numerator: string;
    readonly denominator: string;
};
export interface ChartWindingUse {
    readonly chart: ChartCurve;
    readonly sense: Sense;
    readonly classification: Classification;
}
export interface ChartWindingPoint {
    readonly slope: ChartRatio;
    readonly height: ChartRatio;
    readonly origin: 'world' | 'vertex';
}
export interface ChartWindingInterval {
    readonly depth: number;
    readonly index: number;
    readonly range: readonly [number, number];
}
export interface ChartWindingEdgeReceipt {
    readonly curve: string;
    readonly sense: Sense;
    readonly classification: Classification;
    readonly contribution: -1 | 0 | 1;
    readonly method: 'constant-slope-outside' | 'outside-slope-range' | 'upper-endpoint-excluded' | 'endpoint-above' | 'endpoint-below' | 'midpoint-above' | 'midpoint-below' | 'root-box-above' | 'root-box-below';
    readonly interval: ChartWindingInterval;
    readonly root?: {
        readonly endpoint: Endpoint;
    } | {
        readonly numerator: number;
        readonly depth: number;
    };
    readonly height?: {
        readonly kind: 'point';
        readonly value: TextRatio;
    } | {
        readonly kind: 'box';
        readonly lower: TextRatio;
        readonly upper: TextRatio;
    };
}
export interface ChartWindingCertificate {
    readonly method: 'exact-upward-ray-monotone-slope';
    readonly winding: number;
    readonly point: {
        readonly slope: TextRatio;
        readonly height: TextRatio;
        readonly origin: 'world' | 'vertex';
    };
    readonly edges: readonly ChartWindingEdgeReceipt[];
    readonly axisUnits: {
        readonly slope: 'dimensionless-y-over-x';
        readonly height: 'mm';
    };
    readonly halfOpen: 'minimum-inclusive-maximum-exclusive';
    readonly boundaryExcluded: true;
    readonly counts: ReturnType<ChartContext['counts']>;
    readonly limits: {
        readonly uses: 32;
        readonly depth: number;
    };
    readonly meaning: {
        readonly exactStoredProjectedChainWinding: true;
        readonly individualProgressFromOwnedCharts: true;
        readonly loopClosureCertified: false;
        readonly loopSimplicityCertified: false;
        readonly componentContainmentCertified: false;
        readonly sourceCertified: false;
        readonly carrierCertified: false;
        readonly solidQualified: false;
        readonly volumeCertified: false;
        readonly globalEvaluatorErrorCertified: false;
    };
}
/** Prepare one canonical-curve use. Sense changes traversal only, never the stored Curve. */
export declare function prepareChartWindingUse(chart: ChartCurve, sense: Sense, ctx: ChartContext): ChartWindingUse;
/** An exact projected query from finite world data. The candidate need not be on a carrier. */
export declare function chartWindingPointFromWorld(input: readonly [number, number, number], ctx: ChartContext): ChartWindingPoint;
/** Endpoint is canonical0/1 even for a reversed use. No Number quotient is formed. */
export declare function chartWindingPointFromVertex(use: ChartWindingUse, at: Endpoint, ctx: ChartContext): ChartWindingPoint;
/** Exact chain winding only. Closure, simplicity and component roles are obligations of the caller. */
export declare function certifyChartWinding(uses: readonly ChartWindingUse[], point: ChartWindingPoint, ctx: ChartContext): ChartWindingCertificate;
export {};
