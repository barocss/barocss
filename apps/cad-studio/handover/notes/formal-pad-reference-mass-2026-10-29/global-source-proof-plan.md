# Minimal complete native-source radial graph proof

Source-only plan, 2026-10-29. No repository source was changed. No geometry execution, probe, build, test, benchmark or commit was run. This plan does not qualify a product wrap, literal stored B-rep volume or mass transfer.

Repository paths below are relative to:
`/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`.

## 1. Actual producer facts, separated from numeric receipts

`src/features/prismatic-solid.ts:76 prismaticFromProfile` builds a circular profile and sends its line/arc rings through `booleanCurveRegions`. `src/brep/curved-arrangement.ts:420 halves` splits an arc larger than a half turn, and arrangement/reversal/simplification can retain shifted binary64 t0/sweep values. Those stored values are not two universal Math.PI literals.

`src/features/cylindrical-wrap-source.ts:86 circleRegion` constructs the same current native source at the actual radius, matches the two stored t0/sweep pairs exactly once each, and refuses other pairs. It does not overwrite the actual arcs. `sourceCore` at :161 reconstructs only for complete own-field/Number-bit/array-order comparison and returns an original snapshot. Its quarter extraction directly copies rows and reports zero knot insertions. Historical producer authenticity remains false.

No retained angle dump with the second t0/sweep numbers was identified in this review. Therefore this note does not assign new numeric literals to those values or infer them from ideal angles. The current source comparison mechanism, not a guessed decimal, is the authority for those arc parameters.

Canonical B-rep pieces are a different orientation layer. `prismatic-solid.ts:187..210` gives each piece the global-point lo->hi direction; it can call `segReverse` on an original arc. `profileSegment` at :161 preserves that piece's actual startAngle/sweep while supplying its endpoints from the common PointSet. `segmentCurve` in `src/features/extruded-profile-solid.ts:192` computes intermediate poles and middle weights with Math.cos/sin but copies the supplied first/last Cartesian poles and assigns endpoint weights1. Do not regenerate those poles from radius/cardinal coordinates.

### Preserved R10/H30 coefficient evidence

Read-only evidence: `/tmp/barocss-native-d0-family-receipts.json`, surfaces0/1 at approximately lines2637..2890, and world curves0/4. This is an existing receipt, not a newly executed producer observation. Its two original walls have knots U=[0,0,0,0.5,0.5,1,1,1], V=[0,0,1,1], identical XY/weights in both V columns and Z columns0/30.

| Canonical row | Positive-Y wall XY | Negative-Y wall XY |
| --- | --- | --- |
| 0 | (10,0) | (10,0) |
| 1 | (10,9.999999999999998) | (9.999999999999995,-10) |
| 2 | (6.123233995736766e-16,10) | (-1.8369701987210296e-15,-10) |
| 3 | (-9.999999999999998,10) | (-10,-9.999999999999996) |
| 4 | (-10,1.2246467991473533e-15) | (-10,1.2246467991473533e-15) |

The positive-Y row weights are [1,0.7071067811865476,1,0.7071067811865476,1]. The negative-Y weights are [1,0.7071067811865477,1,0.7071067811865477,1]. In this receipt the negative-Y middle value is one ulp **larger**, not smaller. Each value is duplicated in the two V columns.

`/tmp/barocss-native-binding-receipt.json` also preserves positive-Y face sense forward and negative-Y face sense reversed. It names them post.side0#2 and post.side0#1 respectively. These names and indices are observations, not general selection rules.

Both canonical wall curves run from the same A=(10,0) to the same B=(-10,1.2246467991473533e-15). Concatenating both in increasing U is not a closed positive cycle. The proof traversal must read the lower wall in the reverse direction. In particular B is not replaced by (-10,0), either middle junction is not forced onto an ideal axis, and the lower weights are not replaced by Math.SQRT1_2.

## 2. Admission and extraction for the minimal theorem

Use a fresh internal native-source extraction/validation of the actual Part, not external flags or a serialized claimed receipt. Keep the existing single slab, origin-centered single circular region, no holes, two original walls/two caps, full cached native B-rep comparison and coordinate/entity limits. Retain an independent frozen source baseline.

Find the two actual degree(2,1),5x2 wall surfaces by coefficients and topology, not name suffix or list order. For each require:

* U knots [0,0,0,0.5,0.5,1,1,1], V knots [0,0,1,1].
* Actual finite poles/positive bounded weights inside existing native limits.
* Identical XY and weights across both V columns, with common z0/z1 and z1>z0.
* Their canonical endpoint rows, actual bottom/top world-edge basis and weights, and actual vertex references are fully matched. Existing D304 original-wall classifiers provide a useful template for these checks.
* The canonical bottom boundary pcurve is a full-domain unit line with exact V=0. Its world-curve use sense must agree with the face sense in this upright producer. Do not infer one from a provenance string.

