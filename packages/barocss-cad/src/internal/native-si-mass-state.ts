// Private provenance for native SI file exports. Public mass properties remain MMGS.
import type { MassProperties } from '../brep/solid-mass.js';

export type NativeSITensor = readonly [readonly [number, number, number], readonly [number, number, number], readonly [number, number, number]];
export type NativeSIUnavailableReason = 'untracked' | 'revolved' | 'transformed' | 'combined' | 'difference';
export type NativeSIInertiaResult =
  | { readonly ok: true; readonly inertia: NativeSITensor; /** Original density, g/cm³. */ readonly density: number }
  | { readonly ok: false; readonly code: 'NATIVE_SI_PROVENANCE_UNAVAILABLE'; readonly reason: NativeSIUnavailableReason };
type CentralMoments = readonly [number, number, number, number, number, number];
type Basis = { readonly kind: 'integrals'; readonly density: number; readonly central: CentralMoments }
  | { readonly kind: 'unsupported'; readonly reason: NativeSIUnavailableReason };
const bases = new WeakMap<MassProperties, Basis>();
const results = new WeakMap<MassProperties, NativeSIInertiaResult>();

/** Retain values already computed by the public integral path; do not integrate or change the public object. */
export function recordIntegralMass(props: MassProperties, density: number, central: CentralMoments): void {
  bases.set(props, { kind: 'integrals', density, central: Object.freeze([...central]) as CentralMoments });
}
/** A metadata-only wrapper (volumeBound) retains the same tensor and basis. */
export function transferNativeMassBasis(from: MassProperties, to: MassProperties): void {
  const basis = bases.get(from);
  if (basis) bases.set(to, basis);
}
/** Derived mass needs its own SI-order proof; never infer its raw moments from rounded MMGS data. */
export function unsupportedNativeMass<T extends MassProperties>(props: T, reason: Exclude<NativeSIUnavailableReason, 'untracked'>): T {
  bases.set(props, { kind: 'unsupported', reason });
  return props;
}
/** Lookup only. A copy or worker clone has no provenance. No geometry or public mass API is called. */
export function readNativeSIInertia(props: MassProperties): NativeSIInertiaResult {
  const cached = results.get(props);
  if (cached) return cached;
  const basis = bases.get(props);
  if (!basis || basis.kind === 'unsupported') return { ok: false, code: 'NATIVE_SI_PROVENANCE_UNAVAILABLE', reason: basis?.reason ?? 'untracked' };
  const [xx, yy, zz, xy, xz, yz] = basis.central;
  // Preserve the former kg/m³ coefficient and its application order before the MMGS rounding step.
  const k = (basis.density * 1000) * 1e-15;
  const inertia: NativeSITensor = Object.freeze([
    Object.freeze([k * (yy + zz), -k * xy, -k * xz] as const),
    Object.freeze([-k * xy, k * (xx + zz), -k * yz] as const),
    Object.freeze([-k * xz, -k * yz, k * (xx + yy)] as const),
  ] as const);
  const result: NativeSIInertiaResult = Object.freeze({ ok: true, inertia, density: basis.density });
  results.set(props, result);
  return result;
}
