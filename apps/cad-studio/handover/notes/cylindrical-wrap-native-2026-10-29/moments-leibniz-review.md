# Wrap moment derivative preparation: Leibniz delta review

Date:2026-10-29. This is a separate delta to `barocss-wrap-moments-static-review.md`.
Scope: current primitiveBounds/productBounds/denominatorLower/fourthDerivative/prepare in
`packages/barocss-cad/src/features/cylindrical-wrap-moments.ts`. The surrounding node, Simpson,
accumulation and receipt source was reread for the changed-bound connection. No edit, numeric probe,
build, AST execution or test was run. Source/map freeze was maintained.

## Finding

No material defect was found in the new conservative derivative-bound construction. It replaces exact
high-degree product-coefficient construction with upper derivative hulls via Leibniz, a downward-rounded
positive denominator floor and upward-rounded quotient-derivative bounds. This can widen the reported
remainder/enclosure. It does not improve or establish physical B-rep accuracy. Keep `solidQualified:false`
and every external cell-cover/cylinder/embedding/full-source-mass boundary from the prior review.

## Primitive hulls and exact zeros

primitiveBounds starts with exact stored homogeneous X,Y,W or exact Jacobian J_h=X*Y'-Y*X'.
For r=0..4 it bounds the absolute value of the rth derivative by the maximum absolute Bernstein
coefficient, then upperDyadic rounds that nonnegative exact rational upward onto the2^-128 grid.
Differentiation returns a new coefficient array, leaving the original node-evaluation polynomials intact.

The derivative of a constant is represented as[0]. Repeated differentiation therefore remains exactly
zero. Context.round(0) is the exact[0,0] interval, so upward rounding does not turn zero into a positive
allowance. Conversely, a small positive bound below2^-128 rounds upward to at least one grid unit, never
silently to zero. This matters for the zero-skip conditions in the following recurrences.

## Leibniz bounds

If a_r≥sup|A^(r)| and b_r≥sup|B^(r)|, then

    sup|(A*B)^(r)| ≤ sum_(k=0..r) C(r,k)*a_k*b_(r-k).

productBounds computes that nonnegative sum and rounds it upward. This remains true for signed X/Y/J_h;
only the bounds need be nonnegative. Skipping a term with an exactly zero bound is valid because that
bound certifies an identically zero derivative. No cancellation or sign assumption is used to reduce an
upper bound. r≤4 keeps choose(r,k) within the exact small-integer range.

prepare's derived arrays have the correct meanings:

- d2,d3,d4 bound the derivatives of W^2,W^3,W^4, respectively.
- jx and jy bound J_h*X and J_h*Y.
- Numerators `[J_h,J_h*X,J_h*Y,J_h*X^2,J_h*Y^2,J_h*X*Y]` match the six XY node integrands.
- Denominators `[W^2,W^3,W^3,W^4,W^4,W^4]` retain the original rational integrands. The new hull
  arrays do not substitute a different denominator into actual node evaluation.

Using an already bounded derivative array in another productBounds call is conservative by induction.
The method loses cancellations that an exact product polynomial can retain; the resulting derivative
bound may be larger. It cannot be described as the exact derivative coefficients of the product.

## Downward denominator floor and upward M_r

For the positive Bernstein weight polynomial W, minD=min(stored coefficients) is a valid whole-domain
lower bound. Therefore minD^m≤W(t)^m for m=2,3,4. denominatorLower takes the fixed128 floor, preserving

    0 < lower_m ≤ minD^m ≤ inf_t W(t)^m.

The positive check occurs after flooring. The admitted weights[0.7,1] put minD^4 far above one fixed grid
unit; no tiny-positive floor issue is hidden by this family. Taking the floor rather than the ceiling
is essential and the current code uses `.lo` correctly.

Let p_r,q_r be the nonnegative upper derivative hulls for P,Q and L the positive downward floor for Q.
From Q*f=P,

    M_0 ≥ p_0/L,
    M_r ≥ [p_r + sum_(l=1..r) C(r,l)*q_l*M_(r-l)]/L.

fourthDerivative rounds M_0 and every M_r upward. Since all factors are nonnegative and L>0, induction
proves M_r≥sup|f^(r)|. Rounded-up earlier M values cannot make a later bound smaller. Zero-skipping is
safe for the same reason as above. `qBounds[0]` is not needed in the sum: its role is replaced by the
separate lower bound on the undifferentiated Q on the left side. This is not an omitted product term.

The fourth returned bound still uses normalized original full-span t. simpson consumes it with the
unchanged width^5/(180*n^4), so no native-U scaling was added or dropped by this preparation change.
The later axial/radial scaling and abs(factor) remainder radius remain unchanged.

## Caching, counters and receipt consequences

All new bounds are prepared once per request in the same Context/SectionRationalContext. Primitive and
derived hull arrays are local, not a cross-source global cache. Node evaluation retains its original
exact source polynomials and shared normalized-t cache. No derivative preparation mutates those inputs
or cached node intervals. There is no reuse across a changed source by object identity.

upperDyadic and denominatorLower route through Context.round, whose fixed integer operations/bit checks
remain charged. productBounds and quotient recurrence use the same q operation/GCD/bit state, followed by
Context.check. No per-monomial/tile counter reset, new larger cap or untracked nested rational context was
introduced. Fixed small binomial/index/loop work is not a CPU-instruction or wall-time certificate; the
existing counters retain their defined rational/direct-operation meaning.

A source for which high derivatives are zero can retain zero Simpson remainder. A nonzero conservative
hull can make remainderRadius and estimateError larger than the old exact-product implementation, even
when actual integral and Simpson node sum are unchanged. Any wider enclosure must continue through the
existing requested error-budget admission. No narrower precision or faster runtime is proved by this
source review. Root's execution/differential results are separate evidence.

## Still external

This delta does not establish exact glyph/rectangle coverage, full original-cylinder moments, actual
trimmed-Brep volume/centroid/inertia, side/cap binding, global embedding, native Number D0 error or one
physical solid. A positive added-volume lower bound continues to concern only the parameter-added-band
integral. No physical mass/provider or precision flag may be promoted on the basis of this preparation
optimization or this review.
