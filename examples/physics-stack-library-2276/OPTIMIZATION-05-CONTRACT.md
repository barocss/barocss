# Exact dyadic normalization, candidate05

Status: SOURCE_AUTHORING_ONLY_NOT_EXECUTED. Root alone executes arithmetic,
compilation, independent observers and runtime diagnostics. The source author
has executed no arithmetic helper, production import, compiler or test. Preserve
all earlier sources, manifests, receipts and failures. No old candidate timing
is repeated. OPT04 is archived unchanged at baseline/strict-line-opt04.ts.

## Frozen change

Change ONLY Arithmetic.make. Keep its checked numerator, checked denominator,
zero-denominator refusal, canonical zero return and negative-denominator sign
normalization in their existing order. Then, for denominator1, call the existing
guardCached and return the already reduced integer. There is no fabricated
integer charge. For every other positive denominator, charge two integer ticks
before its subtraction and bitwise AND. If d & (d-1) is zero, charge two ticks
before negating the positive numerator magnitude and computing its bitwise AND.
Set factor=|n| & -|n| and divisor=min(factor,d). Charge two ticks before the two
normalization divisions. Return {n:n/divisor,d:d/divisor}. All nonbinary
denominators retain the existing Euclidean loop and final divisions unchanged.

The existing div guardCached and all previous optimization paths are unchanged.
No cache, global state, Rational provenance assumption, new public API, operand
pre-cancellation, geometry, rounding, tolerance, iteration or budget change.
No production import from examples. Existing limits remain16384 bits,
200000 rational operations,2000000 integer operations and16 rounding steps.

## Exact proof and resource boundary

Every nonzero integer magnitude is uniquely 2^t*u with u odd. Its bitwise
low factor |n| & -|n| is exactly2^t. If d=2^k, gcd(|n|,d)=2^min(t,k).
Thus divisor=min(factor,d) is the complete GCD. Dividing both components by it
gives the same signed reduced rational as Euclid for arbitrary input integers,
including initially unreduced fractions. Denominator1 is already reduced.
No test can rely on the source having tagged its own outputs as canonical.

The new intermediate d-1 is nonnegative and below the checked positive d.
The denominator AND is between0 and d. The temporary -|n| has the same bit
length as |n|. Its AND factor is positive and no larger than |n|. Both final
quotients are no larger in magnitude than their checked inputs. These bounded
intermediates therefore need no larger integer admission or extra checked call,
just as the old Euclidean remainders are bounded by their checked divisors.
The original checked calls still refuse an oversized input before cancellation,
even if its eventual reduced fraction would fit. Zero denominator still wins
over zero numerator when both are zero. Sign normalization is unchanged.

Actual operation counters deliberately differ. The new integer return has no
integer arithmetic. The new power-of-two path costs six integer ticks after
sign normalization. Every nonbinary denominator has two extra actual integer
operations before the old Euclidean work. Tiny dyadics can also cost more ticks
than the old algorithm. Work admission can improve OR regress at the unchanged
cap. No universal resource-refusal parity or speed improvement is claimed.
The integer return checks all existing failed-context counters; it cannot turn
an exhausted context into a new usable path. The power-of-two path has charged
integer work before its return. The old zero return is unchanged.

## Fixed32 arithmetic cases, before calls

Use the ACTUAL private Arithmetic instance through a test-only structural cast.
No shipping export, test mode, copied arithmetic oracle, counter mutation,
limit mutation, retry or counter reset. The baseline is the actual OPT04 native
module pinned by OPTIMIZATION-05.json. Literal powers are materialized only by
the executing agent. Compare canonical fractions to the independent analytic
answers below; compare actual OPT04 as a secondary check wherever both complete.
IEEE words are MSB-first, distinct from the physical F64LE archive convention.

