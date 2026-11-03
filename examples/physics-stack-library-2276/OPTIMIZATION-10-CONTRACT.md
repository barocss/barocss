# OPT10: one common-denominator integer projection per local vector

Status: ISOLATED_SOURCE_READY_AUTHOR_NOT_RUN. No author import, compiler, test,
helper, codec, profiler, arithmetic or physics execution. Only new OPT10 example
candidate/test/runner/contract/manifest and preserved OPT09 source are owned.
Production remains61baf61303c5450b69329f2006883b712eee75635d7ca0d53a2100ceab1c06ed.
The existing canonical09 provider, complete campaign and receipts stay immutable.

## Frozen source boundary

candidate-strict-line-opt10.ts preserves all OPT09 bytes except SIX explicit
edits authenticated by whole-file reconstruction in the runner:

1. Relocate the existing type-only Body/Vec3 import for this example's path.
2. Add private IntegerRotation {denominator,columns} representation.
3. Add Arithmetic.quotient, prepareRotation and localProjection exactly as frozen.
4. Add a context-owned integerRotations tuple.
5. Prepare that tuple AFTER BOTH original box(a),box(b) calls finish.
6. Replace ONLY local's final3 rational-dot calls with localProjection, selecting
   the corresponding owned box by its existing object identity. Original relative
   assembly stays byte-identical, including all from/sub calls and their order.

No existing op/tick/checked/normalization/GCD/from/add/mul/div/dot/number method,
limits, phase/point/row population, geometry selection, cache policy, tolerance,
rounding, witness or public admission changes. No alternative quaternion basis
is computed. Actual original rotation Rational values remain the authority.
No global/persistent/warm solver cache, fixture pose/ID, expected output or
oracle reuse exists. Integer rotations are immutable-by-use derived state owned
by this one StrictLineContext; no candidate/result reuse crosses contexts.

## Exact denominator strategy and owned-input scope

Read the9 actual positive canonical rotation denominators in row-major order.
Start C=1. Skip a denominator1 with no arithmetic. Otherwise compute g=gcd(C,d)
by ticked Euclidean remainders, then checked/ticked quotient C/g and product
(C/g)*d. Division precedes multiplication. Every partial C is the exact LCM.
If final C=1, reuse the already checked actual numerator BigInts as transposed
integer columns. This path performs ZERO new rational/integer arithmetic.
Otherwise each of9 entries uses a ticked/checked ratio C/d followed by a
ticked/checked product A_ij=n_ij*(C/d_ij). Zero entries are not omitted.

local receives owned coordinates: world/direction entries come only from
unchanged binary64 from; non-direction relative entries are unchanged exact
sub(world,centre). Their canonical positive denominators are powers of2.
After that assembly, localProjection first calls guardCached. Let D=max(d_i).
Each of3 U_i=n_i*(D/d_i) uses a ticked/checked quotient and product. Compute the
single shared ticked/checked divisor C*D. For axis j in original0,1,2 order,
call op once, multiply A_0j*U_0, then left-to-right add the next2 checked/ticked
products with checked/ticked sums. Both numerator and divisor have passed
checked, so unchanged normalizeChecked returns one reduced axis Rational.

This private kernel is not a new arbitrary Rational-vector API. The max-D
strategy requires the proved owned DYADIC relative inputs; do not claim it
works for forged non-dyadic private calls. Synthetic unit matrices in this bank
test the exact integer kernel/LCM mechanics and do not expand physical admission.

## Why the actual LCM remains bounded

Let Q be a conceptual common dyadic denominator of the4 ACTUAL finite binary64
quaternion components, q_i=u_i/Q. Do not compute a replacement basis from it.
The unchanged original rotation is algebraically H_ij/N, where
N=sum(u_i^2)>0. Diagonal H=N-2(u_k^2+u_l^2); off-diagonal
H=2(u_k*u_l ± u_m*u_n). Every actual reduced denominator therefore divides N,
and every partial/final LCM C divides N. This proves the LCM without assuming
that denominators divide norm2.n. No norm2.n shortcut is used.

