import type { Curve } from '../types.js';
import { ChartContext } from './cylindrical-wrap-chart.js';
import { certifyCylindricalWrapChartSeparation } from './cylindrical-wrap-chart-separation.js';
import { certifyChartCone } from './cylindrical-wrap-chart-cone.js';
interface PairBudget {
    readonly maxOperations?: number;
}
export type CylindricalWrapChartPairOptions = (PairBudget & {
    readonly kind: 'disjoint';
    readonly maxDepth?: number;
    readonly maxPairs?: number;
    readonly witnesses?: boolean;
}) | (PairBudget & {
    readonly kind: 'shared';
    readonly endpoints: readonly [0 | 1, 0 | 1];
    readonly normalHint?: readonly [number, number];
});
interface ProgressReceipt {
    readonly coordinate: 'slope' | 'height';
    readonly sign: -1 | 1;
    readonly coefficients: readonly string[];
    readonly minimum: string;
    readonly positiveScale: number;
    readonly homogeneousDenominator: string;
}
declare const MEANING: Readonly<{
    projection: "Y-over-X-and-world-Z";
    coordinateUnits: readonly ["ratio", "world-length"];
    guarantee: "exact-stored-rational-projected-pair";
    pairRelationCertified: true;
    sourceCarrierCertified: false;
    loopEmbeddingCertified: false;
    topologyCertified: false;
    solidQualified: false;
    representedVolumeCertified: false;
    globalNativeEvaluatorErrorCertified: false;
    generalTextSupported: false;
}>;
export interface CylindricalWrapChartPairResult {
    readonly original: readonly [Curve, Curve];
    readonly options: CylindricalWrapChartPairOptions;
    readonly relation: 'disjoint' | 'shared-endpoint-only';
    readonly progress: readonly [ProgressReceipt, ProgressReceipt];
    readonly certificate: ReturnType<typeof certifyCylindricalWrapChartSeparation> | ReturnType<typeof certifyChartCone>;
    readonly counts: ReturnType<ChartContext['counts']>;
    readonly limits: ChartContext['limits'];
    readonly budget: {
        readonly maxOperations: number;
        readonly maxDepth: number;
    };
    readonly meaning: typeof MEANING;
}
/** Private projected-pair certificate. It is conditional on later exact radial-side binding and loop ownership. */
export declare function certifyCylindricalWrapChartPair(firstInput: Curve, secondInput: Curve, optionsInput?: CylindricalWrapChartPairOptions): CylindricalWrapChartPairResult;
export {};
