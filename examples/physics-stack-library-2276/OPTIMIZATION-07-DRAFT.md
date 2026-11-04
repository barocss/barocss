# OPT07 draft: square a sum normalized by the same Arithmetic

Status: DRAFT_SOURCE_PROOF_ONLY. Production remains qualified OPT06, source
SHA256 `cce95ffc60613230e4ff114d4ae3f37e50924b8dfe9e428ef1e919172813f890`,
canonical strict-line.js SHA256
`3b6e5397333ffa45a9120238416f482b6f39ac2d9ac55d4d9abd1e2a57e9416d`.
Its immutable runtime06 diagnostic is separate and may be running. This draft
edits no production, pin, old test or receipt. No import, helper, compiler, test,
arithmetic, new profile, instrumentation or cost run was executed by the author.
Root must finish its OPT06 checkpoint and authorize implementation separately.

## One encapsulated candidate

Add `Arithmetic.sumSquare(a,b)` to the existing unexported Arithmetic class.
It FIRST obtains `const sum=this.add(a,b)`. The existing add, including its
normalization, operand checks, integer operations and failures, is unchanged.
Only then perform the old inner-mul rational op and the same checked numerator
square followed by checked denominator square. This candidate does not introduce
a general square helper which trusts an arbitrary Rational argument.

Proposed algorithm, not applied source:

    const sum = this.add(a,b);
    this.op();
    const n = this.multiply(sum.n,sum.n);
    const d = this.multiply(sum.d,sum.d);
    if (n === 0n) return ZERO;
    if (d === 1n) this.guardCached();
    return {n,d};

Replace ONLY the existing `check()` inner sum-square expression:

    twiceOffset = m.add(a.high,b.low)
    fourDistanceSquared = m.mul(m.mul(twiceOffset,twiceOffset),normalSquared)

with `m.mul(m.sumSquare(a.high,b.low),normalSquared)`. Keep the surrounding
interval construction, direction, midpoint cache, selected-face gates,
tolerance, normalSquared, comparison and RNE unchanged. Generic mul, make,
normalizeChecked, add/div/neg/from/number and all other squares remain unchanged.
There is no new runtime public export, production hook, Rational tag, provenance
table, GCD memo, persistent/context cache, precision rule or fixture condition.

## Self-contained coprime proof

Every successful return of the unchanged add passes the unchanged normalizer,
including equal/divisible-denominator branches. It therefore gives denominator
positive and gcd(abs(sum.n),sum.d)=1; zero is the existing canonical0/1. This is
true even when input a and b are forged raw nonreduced or signed Rational pairs:
the new helper owns the normalizing addition itself. Invalid inputs keep the
same addition/error path. No claim that caller operands were already reduced
is needed, and generic mul's treatment of arbitrary Rational pairs is retained.

For coprime integers x,y, no prime divides both x² and y²: a prime dividing a
square divides its base. Thus gcd(x²,y²)=1. Once the SAME raw products pass their
original checked calls, their pair is already the exact positive reduced square.
The old make/normalizeChecked could only divide each by1. Its sign branch is
unreachable because squared denominator is positive. Returning a fresh pair
therefore gives the same numerator/denominator and alias ownership as the old
composition; zero still returns the shared ZERO object.

No arithmetic redistribution occurs. The addition finishes once, then the old
inner multiplication op is charged, then numerator product is computed/checked,
then denominator product is computed/checked. An oversized numerator still wins
over denominator processing. An oversized denominator still refuses before any
normalization; even a hypothetical later reduction cannot rescue it. The outer
multiply receives identical reduced operands, and existing number conversion
receives identical rationals, so finite binary64 and signed-zero/RNE decisions
must stay unchanged. The old nonbinary square GCD, not a physical phase, is the
work proposed for removal.

## Exact zero and failed-context behavior

The ordering in the proposed algorithm is intentional:

- Always call unchanged add first, even if raw numerators appear to cancel.
  Do not shortcut malformed/zero denominators, oversized cross-products,
  work checks or sign normalization from the input values.
- Always charge the inner rational op and BOTH checked products before returning
  zero. Canonical sum0/1 gives squared0/1; old normalizeChecked returned ZERO
  before its denominator1 failed-context guard, so the new helper must too.