Every finite binary64 magnitude is below2^1024; Q<=2^1074. Hence |u_i|<2^2098
and N<2^4198, conservatively C<2^4200. Diagonal rotation magnitudes are<=1;
off-diagonal magnitudes are<=1 by2|ab|<=a^2+b^2. Thus |A_ij|<=C.
Unchanged relative subtraction has magnitude<2^1025 and D<=2^1074, so
|U_i|<2^2100. Each new numerator product is below2^6300; three-term numerator
and each partial sum are below2^6302; divisor C*D is below2^5274. All are below
the ORIGINAL16384-bit ceiling. Quotients are no larger than their checked
positive numerators; each partial LCM product<=N. Euclidean remainders are
smaller than their positive already bounded divisors, ticked exactly once each.
Every new product/sum/ratio is still checked; this proof does not replace checks.

This covers general finite owned inputs after the unchanged original box
construction succeeds, including subnormals and quaternion components outside
the ordinary parser's unit-norm input shape. A zero quaternion still refuses in
the unchanged box code. Preparation is after BOTH boxes, preserving ordinary
invalid constructor-input priority before any new LCM work. Positive extents,
finite decoding, complete original rotation and body-copy behavior stay intact.

The exact identity is R^T*v=(A^T*U)/(C*D). Integer evaluation followed by one
normalization gives the same canonical reduced axes whenever both paths finish.
There is no finite precision approximation or changed number/RNE conversion.
New intermediate peaks MAY exceed old peaks; old raw intermediates disappear
and new ones are checked. Universal old bit/work/refusal/counter parity is NOT
claimed. The old bit cap is neither raised nor bypassed.

## Work and stronger failed-context refusal

Preparation creates integer data, so rational op count0. For every d>1 its LCM
stage spends g_i+2 integer ticks (g_i remainders, quotient, product). If C>1,
scaling spends18 more ticks. C==1 spends0. These are actual operations using
existing tick, not free precomputation or a repriced existing primitive.

A complete localProjection produces exactly3 rational results/op calls. Shared
scaling/divisor costs7 integer ticks. Axis products/sums cost15 total ticks,
plus the actual unchanged normalizeChecked work for each axis:0 for zero or
raw divisor1,6 for nonzero dyadic divisor>1, or g+4 for nonbinary divisor.
Identity/integer nonzero vectors thus cost exactly22 integer ticks/3 rational
ops. Original relative assembly adds its unchanged work before this kernel.
Compared with old09's15–18 local-dot rational ops, the new kernel has3, but
new preparation/ratios/bit inspections also cost time. NO speed/fit is inferred.

guardCached is deliberately stronger than old private stale-resume quirks.
It executes AFTER unchanged relative assembly and BEFORE ANY new local work.
Example: after actual checked(2^16384) fails, old identity dot with direction
[1,1/2,0] refuses at its unit product; simply normalizing final2/2 could bypass
that guard. New entry refusal prevents this. Old all-zero/nonunit local calls
could still resume after a prior bit failure; they NOW refuse too. Old prior
integer/rational exhaustion also refuses at entry without the old extra op/tick.
No old private-resume, post-failure counter or universal error-priority parity
is claimed. This stronger refusal is explicit and authorized for OPT10.

Actual work admission changes in BOTH directions: new nonunit preparation can
exhaust a context where old constructor returned; fewer local ops/ticks can
finish a vector where old dots exhausted. Shared setup runs before the first
axis op. Near caps, failure order/counters and later reached invalid/oversized
operands can differ. No cap mutation, counter reset, retry, fallback or partial
physical commit follows. Existing StrictLineFailure class/messages are reused.

## Independent fixed32 bank, frozen before Root execution

Actual private m is read through one throwaway context, then its ACTUAL same
constructor supplies fresh counters without writes/mocks/prototype mutations.
Actual immutable canonical09 is the secondary baseline, not a copied algorithm.
Literal fractions, columns, vector sums and IEEE words are independent oracles.
Fresh successful outputs and input retention must match. No stats equality is
asserted except specific independently proved identity/entry cases.

