# Cylindrical wrap moments: independent static cross-review

Date:2026-10-29. Read-only review of the current215-line
`packages/barocss-cad/src/features/cylindrical-wrap-moments.ts` and112-line eight-test source.
No source edit, probe, build, AST execution, numerical execution or test was performed.
Source/map freeze was preserved. Root owns all execution results.

## Finding and authority boundary

No material defect was found in the raw-moment enclosure for the stated **parameter-rectangle added band**.
The formulas do not need a native circle reconstruction, ideal pi-volume substitution or Number quadrature.
`solidQualified:false` must remain. The result does not certify the moment of a B-rep or one physical solid.
Its geometry/cell-cover/nonintersection/provenance and full original-source mass remain external obligations.

The admitted source is an exact stored XY(U) × linear-Z(V) product: degree(2,1),3x2,single clamped spans,
V-independent weights[0.7,1], matching XY rows and common ordered z0<z1. XY coordinates≤5000 keep exact
factor2 outputs within10000; Z coordinates retain the CAD bound10000. These checks do not prove a quarter,
cylinder, nominal arclength chart, placement of a glyph or topology. The authority string's word 'quarter'
must not be interpreted as an extra admission proof. A positive radial Jacobian alone is not a global
embedding/cell-cover certificate.

## Radial, axial and native-domain formulas

With exact stored homogeneous Bernstein polynomials X,Y,W in normalized full-span t,

    x=X/W, y=Y/W, J=x*y'-y*x'=(X*Y'-Y*X')/W^2.

prepare() forms the correct homogeneous Jacobian polynomial and requires its Bernstein coefficients
strictly positive. Positive W then proves J>0 throughout the span. For radial scale rho∈[1,2], the
absolute volume factor is rho*J. Using variable order(rho,t,z) gives positive orientation; reversing
the first two variables would change determinant sign but not this integration measure.

A monomial x^a*y^b*z^c receives radial integral

    integral_1^2 rho^(a+b+1) d rho = (2^(a+b+2)-1)/(a+b+2).

RADIAL_POWER and XY_INDEX/Z_POWER correctly assign this to V,X,Y,Z,XX,YY,ZZ,XY,XZ,YZ. In particular
volume factor3/2, first-XY factor7/3 and second-XY factor15/4 are distinct. z0/dz are not scaled by rho.
Axial factor(top^(c+1)-bottom^(c+1))/(c+1) is correct across negative Z or an interval crossing zero.
It may be negative or zero for first-Z moments; second-Z and volume factors remain nonnegative.

Native rectangle endpoints are normalized exactly as(U-U0)/(U1-U0) and(V-V0)/(V1-V0). Integration is over
normalized t and physical z endpoints. Therefore no extra native-U width, native-V width or dz factor
belongs outside those already used transformations. Exact positive source-span checks avoid Number
width overflow while allowing a width that is not itself one exactly representable Number. Derivative
bounds remain with respect to normalized full-span t; Simpson uses the normalized rectangle width.

## Fourth derivative and Simpson remainder

For each of six XY integrands, P=J_homogeneous*X^a*Y^b and Q=W^(a+b+2). Positive Bernstein Q coefficients
supply a global lower bound qmin>0. Differentiating P=Q*f gives

    sup|f^(r)| ≤ [sup|P^(r)| + sum_(l=1..r) C(r,l)*sup|Q^(l)|*sup|f^(r-l)|]/qmin.

fourthDerivative() implements this recurrence through r=4. Derivative Bernstein coefficients and their
maximal absolute coefficient bounds apply globally on[0,1]. The numerator is allowed to change sign;
its bound uses absolute coefficients. The fixed source degree yields numerator degree≤7 and denominator
degree≤8, so the small choose() coefficients remain exact integer values in the inspected range.