1. make(6,8)=3/4.
2. make(-6,8)=-3/4.
3. make(6,-8)=-3/4.
4. make(-6,-8)=3/4.
5. make(32,8)=4/1: the numerator low factor exceeds d.
6. make(3,8)=3/8: odd numerator.
7. make(0,-8)=0/1: original canonical zero route.
8. make(7,1)=7/1: positive integer return.
9. make(-7,1)=-7/1: negative integer return.
10. make(7,-1)=-7/1: original sign normalization before integer return.
11. make(12,18)=2/3: nonbinary composite Euclidean fallback.
12. make(-15,21)=-5/7: signed nonbinary fallback.
13. make(5,0) refuses StrictLineFailure/zero rational denominator.
14. make(0,0) refuses the same denominator error before canonical zero.
15. make(2^16384,1) refuses integer bit limit BEFORE the integer shortcut,
    even though no GCD is needed.
16. make(0,2^16384) refuses integer bit limit BEFORE the old zero shortcut.
17. make(2^16384-1,1)=(2^16384-1)/1, exact maximum-bit numerator.
    Fraction only; no finite-number claim.
18. make(3,2^16383)=3/2^16383, exact maximum-bit binary denominator.
    Fraction only; no number conversion is required.
19. make(3*2^8191,2^8192)=3/2: large common binary factor.
20. make(2^8193,2^8192)=2/1: large numerator factor exceeds denominator.
21. make(-3*2^8191,-2^8192)=3/2: large factor with both signs negative.
22. make(2^53+1,2^53)=(2^53+1)/2^53;
    RNE even-lower word3ff0000000000000.
23. make(2^53+3,2^53)=(2^53+3)/2^53;
    RNE even-upper word3ff0000000000002.
24. make(1,2^1074)=1/2^1074; minimum subnormal word0000000000000001.
25. from(+0) AND from(-0) give canonical0/1; number gives positive zero,
    word0000000000000000. Original sign-of-zero conversion is unchanged.
26. number(make(-1,2^1075)) gives negative zero, word8000000000000000.
27. number(make(1,2^1075)) gives positive zero, word0000000000000000.
28. from(+Infinity), from(-Infinity) AND from(NaN) retain
    StrictLineFailure/nonfinite exact operand.
29. Actual div of1/7 by0/1 AND0/1 by0/1 retain
    StrictLineFailure/zero rational denominator. Precreate operands.
30. Fresh context: precreate zero,1/8 and3/4. Repeat actual neg(zero), at most
    200001 attempts, until rational work refuses. Both implementations must
    then refuse div(1/8,3/4) with rational work limit. Candidate make(7,1)
    must also refuse via its existing failed-context guard. Record attempts
    and actual counters; do not claim baseline direct-make parity after a
    failed rational context.
31. Fresh context: precreate div operands1/8,3/4 and canonical zero/one.
    Repeat actual make(55,89), at most200001 attempts, until integer work
    refuses; each completed value is55/89. Both implementations must then
    refuse make(7,1), make(3,8), div(1/8,3/4) AND div(0/1,1/1) with integer
    work limit. No rational operation cap can trigger during make repetition.
    Record attempts and counters; new and old counts need not match.
32. Fresh candidate context: make(2^16384,1) first refuses integer bit limit.
    A later make(7,1) must still refuse integer bit limit through guardCached.
    This fixed failed-context guard is intentional. Baseline direct-make
    recovery after an already failed bit context is not a parity requirement.

Retain the existing26 OPT04,25 OPT03 and16 original arithmetic cases and19
boundary cases. Use fresh Source/genuineNative first32 and all three scenes'
one-step/16 prefixes. Require the full independent contact/position/ledger/
quality checks and actual normals, onA/onB witness/point/body binary64 words
to match the original executed run04 baseline. No broad numeric exception or
subtree omission. Counter fields may differ only when named explicitly.

Root decides on one fresh immutable canonical runtime diagnostic only after
these checks. OPT04's1200 local/normal-KKT samples and timings remain diagnostic
evidence; independent full acceptance is0 and API=false. Complete independent
1200/body-cap/resource promotion remains BLOCKED. No mobile, deployment,
publication, API promotion or resumed HOLD work follows from this candidate.
