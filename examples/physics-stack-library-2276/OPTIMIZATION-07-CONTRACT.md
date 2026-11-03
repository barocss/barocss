# OPT07: normalized sum-square without redundant GCD

Status: SOURCE_ONLY_NOT_EXECUTED. Root alone runs imports, compiler, arithmetic,
tests, observers and the later complete-path cost campaign. OPT06 checkpoint
`cf743ae49` and every earlier failure/receipt remain unchanged. Original source
is copied to `baseline/strict-line-opt06.ts`, SHA256
`cce95ffc60613230e4ff114d4ae3f37e50924b8dfe9e428ef1e919172813f890`.

## Frozen production change

Add only `Arithmetic.sumSquare(a,b)` inside the unexported Arithmetic class.
It owns `const sum=this.add(a,b)`, then calls op and computes/checks numerator
square followed by denominator square with the original multiply primitive.
Canonical zero returns ZERO after BOTH products. A nonzero denominator1 result
calls the existing guardCached at its original point. Return the fresh pair.
Generic mul and every existing normalization/check/tick function are unchanged.

Only StrictLineContext.check uses this new method, replacing the old one add
and inner mul before the unchanged outer multiplication by normalSquared. No
other square, geometry predicate, interval, context cache, selected-face gate,
rounding or call population changes. No cache, Rational tag/provenance table,
public export, test hook, expected pose/impulse, approximate arithmetic or new
input profile. Limits remain200000 rational ops,2000000 integer ops,16384 bits,
16 rounding steps; all physical/Boolean/SAT/witness/RNE gates remain unchanged.

## Proof, failure priority and changed actual work

The unchanged add always normalizes its returned value. It therefore gives
positive denominator with coprime numerator/denominator, even for arbitrary
nonreduced/signed raw input Rational pairs. A prime dividing a square divides
its base, so the squared pair is already coprime. Old normalization would only
divide each by1. No trust in caller provenance is required.

The addition and its exact failure order happen first. The inner square keeps
the old rational op and both actual multiply/check calls in their original
order. Numerator bit/work refusal still wins before denominator computation;
denominator product still refuses before any eventual reduction. Successful
reduced values, checked peaks, subsequent outer arithmetic and RNE words agree.
No numerator/denominator bit admission is widened.

Zero comes before the integer guard, as in old normalization. Nonzero integer
results retain guardCached. Do NOT add a global guard on nonunit results: old
direct nonunit arithmetic could return after an independently caught prior bit
failure, while an integer result refused. Tests preserve these distinct OLD
routes, including zero. Production still exits on StrictLineFailure and all
existing context cache-hit guards remain unchanged. New helper frames can
change stack text; constructor/name/message and logical failure priorities are
preserved where the old work is still required.

Actual integer work intentionally decreases for nonzero nonunit sums: remove6
dyadic-normalization ticks, or g+4 nonbinary ticks (old actual Euclid loop g,
dyadic probe2 and final divisions2). Zero/integer routes have exact counter
parity. The two logical rational ops (add then square) remain. A formerly work-
exhausted call can now complete at the SAME cap; universal work-refusal/counter
parity is NOT claimed. No tick price, cap reset or raised limit is authorized.

## Fixed32 analytic/invalid/resource bank

Tests read the actual existing TS-private m on StrictLineContext. They never
mutate counters, caps, prototypes or production methods. Actual OPT06 canonical
baseline strict-line.js SHA256 is
`3b6e5397333ffa45a9120238416f482b6f39ac2d9ac55d4d9abd1e2a57e9416d`,
package metadata SHA256
`7ef765dcf000a0b45dd74495e60243e16516506e730afa024fc7f32b11222330`.
Baseline uses one actual add then actual mul(sum,sum). It is secondary evidence;
independent literal fractions, IEEE words and primitive traces are the oracle.

Cases1–12 have rational delta2, unchanged constructor peak, input retention and
the following independently traced total integer deltas, including the add:

|Case|a,b|Reduced square|OPT07 ticks|OPT06 ticks|
|---|---|---|---:|---:|
|1|1/5,2/5|9/25|11|20|
|2|-1/5,-2/5|9/25|11|20|
|3|1/-5,2/-5|9/25|13|22|
|4|6/8,-1/4|1/4|12|18|
|5|1/8,1/4|9/64|12|18|
|6|2/3,1/3|1/1|8|8|
|7|1/7,-1/7|0/1|3|3|
|8|0/-3,0/-3|0/1|3|3|
|9|3/2,-1/2|1/1|9|9|
|10|1/3,1/6|1/4|13|19|
|11|1/3,1/5|64/225|16|26|
|12|1/-3,1/5|4/225|15|22|

13. 1/0+1/0: zero rational denominator; rational1/integer1 before square.
14. 0/0+0/5: same refusal before zero; rational1/integer4.
15. 1/3+1/0: same refusal; rational1/integer4.
16. P=2^8192; P/(P+1)+(-P)/(P-1): second add cross-product bit refusal
    before cancellation/square; rational1/integer4,peak16385.
17. (P-1)/1+0/1: square=(2^16384-2^8193+1)/1; rational2/integer3,
    peak16384, identical baseline counters.
18. P/1+0/1: numerator square bit refusal; rational2/integer2,peak16385.
19. 1/(P-1)+0/(P-1): square=1/(2^16384-2^8193+1),peak16384;
    rational2, new9/old15 integer ticks.
20. 1/P+0/P: denominator square bit refusal; rational2/integer9,peak16385.
21. Q=2^4096;6Q/(8Q)+(-Q)/(4Q) normalizes before squaring to1/4;
    rational2,new12/old18 ticks,peak4100. No canonical input assumption.
22. 1/2+1/1 squares to9/4; RNE word4002000000000000.
23. 1/2^537+0/2^537 squares to minimum subnormal, word0000000000000001.
24. 1/2^538+0/2^538 squares to positive underflow, word0000000000000000.
25. -1/2^537+0/2^537 squares positive, word0000000000000001.
26. Actual neg(zero) exhaustion (<=200001 calls) then sumSquare rational refusal
    in add. Exact attempts/counters to baseline; no counter mutation.
27. Actual make(55,89) exhaustion (<=200001 calls) then sumSquare integer
    refusal in add. Exact attempts/counters; no modified cap.
28. Actual oversized make causes prior bit failure;2/3+1/3 then square still
    refuses the retained nonzero integer guard. Exact old counters/peak.
29. Same prior bit failure;1/7-1/7 then square still returns canonical0/1,
    matching OLD direct internal behavior. Exact old counters/peak.
30. Same prior bit failure;1/8+1/4 then square returns9/64 as OLD nonunit
    composition did; new12/old18 delta,peak16385 remains. No new global guard.
31. Prefill with actual make(55,89), exactly14 ticks per successful call, then
    at most13 actual neg(zero) calls to integer cap minus12. No counter write.
    1/8+1/4 square: new exact9/64 completes at2000000; baseline refuses in
    its redundant dyadic probe at2000002. Rational delta2; equal checked peak.
32. Same real prefill to cap minus11: both paths refuse second square-product
    tick at2000001; rational delta2, exact final counters/peak. No normalization
    is reached, so resource refusal stays identical.

The prefill's target and14/12/11 prices are frozen before execution; at most
200001 make calls and13 padding calls. Literal fractions/counters are asserted.
No case retries or tunes an input after an unexpected failure.

Retain OPT06 fixed32 and earlier32/26/25/16 arithmetic plus19 boundaries;
require full Source/genuine Native original prefix record/numeric-word/raw/RPC
parity and current canonical build. Root selects one original complete1200 cost
campaign only after qualified storage and these gates; no mandatory additional
runtime-only3×1200 is implied. No old benchmark retime, API/World admission,
body-cap, recorder, desktop, deployment, strict64 or HOLD promotion follows.
