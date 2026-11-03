# OPT09: omit only a first nonzero nonunit product's zero-add

Status: ISOLATED_SOURCE_READY_NOT_EXECUTED. Author runs no import, compiler,
test, profiler, arithmetic, helper, codec or physics. Own only this example's
new candidate/test/runner/contract/manifest and preserved baseline OPT08 source.
Current production and running canonical OPT08 campaign remain immutable:
abb2036ddd46c146a42299173d471a360afc7c30226f694f58c1515fab10f2af.

## Sole numerical-source delta

The candidate is current OPT08 byte-for-byte except its type-only Body/Vec3
import relocation and ONLY Arithmetic.dot:

```ts
dot(a: Rational[], b: Rational[]): Rational {
  return a.reduce<Rational|null>((value,x,i)=>{
    const product = this.mul(x,b[i]);
    return value === null && product.n !== 0n && product.d !== 1n
      ? product : this.add(value ?? ZERO,product);
  },null) ?? ZERO;
}
```

The frozen candidate has that conditional on one line; runner checks exact
whole-file equality after the two literal replacements. No production edit or
automatic adoption occurs. No other arithmetic/check/normalization/cache/
context/row/point/tolerance/solver/rounding/cap/public API change is allowed.
This general algebraic branch does not inspect scene, pose, ID or fixture.

Native reduce remains the traversal. It captures length and visits present
indices in the old order, including leading/interior/trailing holes. Null is
the first-present marker, not i===0. Empty/all-hole arrays return canonical ZERO
without numerical work or a new failed-context guard, exactly as before.
All first zero/integer products retain the OLD zero-add, including its op/tick
and guard priority. Later additions and EVERY actual product remain ordered.
No first-product value is taken from the caller as a trusted reduced Rational:
actual unchanged mul normalizes it before this branch can inspect it.

## Reduction, bit and alias proof

A successful mul returns canonical ZERO or N/D with D>0 and gcd(abs(N),D)=1.
Only N!=0,D>1 skips this first add. ZERO has denominator1. Old add(ZERO,N/D)
takes the positive divisible-denominator branch:1%D is nonzero, D%1 is0,
ratio=D/1=D, then0*D and0+N, then unchanged make(N,D). Normalization divides
only by1. Its result's numerator/denominator therefore equal the owned product.

All removed checked operands are D,0,N,D. Reduced abs(N) and D are no greater
than mul's already checked raw numerator/denominator magnitudes. Zero's width1
is no greater than the raw denominator's width. Thus the removed add cannot
increase peakIntegerBits beyond the product's reached peak, even when raw
inputs were nonreduced or negative. No unexamined oversized raw product gains
admission: numerator then denominator multiplies/checks remain unchanged.
Subsequent unchanged arithmetic receives the same exact reduced pair; successful
number/RNE/witness/Boolean outputs and physical inputs must retain exact words.

For this branch dot returns its internally allocated product object instead of
allocating an equal normalized pair. No caller Rational becomes an alias:
mul creates the nonzero pair. Production code does not mutate Rational fields.
No public object-identity contract or new public return type is introduced.

## Work, stale failures and exact scope of parity

For an eligible first product, exactly1 rational op is removed. The old add
spends5 integer ticks on two denominator probes, ratio, zero multiply and sum.
Its redundant normalization spends6 ticks if D is a power of2, otherwise g+4,
where g is the old Euclidean loop count for abs(N),D. Total integer savings:
11 for nonzero dyadic D>1, or g+9 for other nonunit D. Zero/integer first terms,
empty/all-hole dots and first-product failures have exactly old work behavior.

The200000/2000000 work caps,16384-bit cap and16 rounding steps do not change.
Actual consumed work decreases, so old work-refusal parity is NOT universal.
Cases30/31 explicitly admit an exact1/3 at the same cap where the redundant old
add refuses. Case32 still refuses inside the unchanged first product when one
fewer tick remains, and zero/integer terms still refuse at their retained add.
If saved work lets execution reach a later invalid/oversized term which old code
never reached, that later error/peak can replace old work exhaustion. Do not
claim global first-error/counter/peak parity across this changed work admission.
With adequate shared work, products and remaining additions occur in the same
order and deterministic numerical errors retain their original priority.

Existing stale-bit quirks are preserved, not silently strengthened. A nonzero
unit product already invokes guardCached inside mul and refuses there. A zero
product returns ZERO, then follows its retained old zero-add. A nonunit product
can follow the OLD no-global-peak-guard route; old zero-add likewise had no
global-peak guard for it, so skipping it adds no stale-bit bypass. Actual prior
integer/rational exhaustion still fails at the first op/tick of mul. An empty
dot remains unticked even in such a context. Unexpected non-Physics type errors
are not remapped; exception stack text is not an equality claim.

