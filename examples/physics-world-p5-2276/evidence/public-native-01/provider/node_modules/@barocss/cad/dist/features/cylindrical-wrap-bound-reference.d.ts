import { type KernelError } from '../core/barocss-error.js';
import type { Part } from '../part/part-model.js';
import { type CylindricalWrapAssemblyComponent, type CylindricalWrapNativeBoundResult } from './cylindrical-wrap-assembly.js';
import { type FormalPadBudgets, type FormalPadRectangle, type CylindricalWrapFormalPadMass } from './cylindrical-wrap-formal-mass.js';
export interface CylindricalWrapBoundReferenceOptions {
    readonly id: string;
    readonly height: number;
    readonly density: number;
    readonly budgets: FormalPadBudgets;
    readonly maxOperations?: number;
}
export interface CylindricalWrapBoundReferenceCounts {
    readonly exactOperations: number;
    readonly nativeOperations: number;
    readonly formalOperations: number;
    readonly outerDirectOperations: number;
    readonly nativeWork: number;
    readonly formalWork: number;
    readonly outerWork: number;
    readonly work: number;
    readonly maximumBits: number;
}
declare const MEANING: Readonly<{
    sourceIdentity: "same-owned-frozen-part-two-synchronous-fresh-checks";
    sourceChecks: 2;
    sourceCosts: "both-complete-child-costs-counted";
    nativePositionBindingCertified: true;
    formalReferenceMassOnly: true;
    closedReferenceCertified: false;
    physicalBrepCertified: false;
    retainedFaceClosureCertified: false;
    representedVolumeCertified: false;
    partMassProvider: false;
    productFeature: false;
}>;
export interface CylindricalWrapBoundReferenceResult {
    readonly native: CylindricalWrapNativeBoundResult;
    readonly formal: CylindricalWrapFormalPadMass;
    readonly rectangle: FormalPadRectangle;
    readonly options: CylindricalWrapBoundReferenceOptions;
    readonly reservations: {
        readonly native: number;
        readonly formal: number;
    };
    readonly counts: CylindricalWrapBoundReferenceCounts;
    readonly limits: {
        readonly exactOperations: number;
        readonly hardExactOperations: 200000;
        readonly integerBits: 8192;
        readonly work: 1048576;
    };
    readonly meaning: typeof MEANING;
    readonly solidQualified: false;
}
export type CylindricalWrapBoundReferenceCode = 'INPUT' | 'SUPPORT' | 'BUDGET';
export type CylindricalWrapBoundReferenceError = KernelError & {
    readonly code: CylindricalWrapBoundReferenceCode;
};
export declare function isCylindricalWrapBoundReferenceError(error: unknown): error is CylindricalWrapBoundReferenceError;
/**
 * Two fresh synchronous checks of one owned source, with both complete costs retained.
 * Position binding and formal reference mass do not qualify the assembled physical solid.
 */
export declare function buildCylindricalWrapBoundReference(partInput: Part, componentsInput: readonly CylindricalWrapAssemblyComponent[], optionsInput: CylindricalWrapBoundReferenceOptions): CylindricalWrapBoundReferenceResult;
declare const SHARED_MEANING: Readonly<{
    sourceIdentity: "one-owned-frozen-native-source-live-continuation";
    sourceChecks: 1;
    sourceCosts: "one-actual-execution-counted-in-native-parent";
    nativePositionBindingCertified: true;
    formalReferenceMassOnly: true;
    closedReferenceCertified: false;
    physicalBrepCertified: false;
    retainedFaceClosureCertified: false;
    representedVolumeCertified: false;
    partMassProvider: false;
    productFeature: false;
}>;
export type CylindricalWrapSharedReferenceResult = Omit<CylindricalWrapBoundReferenceResult, 'meaning'> & {
    readonly meaning: typeof SHARED_MEANING;
};
export type CylindricalWrapAnyReferenceResult = CylindricalWrapBoundReferenceResult | CylindricalWrapSharedReferenceResult;
/** Private combined entry. It executes source extraction once and does not subtract any executed work. */
export declare function buildCylindricalWrapSharedReference(partInput: Part, componentsInput: readonly CylindricalWrapAssemblyComponent[], optionsInput: CylindricalWrapBoundReferenceOptions): CylindricalWrapSharedReferenceResult;
export {};