1. Identity C1/columns, no arithmetic in representation preparation.
2. Synthetic dyadic diagonal C8, literal1/4,-1/16,3/64 projection.
3. Synthetic denominators6,10,15 give C30 and integer columns5,3,2.
4. Repeated thirds give C3, all integer columns[1,1,1], and1/3 axes.
5–6. Quaternion proportional to(1,2,3,4) gives literal rows
[[2,-10,11],[14,5,2],[-5,10,10]]/15. For vector[1/2,-1/4,3/8],
U=[4,-2,3], raw numerators[-35,-20,70]/120 reduce to
[-7/24,-1/6,7/12]. These are fixed expected data, not helper-derived.
7–10. Exact cancellation, quarter-turn transpose/order, nonbinary zero vector,
and signed float-zero canonical words; no input mutation.
11–13. ACTUAL original quaternion construction, negated and dyadic-scaled
quaternions retain the literal anchor matrix and projection.
14. Actual centre[1,2,3]/world[1.5,1.75,3.375] exercises unchanged subtraction.
15–18. First/second zero quaternion, nonfinite quaternion, invalid extent keep
original constructor refusal priority before new preparation.
19. Nonfinite world decoding precedes the new stale-bit guard, as before.
20–22. Independent synthetic half-scale subnormal/signed underflow, dyadic
nearest-even ties, maximum finite and exact overflowing relative value.
23. ACTUAL q=[2^-1074,0,0,1], D=2^1074,N=D^2+1,K=maximum finite integer.
For v=[0,K,1/D], y=[K(D^2-1)+2]/N,
z=[D^2-1-2D^2K]/(D*N). Independent polynomial cross-identities and old
canonical axes must match within the original bit cap; no copied GCD oracle.
24. Actual oversized failure then identity[1,1/2,0] refuses at new entry,
preventing the named final2/2 guard bypass.
25–26. Old zero/nonunit stale resume is explicitly rejected by the new policy.
27–28. Actual neg/make exhaustion stops at entry without any new counter change.
29. Exact2M actual integer ticks: C1 preparation remains free; new nonunit LCM
refuses at the first additional tick. This extra phase is not hidden/free work.
30. Actual199997 neg calls leave3 rational ops; new complete vector fits at
200000, old dots refuse at200001. Actual new results are exactly3.
31. Actual142855 make(55,89) calls plus8 neg calls leave22 integer ticks.
New identity vector completes at2M; old dots refuse at2M+1. New rational11,
old23 includes the actual8-op prefill. No counter writes or cap changes.
32. SYNTHETIC private arithmetic guard probes beyond the physical quaternion
population: C=2^16383 is legal and yields1/C; new raw C*2 divisor refuses at
16385 BEFORE cancellation. Coprime2^8192 and2^8192+1 LCM product likewise
refuses at16385. Do not label these raw-matrix probes admitted physical inputs.

## Retained/source/native/adoption boundary

C1 identity rotations reuse owned numerators with no arithmetic; old06/07 fixed
identity-box/normal[0,1,0] constructor counters remain exact. This does NOT imply
unchanged general quaternion constructor cost. Old banks/files stay immutable;
direct primitive definitions are unchanged. New local guards/counters have
their OWN contract and bank rather than rewritten old expected results.

Root runs pinned Node22 arithmetic-opt10-run.mjs with a fresh arithmetic-opt10-*
receipt ID under the existing owned180s outer/170s inner guard. It requires full
source equality to the literal frozen edits, authenticates tools/baselines/
candidate/contract files, compiles genuine isolated Native and bundles Source,
runs exactly32 tests each against actual canonical09 fded427d84c9e2df34a5de8aa422eee3032a1146e6d8490c36a6eb885500451b,
then verifies before/after inputs. Package metadata remains7ef765dcf000a0b45dd74495e60243e16516506e730afa024fc7f32b11222330.
No author execution or production adoption is implied by this source freeze.

After isolated PASS only Root may adopt the explicitly frozen patch. Actual
production fixed32, retained arithmetic/boundary19, fresh complete Source/Native
physical prefix exact words/payloads, canonical build/closure authentication
must precede a new complete original1200 cost campaign. General stats and
work/failure metadata are declared changed, never silently normalized away.
FullP4, public World/API, recorder, optional strict64/RSS, desktop, deployment,
release and all HOLDs stay separate and unqualified by this arithmetic slice.
