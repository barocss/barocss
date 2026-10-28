# Native wrap D0 evaluator: independent source and rounding-bound review

Date: 2026-10-29. Scope: read-only source inspection and mathematical derivation. No source edit,
AST execution, numeric probe, build, test, browser, benchmark or runtime/hardware validation was performed.
Only this temporary report was written. No ideal carrier was regenerated and no sampled agreement was
used as a whole-interval proof.

Repository root:
`/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`.
Inspected current `src/core/math.ts`, `src/core/vec3.ts`, `src/brep/brep-core.ts`,
`src/brep/brep-check-geometry.ts` and `src/features/cylindrical-wrap-curve.ts` in packages/barocss-cad.
D297 checkpoint is739978a27. Any later implementation must pin/review the actual arithmetic it adopts.

## Finding

A conservative, conditional, whole-domain **D0 position** bound can be derived for this exact narrow
native family from the actual implementation. It is not a proof for all admitted native NURBS. The
following sufficient reservation is deliberately loose: **2e-8 world distance** for comparing a stored
cubic edge with its quadratic-quarter carrier through its computed linear pcurve, under the conditions
below. This reservation is separate from D297's exact stored-model coefficient residual. For a4x2 cubic
ruled side under the same weight/coordinate conditions, reserve **3e-8** instead.

These are source-derived mathematical bounds under explicit IEEE assumptions, not yet a production
receipt or an executed validation. D297 correctly retains `globalEvaluatorErrorCertified:false`.
Do not flip that field merely by citing this report. A future provider needs its own admitted-family
check, conservative arithmetic for the budget sum, source-bound proof metadata and relevant verification.

## 1. Actual arithmetic and required family

`core/math.ts:124–155` is basisInto. It finds the active span by comparisons; right endpoints use the
last span. Per level it forms left/right distances, divides each by scale=max(1,|domain ends|), and then
uses positive fractions `(r/(r+l),l/(r+l))` in the Cox–de Boor recurrence. It does not evaluate trigonometry,
powers or a new ideal circle. For U=[0,.5] and V/t=[0,1], scale is exactly1. Native closed-half U knots
[0,0,0,.5,.5,1,1,1] have the same local half-width. The exact .5 knot uses the next span; shared original
row data makes the source continuous there. A bound across that knot requires both adjacent original
spans to satisfy the stated limits.

`math.ts:173–211` and the reusable evaluators at224–263 perform the same ordered arithmetic. A curve term
is b_i*w_i; a surface term is b_i*c_j*w_ij. Each term is added to a positive denominator and multiplied
by each Cartesian pole before the coordinate sum. `project/projectXYZ` divide each numerator by the
positive finite denominator. Constant-coordinate restoration is exact for that authored invariant; it
cannot worsen this bound. Cached bases are only reused for Object.is-identical arguments. The source
knots/weights/poles must remain unchanged for the evaluator lifetime; concurrent mutation is excluded.

Sufficient conditions for the following bounds:

- Curve is one clamped degree3 span over t=[0,1], with4 stored Cartesian poles.
- Carrier is degree(2,1),3x2, clamped U=[0,.5],V=[0,1], or the original two-quarter native half with
  those same local knot widths. A4x2 side is separately degree(3,1),unit U/V spans.
- **Every actual stored weight lies in [.5,1]**, not merely somewhere in core's broad[1e-6,1e6]. Actual
  native and composition weights near[sqrt(.5),1] satisfy this weaker dyadic condition, but the provider
  must check them. A generic D297 composer input has a wider contract and does not imply this family.
- Every actual stored Cartesian coordinate has absolute value≤10000. Check outer/side poles again after
  homothety; original admission does not certify newly stored outer poles or multiplication rounding.
- Every argument is a finite binary64 value in its evaluator's actual domain, or passes the explicit
  nonexpansive domain clamp used in the B-rep pcurve checker. The comparison is at that exact stored t;
  it is not a claim about an ideal unrounded sampling fraction, Newton solution or authored length.
- A pcurve is the actual degree1,2-pole,unit-weight line over t=[0,1] with U in[0,.5],V in[0,1]. Side
  pcurve coordinates instead lie in[0,1]^2. Coedge sense does not reverse its canonical t.

## 2. IEEE model, cancellation, zeros and subnormals

