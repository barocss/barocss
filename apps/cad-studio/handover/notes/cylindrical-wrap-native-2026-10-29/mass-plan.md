# D297 wrapped-solid mass and floating-point gate

Status: source-only plan. No probe, build or test was run for this note. The private map/composer checks do not
establish a wrapped solid. Current construction work is a private rectilinear diagnostic with radial scale2 and
solidQualified:false, not a general text/wrap feature.

## Existing mass entry points

- `src/part/part-model.ts:735`, `Part.mass?: (density:number)=>MassProperties`, is the producer hook.
  `massPropertiesOf` at:4463 calls it before upright/general-B-rep integration. A producer can return `{brep,mass}`
  and the native operation puts both into Part. `loftSolid`/the loft operation at:1930,:1948 already use this.
- `src/features/loft.ts:196`,:205 `guidedSpanMoments`,:293 provide the D288 precedent. Ten raw integrals are kept
  before density conversion; the provider calls `solidMassFromIntegrals`. The actual symbol is guidedSpanMoments.
  The guide-height polynomial Gauss order and rational cross-section quadrature are distinct. This is not an
  existing general rigorous rational-wrap error receipt.
- `src/brep/solid-mass.ts:37`, `solidMassFromIntegrals([V,X,Y,Z,XX,YY,ZZ,XY,XZ,YZ],density,method)`, computes centroid
  and central inertia. Density is g/cm³; its multiplier1e-3 gives MMGS mass/inertia. Keep raw moments, not values
  reconstructed from rounded centroid/inertia. `internal/native-si-mass-state.ts:18` records central-moment
  provenance for SI ordering; it does not integrate geometry or certify errors.
- `solid-mass.ts:71` caches B-rep quadrature. At:81–89 it uses coarse/fine meshed contributions and Richardson
  extrapolation; whole patches use degree-based Gauss rules with extra points for rational data
  (`brep-mass-quadrature.ts:713`), not an interval remainder theorem. UV inversion, tessellation coverage and trim
  strips may fail and return null. Calling this adaptive does not make its error rigorous.
- `brepMassProperties` at:120 chooses planar/facet integrals, then curved quadrature, then tessellation.
  `method:'tessellated'` volumeBound is the difference from half resolution. It is an estimate, not a rigorous
  enclosure; there is no existing public centroid/inertia error-bound contract. Neither method:'quadrature' nor
  a valid B-rep by itself certifies numerical mass accuracy.
- `makeOutput`/`outputState` at part-model.ts:4443 and `stateOf` at:4458 retain Part.mass only for native output
  state. A copied/deserialized/raw output falls back to its B-rep; attaching a mass field to its JSON does not
  register a provider. Transform/combination helpers also need their own receipt propagation/error treatment.

A future private provider may hold interval receipts beside the ten raw moments and expose a normal mass closure.
Do not overload tessellated volumeBound or silently introduce a new public method/schema. Do not connect a
volume-only certificate to a provider that claims bounded centroid/inertia. A private WeakMap receipt would follow
the existing provenance pattern, but none exists for rigorous general mass errors today.

## Actual stored source versus ideal cylinder

An ordinary upright circle has arc-model closed-form mass πR²H. The stored rational quarter uses actual binary64
trigonometric poles and weights. Its rational boundary is authoritative for the new stored construction; it must
not be replaced by an ideal cardinal circle or declared exactly πR²H. Base actual-source mass needs its own bounded
coefficient integral or a bounded defect from ideal. A matching source snapshot/strict topology check is not that
mass proof.

For R10,H30, chart area56 and h1, the ideal added volume is
`A*(h+h²/(2R)) =58.8`, with ideal base3000π. The current exact scale2 diagnostic instead has h=R=10 and ideal
addition840. These are separate fixtures. Area56 alone does not determine centroid/inertia: profile shape, chart
position and height range must be fixed for those oracles.

Compare base and added contributions separately. Do not find a tiny stroke by subtracting two large numerically
integrated whole-body volumes or use a body-relative epsilon. Per-component positive material/topology/frontier
receipts remain necessary. If only an aggregate volume comparison is used, its derived uncertainty must be smaller
than the smallest admitted component change; otherwise a missing stroke can hide inside the interval and the gate
must refuse or remain diagnostic.

## Smallest implementable moment slice

Use one original degree(2,1) rational quarter with exact native-domain knots, V-independent XY/weights and linear
Z; origin-axis radial homothetyλ2. Accept at most8 explicit, disjoint native-UV rectangles from a rectilinear cell
cover. Ring/stroke coverage/decomposition, source provenance and solid topology belong to the assembler. They are
not inferred from a finite moment interval.

With P(u)=(x,y), J=x*y'−y*x', for a+b+c≤2:

```text
ΔI[a,b,c] = (λ^(a+b+2)−1)/(a+b+2)
           * integral(z0,z1, z^c dz)
           * integral(u0,u1, x^a*y^b*J du)
```

The native-to-unit parameter change is exact inside q; J_native du=J_unit dt. Original source knots/coefficients
remain stored. For x=Nx/D,y=Ny/D, the six XY integrands are
`Nx^a*Ny^b*(Nx*Ny'−Ny*Nx')/D^(a+b+2)`. They have numerator degree≤7 and denominator degree≤8, with a proved
positive denominator. Source/world coordinate, weight and finite-domain limits are explicit.

Chosen integration: composite Simpson with even N, initially8 and maximum32. A bound on the fourth derivative is
derived from Bernstein coefficient convex hulls. For f=P/Q and positive Q:

```text
M0 <= max|P| / min Q
Mr <= (max|P^(r)| + sum(l=1..r, choose(r,l)*max|Q^(l)|*M[r-l])) / min Q
|integral(f)−Simpson_N(f)| <= L^5*M4/(180*N^4)
```

Thus convergence has a proved fourth-order remainder, not a coarse/fine-difference estimate. Cache source
Nx,Ny,D,J at each exact node and reuse them for all six XY moments. One q context covers source preparation,
derivative bounds, all nodes/tiles, factors and receipts. Keep existing200000 operation/GCD and8192-bit limits.
Direct integer work must be charged to the same global request budget.

To prevent denominator products from growing across unrelated exact nodes, enclose each exact contribution once
in fixed128-fraction-bit outward dyadics before accumulation. Include this width in the receipt. The Simpson
remainder and final estimate rounding are separate recorded contributions. If a requested bound is not met,
refuse; otherwise a wide interval is still only a diagnostic receipt. No promise of native accuracy follows just
from completing integration. This is the next private helper scope; generic fonts/curved chart domains are excluded.

Only after all ten raw moment intervals, base-source intervals and FP propagation through centroid/inertia exist
may Part.mass be connected as a bounded producer. Interval division needs Vlower>0; inertia must include central
moment subtraction rounding. For the first implementation, returning added-moment intervals and a separate
estimate with solidQualified:false is the safe smaller checkpoint.

## Combining geometry and numerical errors

Keep independent terms: stored-circle defect versus the ideal circle; map endpoint/derivative/actual-length
error; stored trim/surface residual; and mass integration/rounding error. For a general chart domain a direct
Jacobian receipt `sup|det(P,P_u)*u'(s)−R|` is tighter than several generic relative epsilons and bounds the ideal
added-volume discrepancy after radial/area factors. For a rectangle, monotone u mapping lets the actual stored
integral use only the native endpoint interval; interior map derivative error need not be counted twice.

Pointwise storage error alone does not establish a volume bound: the assembler still needs consistent shared
frontiers/no missing faces and a bounded correspondence of side/face geometry. Tolerant B-rep gaps do not define
an exact watertight set without that construction argument. Do not call a scalar volume match set equivalence.
Preserve protected old source entities; the selected old carrier needs the corresponding hole/frontier uses when
radial sides are attached, rather than leaving the old footprint as an internal duplicate boundary.

The mass helper's exact coefficient integration does not use the generic D0 evaluator, so a D0 implementation bound
belongs to binding/checker execution or any estimator that calls it; it is not an extra physical deformation to
add twice to an already bounded stored-model integral.

## Restricted D0 FP gate from current source

`src/core/math.ts:124` basisInto uses nonnegative distances/fractions for an admitted clamped span, scaled by1 for
the native knots0,0.5,1. There are no transcendental operations in D0. project/projectXYZ at:158–170 divide by the
positive accumulated weight. Curve/surface evaluators at:224,:242 use the same arithmetic as evaluateCurve/Surface;
constant-coordinate restoration only reduces error. The following counts include conservative divisions by scale1:

| Path | basis operations | weighted sum/projection | total FP operations |
|---|---:|---:|---:|
| degree1 pcurve |10|19|29|
| degree3 world edge |48|35|83|
| degree(2,1) carrier |36|57|93|
| degree(3,1) radial side |58|75|133|

Basis degree p costs4p+6*p*(p+1)/2. Each fraction's positive denominator is the fixed span within rounding. Positive
coefficient recurrence permits an operation-by-operation gamma induction; cancellation in Cartesian coordinates
must use absolute sums, never a relative error in the final near-zero coordinate.

For the restricted family, explicitly require stored weights0.7≤w≤1, poles|coordinate|≤10000, positive spans0.5 or1,
finite parameters inside the domain, and no fast-math/flush-to-zero behavior. With u=2^-53 and gamma_n=n*u/(1−n*u),
a conservative candidate induction budget gamma1024 dominates these short recurrence/dot-product paths. If eta
bounds numerator/denominator weighted accumulation, each coordinate's absolute projection error is bounded by
`P*(2eta+u*(1+eta))/(1−eta)`; sum three coordinates for a Euclidean bound. At P=10000, eta=gamma1024 gives below
6.9e-9 mm, plus an explicit underflow term (a conservative1e-300 is ample for this fixed operation/denominator range).

The pcurve can use a much smaller gamma128 allowance from its29-operation positive path: below2.9e-14 per UV
coordinate when UV magnitudes≤1. Propagate this through an actual carrier Lipschitz bound. For pU2/span0.5,pV1/span1,
m=0.7,Wmax=1,P=10000, safe per-coordinate derivative bounds are
`Gaxis <= (2p/span)*(P/m + P/m²)`, giving about277552 in U and69388 in V. Three-coordinate propagated UV error is
below3.1e-8 mm. Adding curve/carrier D0 bounds gives below4.5e-8 mm before the stored-model binding error. This can
fit inside1e-7 only by reserving that budget: default composer errorBudget1e-7 cannot simply have FP error added.
Pass a smaller stored-model budget and use the minimum actual entity tolerance; refuse if the remaining budget
is nonpositive. Exact global-UV adapter rounding, if any, is another explicit term.

These are a feasible restricted proof plan, not an implemented FP certificate. Before admission, encode the
per-operation induction/underflow bound and exact family guards; do not generalize the count to arbitrary knot
scales, tiny weights, arbitrary surfaces, D1/normal evaluation or derivative-based mass quadrature. If pcurve
evaluation exits the native domain, refuse; a silent clamp is not covered. The native stored-model certificate,
FP execution bound, topology qualification and numerical moment receipt remain separate gates.
