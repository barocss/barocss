# D301: Native D0 evaluation certificate and the next closed-solid contract

Status: read-only source audit and implementation plan, 2026-10-29. No source was changed. No build, test, benchmark, probe or new provider execution was run for this audit. The D298 numbers below are recorded evidence, not new measurements. D300's matrix is owned by the parent.

Repository root for every path below:
`/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`.

## 1. Recommended immediate implementation

Implement a private **certificate of the existing native D0 evaluator**, without changing the evaluator. It must prove the error for every finite binary64 parameter in the admitted domain. This closes the current `globalEvaluatorErrorCertified:false` gap for a stated family. It is useful independently of a new shape diagnostic: the certificate can be added to the existing whole-span coefficient binding proof and checked against each edge's existing tolerance.

Start with these exact families:

* A single clamped rational Bezier curve, degree 1..3, `degree+1` poles, one positive span of exact width 0.5 or 1.
* The actual tensor surfaces: degree 1x1 planes and degree 2x1 or 3x1 carriers/sides. A later degree 1..3 by 1..3 extension is possible with the same recurrence but is not needed for the first patch.
* Stored domains lie in [-1,1], so `basisInto`'s scale is exactly 1. Original native domains [0,0.5], [0.5,1] and [0,1] are included. Merely having width 0.5 or 1 with a large translated knot domain is not sufficient for this first implementation.
* All poles are finite and have absolute coordinate at most 10000. All weights are in [0.5,1]. The native quarter, the second quarter's distinct actual weight, stored composed cubics, direct vertical cubics and cap pcurves must be checked against this interval; do not infer the interval from their producer name.
* Parameters are finite binary64 values inside the exact stored domain, including endpoints, the interior repeated knot and subnormals. No assumption that arbitrary subtraction is exact is permitted.
* D0 only. This certificate does not certify derivative evaluators, normals, quadrature nodes, a Number implementation of the inverse map, or arbitrary knot vectors.

Suggested private module names are `core/native-d0-bound.ts` and a matching test file. Suggested functions are `certifyNativeCurveD0` and `certifyNativeSurfaceD0`. Return the owned source snapshot, exact per-axis and L1 upper bounds, supported operation-template identity, domain, weight/coordinate bounds and charged counts. Bounds must be exact rational or outward intervals. Optional caller error budgets and operation limits may only tighten admission. A certificate result must not expose a replacement evaluator.

The original half-wall has five U poles and two quadratic spans. Support it by a separate, explicitly checked two-span template, or certify each direct-copy quadratic span after proving that the original `basisInto` operation path is the same on that span. At U=0.5 the original code selects the right span; the endpoint check must cover that branch. Do not claim that a generic knot insertion, reparameterization or mathematically equivalent Bezier evaluator has the same Number error.

## 2. Source pointers and current gaps