Let unit roundoff u=2^-53 and gamma(n)=n*u/(1-n*u). For a normal finite result of +,-,*,/ use correctly
rounded binary64 nearest-even with no overflow: fl(a op b)=(a op b)(1+delta),|delta|≤u. For subnormal
results use the mixed absolute model `|fl(x)-x|≤u*|x|+mu`, mu=2^-1074; this uses a full subnormal step,
not an unrepresentable JS half-step constant. Require gradual underflow, no flush-to-zero and ordinary
ECMAScript Number operation semantics, including each indicated rounding. No unproved reassociation,
approximate reciprocal or fused operation may replace the source arithmetic. This source review did not
verify a particular JS engine/JIT/hardware configuration.

The basis distances are nonnegative. For a local width h=.5 or1, a=x and b=h-x (or translated local
coordinates) are within[0,h]. Positive h-x near the fixed endpoint has a normal representable spacing;
zero is exact. A tiny a can be subnormal, so it must not be given a relative-only certificate. The rounded
sum r+l differs from h by at most gamma(2)*h (plus the negligible mixed-model term); it stays above
h*(1-gamma(2)), hence above .49. No zero-denominator branch is reachable in this admitted one-span family.
The overflow-rescale branch at143–144 is also unreachable. Fractions are nonnegative; a positive fraction
has relative error≤gamma(5), with a mixed-model subnormal term as needed. Zero terms stay zero.

There are at most3 recurrence levels. Each dependency path adds one fraction multiplication and at most
one nonnegative addition per level. Propagating fraction gamma(5) gives gamma(7p) for degree p≤3;
**gamma(32)** uniformly bounds a computed nonnegative basis coefficient relative to its exact coefficient,
plus the underflow term. This is a dependency-path bound, not an assertion that the whole evaluator has
only32 operations. Sums of nonnegative terms preserve this bound. Endpoints are covered, including exact
zero basis coefficients. Signed zero can affect returned bits, but has zero geometric distance here.

The numerator may cancel for mixed-sign Cartesian coordinates. Therefore the position proof uses an
absolute sum-of-magnitudes bound. It never divides by a nearly cancelling numerator or claims a small
relative error in a coordinate near zero.

A loose common additive allowance2^-900 in the final per-coordinate bound safely dominates gradual-
underflow terms: fewer than1000 relevant scalar operations, at most3 basis levels, intermediate fractions
less than2, pole magnitudes≤10000, and all geometric denominator divisions bounded by approximately2.
Even a conservative propagation factor2^100 is smaller than2^(1074-900). There is no tiny free denominator
or arbitrarily long recurrence to amplify mu further in this family. Do not implement2^-1075 as a Number.

## 3. Homogeneous sums and Cartesian projection

Let b be the exact nonnegative basis/tensor-product basis at the exact argument, D=sum b_i*w_i,
N_k=sum b_i*w_i*P_ik. Exact partition of unity and stored weights in[.5,1] give

    .5≤D≤1, |N_k|≤C*D, sum|b_i*w_i*P_ik|≤C*D, C=10000.

A uniform **gamma(128)** covers the denominator relative error and numerator absolute error divided by
C*D. A per-path count is substantially smaller:

| Quantity | Basis exponents | Remaining term/sum exponents | Sufficient total |
| --- | --- | --- | --- |
| Cubic curve numerator |32| weight1 + Cartesian1 + at most4 additions |38|
| Cubic curve denominator |32| weight1 + at most4 additions |37|
| Quadratic-linear Surface numerator |32+32| tensor/weight2 + Cartesian1 + at most6 additions |73|
| Cubic-linear side numerator |32+32| tensor/weight2 + Cartesian1 + at most8 additions |75|
| Surface denominators |same| one fewer Cartesian product |≤74|

Separate coordinates do not compound one another's errors. Positive denominator accumulation has no
cancellation. Intermediate magnitudes are far below overflow. With a=gamma(128), projection adds one
rounding and yields the following sufficient per-coordinate bound:

    E(C) = C * (2*a + u*(1+a))/(1-a) + 2^-900.

Using gamma(128)<1.422e-14 gives **E(10000)<3e-10**. Thus a single D0 world point has L1 error<9e-10,
and hence Euclidean error<9e-10. A stored cubic and one Surface contribute<1.8e-9 before pcurve argument
rounding. Constant-axis restoration may make an axis exact, but this common bound does not depend on it.

