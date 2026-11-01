import type { Curve } from '../types.js';
import { type ChartContext, type ChartOptions } from './cylindrical-wrap-chart.js';
import { type ChartConeCertificate } from './cylindrical-wrap-chart-cone.js';
import { type ChartSeparationCertificate } from './cylindrical-wrap-chart-separation.js';
import { type ChartWindingCertificate } from './cylindrical-wrap-chart-winding.js';
export interface ChartComponentUse {
    readonly curve: string;
    readonly sense: 'forward' | 'reversed';
}
export interface ChartComponentRing {
    readonly uses: readonly ChartComponentUse[];
    readonly interiorHint: readonly [number, number, number];
}
export interface ChartComponentInput {
    readonly curves: readonly Curve[];
    readonly outer: ChartComponentRing;
    readonly holes: readonly ChartComponentRing[];
}
type SeparationReceipt = Pick<ChartSeparationCertificate, 'relation' | 'curves' | 'parameterFrame' | 'axisUnits' | 'cover' | 'limits'>;
interface PairReceipt {
    readonly first: string;
    readonly second: string;
    readonly certificate: ChartConeCertificate | SeparationReceipt;
}
interface WindingReceipt {
    readonly purpose: 'ring-interior-orientation' | 'hole-in-outer' | 'hole-outside-hole';
    readonly ring: number;
    readonly queryRing: number;
    readonly expected: -1 | 0 | 1;
    readonly certificate: ChartWindingCertificate;
}
declare const MEANING: Readonly<{
    projection: "Y-over-X-and-world-Z";
    guarantee: "exact-stored-projected-component-boundary";
    projectedLoopEmbeddingCertified: true;
    projectedComponentContainmentCertified: true;
    representativeRule: "one-owned-vertex-after-complete-boundary-separation";
    hintMeaning: "individual-ring-interior-and-orientation-only";
    sourceCarrierCertified: false;
    originalNativeUVBindingCertified: false;
    topologyCertified: false;
    solidQualified: false;
    representedVolumeCertified: false;
    globalNativeEvaluatorErrorCertified: false;
    generalTextSupported: false;
    combinedConstructionBudgetCertified: false;
}>;
export interface ChartComponentResult {
    readonly original: ChartComponentInput;
    readonly pairs: readonly PairReceipt[];
    readonly winding: readonly WindingReceipt[];
    readonly cover: {
        readonly curves: number;
        readonly rings: number;
        readonly adjacent: number;
        readonly disjoint: number;
        readonly totalPairs: number;
        readonly complete: true;
    };
    readonly counts: ReturnType<ChartContext['counts']>;
    readonly limits: ChartContext['limits'];
    readonly budget: {
        readonly maxOperations: number;
        readonly maxDepth: number;
    };
    readonly meaning: typeof MEANING;
}
/** Private continuation capability. Frozen copied receipts are not authority to extend a proof request. */
export declare function chartComponentContext(result: ChartComponentResult): ChartContext;
/** Complete exact projected component proof only. Source binding, native trims, mass and physical solid remain separate. */
export declare function certifyCylindricalWrapChartComponent(input: ChartComponentInput, options?: ChartOptions): ChartComponentResult;
export {};
