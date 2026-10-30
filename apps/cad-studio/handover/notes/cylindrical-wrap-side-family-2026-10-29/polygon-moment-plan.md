# Original-UV line-polygon band moments: bounded private plan

Status: read-only design, 2026-10-29. This note reads the current `cylindrical-wrap-moments.ts`, original-quarter source adapter and projected-component contract. It makes no repository edit and runs no probe, build, test, benchmark or subagent. All operation/precision results mentioned as reported are Root's earlier evidence, not new measurements.

## Smallest implementable slice

A private original-UV polygon integrator is mathematically feasible without an arbitrary rectangle-cover input. Generate an exact vertical decomposition from the authored straight UV boundary segments, analytically integrate Z over every material interval, and integrate only in the source's original U parameter. Do not ask a caller to supply or assert coverage by tiles.

Keep the current exact product-source admission and fixed radial range[1,2]. First qualify a single triangle. Then consider a fixed small profile such as at most8 total line edges across all outer/hole rings/components, at most7 U slabs and at most4 material bands in one slab. This gives at most7*(32+1)=231 U-node requests before endpoint reuse, below the existing rectangle helper's264 cached-node ceiling. It is a proposed tighter diagnostic scope, not a claim that every such polygon fits200000 operations or any requested accuracy. The existing rectangle API and limits need not change.

One request must own UV validation/decomposition, source preparation, all nodes, all ten integrals and receipts under the original200000 exact/direct operations,8192 bits and explicit finite work/payload limits. Caller options may only tighten. No fresh context per slab, component, moment, hole or refinement. Source construction/carrier/B-rep/component work outside that request is not thereby included in a combined-construction budget.

## Existing source boundary

The current moments source has degree(2,1), a3x2 clamped grid, positive V-independent weights in[0.7,1], exactly identical XY in each V column and common row Z endpoints z0<z1. The original clamped domains and binary64 poles/weights are copied, not regenerated. `cylindrical-wrap-source.ts/sourceCore` obtains the native quarter by direct-copy splitting the original positive-Y half-wall atU=.5 and preserves its U[0,.5] coefficients.

`moments.ts/prepare` constructs exact homogeneous quadratic Nx,Ny,W and exact cubic K=Nx*Ny'-Ny*Nx', proves a strict positive K coefficient hull, and prepares conservative derivative bounds through primitive hulls, Leibniz products and outward128 quotient recurrences. `node/homogeneousMoment` now evaluates the exact unreduced integer ratio before one signed outward128 division. The bounded fixed-node Simpson path and exact binary64 receipt conversion can be reused conceptually. These functions are module-private today; the public entry point creates a new context and must not be called once per slab.

The D300 certificate concerns stored world cubics in the projection(Y/X,Z/W). It does not prove a straight polygon in original UV, exact correspondence between that UV polygon and a rounded world trim, or a mass identity. It cannot substitute for the UV cover proof below.

## Parameterization and Jacobian

Write native domains as U[a,b], V[c,d], and

`t=(u-a)/(b-a)`, `s=(v-c)/(d-c)`, `z(v)=z0+(z1-z0)*s`.

The exact stored product surface is

`S(u,v)=(x(t),y(t),z(v))`, `x=Nx/W`, `y=Ny/W`.

For radial scale rho in[1,2], the band parameterization is

`T(t,z,rho)=(rho*x(t),rho*y(t),z)`.

Its signed volume Jacobian is `rho*J(t)`, where

`J=x*y'-y*x'=K/W^2`.

The native U factor cancels: J_u=J_t/(b-a) while du=(b-a)dt. The V-to-Z factor is already present when integrating between actual Z limits. Do not multiply another b-a, z1-z0 or1/(d-c) after the formula below. Exact normalization is essential; neither native domains nor UV are nominal arc length.

Strict positive J establishes orientation of this parameterized integral. A native quarter's separate angular/injectivity certificate can identify it with a nonoverlapping source-product band. A bare product Surface plus a Jacobian integral must not silently acquire full-cylinder or physical-B-rep authority.

## Exact UV cover, holes and components

