import type { Curve, Surface } from '../types.js';
import { type ChartContext, type ChartCounts } from './cylindrical-wrap-chart.js';
import { type ChartComponentResult } from './cylindrical-wrap-chart-component.js';
export interface CylindricalWrapSideFamilyPiece {
    readonly base: Curve;
    readonly outer: Curve;
    readonly side: Surface;
}
interface SideBinding {
    readonly base: string;
    readonly outer: string;
    readonly side: string;
    readonly factor: 2;
    readonly parameterDomain: readonly [0, 1];
    readonly radialDomain: readonly [0, 1];
}
declare const MEANING: Readonly<{
    guarantee: "exact-stored-factor2-radial-side-family-embedding";
    projection: "Y-over-X-and-world-Z";
    exactCoefficientBinding: true;
    sideFamilyEmbeddingCertified: true;
    regularSidesCertified: true;
    nonadjacentSidesDisjoint: true;
    adjacentSidesShareOnlyPrescribedRadialEdge: true;
    sourceCarrierCertified: false;
    originalNativeUVBindingCertified: false;
    retainedFaceClosureCertified: false;
    topologyCertified: false;
    physicalBrepCertified: false;
    solidQualified: false;
    representedVolumeCertified: false;
    globalNativeEvaluatorErrorCertified: false;
    generalTextSupported: false;
    combinedConstructionBudgetCertified: false;
}>;
export interface CylindricalWrapSideFamilyResult {
    /** Owned actual inputs in caller order. The binding list follows the certified base order. */
    readonly original: readonly CylindricalWrapSideFamilyPiece[];
    readonly bindings: readonly SideBinding[];
    readonly componentCover: ChartComponentResult['cover'];
    /** The component receipt is an earlier cumulative prefix, never an independent allowance. */
    readonly componentCounts: ChartCounts;
    readonly startedCounts: ChartCounts;
    /** Authoritative cumulative count, including the original component and this continuation. */
    readonly counts: ChartCounts;
    readonly limits: ChartContext['limits'];
    readonly budget: {
        readonly maxOperations: number;
        readonly maxDepth: number;
    };
    readonly meaning: typeof MEANING;
}
/** Exact stored side-family proof only. Actual source/carrier/UV/B-rep binding remains a separate obligation. */
export declare function certifyCylindricalWrapSideFamily(component: ChartComponentResult, pieces: readonly CylindricalWrapSideFamilyPiece[]): CylindricalWrapSideFamilyResult;
export {};