## 4. Pcurve evaluation is an additional world-space term

D297's cross residual compares exact stored rational Curve(t) with exact original Surface(p_native(t)).
The real checker additionally computes p_native(t) in Number. Omitting this stage is a gap.

The same conservative E(C) formula with coordinate bounds .5 and1 gives a rounded pcurve coordinate error
below1.5e-14 in U and3e-14 in V. This deliberately reuses gamma(128); the actual degree1 bound is much tighter.
For the admitted quadratic-linear carrier, homogeneous derivative bounds using only actual pole/weight
ranges give, per Cartesian coordinate:

    |dS/dU|≤2*p*C/(h*.5) + C*p*(1-.5)/(h*.5) =20*C, p=2,h=.5;
    |dS/dV|≤5*C, p=1,h=1.

The factors follow from |dN|≤2*p*C/h, |dD|≤p*(1-.5)/h and |S_k|≤C. Therefore L1 Lipschitz bounds are
L_U≤600000 and L_V≤150000. The whole-domain pcurve lift error is at most

    600000*1.5e-14 +150000*3e-14 =1.35e-8.

Together with both D0 point bounds: **<1.53e-8**, so **2e-8** is a conservative reservation for the original
quadratic carrier. This bound does not rely on observing a small residual at selected t values.

For a unit-U cubic-linear side, the same derivation gives L_U≤450000,L_V≤150000. Both pcurve coordinates
have bound3e-14, so lift error≤1.8e-8; adding both D0 bounds is<1.98e-8. **3e-8** is a conservative common
reservation for that side. These bounds require actual side weight/coordinate admission and a separate
stored side-versus-edge representational proof; the existing carrier residual does not supply that proof.

A computed pcurve can in principle drift slightly outside a domain. basisInto rejects an out-of-domain
argument; a position-error bound is not an admission proof against that exception. `brep-core.ts:267–270`
explicitly clamps to the actual face domain after its own finite UV guard. That clamp is nonexpansive
relative to an exact in-domain pcurve. For an un-clamped public call, prove parameter containment or retain
a typed failure; this review does not silently add a clamp. At the original half's internal .5 knot,
both adjacent native spans must retain the same limits if rounded UV lands across the knot.

## 5. Budget separation and what remains unproved

Keep separate quantities, without replacing any of them by a sampled gap:

1. D297 exact stored-model coefficient cross-residual E_repr, including shared endpoint overrides.
2. Conditional D0/pcurve-lift reservation E_eval, e.g.2e-8 on the native quadratic carrier or3e-8 on a
   properly admitted cubic radial side. The reservation is an allowance, not a measured residual.
3. Additional exact-to-stored outer homothety/ruled-boundary construction residuals, chart-endpoint
   conversion errors and any other newly introduced representation terms. Bound them separately.
4. The original unchanged native floor **1e-7**.

A sufficient carrier binding admission is E_repr+E_eval+E_other≤1e-7, with the sum evaluated exactly or
outward. For the above simple carrier reservation and no other term, E_repr≤8e-8 is sufficient. A side
using3e-8 leaves7e-8 for all its representation/construction terms. This is a tighter allocation inside
existing policy, never permission to increase entity tolerances. D297 currently admits E_repr up to1e-7;
that alone does not qualify the combined Number evaluation.

NOT PROVEN by this review: derivatives/normals evaluated by finite differences; nearest-UV/Newton success;
Mass quadrature and its error; endpoint-table construction not already in a coefficient receipt; regularity,
side Jacobian, trim embedding or global nonintersection; glyph clearance/aggregate budgets; topology or one
physical solid; every native NURBS degree/span/weight range; arbitrary original knot shifts or huge domain
scale; pcurve domain containment for consumers without a clamp; and engine/hardware compliance by execution.

`core/vec3.ts:14` uses Math.hypot for the displayed/tested distance. The bounds above concern the real L1/
Euclidean distance between evaluated points; no correctly-rounded Math.hypot certificate was derived.
Consequently they are not a proof that every native strict checker branch or measured-gap Number has the
same bound. Keep checkBrep as its existing finite necessary check alongside independent admission receipts.
No new native global-error contract or product completion is asserted here.
