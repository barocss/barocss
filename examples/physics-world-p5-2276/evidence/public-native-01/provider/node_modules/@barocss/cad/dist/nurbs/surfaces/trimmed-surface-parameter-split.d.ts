import { arrangementRegionsExact } from '../../brep/planar-arrangement.js';
import { CadNumericPolicy } from '../../numeric-policy.js';
import type { SectionFraction } from '../../section-rational-internal.js';
import type { Surface } from '../../types.js';
import type { SurfaceAxisTrimLoop, OwnedSurfaceAxisTrimLoop } from './trimmed-surface-axis-reversal.js';
import { type SurfaceParameterSplitOptions, type SurfaceParameterSplitResult } from './surface-parameter-split.js';
import { splitRational, type SplitChildBindingProof } from './trimmed-surface-split-binding.js';
import { type SplitTopologyWork } from './trimmed-surface-split-topology.js';
export { TrimmedSurfaceParameterSplitError } from './trimmed-surface-split-common.js';
export type { TrimmedSurfaceParameterSplitDiagnosticCode } from './trimmed-surface-split-common.js';
export interface TrimmedSurfaceSplitComponent {
    side: 'lower' | 'upper';
    surfaceId: string;
    componentIndex: number;
    trimLoops: OwnedSurfaceAxisTrimLoop[];
}
type RationalWork = ReturnType<ReturnType<typeof splitRational>['counts']>;
export interface TrimmedSurfaceSplitReport {
    family: 'affine-plane-single-stored-trim-loop-parameter-split';
    axis: 'u' | 'v';
    inputKeep: 'inside' | 'outside';
    inputPointCount: number;
    componentCounts: {
        lower: number;
        upper: number;
    };
    originalMaterialAreaUV: SectionFraction;
    selectedMaterialAreaUV: SectionFraction;
    maximumUVRoundingBound: number;
    maximumWorldBoundaryBound: number;
    maximumNativePointDifference: number;
    usedChildren: {
        lower: SplitChildBindingProof | null;
        upper: SplitChildBindingProof | null;
    };
    work: {
        arrangement: ReturnType<typeof arrangementRegionsExact>['counts'];
        topology: SplitTopologyWork;
        materialArithmetic: RationalWork;
        bindingArithmetic: RationalWork;
    };
    limits: {
        maximumInputPoints: 160;
        maximumSegments: 165;
        maximumPairTests: 13530;
        maximumVertices: 326;
        maximumEdges: 651;
        maximumBoundaryOccurrences: 1302;
        maximumComponents: 434;
        maximumRationalOperations: 200000;
        maximumRationalBits: 8192;
    };
    quality: {
        uvComparison: 1e-7;
        linearComparison: 1e-7;
        chartPolicy: typeof CadNumericPolicy.chartParameters;
        materialComposition: 'one-object-per-interior-component-inside-outer-and-outside-holes';
        emptyChild: 'no-component';
        childRegularity: 'strict-positive-projected-bilinear-Jacobian-and-convex-boundary';
        worldBoundary: 'whole-child-coefficient-bound-plus-affine-UV-rounding';
        genericSurfaceEmbeddingCertified: false;
        globalBinary64EvaluatorErrorCertified: false;
        solid: false;
        parentReportUnchanged: true;
    };
}
export interface TrimmedSurfaceParameterSplitResult extends SurfaceParameterSplitResult {
    components: TrimmedSurfaceSplitComponent[];
    trimSplit: TrimmedSurfaceSplitReport;
}
export declare function copyLoop(input: readonly SurfaceAxisTrimLoop[], domain: SurfaceParameterSplitResult['report']['domains']['original']): OwnedSurfaceAxisTrimLoop;
/** Split the native support once, then preserve each admitted positive-area material component. */
export declare function splitTrimmedSurfaceAtParameter(surfaceInput: Surface, trimInput: readonly SurfaceAxisTrimLoop[], options: SurfaceParameterSplitOptions): TrimmedSurfaceParameterSplitResult;
