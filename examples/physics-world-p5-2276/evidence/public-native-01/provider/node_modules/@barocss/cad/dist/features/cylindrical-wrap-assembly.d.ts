import { type Brep, type BrepCheckReport } from '../brep/brep-core.js';
import { type KernelError } from '../core/barocss-error.js';
import type { Part } from '../part/part-model.js';
import { type SectionFraction } from '../section-rational-internal.js';
import { type CylindricalWrapUVSource } from './cylindrical-wrap-source.js';
import { type NativeD0FamilyCertificate } from '../core/native-d0-bound.js';
import { type CylindricalWrapSideFamilyResult } from './cylindrical-wrap-side-family.js';
type UV = [number, number];
export type CylindricalWrapAssemblyCode = 'INPUT' | 'SUPPORT' | 'BUDGET' | 'BINDING' | 'TOPOLOGY';
export type CylindricalWrapAssemblyError = KernelError & {
    readonly code: CylindricalWrapAssemblyCode;
};
/** Original native UV, not nominal arc length or font coordinates. No repeated closing point. */
export interface CylindricalWrapAssemblyComponent {
    readonly outer: readonly UV[];
    readonly holes: readonly (readonly UV[])[];
}
export interface CylindricalWrapAssemblyOptions {
    readonly id: string;
    readonly height: number;
}
export interface CylindricalWrapAssemblyPiece {
    readonly component: number;
    readonly ring: number;
    readonly index: number;
    readonly start: UV;
    readonly end: UV;
    readonly baseEdge: string;
    readonly outerEdge: string;
    readonly sideFace: string;
    readonly binding: {
        readonly baseError: SectionFraction;
        readonly outerError: SectionFraction;
        readonly baseBudget: number;
        readonly outerBudget: number;
        readonly baseAuthority: 'horizontal-composition-with-exact-axial-replacement' | 'constant-xy-and-affine-z-bernstein-residual';
        readonly outerAuthority: 'exact-diag-2-2-1-of-admitted-base';
    };
    readonly guard: {
        readonly kind: 'angular' | 'vertical';
        readonly minimum: SectionFraction;
        readonly homothety: 2;
        readonly regularSide: true;
    };
}
export interface CylindricalWrapAssemblyResult {
    readonly brep: Brep;
    readonly check: BrepCheckReport;
    readonly proof: {
        readonly diagnosticOnly: true;
        readonly solidQualified: false;
        readonly coordinateFrame: 'original-native-uv';
        readonly factor: 2;
        readonly sourceFace: string;
        readonly sourceName: string | null;
        readonly sourceConsistency: true;
        readonly historicalProducerProvenance: false;
        readonly protectedOriginals: true;
        readonly fullSpanRegularity: true;
        readonly representedVolumeCertified: false;
        readonly globalEvaluatorErrorCertified: false;
        readonly generalTextSupported: false;
        readonly source: CylindricalWrapUVSource['proof'];
        readonly components: readonly CylindricalWrapAssemblyComponent[];
        readonly pieces: readonly CylindricalWrapAssemblyPiece[];
        readonly vertices: readonly {
            readonly uv: UV;
            readonly base: string;
            readonly outer: string;
            readonly radial: string;
        }[];
        readonly added: {
            readonly vertices: number;
            readonly edges: number;
            readonly faces: number;
            readonly loops: number;
            readonly coedges: number;
            readonly counters: number;
        };
        readonly tolerance: number;
        readonly counts: {
            readonly exactOperations: number;
            readonly helperOperations: number;
            readonly rationalOperations: number;
            readonly integerOperations: number;
            readonly integerMaximumBits: number;
            readonly work: number;
            readonly horizontalCompositions: number;
            readonly angularCertificates: number;
            readonly verticalCurves: number;
            readonly outerClones: number;
        };
        readonly limits: {
            readonly components: 64;
            readonly edges: 512;
            readonly work: 1048576;
            readonly exactOperations: 200000;
            readonly integerBits: 8192;
        };
    };
}
export interface CylindricalWrapNativeBoundOptions extends CylindricalWrapAssemblyOptions {
    readonly maxOperations?: number;
}
export interface NativeAssemblyCounts {
    readonly exactOperations: number;
    readonly rationalOperations: number;
    readonly integerOperations: number;
    readonly helperOperations: number;
    readonly work: number;
    readonly maximumBits: number;
}
interface NativeCoedgeBound {
    readonly coedge: string;
    readonly edge: string;
    readonly face: string;
    readonly curveSlot: number;
    readonly pcurveSlot: number;
    readonly surfaceSlot: number;
    readonly kind: 'wall' | 'cap' | 'base' | 'outer' | 'side';
    readonly modelError: SectionFraction;
    readonly bound: SectionFraction;
    readonly tolerance: number;
}
interface NativeEndpointBound {
    readonly edge: string;
    readonly endpoint: 0 | 1;
    readonly vertex: string;
    readonly bound: SectionFraction;
    readonly tolerance: number;
}
export interface CylindricalWrapNativeBoundResult {
    readonly assembly: CylindricalWrapAssemblyResult;
    readonly nativeBinding: {
        readonly coverage: {
            readonly edges: 18;
            readonly coedges: 36;
            readonly vertices: 12;
            readonly endpointRelations: 36;
            readonly familySlots: 63;
            readonly complete: true;
            readonly classes: Readonly<Record<NativeCoedgeBound['kind'], number>>;
        };
        readonly coedges: readonly NativeCoedgeBound[];
        readonly endpoints: readonly NativeEndpointBound[];
        readonly faces: readonly {
            readonly face: string;
            readonly lipschitz: {
                readonly u: SectionFraction;
                readonly v: SectionFraction;
            };
            readonly inflation: SectionFraction;
        }[];
        readonly evaluator: NativeD0FamilyCertificate;
        readonly sideFamily: CylindricalWrapSideFamilyResult;
        readonly phases: {
            readonly assembly: NativeAssemblyCounts;
            readonly side: {
                readonly exactOperations: number;
                readonly work: number;
            };
            readonly evaluator: {
                readonly exactOperations: number;
                readonly work: number;
            };
        };
        readonly counts: NativeAssemblyCounts;
        readonly limits: {
            readonly exactOperations: number;
            readonly hardExactOperations: 200000;
            readonly integerBits: 8192;
            readonly work: 1048576;
            readonly components: 1;
            readonly edges: 4;
            readonly holes: 0;
        };
        readonly meaning: {
            readonly nativePositionBindingCertified: true;
            readonly allCoedgesCertified: true;
            readonly allEdgeEndpointsCertified: true;
            readonly vertexToleranceRule: 'actual-vertex-tolerance-stronger-than-checker-max';
            readonly distance: 'exact-L1-between-native-position-outputs';
            readonly uvRule: 'actual-rounded-slack-and-nonexpansive-clamp';
            readonly sourceGlobalCertified: false;
            readonly closedReferenceCertified: false;
            readonly retainedFaceClosureCertified: false;
            readonly mathHypotCertified: false;
            readonly orientationCertified: false;
            readonly physicalBrepCertified: false;
            readonly solidQualified: false;
            readonly representedVolumeCertified: false;
            readonly generalTextSupported: false;
            readonly productFeature: false;
            readonly surfaceEndpointVertexBindingCertified: false;
        };
    };
}
export declare function isCylindricalWrapAssemblyError(error: unknown): error is CylindricalWrapAssemblyError;
/** Existing private rectilinear diagnostic. The legacy path keeps its original policy and receipts. */
export declare function buildCylindricalWrapAssembly(part: Part, input: readonly CylindricalWrapAssemblyComponent[], options: CylindricalWrapAssemblyOptions): CylindricalWrapAssemblyResult;
/** Fresh fixed-profile native position proof. No external receipt or flags are accepted as authority. */
export declare function buildCylindricalWrapNativeBoundAssembly(part: Part, input: readonly CylindricalWrapAssemblyComponent[], options: CylindricalWrapNativeBoundOptions): CylindricalWrapNativeBoundResult;
/** Private fresh-source entry for synchronous continuations; no supplied receipt is accepted. */
export declare function buildCylindricalWrapNativeSourceAssembly(part: Part, input: readonly CylindricalWrapAssemblyComponent[], options: CylindricalWrapNativeBoundOptions): {
    readonly native: CylindricalWrapNativeBoundResult;
    readonly source: CylindricalWrapUVSource;
};
export {};
