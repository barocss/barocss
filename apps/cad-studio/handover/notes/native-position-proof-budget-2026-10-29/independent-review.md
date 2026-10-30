# D305 independent performance-patch review

Status: read-only static review. No repository or candidate source was changed. No build, test, probe, benchmark, commit, or subagent was started.

Reviewed:

- /tmp/barocss-native-binding-zero-shortcut.patch
- /tmp/barocss-native-d0-family-fast-bound.patch
- /tmp/barocss-native-binding-perf-plan.md
- /tmp/barocss-native-d0-family-fast-bound-plan.md
- The current native position/assembly, native D0 Context/recurrences, and generic SectionRationalContext conversion contracts.

## Result

No unsafe mathematical bound, IEEE successor, coefficient mutation, zero-alias regression, or tolerance relaxation was found. One narrow direct-comparison accounting gap should be closed before the new fast-conversion counters are treated as the complete hard ledger. Runtime equivalence, actual headroom, and performance remain unverified here.

## Accounting finding: familyBound invariant comparisons

The fast converter explicitly charges its two initial BigInt sign comparisons and its three Number range guards through familyDirect. It also charges the two successor guards. Under that stated direct-comparison accounting model, the following familyBound comparisons are not charged:

    numeratorHigh !== 0n
    denominatorHigh > 0n
    mask !== 0n
    remainder !== 0n
    value.n === 0n

The first four all execute on a successful invariant check. The fifth selects the zero path. Context.integer charges the preceding shift/subtract/and/modulo results and input sizing; it does not charge these later comparisons. No new structuralWork charge covers them either.

A conservative familyDirect(ctx,4) before the combined invariant guard and familyDirect(ctx,1) before the zero branch closes this gap without changing arithmetic, supported source data, bounds, fields, or tolerances. There are four bound conversions per family, so this is up to20 extra direct operations per request. It is small, but a caller using maxOperations equal to the returned count should not receive an incomplete direct-operation ledger. Rebaseline the expected counters after the charge; do not add an allowance or widen the cap.

This finding concerns the hard accounting contract. It does not identify an underestimated geometric/native error or a wrong least-upper Number.

## Zero shortcuts

Both uses are valid for admitted finite same-bit scalar coordinates: their exact rational difference is0. The array, source-field, basis, weight, tolerance, and ownership checks remain before or outside the shortcut. No coefficient check is bypassed. Opposite signed zeros take the former path because Object.is distinguishes them; same-sign zeros safely skip a zero term.

nativePointResidual still creates fresh local zero totals and performs the row maximum. Nonidentical coordinates retain the complete q.from/sub/abs/add calculation. The shortcut does not alter the exact residual or its normalized fraction.

nativeEndpointPositionBound retains scalar validation, both owned finite point copies, coordinate range checks, and actual tolerance admission before comparing bits. NaN, Infinity, getters, or out-of-range point coordinates cannot use the shortcut. A mixed/nonidentical path obtains a fresh normalized result from q.add. The all-identical path explicitly calls q.rat(eL1.n,eL1.d), preserving the former normalized, nonaliased result even for an unreduced caller input. Returning eL1 directly would have been unsafe; the proposed patch does not do that.

The added comparison work charges are present in both loops. The original rectilinear legacy builder does not call either optimized native-binding residual path. No native evaluator, pcurve direction, source record, vertex point, or entity tolerance is modified.

## Family IEEE conversion

All axis and L1 values reach familyBound after the unchanged outward-fixed128 recurrence and unchanged requested-budget check. Context.upper returns a reduced rational on the2^-128 grid. The converter also explicitly checks nonnegative n, positive d, n<2^128, d<=2^128, power-of-two d, divisibility of2^128 by d, and value<=the represented native linear floor.

For a nonzero admitted value, d=2^k with0<=k<=128 and n>=1. Therefore n/d>=2^-128. Number(n) is nearest conversion of a bounded finite positive integer; Number(d) is an exact finite power of two. Scaling that nearest integer by2^-k remains in the normal binary64 range and is exact. It translates the normal rounding lattice, so candidate is nearest to the exact n/d without a subnormal or overflow double-rounding problem.

