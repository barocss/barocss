# D303 native D0 family: independent design review

Status: read-only design challenge, 2026-10-29. This note reviews the proposed D303 family contract and the unchanged D302/native evaluation mathematics. The in-progress D303 implementation is not inspected or approved here. No repository source edit, build, test, feature probe or subagent was made. Root's D302 focused/full evidence remains separate.

## Conclusion

The proposed one-envelope/one-worst-template certificate is sound. Its nonnegative error recurrences are monotone in basis error, weight maximum, coordinate magnitudes and active term count, and antitone in the positive denominator minimum. Therefore the degree3-by-degree1 eight-term template with a global actual-data envelope dominates every listed source and every explicitly admitted two-span branch.

This is an amortized bound, not a throughput or precision guarantee. Forcing all axes nonconstant is conservative and necessary to avoid incorrectly transferring a single active-span constant-coordinate shortcut to an original multisource/multispan cached evaluator. Standalone D302 policy, result fields and operation counts must stay unchanged.

## Explicit original two-span operation path

The new additional Curve template is degree2 with five poles and exactly

`[a,a,a,m,m,b,b,b]`, with exact m-a=b-m=.5 and a,m,b in[-1,1].

The matching Surface is degree(2,1),5x2 poles, the same U template and an admitted single degree1 V span of exact width.5 or1. The one-span D302 families remain separately admitted; no general knot-vector theorem is introduced.

For u<m, the native span search chooses span2 and start pole0. At levels1 and2, every active left knot is a and every active right knot is m. Thus distances are u-a and m-u and every fraction denominator is exactly.5 before rounding.

For u>=m, including u=m itself, the search chooses span4 and start pole2. At both levels, left knots are m and right knots are b. Distances are u-m and b-u and the denominator is again exactly.5. At u=b, the explicit right-endpoint branch also chooses span4. At u=m, the right span returns its first pole, which is the original shared pole2; the mathematical target is continuous there, but no derivative or bit-identity-with-a-rebuilt-curve theorem follows.

Because the full global endpoints remain in[-1,1], basisInto scale is still exactly1. Exact active distances are in[0,.5], so D302's rho(1) subtraction bound and hMin=.5 fraction bound remain conservative. Nonfinite-distance fallback and zero denominator are excluded by the same proof as before. The binary search uses only exact finite comparisons and small integer indices; midpoint selection is not a floating inverse/normalization operation.

Important implementation trap: D302's one-span helper reads right=`knots[degree+1]`. For this five-pole source that index is3 and holds m, not the full right endpoint b. D303 must extract the original domain using right=`knots[controlCount]` (index5 here), check **both** half spans exactly, and inspect all five/ten stored poles and weights. Merely passing the first active span through the old helper would not be a whole-source family admission.

## Monotone domination by one worst template

Let f be D302's common fraction error. Its positive basis map is

`P(E)=E+f*(1+E)+rho((1+f)*(1+E))`,

`Next(E)=2*P(E)+rho(2+2*P(E))`.

On E>=0 every operation is monotone and Next(E)>=E. Hence E1<=E2<=E3. The tensor error

`Tensor(Eu,Ev)=Eu+Ev+Eu*Ev+rho((1+Eu)*(1+Ev))`

is monotone in both arguments and dominates Eu. Therefore `Eworst=Tensor(E3,E1)` covers:

| Actual family | Basis error dominated by Eworst | Active terms <=8 |
| --- | --- | --- |
| One-span degree1..3 Curve | Ep<=E3<=Eworst |2..4|
| One-span degreeU1..3 by V1 Surface |Tensor(Ep,E1)<=Eworst|4..8|
| Original two-span quadratic Curve, either branch |E2<=E3<=Eworst|3|
| Original two-span quadratic by V1 Surface, either branch |Tensor(E2,E1)<=Eworst|6|

The exact active basis is nonnegative and partitions unity, including at a clamped endpoint or the repeated interior knot. Thus D302's ordered partial-sum magnitude bounds apply within each branch, using only its active three or six terms. Bounding by eight positive recurrence steps is conservative; the extra steps enlarge an error bound, not the mathematical source sum.

Compute actual global m=min(all weights), M=max(all weights), and A_axis=max(abs(all stored CP coordinates on that axis)). Every source/branch satisfies m_i>=m, M_i<=M and A_i<=A. The factor/coordinate-product error recurrences and ordered accumulation are monotone in their nonnegative inputs and count. Thus Dworst>=D_i and Tworst>=T_i. With m-Dworst>0,

`(Tworst+A*Dworst)/(m-Dworst)`

and its rounded final division term dominate each member's projection error. The D<=m/2 finite guard remains conservative too. Combining per-axis bounds is valid for every member even when different objects supply the different axis maxima.

No caller-provided bounds, template flags or producer names can establish this envelope. It must be computed from every copied actual coefficient. An outlier in an inactive half-span is still within the claimed complete parameter domain and must affect admission/ranges.

## Global authored constants and caches

The native slow and cached evaluators restore an axis only when Object.is holds over the **full original stored object**, not its active span. A five-pole curve can have the first three X coordinates equal while its last two differ. The left span's mathematical X is then constant but the original evaluator's full-object restoration predicate is false. A copied three-pole certificate with axis error0 cannot automatically be transferred to that original call path.

The family rule forces every axis through the general error formula, so it covers both cases: an original global constant is restored exactly and has actual error0<=family bound, while an active-only constant without restoration receives the full forward bound. Mixed+0/-0 poles also remain covered without classifying them as an authored constant. This may make a fully constant family refuse an extremely tight requested budget that a standalone D302 constant source accepts; that is deliberate separate-family conservatism, not permission to change D302.

