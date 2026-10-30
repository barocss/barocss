# D308 family common-denominator and equal-axis review

Status: independent read-only static review of the actual worktree source. No repository edit, build, test, probe, benchmark, commit, or subagent was performed. Runtime equivalence, budget headroom, and performance are not established here.

Reviewed core/native-d0-bound.ts: new familyErrors(), its finishFamily() call, the unchanged axisError()/Context/accumulated()/finish(), and the family range/constant-axis setup. The actual diff contains the added familyErrors body and the single family caller replacement; the existing standalone calculation bodies are unchanged.

## Conclusion

No material mathematical, source-correlation, alias, or newly missing exact-guard accounting defect was found in this change.

## Common denominator calculation

The hoisted values factor, denominatorError, the denominator half-minimum guard, and lower depend only on count, basis, range.maximum, range.minimum, and the same Context arithmetic. None depends on range.axes[axis] or range.constant[axis].

Their formulas, operator order, upper-rounding positions, exact q.div(m,two) limit, and lowerDifference calculation match the original axisError text. Computing that deterministic sequence once gives the same normalized rational values that each old axis invocation produced. The positive lower-denominator and unchanged half-minimum guard still run before every axis-specific numerator uses the shared result.

The optimization removes redundant arithmetic and identical guard executions. It does not remove the guard's mathematical condition, quantize a new intermediate, replace a lower bound, change eta/non-grid handling, fuse rounded operators, or introduce a different Context implementation.

## Equal-axis reuse

For fixed common values, the remaining numerator/residual/projection/result sequence depends on an axis only through a=range.axes[axis] and the final constant flag. Reuse requires both an equal constant flag and exact q.compare(a,priorA)==0. The prior index is strictly earlier, so its error is already computed or has been safely reused through the same equality relation. There is no uninitialized/cyclic reuse.

The family entrypoint still forces all three constant flags to false. Retaining the flag equality condition is conservative and prevents a future true/false mismatch from borrowing the wrong final zero/nonzero result. Equality of mathematical magnitude, rather than coefficient identity, is the correct key for this particular recurrence.

Two source axes with the same magnitude envelope need not have equal coefficients, functions, or correlated actual errors. The optimization assumes none of those facts: the same scalar worst-case bound independently applies to both axes under the same weight/basis envelope. finishFamily still adds all three error contributions, including each reused value separately. It does not deduplicate the L1 sum or cancel correlated terms.

No source slot, coordinate, weight, knot, ID, constant-axis detection step, source snapshot, or envelope field is changed. Reuse is request-local and keyed by exact current rational values, not by a geometry ID or a global cross-request cache.

## Aliasing and serialization

The reused R reference is private temporary state. Context and SectionRationalContext arithmetic read their operands and return new rationals; they do not mutate a supplied numerator/denominator. familyBound also reads each R and emits a new exact-fraction record and Number upper result for each axis. Thus internal sharing does not introduce a public mutable alias or alter canonical fraction serialization.

The existing ctx.zero object was already shared in the original implementation. No new caller-owned rational object is returned. Final certificate/source freezing and all original input ownership boundaries remain unchanged.

## Accounting and hard limits

Each visited prior-axis flag comparison is charged once through familyDirect(ctx,1), before the comparison executes. If flags differ, the rational comparison is skipped. If flags match, exact q.compare is charged in the same q ledger and is followed by ctx.check(). This is consistent with existing q-comparison predicates; no extra BigInt arithmetic or uncharged BigInt invariant guard is introduced by the reuse test.

The shared/prior loop indices, assignments, and fixed three-axis control flow are bookkeeping, not a new exact-geometry operation or an unbounded scan. The final ctx.check remains. Source structural work, direct/rational operation totals, GCD work,8192-bit guards,1,048,576-work cap, and caller remaining-operation reservations retain their existing implementation.

Reused results avoid operations that no longer occur. Their old cost must not be charged again, and the cap must not be raised to preserve an obsolete refusal. A smaller true cost can validly make a tighter maxOperations request fit. Actual total/total-1 boundary checks and before/after receipt comparisons are still required.

## Required execution evidence, not performed

The parent should retain the old family semantic receipts and standalone selected-five full receipts, compare exact fractions/Number bits/source slots/envelopes/false flags, and normalize only expected counter changes. Exercise unequal and equal axis envelopes, all-zero/tiny/subnormal coordinates, near10000, both real source half-wall weight variants, actual63 slots, and tight budgets. The independent full generic recurrence oracle is a suitable check that the common values and reuse preserve the original result.

This source conclusion supplies no timing result, combined200k-fit result, new source-sharing authority, mass/physical-solid qualification, or product acceptance.