| Path and symbol | Current behavior | Obligation for the next support slice |
| --- | --- | --- |
| `src/core/math.ts:124 basisInto` | Actual scaled Cox-de Boor operation order and binary span search | Certify this order, including floating distances, fractions and zero-denominator branch policy |
| `src/core/math.ts:172 curvePoint`, `:191 surfacePoint` | Nonnegative basis/weight factors, ordered sums and rational projection | Forward-error bounds against exact evaluation of the stored coefficients |
| `src/core/math.ts:224 curveEvaluator`, `:242 surfaceEvaluator` | Documented bit-identical arithmetic; surface caches identical U/V basis | Certificate applies to these calls after their operation-order identity is tested; cache reuse changes no arithmetic value |
| `src/brep/brep-core.ts:23 BrepCoedge.pcurve`, `:257 checkBrep` | A pcurve is a native `Curve`; it is evaluated by `evaluateCurve`, then `evaluateSurface` at its computed UV | Add pcurve D0 error, exact carrier Lipschitz bounds and domain safety to the whole-span binding proof |
| `src/features/cylindrical-wrap-curve.ts:237 bound` | Exact homogeneous cross residual bounds stored cubic versus the exact original carrier of the exact affine UV line | Already a model-coefficient bound; not a Number evaluator bound |
| `src/features/cylindrical-wrap-assembly.ts:458 horizontal template`, `:476 vertical`, `:490 base`, `:534 side` | Exact axial replacement, direct vertical curves, exact factor2 XY outer clone and degree3x1 sides | Reuse those receipts; add native D0 and UV rounding instead of recomposing or moving poles |
| `src/features/cylindrical-wrap-source.ts:161 sourceCore` | Exact all-field equality to the native producer plus strict B-rep check; original clone returned | Prove a coherent full reference boundary and original cap trim binding; equality alone proves consistency, not that theorem |
| `src/features/prismatic-solid.ts:210 curveOf`, `:249 wall`, `:258 cap UV` | The same native arc curve is extruded; caps use a rounded affine inverse on every pcurve pole | Certify original wall/edge identity and cap lift residual; preserve all original bits |
| `src/features/extruded-profile-solid.ts:192 segmentCurve` | Native trig-produced intermediate poles, actual weights, supplied exact endpoint poles | Keep actual original endpoint and weight bits, including the negative-Y half's different weight |
| `src/features/cylindrical-wrap-moments.ts:228 cylindricalWrapMoments` | Separate, added-only ten-moment Simpson enclosure | Not complete body mass, not the literal assembled surface integral, not an integrated 200k request |
| `src/brep/solid-mass.ts:51 prismaticMassProperties` and `src/brep/curved-arrangement.ts:686 regionMoments` | Upright source mass uses formal circular arc data | Nominal arc mass is not a proof of the stored rational carrier's exact volume |
| `src/part/part-model.ts:4463 massPropertiesOf` | Existing private `part.mass` callback overrides upright/B-rep defaults | Reuse this route when the complete reference/mass contract is implemented; avoid unrelated public schema additions |

The current native binding check samples same-t pcurve and edge evaluations and accepts `gap <= edge.tolerance`. Its domain test includes a 1e-9 UV slack and then clamps UV to the domain. A new global proof must cover its own true domain/range or its actual clamp path. It must not borrow a looser sampled strict-geometry limit as its admission tolerance.

`numeric-policy.ts:40 chartRoundingBoundMM` is an affine-plane rule. It is not a cylindrical derivative bound. `linearToleranceMM` and the existing edge/vertex tolerances remain authoritative. CoordinateAbs remains 10000; no new unit system is needed.

## 3. Concrete forward-error calculation for the actual evaluator

Use binary64 round-to-nearest unit roundoff `u=2^-53` and the absolute subnormal allowance `eta=2^-1074`. A safe elementary rounding function is

`rho(B) = u*B + eta`, for a nonnegative finite bound B on the exact pre-rounding result.

This is intentionally safe rather than half-ulp tight. All formulas below are evaluated exactly or outward; their evaluation is charged. Overflow and non-finite intermediates must be excluded from the admitted coordinate/weight/degree bounds. Underflow is included through eta, even for MIN_VALUE parameters. Use the same shared request accounting as the other helpers.

### 3.1 Distances and fractions

In the supported templates scale=1, all exact active distances are in [0,1], and each denominator in the Cox-de Boor fraction is the positive span width h in {0.5,1}. The zero-denominator branch is therefore unreachable for these templates, including t at a clamped endpoint. Reject an unsupported knot template rather than assuming this for arbitrary repeated knots.

A uniform subtraction-error bound is `ed=rho(1)`. Both positive distance operands stay nonnegative under rounding. For the rounded denominator addition use

`eSum = 2*ed + rho(1 + 2*ed)`.

Require `hMin-eSum>0`, with hMin=0.5. A bound for either computed fraction relative to its exact fraction is

`f = (ed + eSum)/(hMin-eSum) + rho((1+ed)/(hMin-eSum))`.

