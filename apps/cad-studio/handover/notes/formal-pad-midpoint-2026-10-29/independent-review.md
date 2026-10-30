# D307 fixed128 midpoint conversion: independent review

Reviewed `/tmp/barocss-formal-mass-midpoint-fast.patch` and its plan without applying or executing either. No repository edit, build, test, probe, benchmark, commit or subagent was performed. Parent-supplied baseline receipts/timings are not independently verified by this review.

No material mathematical or direct-accounting defect was found in the proposed bounded conversion.

## Exact target and comparison with the existing generic conversion

For interval endpoints lo/S and hi/S, with S=2^128, the exact midpoint is

`n/d = (lo+hi)/2^129`.

The old call constructs this exact rational and uses `SectionRationalContext.nearest`. That implementation searches adjacent positive binary64 values, compares exact distances, selects the even lower code on a tie (otherwise the upper code), and restores a negative sign afterwards. Exact zero returns literal positive0.

The candidate retains the exact charged integer addition. It requires either n=0 or

`1 <= abs(n) < 2^256`.

For nonzero n, `Number(n)` is nearest/ties-to-even conversion of that exact signed integer. It is normal and finite; rounding an integer just below2^256 to2^256 is allowed. `MIDPOINT_DENOMINATOR` is the exactly represented power of two2^129.

Dividing this rounded integer by2^129 shifts the exponent without changing its significand. The result is between2^-129 and2^127 in magnitude, including a possible upper endpoint caused by integer rounding. This lies strictly inside the binary64 normal finite exponent range. Therefore the division is exact: there is no second rounding at this step.

Scaling by a power of two maps the neighboring normal binary64 lattice, binade boundaries and significand parity to the lattice around the exact target n/d. Integer nearest/ties-even followed by this exact scaling is consequently identical to direct generic q.nearest(n/d).

The proof is about this fixed denominator and guarded magnitude. It does not justify replacing generic nearest for an arbitrary rational or a scaling that enters the subnormal range.

## Signs, ties and boundary cases

* **Exact zero:** n=0 returns positive0, exactly as the existing generic function. No sign is attached to a zero BigInt sum.
* **Negative values:** nearest/ties-even is sign-symmetric. Number(n)/d agrees with generic nearest's absolute-value selection followed by sign restoration. A nonzero admitted n cannot become either signed zero.
* **Smallest magnitude:** abs(n)=1 gives exactly2^-129, far above the binary64 smallest normal2^-1022. Thus neither subnormal underflow nor a normal-to-subnormal double-rounding boundary occurs.
* **Ties:** n=2^53+1 rounds to2^53; n=2^53+3 rounds to2^53+4. Scaling by2^-129 preserves the same even/odd significand choice. Their negatives follow the symmetric result.
* **Binade boundaries:** an integer immediately below a power of two may round to that power. The power-of-two scaling maps both sides of that boundary exactly, so this is not a double-rounding exception.
* **Largest admitted integer:** n=2^256-1 may round to2^256, giving result2^127. The candidate's `absolute > MIDPOINT_MAXIMUM` guard correctly permits equality. It would be wrong to require the rounded result to be strictly below that constant.
* **Guard refusal:** abs(n)>=2^256 is explicitly refused. Existing8192-bit checks still apply earlier through ctx.addInteger/ctx.integer; the conversion guard neither weakens nor replaces them.

The stated source family and fixed moment formulas put ordinary raw moment magnitudes far below the new256-bit numerator ceiling. A complete unchanged-admission statement should still be tied to the preserved source/boundary fixtures or a documented coarse envelope for all admitted raw intervals. This review does not infer a wider input domain from the optimization.

## Direct-operation accounting

The successful nonzero path's direct increments are exactly:

| Operation | Direct charge |
| --- | --- |
| Existing ctx.addInteger(lo,hi) |1|
| Zero comparison |1|
| Sign comparison |1|
| Absolute integer result/sizing |1|
| Right-shift result/sizing |1|
| High-part guard comparison |1|
| Number(n) conversion and division |2|
| Math.abs(result) |1|
| Finite/lower/upper result guards |3|
| Total |12|

The exact zero path performs only the first two steps and charges2. All result guards are precharged, including a short-circuit refusal. Positive inputs are conservatively charged for the same abs-result sizing as negative inputs. Input-dependent integer magnitudes remain covered by ctx.integer's maximum-bit recording.

Every added direct increment calls the same Context.check as the existing arithmetic. There is no fresh ledger, uncharged alternate conversion loop, retry or arbitrary caller bound. Module-level powers of two are fixed exact constants rather than request-dependent conversions. The table is consistent with the existing module's logical primitive-count convention; it is not a claim to count every JavaScript instruction or CPU cycle.

## Scope preservation and required runtime evidence

Only the ten raw fixed128 interval midpoint conversions change. Source admission, moment intervals, density conversion, public Number formulas, scalar audit, budgets, representation fields, retained native mass basis and false qualification flags are unchanged by this patch. zCenter deliberately retains generic ctx.nearest and its full old domain behavior.

If the raw estimate Numbers remain bit-identical, the unchanged public arithmetic consumes identical inputs and should produce identical properties/basis values. That implication does not replace the parent's full signed64-bit receipt differential, which must compare raw estimates, final properties, exact interval/error strings, source fields and metadata while normalizing only changed counters.

The parent should retain the independent moment/scalar tests and the generic nearest oracle, particularly signed zero, positive/negative ties and binade boundaries. A production test hook or public export is not needed for this private optimization. Budget refusals should follow the new real counts rather than an obsolete cost threshold.

No timing or count-saving result is asserted here. Mandatory perf-bench before/after and the retained baseline receipts remain the parent's separate qualification work. No new mass provider, physical B-rep guarantee, native SI accuracy theorem or runtime dependency is established by this conversion review.
