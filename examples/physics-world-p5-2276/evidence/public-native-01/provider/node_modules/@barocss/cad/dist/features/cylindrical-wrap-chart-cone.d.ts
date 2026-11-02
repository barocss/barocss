import { type ChartContext, type ChartCurve } from './cylindrical-wrap-chart.js';
type Endpoint = 0 | 1;
type TextPair = readonly [string, string];
type TextTriple = readonly [string, string, string];
interface ConeSide {
    readonly sourceDenominator: string;
    /** These are exactly 60*D^2 times the original degree-six product coefficients. */
    readonly projected: readonly TextTriple[];
    readonly endpointFactor: 't' | 'one-minus-t';
    /** Integer pairs are exactly 60 times the factored degree-five coefficients. */
    readonly factored: readonly TextPair[];
    readonly functional: readonly string[];
    readonly sign: 1 | -1;
}
export interface ChartConeCertificate {
    readonly method: 'opposite-strict-bernstein-endpoint-cones';
    readonly relation: 'projected-images-share-only-prescribed-endpoint';
    readonly curves: readonly [string, string];
    readonly endpoints: readonly [Endpoint, Endpoint];
    readonly worldEndpoint: readonly [number, number, number];
    readonly projectedVertex: TextTriple;
    readonly normal: {
        readonly integers: TextPair;
        readonly denominator: string;
        readonly candidate: readonly [number, number];
        readonly origin: 'hint' | 'outgoing-tangents';
    };
    readonly projectionDegree: 6;
    readonly factoredDegree: 5;
    readonly wholeOriginalIntervals: true;
    readonly first: ConeSide;
    readonly second: ConeSide;
    readonly requiresIndividualProgress: true;
    readonly diagnosticOnly: true;
    readonly solidQualified: false;
    readonly sourceBindingCertified: false;
    readonly cylinderCertified: false;
    readonly wholeLoopCertified: false;
    readonly volumeCertified: false;
    readonly globalEvaluatorErrorCertified: false;
}
/** Private adjacent-edge projection proof. Per-edge progress and every other graph/pair condition remain required. */
export declare function certifyChartCone(first: ChartCurve, second: ChartCurve, firstEndpoint: Endpoint, secondEndpoint: Endpoint, ctx: ChartContext, normalHint?: readonly [number, number]): ChartConeCertificate;
export {};
