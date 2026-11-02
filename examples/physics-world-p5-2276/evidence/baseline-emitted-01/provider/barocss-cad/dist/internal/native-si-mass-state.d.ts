import type { MassProperties } from '../brep/solid-mass.js';
export type NativeSITensor = readonly [readonly [number, number, number], readonly [number, number, number], readonly [number, number, number]];
export type NativeSIUnavailableReason = 'untracked' | 'revolved' | 'transformed' | 'combined' | 'difference';
export type NativeSIInertiaResult = {
    readonly ok: true;
    readonly inertia: NativeSITensor; /** Original density, g/cm³. */
    readonly density: number;
} | {
    readonly ok: false;
    readonly code: 'NATIVE_SI_PROVENANCE_UNAVAILABLE';
    readonly reason: NativeSIUnavailableReason;
};
type CentralMoments = readonly [number, number, number, number, number, number];
/** Retain values already computed by the public integral path; do not integrate or change the public object. */
export declare function recordIntegralMass(props: MassProperties, density: number, central: CentralMoments): void;
/** A metadata-only wrapper (volumeBound) retains the same tensor and basis. */
export declare function transferNativeMassBasis(from: MassProperties, to: MassProperties): void;
/** Derived mass needs its own SI-order proof; never infer its raw moments from rounded MMGS data. */
export declare function unsupportedNativeMass<T extends MassProperties>(props: T, reason: Exclude<NativeSIUnavailableReason, 'untracked'>): T;
/** Lookup only. A copy or worker clone has no provenance. No geometry or public mass API is called. */
export declare function readNativeSIInertia(props: MassProperties): NativeSIInertiaResult;
export {};
