# D307 private fixed128 raw-midpoint conversion candidate

Status: temporary patch only. No repository file, test, workload, or source receipt was changed. No build, test, probe, benchmark, commit, or subagent was started. D306's reported40919 total /11544 source /29375 local operation counts and focused24 pass are parent-supplied observations, not results of this task.

Candidate: /tmp/barocss-formal-mass-midpoint-fast.patch.

## Exact target and scope

An internal raw interval is [lo/S,hi/S], S=2^128. Its exact midpoint is:

    n/d = (lo+hi)/2^129.

Only the ten raw moment midpoint conversions change. The source/carrier, interval construction, ten moment formulas, final public Number arithmetic, every raw/output audit, budgets, representation metadata, and native SI policy remain untouched. zCenter still calls the original generic ctx.nearest. No new public/private export or test hook is added.

## Guarded nearest proof

1. Compute n with the existing charged ctx.addInteger. Exact n=0 returns literal positive0, matching generic q.nearest of exact zero.
2. For nonzero n, test the sign, size abs(n) with Context.integer, and compute abs(n)>>256. Require that exact shifted value to be0. Thus1<=abs(n)<2^256. This is an explicit conversion proof guard, not a relaxation of the existing8192-bit global limit.
3. Number(n) is nearest/ties-to-even binary64 conversion of the exact signed integer. It is finite; its magnitude is at most2^256, including a possible rounding to that endpoint.
4. The denominator Number is exactly2^129, obtained once from the exact power-of-two BigInt constant. Dividing the rounded integer by this power of two shifts its exponent without another rounding. Nonzero magnitude is at least2^-129 and at most2^127, so the result remains normal and finite. Neither underflow/subnormal double rounding nor overflow is possible.
5. Exact power-of-two scaling maps the neighboring normal binary64 values and their significand parity to the neighbors at the target scale. Therefore the resulting Number is the same nearest/ties-to-even value as generic q.nearest(n/2^129). The argument applies symmetrically to negative n. A nonzero admitted n cannot produce either signed zero.
6. The implementation also checks Number.isFinite and the proved magnitude range[2^-129,2^127]. Unexpected range failure is typed REPRESENTABILITY. No approximate equality, fallback retry, tolerance increase, nextUp adjustment, or sample approval is used.

The256-bit guard is well above the expected numerator size for the existing native coordinate/volume/moment range; it must still remain explicit. A domain-wide unchanged-admission claim requires the parent's frozen-source boundary checks. Do not replace a new guard refusal with a looser guard merely to obtain a passing benchmark.

All output estimates are primitive Numbers. No mutable rational input is returned, and no alias/normalization contract is introduced. Source coordinates and output geometry are never rewritten.

## Accounting

All new input-dependent operations share the existing Context. midpointDirect adds to direct and calls the same check that applies the global operation/work caps. Exact integer addition, abs-result sizing, and shifted-result sizing use Context.integer and retain the maximum-bit ledger.

Successful nonzero path charges12 direct primitives:

| Primitive | Charge |
| --- | --- |
| Existing exact numerator addition |1|
| Exact zero comparison |1|
| Exact sign comparison |1|
| Absolute integer result and sizing |1|
| Exact256-bit shift result and sizing |1|
| Exact high-part guard comparison |1|
| BigInt-to-Number conversion and Number division |2|
| Number absolute value |1|
| Finite, lower-normal-range, upper-finite-range guards |3|

The zero path charges the numerator addition and exact zero comparison,2 direct primitives. The sign-dependent abs sizing is conservatively charged on either sign. All three range guards are precharged, including a possible short-circuit refusal. Module-level powers of two are fixed exact constants, not input-dependent conversion work or a cache of prior results.

The previous numerator addition is retained. The raw midpoint q.rat and q.nearest float-code searches disappear. Their exact source/output values must be preserved; their operation/GCD/float-search counters are expected to change. No exact saving count, timing improvement, or newly available native/mass feature budget is claimed before measurement.

## Parent verification plan, not executed

- Preserve the completed D306 source/dist baseline before applying the candidate or running a new workload.
- Obtain before/after full formal receipts on identical actual-source rectangles: the standard fixture, negative/asymmetric V, centered exact-zero Z/XZ/YZ, positive and negative source translations, several densities, and near-diagonal angle cases. Compare all ten raw estimate Numbers with Object.is or complete IEEE bits, including positive zero. Also compare all final properties, raw/output interval fractions/errors, angles, source/representation metadata, and false qualification flags. Normalize only the changed cumulative counters.
- Keep the source cost identical. Keep zCenter's generic conversion and the native SI transfer policy unchanged. Check current too-tight operation-budget refusals against the new true counts; do not require an obsolete arithmetic cost to remain a refusal.
- Use the existing generic SectionRationalContext.nearest as a conversion oracle in the parent's test lane, not in production. If a focused isolated test is added, cover n=0, +/-1, integers around2^53, positive/negative ties such as2^53+1, binade boundaries, and values immediately below2^256. Verify the explicit abs(n)>=2^256 guard refusal. Do not add a public export solely for this test.
- Re-run the independent moment/density/scalar-audit tests; raw-number equivalence alone is not a replacement for those semantic checks.
- The separate workload worker/root owns the mandatory existing perf-bench before/after. Record actual run count, timing, context, and unchanged values. A smaller rational counter alone is budget evidence, not a performance result.

No Part.mass provider, physical B-rep qualification, stored-B-rep volume theorem, global native SI accuracy theorem, document schema change, or runtime dependency is added.