1. Snapshot all finite UV vertices and preserve ring/component membership. Every point lies in the original domains. Rings have at least3 distinct vertices, no zero edge and nonzero exact signed line area. Keep outer orientation positive and hole orientation negative in(U,V), or explicitly normalize only traversal sense while preserving authored points.
2. Prove every line ring simple with exact charged segment predicates. Adjacent edges may share only their one prescribed endpoint; reject backtracking/overlap. Nonadjacent and cross-ring boundary contact/crossing must refuse under the initial strict family. Repeated vertices cannot be repaired with an epsilon.
3. Sort all distinct vertex U values exactly. Since crossing boundaries were rejected, no interior segment-intersection U event remains to add. Consecutive events form complete open U slabs; vertical segments lie on event lines and have zero measure for the integral, but they remain part of the boundary/topology proof.
4. At each slab's exact rational midpoint, activate every nonvertical edge covering that open U interval. Its V value is the exact affine expression `vA+(vB-vA)*(u-uA)/(uB-uA)`. Sort these values by charged exact comparisons. An exact tie is contact/overlap uncertainty, never a sort-order hint.
5. Certify the order over the whole slab, not only at the midpoint. The difference of adjacent active affine functions is affine; nonnegative values at both slab endpoints and a strict positive midpoint prove the strict interior ordering. Zero at an event endpoint is permitted only for the already certified vertex incidence. No active edge can start/end inside this slab because every vertex U is an event.
6. Sweep the sorted V crossings from below with **component-labelled winding state**. Crossing an oriented line while increasing V adds `sign(uEnd-uStart)` to that component. Each component's material winding must remain0 or1; simultaneous filled components must be at most1 for a disjoint-material contract. Return to zero above all crossings. Consecutive crossings with one filled component form a derived material interval. Empty bands remain part of the cover proof, not omitted evidence.

A crucial counterexample forbids an unlabelled global winding shortcut: outer A is on the left, outer B on the right, and a clockwise ring declared as A's hole lies inside B. The global sum can stay0/1 while incorrectly removing B material. Component-specific winding becomes-1 for A there and rejects it. Alternatively first prove every hole lies in its own outer and holes are nonnested, plus disjoint filled components, then sum globally. Component ownership cannot be inferred from the total scalar winding alone.

This also preserves legitimate islands: a separate filled component can sit in another component's void if the contract permits disjoint filled sets. Its boundary is nested geometrically but the filled sets do not overlap. Keep this distinction explicit; rejecting every cross-component nesting is a narrower optional first policy, not a general union theorem. If that narrower policy is chosen, report it rather than dropping island material.

These complete slabs and exact crossing orders prove coverage up to finitely many event lines, which have zero measure. No tiny positive U span, stroke or gap is discarded because it is below a Number threshold. Degenerate zero-area input refuses. Bad component roles, holes outside their own outer, nested holes or overlapping filled components cannot be hidden by signed cancellation.

## Analytic Z integration and ten raw integrands

For a material interval in one slab, let vMinus(u),vPlus(u) be its exact affine bounds. Their actual world heights `zMinus(t),zPlus(t)` are affine in t. For c=0,1,2 define

`G_c(t)=sum_bands (zPlus(t)^(c+1)-zMinus(t)^(c+1))/(c+1)`.

This is an exact polynomial of degree at most c+1. Summation is over the correctly owned disjoint material intervals of that U slab. Thus only three height polynomials are needed per slab, regardless of how many voids/bands it contains. G0 is nonnegative; G1 can be negative; G2 is nonnegative. Do not replace signed heights or moments by absolute values.

For nonnegative integers a,b,c of total degree at most2, define

`F_ab(t)=Nx(t)^a*Ny(t)^b*K(t)/W(t)^(a+b+2)`

and `A_r=(2^r-1)/r`, r=a+b+2. The added raw moment on a slab is

`I_abc=A_r*integral[tLeft,tRight] F_ab(t)*G_c(t) dt`.

| Raw order | a,b,c | Radial factor | Rational U integrand before dt |
| --- | --- | --- | --- |
| V |0,0,0|3/2|F00*G0|
| X |1,0,0|7/3|F10*G0|
| Y |0,1,0|7/3|F01*G0|
| Z |0,0,1|3/2|F00*G1|
| XX |2,0,0|15/4|F20*G0|
| YY |0,2,0|15/4|F02*G0|
| ZZ |0,0,2|3/2|F00*G2|
| XY |1,1,0|15/4|F11*G0|
| XZ |1,0,1|7/3|F10*G1|
| YZ |0,1,1|7/3|F01*G1|