## Fixed32 independent bank

Root obtains actual Arithmetic via the existing TS-private m access and creates
a fresh actual same constructor for zero-based counters. No mock class, counter
write/reset, cap/prototype mutation, production hook or copied arithmetic oracle.
Actual immutable canonical08 JS is the secondary parity baseline; literal
fractions/words/tick derivations are the independent oracle.

1–2. Empty/all-hole left arrays do not access a null right input; exact ZERO and
zero work/peak. 3. First present index2, raw2/3*3/5=2/5: new1R/9I/peak4,
old2R/21I. No i===0 assumption.
4–6. Zero, positive integer6 and negative integer-6 retain old2R/3I exactly.
7–8. ±1/2*1/2=±1/4: new1R/8I versus old2R/19I, peak3.
9. 2/3*3/5=2/5:9 versus21 ticks, peak4.
10. Raw6/8*10/15=1/2:8 versus19 ticks, raw peak7 retained.
11–12. Double-negative denominators and one-negative denominator:2/5 or-2/5,
9/21 or11/23 ticks, peak4. Raw normalization is owned by actual mul.
13. Independent3D cancellation1/2+1/3-5/6=0;11 ticks/1R saved.
14. Independent4D sum1/2+2/3+3/4+4/5=163/60;11 ticks/1R saved.
15–16. First zero/integer followed by nonunit product does not enable a later
skip: exact1/3 or19/3, complete old counters remain equal.
17. Leading/interior/trailing holes preserve actual index pairing;2/5+1/2=9/10.
18. Actual old06/07 identity-box/normal[0,1,0] constructor fixture has EXACT old
stats, plus an equal actual context check result. Each of its three constructor
dots starts with a zero product, so all cheap initial adds remain.
19–21. Null left input, null first term and missing right operand: original
TypeError name/message and pre-error work. No eager validation changes precedence.
22. First zero denominator refuses inside mul at1R/2I/peak1 before any add.
23–24. Raw first numerator/denominator bit overflow retains16385 peak and
original priority, including oversized denominator before a zero shortcut.
25. Later missing operand follows actual first product; same TypeError with
1R/12I saved, no reordering of the bad term.
26. Independent literal nearest-even words near1, minimum subnormal and signed
underflow; exact shared peaks and eligible11I/1R savings.
27. Actual prior16385-bit failure: empty, zero, unit-guard and nonunit behavior
remain old, with only declared nonunit savings.
28–29. Actual neg/make loops exhaust rational/integer work. Empty/all-hole dots
remain unticked; first nonunit mul refuses at the original op/tick, no recovery.
30. Actual199999 neg calls leave1 rational op. New first1/3 product completes
at200000; old zero-add refuses at200001. Both integer200007.
31. Actual142856 make(55,89) calls at14 ticks each plus8 actual neg calls
leave8 ticks. New1/3 completes at2M; old add refuses at2M+1.
32. Same calls plus9 neg calls leave7 ticks; both first products refuse at2M+1.
Additional zero/integer controls prefill to2M-2 using142857 actual make calls;
their retained old initial adds both refuse at2M+1. No counter/cap mutation.

## Retained tests and later production qualification

Keep all old tests/contracts/results immutable. Unlike the rejected broad
all-first-add skip, this narrow branch leaves the fixed old06/07 constructor
counters unchanged: their first products are zero. No special retained-harness
counter offset, reset, normalization or rewritten expected bank is needed.
Their direct primitive arithmetic is unchanged. General nonzero quaternion/
normal constructor work may decrease by the same declared rule; do not extend
the fixed-fixture counter equality into a universal constructor claim.

Root executes arithmetic-opt09-run.mjs with a new arithmetic-opt09-* receipt ID
under the existing owned180s outer/170s inner guard after the running campaign,
not concurrently with its cost clock. Source bundle and genuine isolated Native
must each run all32 cases against actual canonical-opt08-01 strict-line.js
cc68eb9c7f8177dd78d5c74eb414362fd04766bc8cda7e1e75b1185e731564c3.
Runner authenticates whole-file sole-dot/type-import delta and all pins before
execution, then complete before/after source/tool/baseline bytes. It introduces
no runtime dependency or production import of an example.

Root alone may later adopt only the dot function, after preserving the current
campaign/source. Then actual production fixed32, unchanged retained08/07/06/
05/26/25/16 arithmetic, boundary19, full Source/Native physical prefix word/
payload identity, canonical build and source/provider authentication precede
any new original1200 cost campaign. No measured speed or current hotspot gain
is claimed. Full physics/API/recorder/desktop/strict64/RSS/release/HOLD status
does not advance from this source proposal or synthetic arithmetic gate.
