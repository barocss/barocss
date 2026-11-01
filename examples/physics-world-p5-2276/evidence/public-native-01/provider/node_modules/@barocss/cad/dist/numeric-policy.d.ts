/** Shared numeric rules. Values match what the kernel modules already apply locally. */
export declare const CadNumericPolicy: Readonly<{
    version: 1;
    /** Modeling coordinate range for authored and stored geometry. */
    coordinateAbs: 10000;
    /** Geometry / interchange coordinate range accepted by math validation (validateCurve, IGES import). */
    geometryCoordinateAbs: 1000000;
    /** Absolute linear comparison floor for native geometry bindings. */
    linearTolerance: 1e-7;
    /**
     * Scale-relative part of the linear tolerance: a 1e-12 parameter bracket on geometry of size S moves
     * points by ~1e-12·S, so comparisons use max(linearToleranceMM, relativeLinearTolerance·S). Equal to the
     * floor for S ≤ 10000 mm (the modeling range), so modeling results are unchanged.
     */
    relativeLinearTolerance: 1e-11;
    /** Comparison for dimensionless chart (UV) bindings; numerically the same as the mm floor, kept apart by meaning. */
    uvBindingTolerance: 1e-7;
    /** Dimensionless relative comparison (derivatives, chains: value · max(1, scale)). */
    relativeComparison: 1e-7;
    /** Normalized parameter bracket width for root refinement. */
    parameterWidth: 1e-12;
    /**
     * A stored binary64 parameter derived from exact geometry is computed exactly and rounded once to
     * nearest. Proofs accept it when it is exact, or when its 3D deviation is within the bound that one
     * such rounding can cause; anything larger is still refused.
     */
    chartParameters: "exact-or-one-rounding-certified-v1";
}>;
/**
 * Per-coordinate 3D bound for lifting chart parameters (u, v) that were each rounded once:
 * |Δu| ≤ 2^-53·max(|u0|, |u1|) moves the point by |Δu|·|U_i|/(u1 − u0) along chart axis U, likewise
 * for v. Doubled for margin; still ~1e-15 of the chart size, far below the 1e-7 mm linear floor.
 */
export declare function chartRoundingBoundMM(axisU: readonly number[], domainU: readonly [number, number], axisV: readonly number[], domainV: readonly [number, number]): [number, number, number];
/** Linear comparison tolerance for geometry whose coordinates reach `scaleMM` (see relativeLinearTolerance). */
export declare function linearToleranceMM(scaleMM: number): number;
/** Largest absolute coordinate over point lists (curve poles, surface poles, …). */
export declare function geometryScaleMM(...pointLists: readonly (readonly (readonly number[])[])[]): number;
