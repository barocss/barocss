// CAD numeric policy v1 — the single home for the kernel's shared numeric rules.
// Phase 1 of the unification: values every module already uses, plus the "exact or one-rounding
// certified" rule for stored chart parameters. Later phases move per-module literals onto it.

/** Shared numeric rules. Values match what the kernel modules already apply locally. */
export const CadNumericPolicy = Object.freeze({
  version: 1 as const,
  /** Modeling coordinate range for authored and stored geometry. */
  coordinateAbsMM: 10000,
  /** Absolute linear comparison floor for native geometry bindings. */
  linearToleranceMM: 1e-7,
  /** Normalized parameter bracket width for root refinement. */
  parameterWidth: 1e-12,
  /**
   * A stored binary64 parameter derived from exact geometry is computed exactly and rounded once to
   * nearest. Proofs accept it when it is exact, or when its 3D deviation is within the bound that one
   * such rounding can cause; anything larger is still refused.
   */
  chartParameters: 'exact-or-one-rounding-certified-v1' as const,
});

const HALF_ULP = 2 ** -53;
/**
 * Per-coordinate 3D bound for lifting chart parameters (u, v) that were each rounded once:
 * |Δu| ≤ 2^-53·max(|u0|, |u1|) moves the point by |Δu|·|U_i|/(u1 − u0) along chart axis U, likewise
 * for v. Doubled for margin; still ~1e-15 of the chart size, far below the 1e-7 mm linear floor.
 */
export function chartRoundingBoundMM(axisU: readonly number[], domainU: readonly [number, number],
  axisV: readonly number[], domainV: readonly [number, number]): [number, number, number] {
  const reach = (domain: readonly [number, number]) => HALF_ULP * Math.max(Math.abs(domain[0]), Math.abs(domain[1])) / (domain[1] - domain[0]);
  const ru = reach(domainU), rv = reach(domainV);
  return [0, 1, 2].map(i => 2 * (ru * Math.abs(axisU[i]) + rv * Math.abs(axisV[i])) * (1 + 2 ** -40)) as [number, number, number];
}