There is one rational U integral per moment/slab after exact Z integration, with the same positive W powers2,3,4 as today. The numerator's safe unreduced degree is at most8 for these ten moments; the denominator degree is at most8. High-degree coefficient construction is nevertheless unnecessary and would repeat the exact-GCD cost already removed from the rectangle helper.

## Local slab coordinate avoids huge affine slopes

Use `L=tRight-tLeft>0` and `r=(t-tLeft)/L` in[0,1]. Derive the upper/lower height of each active edge exactly at both slab endpoints, then store its affine height in local Bernstein form `(1-r)*zLeft+r*zRight`.

This avoids an explicit intercept/slope representation involving division by a tiny U width. All actual endpoint heights remain within the existing world range. It does not round the geometry or clamp the U span. Powers up to3 and their differences/1,2,3 denominators give the exact G_c(r) coefficients. A zero band at an event endpoint is valid for a triangular slab; its interior width must still be certified positive.

The integral becomes

`I_abc=A_r*L*integral[0,1] F_ab(tLeft+L*r)*G_c(r) dr`.

Reuse exact global source evaluation at `tLeft+L*r`; never normalize native U with Number interpolation. All bands in one slab share the same six F_ab node values. Adjacent slabs can share exact event-endpoint F cache entries. G values are slab-specific and must not be reused merely because a global t matches.

## Certified fourth derivative and Simpson remainder

Retain the existing primitive Bernstein derivative bounds and quotient recurrence, but preserve the full bound vector `M_j(ab)>=sup |F_ab^(j)|`, j=0..4, rather than only M4. Compute it once per source/six integrands with the same outward128 rounding. A future local restriction may sharpen it, but the global bound is already sound.

For each exact degree<=3 height polynomial G_c(r), let `B_k(c)>=sup |d^k G_c/dr^k|`, k=0..3. Exact Bernstein differentiation and maximum absolute coefficients, rounded upward if needed, give these bounds. Higher derivatives are exactly zero.

For `H(r)=A_r*L*F_ab(tLeft+L*r)*G_c(r)`, Leibniz gives

`sup |H''''| <= |A_r|*L*sum[k=0..min(4,c+1)] binom(4,k)*L^(4-k)*M_(4-k)(ab)*B_k(c)`.

All terms are nonnegative, so the current immediate-upward128 bound arithmetic remains conservative. This formula includes the chain rule and the outer integration factor L; adding/removing another slab-length power would be a bug.

Composite Simpson with an even n in the existing2..32 range on r[0,1] has exact analytic remainder radius at most

`R_slab,abc = bound(H'''')/(180*n^4)`.

Equivalently, the global-t form is `L^5*sup|(A_r*F*G_t)''''|/(180*n^4)`. Do not mix the local G derivative bounds with the global-t L^5 formula without the chain factors.

The scalar polynomial derivatives stay zero exactly when appropriate. In the affine synthetic carrier below, every total moment integrand has degree<=3 and the exact fourth derivative is zero; a zero remainder is an independent useful regression. On the native rational source, conservative bounds can be wide. Larger n gives the usual n^-4 analytic term only if the request still fits every unchanged limit; no precision is promised before measurement.

## Node enclosures and signed accumulation

The current six exact F values can be enclosed once on the same128-bit dyadic grid. Multiply those intervals by exact signed G_c(node) with proper sign reversal and outward rounding, then apply the positive Simpson weights, L and A_r. Add all slab intervals and all nonnegative remainder radii. Never subtract remainder radii for holes or rely on cancellation of large signed errors.

A further valid optimization is to form the exact unreduced integer ratio for `F_ab*G_c*A_r*L` and outward-divide once. For F alone today, the raw numerator is `Nx.n^a*Ny.n^b*K.n*W.d^m`, denominator `Nx.d^a*Ny.d^b*K.d*W.n^m>0`. Multiplying a signed exact G ratio preserves this identity. Charge every multiplication/division/remainder and guard every intermediate at8192 bits. Large unreduced intermediates may refuse even when a reduced fraction would fit; that is a bounded refusal, not grounds to bypass the cap.

Exact summation of many unrelated rational height coefficients can again grow odd-denominator products. The first small request can simply refuse at the existing cap. An optional later optimization is outward128 coefficient intervals for accumulated G polynomials, preserving the induced evaluation/derivative uncertainty in the receipt. Such intervals enclose the exact original polynomial; they must not silently replace it with rounded geometry. Signed interval multiplication needs all relevant endpoint products, not a positive-only shortcut.