The exact q comparison then establishes which side of the target candidate lies on. If candidate>=target, nearest conversion implies that its predecessor is below target. If candidate<target, its immediately next positive IEEE code is the least representable upper value. The successor is guarded against nonpositive input and finite-code overflow, and its exact value is checked against the target again. The zero branch returns positive0. These results match the generic q.bound meaning, not merely an arbitrary enclosing Number.

The range guard candidate<=the represented native floor cannot reject a previously valid nonzero nearest conversion merely due to upward rounding: that floor is itself a representable endpoint, and rounding is monotone. A target below or equal to it cannot round above it. The successor branch also cannot cross it when target is below or equal to it.

The shared DataView is used synchronously on private primitive values; no callback/await or user conversion hook intervenes between its write/read steps. It is separate from each q Context's own storage. This introduces no observed reentrancy or standalone-state hazard in the reviewed call graph.

## Preserved arithmetic and authority

finishFamily copies the existing basis admission, three axisError calls, outward L1 sum, and requested error-budget comparison. Only the four final bound conversions differ. Exact rational fraction text is still q.text of the same reduced value. No converted Number feeds back into a recurrence or stored geometry.

The standalone finish, Context.bound, certifyNativeCurveD0, and certifyNativeSurfaceD0 bodies are unchanged. The new module-level DataView and constant are not calls in those standalone ledgers. Their preserved receipts must still be checked externally; static inspection is not that differential evidence.

Input structure, source snapshots, weight/domain admission, family envelope, forced nonconstant worst-template proof, all63 actual geometry slots, and every false physical/mass/product flag remain unchanged. The new counters replace binary-search work with charged direct conversion work; a lower counter is not by itself a timing result or approval for a later mass feature.

## Evidence-comparison boundary when combining the patches

The zero-shortcut plan correctly removes only the final nativeBinding.counts for its own proof comparison, because its shortcuts run after assembly/side/D0 phases. Once the family-conversion patch is also applied, nested evaluator.counts and the corresponding phase/final counters legitimately change too. The zero-only verifier would then report a false difference.

For the combined candidate, normalize only those explicitly expected counter records. Retain all exact fraction strings, upper Number bits, source/basis/domain/slot/envelope fields, binding bounds, tolerances, geometry fields, and false flags. Do not delete the whole evaluator or whole native proof to make the combined comparison pass. The fast-bound plan already requires this separate semantic/count comparison.

The generic-bound comparison plus exact predecessor criterion is a meaningful numerical oracle. It must accompany preserved before/after family receipts and standalone receipts. The scale0 fixture supplies zero coordinates; it should not be described as proof that a produced bound takes the zero-return branch unless that branch is actually observed, since the forced-nonconstant recurrence can retain a positive absolute error allowance.

No execution result or saving is claimed in this review. Required frozen-source tests and the existing perf-bench before/after runs remain the parent's work.

## Final successor/conversion accounting check

The existing familyNextUp `familyDirect(ctx,2)` covers exactly the two guard comparisons: `value>0` and `bits>=0x7fefffffffffffff`. They need no additional charge. Precharging both remains conservative if the first comparison refuses and short-circuits the second.

The successful successor path has seven charged direct primitives: setFloat64(1), the exact getBigUint64 result through Context.integer(1), the two guard comparisons(2), code increment through Context.integer(1), setBigUint64(1), and getFloat64(1). The integer result checks retain the existing8192-bit maximum accounting. A positive finite code below the maximum advances to another finite positive code; no unchecked Number arithmetic constructs the successor.

The main converter separately charges Number(n), Number(d), and the power-of-two division as3 direct operations. The next3 direct charges cover finite/minimum/maximum candidate guards. q.from(candidate), exact q comparisons, q.text, and any q.from(successor) use the original q operation ledger. Integer shift/subtract/and/modulo results are sized and charged through Context.integer. Input integer sizing is charged there too. The explicit dyadic/numerator guards make those Number conversions bounded to at most129-bit integer inputs, and exact scaling stays normal.

After the earlier five guard-comparison charges per bound are added, no further material successor, IEEE conversion, or resource-accounting gap was identified in this review. This is a source conclusion only. The document is frozen; the parent owns any source correction and all execution evidence.