- A nonzero squared integer calls guardCached after the two products, matching
  old normalizeChecked's denominator1 branch. Do not bypass the already-failed
  rational/integer/bit guard on that branch.
- A nonzero nonunit square must not add a new global guardCached call. The old
  nonunit normalizer did not check a stale global bit peak through that method.
  Preserve that existing test-only post-failure behavior rather than silently
  repairing it in this optimization. Normal production exits on StrictLineFailure;
  existing StrictLineContext cache-hit guards remain untouched.
- Actual rational exhaustion still refuses in add's op before square work.
  Actual integer exhaustion still refuses at add's first relevant tick. A cap
  reached inside the two square products still throws at its original tick or
  checked point. No counter reset, cap mutation, swallowed refusal or fallback.

Required post-bit-failure controls include integer-result refusal, zero-result
behavior and nonunit-result behavior against actual OPT06. These are not all
claimed to refuse: the goal is exact OLD route behavior, including where the
old direct internal composition could return after a separately caught bit error.
Do not confuse this with a public failed World being allowed to continue.

## Actual work and admission change

The two logical rational operations (add then inner mul) remain. Peak checked
bits and the raw product bit-failure boundary remain identical. All shared
prices/caps stay fixed: rational200000, integer2000000, integerBits16384,
roundingSteps16. No tolerance, point, axis, contact, QP or scene bound changes.

Integer counters intentionally differ for nonzero nonunit sums:

| Sum class | Removed old normalization work |
|---|---|
| zero or denominator1 | None; exact old op/tick/guard route retained. |
| denominator is power of two>1 | Six ticks: dyadic probe2, low-factor2, final two divisions2. The sum numerator is odd, so squared pair already coprime. |
| other denominator>1 | Dyadic probe2 + g Euclidean remainder ticks + final two division ticks; g is the actual old square-GCD loop count. |

Consequently an unchanged integer cap can admit a sum-square for which OPT06
exhausted work in redundant normalization. This is a deliberate actual-work
admission difference, not increased limits or universal old resource-refusal
parity. If both finish, reduced value and peak must match; integer counts must
follow the frozen trace. No cost claim follows from fewer nominal ticks.

Independent small analytic examples for a future fixed bank:

| a,b | sumSquare result | Candidate total integer ticks | OPT06 total ticks |
|---|---|---:|---:|
|1/5,2/5|9/25|11|20|
|1/8,1/4|9/64|12|18|
|2/3,1/3|1/1|8|8|
|1/7,-1/7|0/1|3|3|
|6/8,-1/4 (raw nonreduced)|1/4|12|18|

These include addition's original normalization costs; they are not square-only
prices. Future tests must assert independent literal results and traced tick
counts, not use old `mul(add(...),...)` as the sole mathematical oracle.

## Before any implementation/cost qualification

Root must freeze a fixed independent analytic/invalid/boundary/exhaustion bank
and exact candidate source before its first import. Probe the real existing
TS-private Arithmetic through StrictLineContext only; no shipping hook. Actual
OPT06 baseline composition is `const s=m.add(a,b); m.mul(s,s)`, using the paid
canonical module; it is a secondary parity/resource comparator.

The bank must cover signed/nonreduced/negative-denominator inputs, cancellation,
zero-divisor priority, zero/integer/dyadic/nonbinary sums, invalid addition before
square, maximum admitted numerator and denominator squares, numerator/denominator
product bit refusal, oversized addition intermediates before cancellation,
finite/RNE words and positive underflow, real rational/integer exhaustion,
nonunit work-admission differences and the three stale-bit routes above. Large
expected squares should use independent polynomial identities, not the candidate
helper copied into an oracle. No caller may pass a raw square directly into the
new helper and skip its owned add.

Retain all OPT06 fixed32, earlier32/26/25/16 arithmetic and19 boundary tests,
Source/genuine Native exact original prefix records/words/RPCs and canonical
build provenance. Then one new immutable cost campaign only if those gates
pass and Root authorizes it. Old benchmarks/candidates are not retimed. The
make census did not measure square frequency or time, so it cannot predict a
speedup or full1200 fit. Preserve full01's1114 accepted timeout and OPT06's
separate runtime result; no physics/API/strict64/HOLD promotion follows.