Take direct coefficient windows [0,1,2] and [2,3,4] from each original wall. These are four actual rational quadratic spans, each width0.5 in original U. Do not insert knots, reconstruct a quarter or call trigonometry. Every stored pole, weight, sense, ID, name and tolerance remains unchanged.

Represent orientation as proof-use metadata (face slot, span slot, forward/reversed traversal). For a wall sense forward use sigma=+1; reversed use sigma=-1. Native data is not reversed in place. Directed endpoints are selected by this traversal metadata.

Join directed endpoints by exact Cartesian equality and original endpoint ownership. Within each half the shared middle row is literally one original row; between halves the supplied global endpoint poles are identical. Require one four-span cycle, unique outgoing/incoming junctions and no branch or unused span. No tolerance snapping or approximate endpoint equality is permitted in this proof.

For the retained R10 case the positive traversal is upper[0..0.5], upper[0.5..1], lower[1..0.5], lower[0.5..0]. The four distinct junctions are A,upper-middle,B,lower-middle. The implementation must derive this correspondence from actual endpoints/senses and then validate it.

## 3. Per-span exact coefficient tests

For local t in[0,1], form the exact homogeneous degree2 coefficients

`X_i=w_i*x_i`, `Y_i=w_i*y_i`, `W_i=w_i`.

All input numbers are interpreted as their exact binary64 dyadics. Use the single provided SectionRationalContext or counted common-dyadic integer arithmetic. No new runtime dependency, WASM, table of circle poles or Math.atan2 samples are needed.

1. **Denominator:** mW=min(W_i)>0. Positive weights and Bernstein partition of unity prove W(t)>=mW globally.
2. **Circle defect:** form degree4 `Q=X^2+Y^2-R^2*W^2`. Let eQ=max(abs(Q_k)). Then

   `abs(r(t)^2-R^2)<=eQ/mW^2`,

   `abs(r(t)-R)<=delta=eQ/(R*mW^2)`.

   The second inequality uses r+R>=R and does not assume an ideal stored circle. Require delta<=the existing native linear policy and delta<R/2. This also excludes the origin globally. A separate positive Bernstein lower hull for X^2+Y^2 is optional; the radial inequality already supplies r>=R-delta>0.
3. **Angular orientation:** construct `K=X*Y'-Y*X'` exactly. A generic degree3 Bernstein product is enough; no cancellation-dependent degree reduction is required. Multiply the coefficient sign by sigma and require every oriented coefficient strictly positive. Local t and original U derivatives differ by positive1/h, so their signs agree. Keep the parameter scale explicit if a quantitative K minimum is returned.
4. **Open half-plane:** select an integer candidate normal, for example from {(1,1),(-1,1),(-1,-1),(1,-1)}. It is only a candidate. Require each exact homogeneous pole dot `n_x*X_i+n_y*Y_i` to be strictly positive. Then the entire rational span is inside that open half-plane. No angle reconstruction or sampled cone is used for approval.

The stored near-cardinal coefficients fit the reason for these broad half-plane candidates: tiny endpoint sign offsets do not require forcing an exact nominal quadrant. Unsupported/ambiguous coefficients must refuse instead of widening a sign tolerance.

## 4. Winding and simplicity without atan or root isolation

The four sufficient per-span conditions are W>0, origin exclusion, oriented K>0 and one open-half-plane inclusion. Therefore each directed span has a continuous argument with strictly positive increase less than pi. Exact endpoint closure gives total argument increase2*pi*k for an integer k. Summing four increases gives

`0 < totalIncrease < 4*pi`.

Thus k=1. No numeric pi approximation is needed for this integer argument.

The global argument is strictly increasing through exactly one turn. Every polar ray occurs once, apart from the identified start/end junction. Consequently the curve is a single positive radial graph, is simple, and has no self-intersection or overlap beyond prescribed shared junctions. This conclusion needs the complete connected endpoint cycle; four independent positive spans do not establish it by themselves.

The proof does not require a shared endpoint to be differentiable. Position continuity plus positive one-sided angular progress is sufficient for global winding/simplicity. The original C0 knot can retain different one-sided speeds.

## 5. Wall orientation consequence and remaining face obligations

For the checked exact upright tensor structure,

`S(U,V)=(C_x(U),C_y(U),z0+H*V)`, H>0.

The canonical normal is `S_U cross S_V = H*(C'_y,-C'_x,0)`. Its radial dot product is H times the Cartesian angular numerator. Multiplying by the actual face-sense sign sigma and using sigma*K>0 proves that each checked wall is regular and radially outward. This is a concrete wall-orientation consequence, not a claim about an arbitrary B-rep normal evaluator.

The following remain separate unless explicitly added:

* Exact stored cap-net affine/normal orientation, top/bottom outward signs, cap loop orientation, and complete trim-region ownership. Existing source comparison and sampled strict checks are not themselves a whole-region geometric theorem.
* Equality of the actual rounded cap pcurve image to the common world boundary. D304 bounds their native positions within unchanged tolerances; rounded affine inverse poles do not generally produce exact analytic coincidence.
* Full stored-shell closure/embedding and a chosen closed reference correspondence. A closed cross-section and exact wall extrusion define the mathematical prism Omega_C x[z0,z1], but that definition does not by itself certify every literal stored cap trim or prove a homeomorphism to a chosen tolerant B-rep.
* Global orientation or watertightness of a wrapped body after new faces are installed. This theorem concerns the original source walls, not the new pad's complete retained-face decomposition.

A small next cap theorem is feasible: prove the actual cap net affine, use the exact inverse of that plane only as reference data for the original common world curve, and certify its reference domain plus orientation. If the stored rounded trim is retained, its entire embedding/correspondence still needs a separate whole-loop proof. Do not alter the original pcurves to make that proof easier.

## 6. Complete radial receipt and one ledger

Return the maximum exact delta over all four spans, with per-span source slots/orientation/windows and positive W/K/half-plane margins. This is a full original-wall coefficient radial bound, distinct from the current selectedQuarterRadial field. Since wall XY is V-independent, the same coefficient bound holds over both complete wall surfaces and their Z extent.

The bound is on exact stored-rational geometry. If a caller also consumes a fresh D303/D304 native D0 receipt, the actual returned Number point's radial deviation is at most `delta+worldD0L1` by the reverse triangle inequality. Do not label the coefficient-only theorem a native evaluator certificate or a Math.hypot accuracy proof.

All four span calculations use one supplied aggregate request ledger. Do not call `certifyCylindricalWrapCarrier` four times: it creates fresh ledgers and its admission is intentionally limited to the first positive quarter with the selected middle-weight bits. It is unsuitable as-is for the actual reversed lower half.

Reuse its mathematical product/derivative/minimum/circle-defect patterns (`cylindrical-wrap-map.ts:190,:214,:248,:255`) through a private bounded helper or a small fixed-degree implementation. The new global code must accept actual positive weights after coefficient checks; it must not impose the first quarter's Math.SQRT1_2 bit on every span. Keep old map/standalone operation paths unchanged.

The source factory's existing selected-quarter proof cost must be imported once into the aggregate ledger if that factory is used. Subsequent full-span proof work belongs to the same caller ledger; no reset per quadrant is allowed. A private source-core continuation can avoid duplicate selected-quarter work if it is exposed without a public schema/option expansion and without trusting external flags.

Count all q/direct operations, imported helper work, GCD/float-search work, structural scans and maximum integer bits. Retain200000 aggregate exact/direct operations,8192 bits and1048576 work. Serialize per-span exact fractions without repeated generic Number searches; compute a Number upper only where needed. No performance or budget-fit conclusion is made until the parent measures the integrated request.

## 7. Mass does not transfer automatically

The actual radial graph usually differs from the formal disk because its stored coefficients/weights are binary64. The complete coefficient bound permits a later area/volume discrepancy theorem, for example

`pi*(R-delta)^2 <= area(Omega_C) <= pi*(R+delta)^2`

and the corresponding H-scaled prism-volume interval. With delta<R/2, the exact/reference volume discrepancy is bounded by `pi*H*(2*R*delta+delta^2)`. A crude pi<4 bound can avoid transcendental computation if only a conservative discrepancy receipt is needed; a tight mass receipt can reuse an independently certified pi interval.

For raw moments through degree2, a full-angle radial-shell difference bound also follows with p=a+b+2 and the integral of absolute axial monomials. That is a later quantitative mass-error step, not the same theorem as source winding. Density scaling, centroid/central inertia propagation and actual returned Number audit remain necessary.

The existing formal mass authority intentionally computes ideal reference cylinder/sector mass. This new source proof must not silently change that authority or flip literalStoredBrepMass, representedVolumeCertified or solidQualified. Literal cap geometry/reference closure and wrapped-side mass remain additional obligations.

## 8. Independent validation proposed for a later implementation

Use the retained actual R10 coefficients above and fresh parent-owned fixtures at several admitted radii/Z extents. Compare all source fields before/after and require no mutation. Independent exact Bernstein oracles should check Q and oriented K coefficients, closure joins and half-plane margins; deliberately changing a lower weight, endpoint, traversal sense or middle-knot window must be rejected or produce a changed valid bound rather than borrow the original source identity.

Include a counterexample with two canonical A->B halves concatenated in increasing U, a reversed wall sense, a nonclosed one-ulp endpoint, a nonpositive oriented K coefficient and an origin-crossing/unsupported span. Exercise narrow budgets and native coefficient signed zeros without snapping. Samples can regress the implementation; the coefficient/endpoint/half-plane argument is the complete winding proof.

No tests or candidate implementation were created or executed for this plan. It is a concrete bounded source theorem proposal, with cap/global B-rep/reference/mass qualifications deliberately separate.
