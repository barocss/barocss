# D301 exact stored radial side family: preliminary independent review

Status: read-only mathematics/ownership review, 2026-10-29. The side-family implementation is still being prepared by its owner and was not reviewed here. The current component continuation WeakMap registration was inspected. No repository edit, build, test, probe or subagent was made. This note does not extend D300's runtime/full-matrix evidence into D301 acceptance.

## Conclusion

The proposed theorem is sound under the complete exact coefficient/basis matching and authentic D300-component prerequisites. It proves regular injective individual side patches and the stated geometric pair intersections. It does not prove an actual B-rep's edge/twin incidence, carrier trim closure, orientation, material volume or floating-point evaluator accuracy.

## Exact represented surface identity

Let the stored rational cubic be B(t)=(Bx,By,Bz) on its original canonical t in[0,1], with positive weights. The actual outer cubic must have the same degree, knots, weights and canonical direction, and control points exactly T*p=(2px,2py,pz). The actual degree(3,1)4x2 side must have the two corresponding base/outer poles in each row, the same original U knots and duplicated row weight on both V columns, with radial V domain[0,1].

Its tensor denominator is then sum_i Bi^3(t)*wi, independent of r, and the numerator is `((1+r)*Nx,(1+r)*Ny,Nz)`. Therefore the **actual stored** Surface is exactly

`H(t,r)=((1+r)*Bx(t),(1+r)*By(t),Bz(t))`, t,r in[0,1].

This is coefficient algebra, not a sampled equality. Multiplication of a finite binary64 coordinate by two is exact whenever the result remains finite; the explicit native-range check prevents overflow and out-of-family geometry. Positive subnormal X is not rounded to zero by multiplication by two. Z, including signed zero bits, must be preserved in the structural matching rule.

Matching only edge endpoints or an outer curve's geometric image is insufficient. A reversed outer parameterization, different row weights, swapped surface columns, changed interior row, or transposed grid can destroy this identity. The stated strict canonical field matching correctly refuses these alternatives rather than sewing/reparameterizing them.

## Projection, injectivity and rank

D300 admission gives Bx(t)>0 throughout the complete interval: every stored X pole and weight is strictly positive. Define psi(x,y,z)=(y/x,z). Then

`psi(H(t,r))=(By(t)/Bx(t),Bz(t))=gamma(t)`

for every radial r, independently of r.

An authentic successful D300 component supplies strict progress in one projected coordinate, so gamma is injective and gamma' never vanishes. If H(t,r)=H(s,q), applying psi gives gamma(t)=gamma(s), hence t=s. Positive Bx then gives1+r=1+q, hence r=q. Thus each closed side parameter rectangle is injective.

Let rho=1+r, and J=Bx*By'-By*Bx'. The exact derivative cross product is

`Ht cross Hr=(-By*Bz', Bx*Bz', -rho*J)`.

