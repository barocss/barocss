import type { MultiSpanVLinearSurfacePlaneSectionAsset } from '../intersect/multispan-vlinear-plane-section.js';
import type { QualifiedTranslatedStripBodyResult } from './qualified-translated-strip-body.js';
import type { SectionRationalContext } from '../section-rational-internal.js';
import type { TranslatedStripIntervalBooleanOutput } from './translated-strip-interval-boolean.js';
/** Source authority is selected and fully validated by the public core, never generated here. */
export type TranslatedStripIntervalConstructionDonor = {
    operand: 'a' | 'b';
    side: 'lower' | 'upper';
    bodyId: string;
    asset: MultiSpanVLinearSurfacePlaneSectionAsset;
};
export type TranslatedStripIntervalConstructionPair = {
    componentIndex: number;
    lower: TranslatedStripIntervalConstructionDonor;
    upper: TranslatedStripIntervalConstructionDonor;
    planeAsset: MultiSpanVLinearSurfacePlaneSectionAsset;
};
export type TranslatedStripIntervalConstructionCheck = (condition: boolean, detail: string) => void;
export type TranslatedStripIntervalConstructionReceipt = {
    body: QualifiedTranslatedStripBodyResult;
    recipe: TranslatedStripIntervalBooleanOutput['recipe'];
    directCounts: {
        sectionBuildCount: 2;
        bindingBuildCount: 2;
        wallBuildCount: 2;
        capBuildCount: 1;
        baseBuildCount: 1;
        endBuildCount: 1;
        volumeBuildCount: 1;
        qualifiedBodyBuildCount: 1;
    };
};
/**
 * Private delegation only. The public core admits both complete operands,
 * selects unchanged original endpoint assets, proves the positive interval,
 * and reserves every fresh recipe identity before calling this function.
 * Provider errors propagate unchanged to the core's CONSTRUCTION wrapper.
 */
export declare function reconstructTranslatedStripIntervalBodyTrusted(pair: TranslatedStripIntervalConstructionPair, recipe: TranslatedStripIntervalBooleanOutput['recipe'], q: SectionRationalContext, check: TranslatedStripIntervalConstructionCheck): TranslatedStripIntervalConstructionReceipt;