This expression is conservative and valid without Sterbenz assumptions. A tighter implementation may use the actual h in each template and the exact bound h on the numerator, but may not silently omit a rounded subtraction or addition. Computed fractions are nonnegative. Their exact targets are in [0,1].

### 3.2 Basis recurrence in the existing loop order

Let E be a bound on each previous-level computed basis value minus the exact basis value. The exact previous values and exact fractions are in [0,1]. For either rounded fraction product, a safe error bound is

`P(E) = E + f*(1+E) + rho((1+f)*(1+E))`.

The two products are then added for a new value, while the saved branch contains just one product. The common next-level bound

`E_next = 2*P(E) + rho(2+2*P(E))`

covers both branches. Begin with E0=0 and iterate exactly degree times. The final scalar basis bound is Ep. This recurrence also covers additions to a saved zero; it does not require a floating partition of unity.

The tensor product basis is rounded before multiplying by the stored weight. For degrees p,q, use

`Euv = Ep + Eq + Ep*Eq + rho((1+Ep)*(1+Eq))`.

Curves use Eb=Ep. Surfaces use Eb=Euv. A more precise per-entry DAG can reduce the bound, but this fixed small recurrence is already implementable without evaluating any sample parameters.

### 3.3 Factors, sums and rational projection

Let m=min(weights), M=max(weights), A=max(abs(pole[axis])), and N be p+1 for curves or (p+1)(q+1) for surfaces. For each rounded factor and coordinate product use

`Ef = M*Eb + rho(M*(1+Eb))`

`Et = A*Ef + rho(A*(M+Ef))`.

The exact basis is nonnegative and partitions unity. Therefore every exact partial denominator sum is at most M, and the absolute value of an exact partial numerator sum is at most A*M, even if pole coordinates have mixed signs. This avoids an unnecessary factor N in each summand's magnitude bound. Accumulate errors in the actual source loop order:

`D0=0; Dnext=D+Ef+rho(M+D+Ef)`

`T0=0; Tnext=T+Et+rho(A*M+T+Et)`.

After N steps require `m-D>0`. The exact projected coordinate is in [-A,A]. A safe bound for the final rounded division is

`Eaxis = (T + A*D)/(m-D) + rho((A*M+T)/(m-D))`.

If the source's authored constant-coordinate invariant is established by the exact same `Object.is` predicate as core/math, the final restored axis is exact; its bound may be zero. Other axes still need the full calculation. Do not assume mixed +0/-0 poles meet that predicate.

These expressions give a concrete finite proof with at most a few degree-dependent recurrences, not a count of sampled successes. Rough hand estimates for the actual 3x1, eight-term, weight>=0.5, coordinate<=10000 case are on the order of 1e-8 in the sum of coordinate errors, below the native 1e-7 floor. This is a feasibility estimate, not a computed receipt. The first implementation must return its exact bound and reject when the actual combined edge budget is exceeded. It need not accept every input at the largest coordinate bound.

### 3.4 Binding actual pcurve evaluations

For stored edge C and pcurve P on a surface S, first retain the current exact-model binding proof

`|C(t)-S(P(t))|_1 <= bStored`.

Certify exact mathematical carrier derivative bounds LU,LV, for example with positive-denominator Bernstein quotient bounds for `(Nu'W-NuW')/W^2` and the corresponding V expression. These are bounds on the exact stored surface, not on a native D1 routine. Then

`bNative <= bStored + eCurve + eSurface + LU*eP_U + LV*eP_V`.

Use L1 coordinate bounds consistently. Account for any domain clamp explicitly. For interior footprints, prove the pcurve error tube stays inside the original domain. For canonical unit-edge pcurves, prove the actual nonnegative numerator/denominator arithmetic cannot leave [0,1]; identical summation order and monotonic correctly rounded multiplication can support this proof. Constant pcurve coordinates are restored exactly by core/math. A pcurve ending on a noncanonical domain boundary needs its own exact range argument; an error magnitude alone does not prove that `evaluateSurface` will not throw outside its domain.