For even panels n, composite Simpson error is at most

    (right-left)^5 * sup|f''''|/(180*n^4).

simpson() uses exactly this normalized-width formula, including n^4 and the odd4/even2 endpoint1 weights.
The global derivative bound is conservative on each subinterval and needs no sampled smoothness claim.
Disjoint rectangle interiors ensure additive parameter-cell integrals without duplicate interior measure.
Shared boundaries have zero parameter measure; their node cache reuse does not change quadrature weights.

## Outward fixed128 accumulation and negative factors

Context.round() uses BigInt truncation plus a negative-remainder correction, yielding true floor/ceiling
of the exact rational value scaled by2^128. Negative nonintegral values are not rounded toward zero on
both sides. Exact dyadic values get zero width.

All Simpson node weights and the normalized integration factor are positive. ctx.scale() also handles a
negative axial/moment factor by swapping endpoint roles before outward rounding. Thus negative Z, X or Y
moments do not reverse the interval accidentally. The derivative remainder is multiplied by abs(factor),
rounded upward to fixed128, and added to the nonnegative per-moment radius. A zero factor gives zero
contribution and zero new remainder radius.

For accumulated fixed interval[a,b]/S and remainder radius r/S, valueReceipt returns[(a-r)/S,(b+r)/S].
Its midpoint(a+b)/(2S) is also the expanded interval midpoint. Rounding that midpoint once to Number and
adding its exact rounding distance to half the full expanded width is a valid absolute estimate-error
bound. roundingWidth describes only accumulated fixed arithmetic; remainderRadius describes the separate
upward Simpson remainder. Their separation is honest. Optional raw-moment budgets test the full exact
estimate-error expression, including the final Number rounding.

## Positivity and request-wide budgets

positiveAddedVolume tests a>r for the volume interval, exactly equivalent to its certified lower bound>0.
It cannot produce a false positive from rounding. A false value means this enclosure did not establish
positive added measure; it must not be interpreted as proof of zero/negative physical volume. Source J>0,
positive rectangle widths/height and radial scale imply positive exact parameter-added volume, but coarse
intervals may still fail the returned lower-bound test. This is distinct from global material embedding.

One Context and one SectionRationalContext cover all preparation, normalized rectangles, shared nodes,
Simpson values, ten accumulated moments and receipts. Context.check bounds the sum of q-operation count
and charged fixed integer operations at200000 or a caller-tightened maximum. Existing q GCD/bit limits
remain active. Every charged fixed integer result is checked against8192 bits. Node cache is bounded by
8*(32+1), panels by even2..32 and rectangles by8. No helper resets an arithmetic budget per tile/moment.

These counters are the defined rational/direct operation counters, not CPU instruction counts or a
wall-time guarantee. Own-data copying has its existing separate structural bound. Fixed small table/index
and loop-control operations are not claimed as a complete hardware-operation count. Tight caller work can
be detected at a phase check after bounded work; no over-budget receipt is returned.

## Evidence and remaining exact limits

The eight tests were read, not executed. They use independent triangular/simplex and degree-six polynomial
oracles, Simpson n^-4 improvement, tile addition/cache count, direct native quarter data retention,
nonunit-domain partial integration, negative-Z signed first moments, malformed/refusal cases and ownership
isolation. The circle-intent fixture deliberately does not compare against ideal pi*R^2*H. This is a useful
boundary: representational circle defect is not silently discarded.

No additional blocker was found. Still unproved: exact rectangle coverage of arbitrary rectilinear rings
or font ink, cylinder/source authenticity, original/raised B-rep surface binding and embedding, whole-source
mass, storage-to-Number D0 evaluation, centroid/inertia propagation, arbitrary source knots/degrees/weights,
or a physical-volume/solid qualification. The ten values are raw added-band moments only. Any future
MassProperties provider must combine rigorously bounded actual source moments, prove coverage/embedding,
check a positive total-volume lower bound and propagate division/centroid/inertia errors separately.

Returned source/rectangles are independent snapshots but mutable. Their later mutation does not update
the already computed receipt. No immutable-result or changed-source recalculation contract is inferred.