Final exact lower/upper fractions include node/contribution rounding and summed analytic remainder. The binary64 estimate is a separately rounded value whose exact rounding distance is included, as in valueReceipt today. Ten caller absolute errorBudgets remain enforced. A wider bound is a diagnostic or typed refusal, never automatic tolerance relaxation.

## Aggregate200000 cost blockers

Root reported one native quarter rectangle at panels8 taking180216 total operations with V estimate2192.3394307508997 and error bound1.9005899585893957. That is an added-band diagnostic, not mass precision qualification. It leaves little room for several distinct slab node grids, exact UV proof, three height polynomials, extra derivative bounds and ten signed node products. No runtime estimate for the polygon path is available.

Main blockers are exact source de Casteljau/K evaluation at many distinct rational t values, low-degree but repeated height-rational arithmetic, unrelated odd denominators from line intersections, interval scaling, and the final ten estimate/error float searches. Global F-node caching and slab-wise G aggregation are legitimate reductions. Repeating source preparation for each slab, integrating each band separately, rebuilding high-degree P/Q coefficients, or calling the current rectangle entry point per band would waste work or reset the authority budget.

Start with one triangle, even panels2, explicit broad diagnostic receipts and preserved inputs. Then measure the same source at panels8 and a tightly bounded hole/disjoint case. If a requested bound or fixed200000 budget fails, preserve the failure and narrow the qualified input/precision slice; do not raise the cap, drop a narrow stroke, reduce the polygon silently or mark the receipt physical-solid-qualified.

## Independent exact oracle and counterexamples

An affine synthetic source provides a complete independent oracle: x=10(1-t), y=10t, W=1, K=100, world Z=30v, t,v in[0,1], and the UV triangle0<=v<=t<=1. At radial range[1,2], integrate ordinary polynomial powers by `integral t^k=1/(k+1)`. In current raw order the ten exact added moments are

`[2250,35000/3,70000/3,22500,93750,281250,337500,93750,87500,262500]`.

For example V=(3/2)*100*30*integral t=2250 and Z=(3/2)*100*450*integral t^2=22500. All moment integrands have degree<=3, so Simpson's analytic remainder is exactly zero; finite estimate/interval rounding is still accounted for. This oracle is derived analytically here, not from the implementation or a source checksum, and has not been executed as a test.

Map the same triangle to native U[2,6],V[-1,3] while preserving t=(u-2)/4,s=(v+1)/4 and the same world source coefficients. The raw moments must be the same. This detects missing/duplicated native-span factors.

Further required later cases: a slanted trapezoid; concave polygon with several bands; strictly interior triangular/rectangular hole; two disjoint components; an island inside another component's hole if allowed; the misassigned-hole counterexample above; overlapping filled components; crossing/touching/duplicate segments; vertical edges and repeated U events; almost vertical positive-width slabs; Z entirely negative or crossing zero; affine bands degenerating only at a slab endpoint; rational crossing-order ties; all event/edge/slab/node/work/8192-bit limits; and atomic failure after earlier slab success. Polynomial sources permit independently derived exact fractions for all of these geometric moments without treating generic quadrature estimates as certificates.

## Full source mass and model-error separation

This receipt concerns the exact original stored product source over its exact UV polygon and radial range[1,2]. It is not the represented B-rep mass of the assembled rounded trim/side geometry. Composition positional residuals, actual trim/cap compatibility, closure and floating-point evaluator error remain separate gaps even after D300 projected loop embedding passes.

Do not add circle-defect or chart-map error to an exact stored-source integral as if those errors were quadrature error: the target already uses the stored coefficients and native UV. Those become separate terms only when comparing with an intended ideal circle/nominal arclength/font mapping. Nor may a blanket body-relative volume epsilon hide a missing small component or stroke. Relating this receipt to actual constructed trim geometry would need per-boundary correspondence/tube and symmetric-difference volume bounds with all components accounted for; no such transfer is supplied here.

The untouched full source cylinder is also absent. Ideal pi*R^2*H is an ideal/native source reference, not an exact stored-circle/B-rep oracle. A separate certified base receipt would need its actual source spans, angular coverage/closure and model authority. If both base and added-band raw intervals refer to proven compatible disjoint-interior sets, totals can be added componentwise. Generic `MassProperties.volumeBound`, quadrature coarse/fine differences, or a shape-only/tessellated estimate must not be promoted to that rigorous base certificate.