Require the total bound at every coedge to be no greater than that edge's own unchanged tolerance. Include original cap coedges and original wall coedges, not only new curves. Apply endpoint-to-vertex bounds too, with the actual vertex tolerance. Do not auto-increase an entity tolerance or the caller's requested error to make a certificate fit.

The certificate closes global D0 and native-binding uncertainty for admitted templates. It does not alone prove global trim embedding, a closed physical reference, or mass.

## 4. Smallest closed reference family after D0

Use one outward rectangular pad on the existing origin-centered +Z native closed single-slab circular source. Keep the pad strictly inside the selected positive-Y quarter in original native UV, h=R and exact factor2 XY. Exclude holes, multiple strokes, diagonals, arbitrary glyphs, full inverse mapping and text/UI wiring for this first qualified family.

One rectangle uses one horizontal composition interval, reused at two axial levels and in both directions. D298 ring+stroke used three distinct horizontal compositions. The smaller family should leave substantially more budget for source/evaluator/mass proof. This is a source-based work estimate; it has not been measured.

Choose and state a mass/geometry authority. Two different authorities are possible and must not be conflated:

1. **Existing native formal source plus a closed ideal reference pad.** The source remains the authored circular slab, consistent with `prismaticMassProperties`. The pad angular endpoints come from certified angles of the actual native carrier at its stored U endpoints. Every original/new stored B-rep patch and trim must be certified within existing native tolerances of this closed reference. Formal source mass is nominal circle mass by definition; it is not called the exact stored-carrier mass. Radius defect belongs in the representation error ledger.
2. **Closed actual-rational reference source plus actual-rational UV pad.** Source cross-section is the original four rational spans; each pad is the exact carrier over the exact rectangle with exact factor2 radial homothety. This authority needs actual source and pad moment bounds, and its result may differ from nominal pi*R^2*H. The literal stored cubic trim/surface pair is still only tolerance-bound to this closed reference, so it is not called an exactly coincident analytic shell.

The first authority follows the existing upright semantic mass path and is the smallest implementation. The second provides a useful additional actual-rational mass receipt. Neither choice licenses changing old surface coefficients, vertices, weights, names, pcurves or tolerances. A tolerance-bound B-rep must explicitly state the closed reference it represents. A small sampled gap is not that definition.

For either reference, whole-span regularity, correspondence and positive basal support are required. Use exact angular monotonicity, positive denominators, strict axial height and strict chart separation. Prove that the stored sides correspond one-to-one to the reference pad sides inside the clearance tube, with shared corners/radial edges. A Hausdorff distance by itself does not prove topology or determine a literal enclosed volume for noncoincident records.

Full-source closure is tractable for the actual producer. `segmentCurve` sets first/last poles from the shared supplied endpoints, with weight1, and each `extrudedSurface` copies the same XY coefficients into both V columns. The selected quarter is not the complete source proof: audit both original half walls and all four spans. Actual negative-Y weights can differ by one ulp. For a star-shaped reference proof, certify positive angular derivative on every oriented span, exact shared endpoints, and each span inside an open half-plane through the axis. Four such spans have positive total turn less than 4*pi. Closed nonzero winding then forces exactly one turn. Prove these statements from the actual coefficients and coedge senses; do not replace the second half by ideal pi parameters.

Original cap surfaces are affine 1x1 planes. Their stored cap pcurves were obtained by rounded affine inverse per pole. Lift these pcurves through the exact affine surface and bound the coefficient residual to the original common world edge, then add D0 errors. Alternatively keep an exact affine inverse only as internal reference proof data. Never rewrite protected pcurves to make their residual vanish.

## 5. A tighter, native-family mass route

D298's panels8 added volume is 2192.3394307508997 +/-1.9005899585893957 at 180216 operations. It is a valid added-band enclosure but too broad to establish native mass precision. More panels or a fresh second 200k ledger is not the next default.