If it were zero, Bx>0 would imply Bz'=0 and J=0, so both components of gamma'=(J/Bx^2,Bz') would be zero. This contradicts D300's strict progress. Thus every patch has rank2, including one-sided derivatives at its parameter boundary. A vertical/constant-slope edge is supported because its strict height derivative supplies the rank. No positive lower conditioning margin or finite-precision derivative accuracy follows merely from nonzero rank.

D300's narrower winding family remains the actual supported source family. The abstract rank theorem can cover more curves, but D301 must not widen source admission by accepting a hand-written progress flag or recomputing a weaker condition.

## Pair intersections and corners

For a nonadjacent D300 pair, the projected images are disjoint on complete original intervals. Any side intersection would give a shared projected point, so the two actual side images are disjoint.

For an authored adjacent pair, D300's cone proves exactly one shared projected point at the prescribed canonical endpoints. Individual injectivity makes those the unique parameters with that projection. D300's world endpoint comparison further gives one identical stored Cartesian point p for both edges. At these endpoints both actual sides contain exactly

`E={((1+r)*px,(1+r)*py,pz):0<=r<=1}`.

Every possible side intersection must lie there, and both sides contain all of E. Their intersection is therefore exactly that one radial segment. Positive px makes it nondegenerate. Adjacent endpoint weights may differ across curves: clamped rational endpoints still equal their Cartesian CPs, and each side separately cancels its own duplicated endpoint weight. There is no need to require equal weights between neighboring curves.

Traversal sense only selects which canonical endpoint is shared. It does not reverse the stored side's U parameter. The last-to-first corner needs the same sense-selected incidence as all other corners. Collinear smooth continuation can have matching tangent planes at the radial join without violating injectivity; a sharp corner need not be differentiable across faces. The theorem requires regularity of each patch and the exact intersection relation, not a globally smooth side normal.

If the full authentic ring incidence and all side pieces are present, these facts also give a continuous geometric embedding of the abstract finite ring-product strips: the only identifications are the authored shared radial joins. This statement is about mathematical Surface images. It is not a certificate that an external Brep contains one corresponding edge record, opposite coedges, compatible face senses or closed retained faces.

## Authentic continuation and complete actual-family admission

The inspected component module stores `result -> original ChartContext` in a module-private WeakMap only after every D300 pair/winding gate, final ctx.check, owned-input freeze and result construction. `chartComponentContext` retrieves by exact result identity without reading caller-supplied flags. A shallow copy, JSON roundtrip, frozen lookalike or object with projected-certified:true cannot acquire this capability.

D301 should obtain that original context first and immediately check it. The actual side-piece input is independently copied with ownSnapshot; the component result itself must never be copied and then treated as authentic.

Every component original curve must match exactly one actual base with all fields/bits, and every actual piece must be consumed once. Validate both set coverage and multiplicity, not only piece count or IDs. A duplicate/missing base with the same total count must refuse. Comparing to the component's complete original curve data is what transfers its progress and pair proof to the actual sides. Matching only names, endpoint samples, receipt signs or rounded shape bounds would not do so.

Check every actual outer and actual Surface field that enters the identity above, including kind, degree, knot-domain arrays, full pole grid, full weights and absence of unsupported extra data. Stored geometry IDs can identify the actual input but do not create a B-rep topology certificate. Historical producer/source provenance remains outside a bit-identical mathematical representation check.

## Shared resources and repeat calls

The retrieved context is the same live ledger used for D300, not a new200000 allowance and not a reconstruction from its frozen counts snapshot. All continuation proof arithmetic and structural scan work must be charged to its original arithmetic/work ledgers, with the same limits, and checked again before success. There is no need to reset its cached source charts or re-run pair proofs when the actual base data matches exactly.

A component's reported counts are a frozen snapshot of its original return time. Later continuation calls may already have consumed additional counters. D301 must use current ctx counts, including earlier successful or failed continuations, rather than subtracting back to that snapshot. A failed actual-piece check does not mutate caller geometry, but consumed proof counters need not and must not roll back. Retrying the same authentic component does not restore its budget.

The context's curve/node counts may include other legitimate work performed through that capability. Actual-family coverage must therefore come from the authentic component's own curves, not by assuming the current context count equals that family size. Resource exhaustion remains BUDGET; it is not an invitation to create a fresh context or accept a partial family.

The existing finite own-data snapshot limits and bounded proof serialization are separate implementation costs; the exact/direct ledger is not a count of every JavaScript instruction. No new unbounded loop or work allowance is justified by this theorem.

## Required implementation counterexamples and independent checks

These are test requirements, not executed results:

- An authentic simple outer ring and outer+hole family, including reversed uses and unequal adjacent endpoint weights, with all actual canonical pieces matching. Keep original curves/knots/weights unchanged.
- Change one actual base interior pole, degree, knot or weight by one represented step while keeping endpoints and names. It must not inherit the old component proof.
- Duplicate one actual piece and omit another with the same family count. Exact set coverage/multiplicity must refuse.
- An outer cubic with exact endpoints but wrong interior pole, reverse direction, proportional/different weights or changed Z. Matching only samples must not succeed.
- A side with correct base/outer boundaries but a changed row weight, swapped columns, wrong U basis/domain, wrong radial V domain or transposed grid. The actual tensor identity must be checked completely.
- A copied/JSON/frozen fake component receipt, a flags-only object and a getter-bearing fake. WeakMap authority must refuse before reading spoofed geometry/proof fields.
- Existing remaining arithmetic/work budget exhausted between component return and continuation; a late actual-family failure; and repeated calls. No reset or partial success.
- Exact allowed outer range versus a factor2 result outside10000. Refuse rather than changing the scale/height or clipping poles.
- Constant-slope/strict-height sides, negative Z, signed-zero identity differences and tiny positive X. The exact mathematical proof must not be rephrased as a numerical conditioning or CAD minimum-edge guarantee.
- Closing-corner endpoint order and nonadjacent/cross-ring pairs. Pair-side intersection receipts must reference the authenticated ring incidence and actual piece IDs consistently.

## Qualification boundary

Only actual stored side-family coefficient matching, individual regular/injective patches and the exact geometric pair intersection relations are supported by this theorem. Retained source faces, source/cylinder provenance, original native-UV trim binding, cap/basal/outer closure, B-rep incidence/orientation, a closed physical solid, represented volume/mass, global Number evaluator error, general text and a combined construction budget remain unqualified. No rule here turns an exact surface-image certificate into a full wrapped solid.


## Frozen implementation follow-up

The later actual-source review is recorded in `/tmp/barocss-wrap-side-family-source-review.md`. No material false acceptance was found in that static inspection. No source or test was executed by this reviewer; Root's runtime evidence remains separate.