Only after a strictly positive total-volume lower bound and compatible raw receipts can interval arithmetic safely derive centroid/inertia bounds. Dependence may make those bounds wide; it must remain visible. No Part.mass provider, fullsource mass, general glyph wrap, native B-rep/solid, evaluator or combined-construction qualification is proposed for this initial polygon integrator.

## Alternative: bounded exact rational antiderivative reduction

If fixed-panel Simpson is too expensive or its certified width cannot meet an explicit request, a separate bounded Hermite-reduction candidate is reasonable. It replaces repeated U sampling with exact low-degree rational algebra plus rigorously enclosed endpoint transcendental terms. It is not an implemented speed/precision result and does not justify a larger operation or bit cap.

In a slab-local parameter r, the integrand is a rational P(r)/W(r)^m, m<=4, with numerator degree at most8 and positive quadratic W. Perform exact polynomial division, then Hermite reduction of the proper rational part. The exact result consists of a polynomial antiderivative, rational terms with powers of W, and a reduced linear numerator `(p*r+q)/W`.

**A logarithm term generally remains.** Let W=a*r^2+b*r+c, a!=0. Write `(p*r+q)/W = A*W'/W+B/W`, with A=p/(2a) and B=q-A*b. Its integral is

`A*log(W) + B*(2/sqrt(delta))*atan((2*a*r+b)/sqrt(delta))`,

when `delta=4*a*c-b^2>0`. Here delta is the negative of the conventional discriminant b^2-4ac. Slanted affine height factors can produce A!=0, even for the symmetric native denominator. Do not omit log(W) unless its coefficient is proved exactly zero for that particular moment/slab. The elementary counterexample integral r/(1+r^2)=log(1+r^2)/2 shows the missing authority if only rational and atan terms are retained.

The native quarter has exact stored endpoint weights1 and middle w near cos(pi/4), so after normalized original t, W=1-2(1-w)*t+2(1-w)*t^2 and delta=4*(1-w^2)>0. Recognize/prove this from the actual copied coefficients; never regenerate w or cardinal poles. An affine slab restriction preserves positivity and multiplies delta by its positive span squared. Constant W can take an exact polynomial path. Linear W or a different quadratic discriminant requires log/other formulas and separate admission; the first candidate can explicitly refuse those denominator families rather than pretending positive W alone implies the atan case.

Potential bounded endpoint machinery:

- Enclose the positive rational square root by charged integer inequalities at a fixed dyadic precision. A Number sqrt can be a candidate only. Prove both squared bounds exactly and refuse at the existing bit/work limit.
- Existing D297 fixed128 atan interval arithmetic and signed remainder logic can be reused after enclosing the algebraic endpoint argument by rational bounds and applying monotonicity. Native arguments can be proved small; for the symmetric full native span their magnitudes are sqrt((1-w)/(1+w))<.5 when the copied weights satisfy the corresponding exact bound. A generic quadratic cannot assume this.
- Evaluate the log difference as log(W(right)/W(left)), avoiding subtraction of separately rounded close logs. For positive rational R, set h=(R-1)/(R+1) and use `log(R)=2*sum[k>=0] h^(2k+1)/(2k+1)`. After N terms, an absolute tail bound is `2*|h|^(2N+1)/((2N+1)*(1-h^2))`. Check a fixed exact |h| bound, carry signed outward intervals, and refuse if it is not met. Existing atan's alternating tail is not a log/atanh tail and cannot be copied unchanged.
- Keep fixed term/root iteration limits and include rational reduction, integer work, coefficient growth and final interval evaluation in the same200000/8192 ledger. Rational Hermite coefficients and cancellation can be expensive or produce wide endpoint enclosures even with few function evaluations.

A first comparison should use exactly the same preserved source/UV polygon and all ten requested raw intervals against independent polynomial oracles and the existing certified Simpson path where it succeeds. Report actual interval widths, counts and preserved first failures. Neither D297's existing transcendental machinery nor the degree<=8 algebra proves in advance that this antiderivative path will meet the native contract.

Conditioning remains explicit: in a very narrow slab-local parameter, delta scales as span squared, so a fixed128 sqrt enclosure may acquire a zero lower bound and must refuse. Reducing in the original normalized t avoids that discriminant scaling but can enlarge the global affine-height coefficients and their cancellations. Select and measure one bounded representation; neither choice permits dropping the slab, increasing the cap or hiding its uncertainty in a body-relative epsilon.
