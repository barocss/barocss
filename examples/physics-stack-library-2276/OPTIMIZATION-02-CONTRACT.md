# Equal-denominator exact addition, candidate02

Status: DESIGN_FROZEN_SOURCE_NOT_YET_CHANGED. Root alone executes arithmetic,
imports, compilation, tests, prefixes and runtime diagnostics. Hold package
source until Root checkpoints candidate01 and explicitly authorizes the edit.
The observed library function, not offline proof tooling, is the target.
Runtime01 accepted542 before its170s stop; canonical OPT01 accepted1050 before
its170s stop. Preserve both receipts, first failures and all raw frames. These
separate diagnostics are not same-boundary speed benchmarks or fullP4 evidence.

Change ONLY Arithmetic.add in package stack/strict-line.ts. Execute its existing
`this.op()` BEFORE the branch. For canonical rationals a,b with the SAME positive
denominator d, return `make(sum(a.n,b.n),d)`. Otherwise execute the original
three multiplications, sum and make, byte-for-byte except formatting needed for
the branch. Do not add zero, integer, cross-cancellation, GCD or common-multiple
algorithms. Cache behavior from OPT01 stays unchanged.

The identity is (an*d+bn*d)/(d*d)=(an+bn)/d for d>0. All internal rationals are
canonical with checked numerator/denominator. make still checks the RAW sum and
denominator, rejects zero denominator, normalizes sign and GCD, and returns the
same canonical fraction. The exact value, comparison result and RNE word are
unchanged whenever both paths complete. No tolerance, precision, iteration,
rational/integer work cap16384-bit guard or per-operation price changes.
Actual skipped multiplications and their redundant normalization work are not
charged as though executed. No fake old counters or general cost GO is claimed.

Resource outcomes are algorithm dependent and explicitly NOT universally
identical. With D=2^8192+1, a=b=1/D, old denominator product has16385 bits and
refuses; new sum2 and D fit, giving canonical2/D. This is less actual temporary
work under the SAME cap. Conversely a=b=(2^16384−1)/2 must still refuse: the raw
sum has16385 bits even though the eventual reduced result could fit. The sum
guard runs BEFORE make; no pre-reduction, cap raise or fallback is allowed.
Every addition, including the fast branch, retains rational and integer work
guards. An already-exceeded arithmetic budget cannot be bypassed by the branch.

## Fixed16 arithmetic controls, before calls

Use the ACTUAL class in the production context through a test-only structural
cast of the existing private `m` field. No production export, mode, budget hook,
replacement implementation, synthetic counters or copied arithmetic oracle.
Construct canonical operands through the actual make method; compare to the
following independent analytic numerator/denominator truth. Powers are literal
descriptors materialized by Root in tests, not author-time numerical calls.
Only the last three cases additionally convert with the unchanged actual
Arithmetic.number; expected words below are unsigned IEEE MSB-first words.

1. 0/1+0/1 =0/1.
2. 3/1+4/1 =7/1.
3. −5/1+2/1 =−3/1.
4. 5/7+(−5/7) =0/1.
5. 1/6+1/6 =1/3.
6. −1/6+(−1/6) =−1/3.
7. 2/9+5/9 =7/9.
8. Unequal-denominator fallback:1/2+1/3 =5/6.
9. Unequal-denominator zero fallback:0/1+1/7 =1/7.
10. D=2^8192+1:1/D+1/D =2/D in OPT02; old actual OPT01 refuses
    `StrictLineFailure:integer bit limit`. Do not ask old output as the sole
    truth for a deliberately improved resource case.
11. N=2^16384−1:a=b=N/2. Both actual versions refuse
    `StrictLineFailure:integer bit limit`; OPT02 must refuse its raw sum.
12. Fresh actual context, repeatedly apply actual neg to canonical zero, at
    most200001 calls, until rational work refuses; then actual add(0,0) must
    still throw rational work limit. No counter/limit mutation or reset.
13. Fresh actual context, repeat actual add(1/89,54/89), at most200001 calls,
    until integer work refuses; then actual add on those operands must still
    throw integer work limit. Sum55/89 has ten Euclidean remainder iterations
    from55,89; plus two normalization divisions and the sum, integer cap is
    reached before rational cap in OPT02. Keep actual attempted counts.
14. a=b=(2^53+1)/2^54. Exact sum(2^53+1)/2^53 is a midpoint above1;
    RNE even-lower word `3ff0000000000000`.
15. a=b=(2^53+3)/2^54. Exact sum(2^53+3)/2^53 is the next midpoint;
    RNE even-upper word `3ff0000000000002`.
16. a=b=1/2^1074. Exact sum1/2^1073;
    RNE subnormal word `0000000000000002`.

No resource test uses synthetic pre-returned errors, changed limits or counters.
Old actual OPT01 Native arithmetic is the differential baseline where both
complete. Its source/artifact pins are frozen before execution. Small literal
fraction and IEEE truth remains independent of either implementation.

Keep the existing19 boundary tests, including signed-zero, alias mutation,
malformed reused vectors and exhausted-cache checks. Root then requires the
original32 first-force keys/order/words and fresh Source/genuineNative one-step
plus16 ALIGNED/OFFSET/YAW full independent checks. All actual witness/body/point
words and physical fields must agree with executed OPT01. Honest arithmetic
counter differences are isolated only where that exact metadata is exposed.
No subtree deletion or broad numeric exception is permitted.

Only after those gates may a new immutable canonical-dist runtime diagnostic
run. It retains original dt, scenes, unchanged engine gates, first-failure
termination and170/180s limits. No old run is resumed or retimed. Original
PROVENANCE and OPTIMIZATION-01 remain unchanged; OPTIMIZATION-02 separately pins
the checkpoint source, new source, this contract and actual baseline artifacts.
Full1200 independent verification, public API/body admission and complete-path
resource qualification remain BLOCKED even if the runtime diagnostic completes.
No new offline framework, broad port, mobile or deployment.