For this near-circle native family, use the already certified circle defect rather than a broad global fourth-derivative Simpson hull. Let exact carrier polar radius satisfy `R-delta <= r(theta) <= R+delta`, with delta from the exact Q=(X^2+Y^2)-R^2*W^2 bound and a positive denominator. Require R-delta>0.

For x^a*y^b, a+b<=2, set p=a+b+2. The scale2 band transverse moment is

`((2^p-1)/p) * integral(theta0..theta1, r(theta)^p*cos(theta)^a*sin(theta)^b dtheta)`.

Its ideal-R value has elementary angular integrals:

* 1: theta1-theta0.
* cos: sin(theta1)-sin(theta0).
* sin: cos(theta0)-cos(theta1).
* cos^2: (theta1-theta0)/2 + (sin(2theta1)-sin(2theta0))/4.
* sin^2: (theta1-theta0)/2 - (sin(2theta1)-sin(2theta0))/4.
* cos*sin: (sin(theta1)^2-sin(theta0)^2)/2.

Use existing rational fixed128 atan/Machin enclosure logic for the two actual endpoint angles, without constructing inverse grid nodes or rounded s nodes. Refactor a shared charged angle primitive if necessary; do not duplicate an uncharged arithmetic context. Sin/cos can be enclosed from stored endpoint x/R,y/R with delta/R error and intersection with [-1,1], avoiding a new sqrt/transcendental evaluator. Identities for sin(2theta) then use outward interval products.

The actual-rational moment differs from that ideal-R sector value by at most

`((2^p-1)/p) * DeltaThetaUpper * max((R+delta)^p-R^p, R^p-(R-delta)^p)`.

Multiply by the absolute exact axial integral for each z power. This follows from |cos^a*sin^b|<=1 and strict angular progress; it is a whole-interval bound. It is small when the actual source coefficient radial defect is small, independent of Simpson panel count. It is an actual-rational reference bound, not an assertion that the stored carrier is an ideal circle.

For the full source actual-rational receipt, after proving one complete winding, use the full ideal cylinder moments plus a radial shell perturbation bound. Replace the sector angular factor by 2*pi and the radial scale2 factor by 1. Odd ideal transverse moments are zero, but their absolute perturbation bounds remain nonzero. This explicitly encloses the nominal-versus-stored source discrepancy.

Use an origin on the cylinder axis and a centered axial coordinate for the ten integrals. Propagate intervals through centroid and central inertia, including Number conversion and final division/multiplication rounding. `solidMassFromIntegrals` currently uses Number arithmetic on raw moments and accepts any positive finite density; a certificate must also refuse unrepresentable mass/inertia instead of returning Infinity. D23 already establishes the centered-coordinate/parallel-axis direction for avoiding distant-body cancellation.

For the formal-reference authority the ideal sector values are the target mass; radial defect is a representation bound. For the actual-rational authority include the shell perturbation terms in the target moment intervals. Neither path may say that an arbitrary tolerance-close boundary has the same exact volume. Keep explicit per-moment budgets; propagate to the actual public centroid/inertia values before acceptance.

D24's existing property-test tolerances are 1e-9 relative for closed-form/planar, 2e-5 for quadrature and 2e-3 for tessellated. These are method conformance criteria, not a universal absolute geometry/mass tolerance. Do not relabel a broad enclosure as precise because it is positive. `MassProperties.volumeBound` is documented as a tessellation convergence estimate only; do not repurpose it silently as a rigorous quadrature error field. Private receipts and the existing `part.mass` override are enough for the first integration.

Surface area is a separate obligation. A D0 or volume certificate does not certify native surface-area quadrature. Keep its existing method semantics explicit until its own bound is provided.

## 6. One request budget and honest refusal

The recorded ring+stroke assembly costs 185431 aggregate operations. The recorded separate panels8 moment helper costs 180216. Their sum does not satisfy a 200000 integrated request. A complete operation must charge source, all four source spans, composition, topology, D0, endpoint angles, moments and interval-to-public-value conversion to one bounded ledger.

