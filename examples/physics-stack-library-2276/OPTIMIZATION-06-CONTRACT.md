# OPT06: omit repeated checks of already checked results

Status: SOURCE_ONLY_NOT_EXECUTED. Root alone executes imports, arithmetic,
compilation, tests, independent observers and cost campaigns. Preserve original
OPT05 source at `baseline/strict-line-opt05.ts`, SHA256
`1ce1c28ee3eec55ae132b902791e814c58b3cda0ee1d7ec5714d8e25ef49796f`.
The source author performs no helper/test/compiler/numerical execution.

## Exact change and invariant

Split `make` after its existing `checked(n); checked(d)` calls. Those calls stay
at that entry in their original order, followed by private `normalizeChecked`.
The helper contains the original remainder of make verbatim: zero divisor,
canonical zero, denominator sign, integer failed-context guard, dyadic path,
Euclid, final divisions and every tick remain in the same order.

Only three existing call sites bypass repeated make checks:

1. `mul`: numerator multiply and denominator multiply BOTH call checked.
2. General add fallback: each cross-product is checked; the summed numerator is
   checked by sum; denominator multiply is checked. JavaScript argument
   evaluation remains numerator expression first, denominator expression next.
3. General div fallback: numerator multiply and denominator multiply BOTH call
   checked, in that order. Earlier equal/divisible-denominator paths keep make.

No input is assumed canonical, positive or produced in the same Arithmetic.
The helper receives already checked **result BigInts**, not trusted input
Rationals. No cache, tag, WeakSet, new export, counter/limit mutation, square
specialization, bit-format change, GCD replacement or new failure recovery.

Proof: each omitted call examines the identical immutable BigInt just checked
by the preceding primitive. checked computes its bit length, records max peak
and compares the fixed16384-bit cap; it consumes no tick or rational operation.
Repeating the same max assignment is idempotent and repeating the same fixed
bit comparison cannot newly fail. All intervening code is evaluation of other
checked primitive results, so neither operand changes. If either primitive
exceeds the cap it throws at its original earlier point, including before any
eventual reduction/cancellation. Every BigInt multiply/add/remainder/divide/
shift/sign operation, tick/op charge, resource-failure priority, final counter
and peak value is therefore unchanged. Unlike OPT02–05, OPT06 requires exact
counter and refusal parity to OPT05, not merely successful numeric parity.
The private helper can add a stack frame. Error constructor/name/message,
priority and counters are preserved; byte-identical stack text is not claimed.

Direct make still checks raw inputs before zero/sign shortcuts. Equal/divisible
add/div, from, neg, number/RNE, geometry, tolerance, point ordering,16 rounding
steps,200000 rational operations and2000000 integer operations are unchanged.
Existing failed-context guards stay in the helper verbatim. No numerical
admission is widened; already exhausted contexts must behave exactly as OPT05.

## Frozen independent fixed32 bank

Actual private Arithmetic is obtained from one real StrictLineContext through
the existing test-only structural m access. No shipping hook. The reference is
the immutable actual OPT05 canonical `strict-line.js`, SHA256
`23b3b36e269a6dd7ad15d5a1d41d2b0f81b67298d2fe47c51442dd913d21167a`,
package metadata SHA256
`7ef765dcf000a0b45dd74495e60243e16516506e730afa024fc7f32b11222330`.
Literal reduced results/error messages and primitive charge totals below are
independent analytic expectations. Baseline equality is an additional check,
not the only oracle. Compare before/after full counters and input retention.
No copied normalizer, GCD oracle, production override or counter reset.

Cases1–24 each use one actual operation on the following raw Rational operands.
Each increments rationalOperations by1. Integer deltas are fixed from explicit
primitive counts; small operands leave the constructor's larger peak unchanged.

| Case | Operation | Analytic result or refusal | Integer delta |
|---|---|---|---:|
|1|2/3 ×3/5|2/5|9|
|2|-2/3 ×3/5|-2/5|9|
|3|2/3 ×3/-5|-2/5|11|
|4|-2/-3 ×3/-5|-2/5|9|
|5|6/8 ×10/15|1/2|8|
|6|0/1 ×5/7|0/1|2|
|7|0/-2 ×3/5|0/1; zero precedes sign|2|
|8|0/1 ×3/0|zero rational denominator|2|
|9|3/0 ×5/7|zero rational denominator|2|
|10|1/2 ×1/2|1/4|8|
|11|2/1 ×3/1|6/1|2|
|12|-2/1 ×3/-1|6/1|4|
|13|1/3 +1/5|8/15|14|
|14|-1/3 +1/5|-2/15|13|
|15|1/3 +2/5|11/15|15|
|16|1/-3 +1/5|-2/15|13|
|17|1/6 +1/10|4/15|14|
|18|0/3 +0/5|0/1|6|
|19|0/0 +0/5|zero rational denominator|4|
|20|2/3 ÷4/5|5/6|11|
|21|-2/3 ÷4/5|-5/6|11|
|22|2/3 ÷-4/5|-5/6|13|
|23|0/1 ÷0/1|zero rational denominator|2|
|24|0/1 ÷3/8|0/1; retained divisible path|4|

25. P=2^8192. mul(P/1,(P-1)/1)=(2^16384-2^8192)/1, exact maximum
    admitted16384-bit result; delta rational1/integer2; peak16384.
26. mul(P/0,P/1) first refuses integer bit limit at numerator product before
    denominator zero is evaluated; delta rational1/integer1; peak16385.
27. add(P/(P+1),-P/(P-1)) refuses integer bit limit at second cross-product
    before cancellation; delta rational1/integer4; peak16385.
28. div(P/(P+1),P/(P-1)) refuses integer bit limit at denominator product
    before a reduced ratio could fit; delta rational1/integer4; peak16385.
29. Actual mul by1 followed by unchanged number: analytic midpoint words
    (2^53+1)/2^53→3ff0000000000000,
    (2^53+3)/2^53→3ff0000000000002,
    -1/2^1075→8000000000000000 and1/2^1075→0000000000000000.
    Require full baseline counter equality, including subsequent RNE work.
30. Actual repeated neg(zero),<=200001 attempts, reaches rational work refusal.
    Followup mul/add/div all refuse rational work. Exact attempt/counter parity.
31. Actual repeated mul(55/89,1/1),<=200001 attempts, reaches integer work
    refusal before rational exhaustion. Followup mul/add/div/direct integer
    make retain integer refusal. Exact attempt/counter parity; no cap mutation.
32. Actual oversized make first fails bit limit; subsequent mul(1/1,1/1)
    still fails through the retained integer failed-context guard. Exact final
    counters and peak to OPT05. No normalized helper is called by tests.

Root retains the previous32/26/25/16 arithmetic and19 boundary banks, full fresh
Source/genuine Native prefix word/record/RPC parity, then canonical build and
one new immutable cost campaign after those gates. Old profile/census timings
are not retimed. No speed ratio or1200 fit follows from source or arithmetic
tests. Preserve full01 timeout1114 acceptance and all earlier failures. No API,
World/body-cap, recorder, desktop, deployment, strict64 or HOLD promotion.
