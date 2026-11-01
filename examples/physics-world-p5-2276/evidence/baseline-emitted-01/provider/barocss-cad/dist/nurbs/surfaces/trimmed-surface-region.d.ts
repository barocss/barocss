import { arrangementRegionsExact } from '../../brep/planar-arrangement.js';
import { KernelError } from '../../core/barocss-error.js';
import { CadNumericPolicy } from '../../numeric-policy.js';
import type { SectionFraction } from '../../section-rational-internal.js';
import type { Surface } from '../../types.js';
import { type SurfaceRegionOptions, type SurfaceRegionDomain, type ExtractedSurfaceRegionResult } from './surface-region.js';
import type { SurfaceAxisTrimLoop, OwnedSurfaceAxisTrimLoop } from './trimmed-surface-axis-reversal.js';
import { splitRational, type SplitChildBindingProof } from './trimmed-surface-split-binding.js';
import { type SplitTopologyWork } from './trimmed-surface-split-topology.js';
export type TrimmedSurfaceRegionDiagnosticCode = 'INPUT' | 'SUPPORT' | 'DOMAIN' | 'TOPOLOGY' | 'REPRESENTABILITY' | 'BUDGET' | 'BINDING' | 'NATIVE';
export declare class TrimmedSurfaceRegionError extends KernelError {
    readonly code: TrimmedSurfaceRegionDiagnosticCode;
    constructor(code: TrimmedSurfaceRegionDiagnosticCode, detail: string, cause?: unknown);
}
export interface TrimmedSurfaceRegionComponent {
    surfaceId: string;
    componentIndex: number;
    trimLoops: OwnedSurfaceAxisTrimLoop[];
}
type RationalWork = ReturnType<ReturnType<typeof splitRational>['counts']>;
export interface TrimmedSurfaceRegionReport {
    family: 'affine-plane-single-stored-trim-loop-region';
    inputKeep: 'inside' | 'outside';
    inputPointCount: number;
    componentCount: number;
    originalDomain: SurfaceRegionDomain;
    requestedDomain: SurfaceRegionDomain;
    effectiveDomain: SurfaceRegionDomain;
    originalMaterialAreaUV: SectionFraction;
    croppedMaterialAreaUV: SectionFraction;
    usedSupportProof: SplitChildBindingProof;
    maximumUVRoundingBound: number;
    maximumWorldBoundaryBound: number;
    maximumNativePointDifference: number;
    work: {
        arrangement: ReturnType<typeof arrangementRegionsExact>['counts'];
        topology: SplitTopologyWork;
        materialArithmetic: RationalWork;
        bindingArithmetic: RationalWork;
    };
    limits: {
        maximumInputPoints: 160;
        maximumSegments: 164;
        maximumPairTests: 13366;
        maximumVertices: 484;
        maximumEdges: 804;
        maximumBoundaryOccurrences: 1608;
        maximumComponents: 536;
        maximumRationalOperations: 200000;
        maximumRationalBits: 8192;
    };
    quality: {
        uvComparison: 1e-7;
        linearComparison: 1e-7;
        chartPolicy: typeof CadNumericPolicy.chartParameters;
        materialComposition: 'one-object-per-interior-component-inside-outer-and-outside-holes';
        emptyCrop: 'atomic-DOMAIN-refusal';
        supportRegularity: 'strict-positive-projected-bilinear-Jacobian-and-convex-boundary';
        worldBoundary: 'whole-final-support-coefficient-bound-plus-affine-UV-rounding';
        genericSurfaceEmbeddingCertified: false;
        globalBinary64EvaluatorErrorCertified: false;
        solid: false;
        parentReportUnchanged: true;
    };
}
export interface ExtractedTrimmedSurfaceRegionResult extends ExtractedSurfaceRegionResult {
    components: TrimmedSurfaceRegionComponent[];
    trimRegion: TrimmedSurfaceRegionReport;
}
/** Retain every representable positive-area component of the original trim inside one native region. */
export declare function extractTrimmedSurfaceRegion(surface: Surface, trims: readonly SurfaceAxisTrimLoop[], options: SurfaceRegionOptions): ExtractedTrimmedSurfaceRegionResult;
export {};
