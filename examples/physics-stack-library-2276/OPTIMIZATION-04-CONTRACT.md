# Divisible-denominator exact division, candidate04

Status: SOURCE_AUTHORING_ONLY_NOT_EXECUTED. Root alone executes arithmetic,
compilation, physical observers and runtime diagnostics. Preserve OPT03 source
c07b409b and its returned1167/local1166 internal170s failure, all frames and all
prior failures. This targets actual package runtime, not an offline proof port
or a remeasurement of a closed microcost candidate.

Change ONLY Arithmetic.div in package stack/strict-line.ts. Retain this.op()
FIRST. Fast paths require BOTH canonical denominators positive AND b.n!=0.
Inside that guard call existing guardCached without a fabricated charge; then
equal denominators return make(a.n,b.n). Otherwise charge
one existing tick BEFORE testing a.d%b.d. When zero, charge one tick BEFORE
division k=a.d/b.d, check k, then make(a.n,multiply(k,b.n)). Otherwise test
b.d%a.d with its own tick, and when zero similarly make(multiply(k,a.n),b.n),
k=b.d/a.d. All others use the ORIGINAL two-product div fallback unchanged.
In particular zero divisors and nonpositive unsupported denominators retain
the old fallback and refusal order. No new zero/integer/GCD/multiply/cache path.

## Exact proof and guards

For a=an/da, b=bn/db with da,db>0 and bn!=0,
a/b=an*db/(da*bn). Equal denominators cancel to an/bn. If da=k*db,
the ratio is an/(k*bn); if db=k*da, it is k*an/bn. make handles a negative
bn with its original sign normalization and GCD. The resulting canonical
fraction and RNE word are therefore identical whenever both paths complete.
Existing Arithmetic.number, add/mul/neg/compare and all geometry are unchanged.

Each actual remainder and integer division has its original unit tick price.
Positive canonical input denominators are already checked; each remainder is
smaller than its divisor. The quotient is positive and no larger than its
checked numerator denominator, and is checked explicitly. The scaled numerator
or denominator uses multiply BEFORE make. An oversized raw product refuses
even if later GCD cancellation could fit. No division-by-zero shortcut, resource
raise, pre-cancellation of numerators, retry or fallback after failure.
Same16384-bit and rational200000/integer2000000 caps apply. Counters are honest
actual work; their equality to earlier algorithms is not required.

Resource-admission differences are deliberate and fixed BEFORE calls. The
suggested D0=2^8192+1, an=D0−2, bn=D0−4 is actually a BOTH-PASS boundary:
an*D0=2^16384−1 and bn*D0=2^16384−2*2^8192−3 fit16384 bits. To require an old
overflow use D=2^8192+3 instead: (D−2)*D=(2^8192+1)*(2^8192+3)>2^16384.
The new exact (D−2)/(D−4) fits and is canonical because its odd numerator and
denominator differ by2. Never label the first boundary as an old refusal.

## Fixed26 arithmetic cases, before calls

Tests invoke ACTUAL production-context m.make/div/neg/number through a test-only
structural cast. No public export, test mode, counter mutation or copied math
oracle. Root materializes literal powers only during test execution. The actual
immutable OPT03 canonical Native module is the differential baseline where both
complete. Expected fractions/IEEE words below are independent analytic truth.
Words are MSB-first IEEE64, not the F64LE physical archive format.

1. (3/7)/(2/7)=3/2.
2. (−3/7)/(2/7)=−3/2.
3. (3/7)/(−2/7)=−3/2.
4. (−3/7)/(−2/7)=3/2.
5. (1/8)/(3/4)=1/6, first divisibility branch.
6. Reverse5=6/1, converse branch.
7. (5/12)/(2/3)=5/8, composite denominator ratio4.
8. Reverse7=8/5.
9. (0/1)/(3/8)=0/1, through generic ratio formula, not a zero fast path.
10. (1/7)/(0/1) refuses StrictLineFailure/zero rational denominator.
11. (0/1)/(0/1) refuses the same old fallback error.
12. (1/6)/(1/10)=5/3, neither denominator divides.
13. (2/3)/(4/5)=5/6, coprime fallback.
14. D0=2^8192+1:((D0−2)/D0)/((D0−4)/D0)=(D0−2)/(D0−4).
    BOTH actual implementations complete; old cross products fit as proved above.
15. D=2^8192+3, same forms: NEW (D−2)/(D−4), OLD integer bit limit.
16. E=2^8192+3:a=(2E−1)/(2E), b=(E−1)/E. NEW a/b=(2E−1)/(2E−2),
    OLD integer bit limit. Consecutive result integers are coprime.
17. Reverse16:NEW (2E−2)/(2E−1), OLD integer bit limit.
18. Q=2^16383:(Q/3)/(Q/1) MUST refuse scaled denominator3Q before make,
    even though the reduced ratio1/3 fits. StrictLineFailure/integer bit limit.
19. Reverse18 MUST refuse scaled numerator3Q before make, though3/1 fits.
20. Q=2^16383:(1/Q)/(1/1)=1/Q, maximum admitted quotient. Fraction only.
21. Reverse20=Q/1. Fraction only; no finite-Float64 presentation claim.
22. Fresh context, repeat actual neg of canonical zero until rational work
    refuses, at most200001 calls. Then div(1/8,3/4) must still refuse rational
    work before entering a fast path. No counter/limit mutation or reset.
23. Fresh context, repeat actual div(55/178,1/2), at most200001 calls, until
    integer work refuses. Every completed result is55/89. The first branch has
    one remainder, one denominator division, one scaled multiply, ten Euclidean
    remainders and two normalization divisions:15 integer ticks/division.
    Integer cap is reached before rational cap. Both argument orders must
    then refuse integer work; div(0/1,1/1) must also refuse. Precreate all these
    operands BEFORE exhaustion so only div is invoked afterward. Retain actual
    attempted counts. The equal-denominator zero result calls existing
    guardCached AFTER op and inside the fast-path guard: make(0,1) has no
    integer tick, so it must not bypass an already failed arithmetic context.
24. ((2^53+1)/2^53)/(1/1)=(2^53+1)/2^53;
    RNE even-lower word3ff0000000000000.
25. ((2^53+3)/1)/((2^53)/1)=(2^53+3)/2^53;
    RNE even-upper word3ff0000000000002.
26. (1/2^1074)/(1/2)=1/2^1073; subnormal word0000000000000002.

Keep existing19 boundary cases. Require fresh Source/genuineNative first32 and
all3 one-step/16 prefixes with full independent contact/position/ledger/quality,
all actual normals, onA/onB witness/point/body words and physical reports exact
against executed OPT03. Counter changes are honestly labeled, never a broad
numeric exception or subtree omission. Root alone decides a fresh immutable
canonical runtime diagnostic afterward. All precision, tolerance and iteration
rules remain fixed; there is no speed claim before actual evidence.

Archive exact OPT03 at baseline/strict-line-opt03.ts BEFORE edit. Preserve
original PROVENANCE and OPTIMIZATION-01/02/03; OPTIMIZATION-04 separately pins
old/new source, this contract and actual baseline artifacts. Full independent
1200/API/body-cap promotion and complete-path resources remain BLOCKED. No
offline framework, new dependency, mobile or deployment.