Keep 200000 exact/direct operations, 8192-bit integer limits and existing work caps. Pass remaining limits to helpers and account for all their charged work. No context reset, hidden retry, unused inverse-grid generation or new aggregate allowance is justified by this plan. The single rectangular pad plus one reused horizontal template and angle-only sector moments is the smallest promising implementation. Measure it before claiming it fits. If it does not fit, optimize exact duplicate work or refuse; do not increase a tolerance or user maximum.

For a strict first feature, any unsupported knot/weight/evaluator branch, unproven pcurve range, missing source trim proof, nonpositive basal support, mass interval too wide, unresolved topology or exhausted budget remains a typed atomic refusal. The admitted input is immutable. Partial diagnostics must not escape as a successful Part.

## 7. Independent evidence for the next implementation

1. Prove the D0 formulas in code at fixed admitted templates and test their exact returned bounds. Regression-evaluate the unchanged `evaluateCurve`, `curveEvaluator`, `evaluateSurface` and `surfaceEvaluator` against independent exact rational evaluation at dyadic, non-dyadic binary64, MIN_VALUE, endpoint, next-representable-neighbor and repeated-knot parameters. Those observations test the implementation; the operation recurrence supplies the global proof.
2. Test all degree1..3 admitted curves, actual 1x1/2x1/3x1 tensors, mixed-sign coordinates, exact constant-axis restoration, mixed +0/-0 poles, weights0.5/1 and actual native quarter weights, and coordinates near +/-10000. Include unsupported large translated domains, tiny knot spans, foreign mutable/accessor data, weights outside the family, too-tight error/operation budgets and non-finite inputs. Preserve INPUT/SUPPORT/BUDGET distinctions.
3. Independent source fixture: retain both actual half-wall coefficients, including the second weight bits. Validate source four-span rational integral against an independent high-precision or exact-rational-plus-certified-integration oracle. Check nominal pi*R^2*H lies only in its correctly named formal or discrepancy receipt; never demand false bit identity with stored-carrier volume.
4. Independent one-rectangle mass oracle: analytic annular-sector formulas at canonical quarter/half-quarter angles, plus the exact radial-defect shell enclosure for actual native coefficients. Keep the existing synthetic polynomial all-ten-moment rational fixtures. Expected values must not be computed by importing the candidate helper.
5. Binding counterexamples: original cap UV rounding, a pcurve perturbation just outside its own unchanged edge tolerance, a Number UV error tube that leaves the domain, and a very small positive thickness/gap. Each must be globally proved or refused, regardless of sampled strict-B-rep success.
6. Integration: complete request counts <=200000, strict closed one-body topology, positive basal support/removal-free outward growth, protected original all-field equality, original immutability and atomic failure. Assert `globalEvaluatorErrorCertified:true` only after its actual native evaluator receipt is used. Assert a physical/volume qualification only after the chosen closed reference and complete mass receipt are consumed by the successful output path.

## 8. Order and completion boundary

1. Implement and validate the unchanged-native D0 certificate. This is a real reusable theorem about the production evaluator, not a substitute evaluator or another sample-only geometry diagnostic.
2. Consume it in the existing coedge binding ledger, including original source caps/walls and vertex endpoints. Narrow support or refuse if its exact total cannot fit the unchanged tolerance.
3. Add the single rectangular pad's explicit closed-reference/source consistency and centered ten-moment contract under one request ledger. Use the nominal-source versus actual-rational distinction above.
4. Integrate this bounded native family only when all three receipts are consumed. General glyph diagonals, holes, multiple strokes, inverse nominal-length text, Model/API/Studio and general wrap remain later work.

No new implementation or runtime evidence is claimed by this document. The next immediate source patch can be isolated to the private D0 module and its independent tests; public schema/index/Part wiring is unnecessary for that proof.