curveEvaluator and surfaceEvaluator still use the same full-source cached predicates and same basis arithmetic. Reusing a successful U/V basis at an identical Object.is parameter creates no extra rounding or stale branch. At m, m-ulp and m+ulp, separate computations/cached transitions must respect the actual span choice. No generic Bezier evaluator or derivative path is substituted.

## Repeated IDs are not authority

Actual native coedge pcurves can legitimately reuse id='pcurve' while having different geometry. The D0 family certifies numerical evaluation of each object; it is not a Model/B-rep identifier registry. Global ID uniqueness is unnecessary and would reject valid data.

Preserve each original array slot, its kind and full snapshot. Do not rename IDs, deduplicate by ID or overwrite a Map entry keyed only by ID. Repeated IDs with different CPs/weights/domains must each be fully validated, counted against the object/pole caps and charged for scan work. Even repeated identical source values remain separate admitted slots under the declared intake caps.

A later binding consumer must match an actual evaluator source to the intended slot and its complete unchanged fields, not look up a family bound by the repeated ID alone. Returning one common bound does not remove this source-binding requirement. This introduces no schema, migration or ID-repair path.

## Input and shared resources

A fixed family can admit at most64 objects and512 stored Point triplets. The stored-pole tally counts all five/ten poles of a two-span source, including poles inactive at a particular parameter. It must not count only active terms, use the three-axis coordinate count instead of poles, or count only unique IDs.

Copy the complete family once under one finite own-data budget, then validate every actual kind/field/degree/knot/grid/weight/coordinate record. Do not reset an independent large snapshot budget or a q context for every array member. The arithmetic, direct integer work and charged structural inspection must belong to one request ledger with the unchanged200000/8192/1048576 ceilings. State clearly which structural operations are included in each returned work counter; do not describe it as every JavaScript CPU instruction.

The family performs the common f, worst basis, eight-term denominator/numerator and final bound calculations once, after complete admission/envelope formation. It must not call the standalone certificate per member and sum independent200000 allowances. Options may only tighten existing operation/error policy; no caller may widen object/pole/template limits or supply a pre-certified envelope.

The new family entry point is separate. Shared-core refactoring must keep old D302 calls in the same arithmetic order, retain old constant-axis behavior/result fields, and leave old count keys/values unchanged. Family-only structural accounting or a forced-nonconstant option must not silently add work to old single-source paths. This preservation still needs Root's implementation/differential tests; the design theorem does not prove emitted runtime equality.

## Required independent counterexamples and regression boundaries

These are proposed tests, not executed evidence:

1. Every one-span degree family and the two-span Curve/Surface at a,m,b and the nearest valid representable neighbors of m, including m=0 with +/-MIN_VALUE, negative domains, repeated cached U and V and failed/outside-domain calls. The exact oracle must select poles0..2 before m and2..4 at/after m.
2. Incorrect middle multiplicity, two distinct interior knots, only one half width.5, widths that round to.5 under Number subtraction but are not exactly.5, large translated domains despite half-widths.5, and unsupported V spans/degrees. Refuse the undeclared template instead of extrapolating the proof.
3. An active-only constant axis such as first three X coordinates=.1 and later coordinates different, with nonuniform weights. Its family bound must not be zero. Also test globally constant and mixed+0/-0 axes; standalone D302 constant-zero receipts must remain unchanged.
4. Global envelope extrema supplied by different objects/axes, and a tiny or excessive weight/CP located only in the other half of a two-span source. Every actual source contributes to the envelope/admission, regardless of sampling or active branch.
5. Repeated id='pcurve' with different degrees, knots or coefficients; repeated IDs across kinds; repeated identical values. Preserve all slots and their full snapshots with no rename/dedup. A later source lookup by ID alone must not be used as binding authority.
6.64 valid low-cost objects followed by a65th to isolate the object cap;51 two-span5x2 surfaces(510 poles) plus a two-pole curve for512, or plus a three-pole curve for513, to isolate the pole cap while staying below64 objects. Count every stored pole, not active poles or unique IDs. Valid cap-sized inputs still must meet operation/error budgets.
7. A too-tight one shared operation budget, structural work exhaustion,8192-bit arithmetic failure, malformed/accessor/foreign/sparse data, unsupported metadata/template flags and immutable/no-alias output. A late outlier or failure returns no partial family certificate.
8. Compare actual native D0 errors against an independent exact piecewise Bernstein oracle for all source slots. Sampled comparisons remain regression evidence; the positive recurrence supplies global authority. Preserve D302's existing per-source policy/results/counts with explicit before/after regression checks.

## Precision and qualification boundary

One global envelope is intentionally coarse. Mixing large world coordinates with small UV pcurves can inflate the shared pcurve coordinate error, and a later carrier Lipschitz factor may make native binding fail even when this D0 L1 budget passes. The family theorem does not promise a useful coedge tolerance for every64-object mixture. A future tighter grouping strategy would still need one combined ledger and actual-data envelopes; it cannot reset allowances or accept caller numeric bounds.

The certificate applies to finite binary64 parameters inside each object's complete exact stored domain and to unchanged stored coefficients. It does not certify arbitrary mutable cached evaluator state after edits, pcurve-to-surface domain safety, derivative/Lipschitz estimates, coedge/vertex binding, source closure, topology, mass, whole native B-rep evaluation or a complete construction request. D0 family amortization is useful independent work, but all of those other flags remain false.
