import type { Curve, Surface } from '../types.js';
import type { SectionFraction, SectionRationalContext } from '../section-rational-internal.js';
import { KernelError } from '../core/barocss-error.js';
type F = SectionFraction;
type Domains = {
    u: [number, number];
    v: [number, number];
};
type Profile = {
    assetIndex: 0 | 1;
    degreeU: 1 | 2;
    degreeV: 1;
    domain: Domains;
    uniformWeight: F;
    originalCartesian: F[][][];
    xU: F[];
    yU: F[];
    yV: F[];
    zU: F[];
    zUV: F[][];
    axisResiduals: F[][][];
};
type Proof = {
    schema: 'barocss-exact-paired-vlinear-surface-intersection';
    version: 0;
    parameterDomain: [number, number];
    parameterAuthority: 'original-a-u-interval';
    profiles: [Profile, Profile];
    originalUB: {
        offset: F;
        scale: F;
        coefficients: F[];
    };
    originalVA: F[];
    originalVB: F[];
    commonDegree: 4;
    worldCartesian: F[][];
    pcurveACartesian: F[][];
    pcurveBCartesian: F[][];
    composedA: F[][];
    composedB: F[][];
    residualsA: F[][];
    residualsB: F[][];
    chartGaps: {
        assetIndex: 0 | 1;
        uMinimum: F[];
        uMaximum: F[];
        vMinimum: F[];
        vMaximum: F[];
        minimumUGap: F;
        minimumVGap: F;
    }[];
    fixedUJacobianDeterminant: F;
    uniqueCompleteBranchOnDeclaredInterval: true;
    storedWorldEqualsBothCompositions: true;
    originalInputsPreserved: true;
    authority: 'exact-stored-source-axis-profile-and-entire-coefficient-composition';
};
export type ExactPairedVLinearProfile = Profile;
export type ExactPairedVLinearProof = Proof;
export interface ExactPairedVLinearDerived {
    world: Curve;
    pcurveA: Curve;
    pcurveB: Curve;
    proof: ExactPairedVLinearProof;
}
/** Known private admission failures; errors from the caller's q are never wrapped. */
export declare class ExactPairedVLinearPolynomialError extends KernelError {
    readonly code: 'SUPPORT' | 'DOMAIN' | 'BINDING';
    readonly assetIndex: 0 | 1 | null;
    constructor(code: ExactPairedVLinearPolynomialError['code'], detail: string, assetIndex: 0 | 1 | null);
}
/** Whole source-axis reduction, actual stored Curve construction and full coefficient binding. */
export declare function deriveExactPairedVLinearPolynomialsTrusted(surfaces: [Surface, Surface], domains: [Domains, Domains], uAInterval: [number, number], ids: {
    worldCurveId: string;
    pcurveAId: string;
    pcurveBId: string;
}, q: SectionRationalContext): ExactPairedVLinearDerived;
export {};
