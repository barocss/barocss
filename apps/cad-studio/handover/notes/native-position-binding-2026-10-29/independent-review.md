# D304 independent native position-binding review

Status: read-only source review. No source was changed. No build, lint, test, or runtime probe was run by this reviewer. The first D304 runtime result was not known when this note was written.

Reviewed actual files:

- packages/barocss-cad/src/features/cylindrical-wrap-assembly.ts
- packages/barocss-cad/src/features/cylindrical-wrap-native-position.ts
- packages/barocss-cad/test/cylindrical-wrap-native-binding.test.mjs
- packages/barocss-cad/test/cylindrical-wrap-native-position.test.mjs
- Supporting native D0 family, side-family, math validation, and checkBrep parameter conventions.

## Result

No material false-acceptance defect was found in the current closed native wrapper path. The positive claims are limited to native position-output binding and actual edge-endpoint/vertex relations. Physical solid, retained-face closure, whole-source embedding, orientation, Math.hypot accuracy, volume, mass, and product-feature claims remain false.

This is not a runtime PASS or a claim that the native fixture fits its operation/tolerance budgets.

## Actual-source binding and fresh residuals

`runAssembly` obtains a fresh `buildCylindricalWrapUVSource` result. No external assembled B-rep, residual receipt, or caller certificate flag is accepted. The source adapter retains its complete native-source comparison and direct-copy quarter contract.

For the native path, assembly.ts:675-680 imports the source coefficient cost, creates an independent own-data snapshot of the complete baseline B-rep, and freezes both baseline and fresh source. `protect` compares the independent baseline against the assembled result, including every original body/vertex/edge/loop/coedge record and only the prescribed face-loop and shell-face appends. This avoids comparing two writable aliases after mutation. The actual input Part remains outside that owned graph.

Private NativePieceEvidence is created only by the fresh base/outer/side producer. Curves, pcurves, residual rationals, side Surfaces, and the final diagnostic graph are frozen before classification. These records are not caller-supplied proof authority.

`nativeModel` binds each producer residual to the installed complete Curve/pcurve/Surface fields with Object.is-aware recursive comparison. In particular, the base-on-retained-wall class checks the full actual original wall, its original knot domain, its first three rows and weights against the retained quarter, and V knots before reusing the fresh base residual. The outer class similarly checks the actual outer Curve, canonical pcurve, and actual outer Surface. The error therefore does not float free of the coefficients it certified.

## Model residuals and canonical parameter

The wrapper checks every world/pcurve parameter domain and requires canonical [0,1]. It does not reverse pcurves a second time for reversed coedge sense. This agrees with brep-core.ts:257-271: the same canonical t is used for world Curve and pcurve evaluation, independently of loop traversal sense.

All36 coedges are classified, with the exact required totals:

- Wall8: original horizontal full-half rational isocurves or original affine struts. Actual original edge fields and actual original face Surface are compared first. Horizontal world weights/knots match the selected Surface row, and the pcurve is exactly (t,v). Struts use the exact endpoint row with equal V weights and pcurve (u,t). Maximum Cartesian per-pole L1 residual is valid because the corresponding positive-weight basis agrees.
- Cap4: `nativeAffineCapResidual` proves an exact affine parallelogram with unit Surface weights/domain; world and pcurve complete knot/weight/degree basis bits agree. The affine lift of every pcurve pole is compared exactly with its world pole. The shared positive basis makes the maximum pole L1 residual a whole-parameter bound. Bottom-cap swapped axes are handled by the actual affine net, not a top-cap-only assumption.
- Base4: fresh source-quarter composition/vertical residual, with the installed complete world Curve, canonical UV pcurve, full wall and quarter fields bound as above.
- Outer4: exact factor2 outer-homothety residual, bound to the installed outer Curve/pcurve/Surface.
- Side16: the fresh D301 side-family continuation proves all actual degree(3,1) coefficient identities and shared basis. Base and outer boundary rows have exact model residual0. Radial boundaries require the prescribed affine pcurve, unit affine edge basis, and equal radial row weights; maximum endpoint L1 residual then bounds the complete affine edge.

The model calculation is independent of the native evaluator D0 bound. A small sampled gap is not used as its proof.

## Whole-face UV propagation

`prepareNativePositionFace` validates clamped current native inputs, admitted half/unit spans, positive stored weights in[0.5,1], and bounded actual coordinates. The five-row quadratic case consists of two exact half-span pieces sharing the middle row. It is continuous at the repeated knot.

Its exact L1 derivative bound is conservative. With M=max weight, m=min weight, A=sum coordinate absolute maxima, and span factor p/h:

    |N'| <= 2*(p/h)*A*M
    |W'| <= (p/h)*(M-m)
    |N| <= A*M, W>=m

so the quotient derivative is bounded by:

    (p/h)*A*M*(3*M-m)/m^2.

Taking the maximum span factor gives a global Lipschitz bound across the shared-row join. The V bound follows the same argument. No native D1 evaluator or numerical derivative sample supplies this proof.

`requireNativePcurveRange` first requires the exact positive-weight pcurve pole hull to lie inside the true Surface domain. It then expands that hull by actual per-axis pcurve D0 error and compares it with the exact represented results of the native threshold operations `low-1e-9` and `high+1e-9`. The range check is separate from the affine-extension residual. Thus a pcurve outside the true domain cannot be accepted merely because native slack would admit its computed Number coordinate.

Given a true-domain mathematical pcurve point, projection/clamp onto that same interval is nonexpansive. Therefore the clamped computed UV point differs from the exact target UV by at most the pcurve D0 error. D303 then bounds native Surface evaluation at the clamped represented UV. This justifies:

    total L1 <= model + 2*worldD0 + Lu*pcurveUError + Lv*pcurveVError.

The two independent worldD0 terms cover the world Curve output and the Surface output. There is no unsupported extrapolation outside the Surface domain.

The prepared-face WeakMap binds a frozen owned Surface/Lipschitz record to the exact host Context. The closed wrapper supplies that host and fresh evaluator bounds itself; helper inputs are not external certificate flags.

## Endpoint and slot coverage

For all18 actual edges, both clamped endpoint relations are checked. Exact mathematical endpoint position is the actual endpoint pole because the admitted basis is open/clamped with positive weights. `nativeEndpointPositionBound` adds the family native Curve D0 bound to the exact L1 pole-to-actual-vertex gap and compares it with that actual vertex tolerance. This is stronger than the checker's max(edgeTolerance,vertexTolerance) endpoint rule. It is not a surface-endpoint/vertex certificate, and that distinct flag is false.

The D0-family input is assembled directly from all18 edge Curves, all36 coedge pcurves, and all9 face Surfaces. The family has63 slots. Nothing is deduplicated by geometry ID. Repeated pcurve IDs remain distinct array slots, and all returned source snapshots are compared with the corresponding actual slot. Receipt curveSlot/pcurveSlot/surfaceSlot values follow those actual array indices.

B-rep topology maps use native unique entity IDs after strict diagnostic validity. That use is separate from geometry-ID authority and does not erase repeated geometry-ID slots.

## Shared resource accounting

The native Context retains the existing global200k exact-operation cap,8192-bit cap, and1,048,576-work cap. Source and composition costs are imported; the old q operation order is retained. Native-only UV orientation predicates use the same local rational ledger instead of the legacy external exactOrient2 predicate.

The side phase starts D300 with `ctx.remaining()`. D301 continues the authentic same component Context. The wrapper imports the final cumulative side count once; it does not add the component prefix again. The D0-family phase also receives `ctx.remaining()` and imports its complete actual family count once. Subsequent face/UV/model/endpoint arithmetic uses the original assembly q Context.

Native work includes local structural charges, local q operations/GCD/float-search steps, imported helper work, and direct operations. Side work adds the side Context's structural/direct work and its rational operations/GCD/float-search steps. D0-family work already includes its rational/direct/structural ledger. Maximum bit sizes from all helpers are folded into the final maximum.

There is no separate aggregate GCD field, but every q GCD step is itself charged as a rational operation by SectionRationalContext. Therefore the sum of all GCD steps is bounded by the sum of imported/local rational operations, which is bounded by the global exact-operation total<=200k. No accepted receipt can obtain extra GCD allowance by starting these helpers.

The source adapter does not expose a remaining-operation argument. Its actual reported cost is imported before new work continues. Helpers with their own work ledgers can also finish before an aggregate import refuses. Thus the receipt proves the accepted aggregate ledger; it is not a wall-time or instruction-preemption guarantee for a rejected request. Existing generic Number B-rep checks still use their conservative explicit structural charges, not a new formal count of every JS instruction.

## Legacy path

The existing `buildCylindricalWrapAssembly` calls private `runAssembly` with native=false and the original default operation limit. Source extraction, composition call order, geometry generation, numeric candidates, original predicates, counts, and mutable public diagnostic result remain on that branch. New frozen baselines, NativePieceEvidence, side/D0 families, per-face native-position scans, and extra rational orientation work are native-only.

There is small fixed bookkeeping/branch/module-import overhead from factoring. No new expensive native qualification or extra exact-arithmetic work is applied to the legacy geometry path. Static comparison found no changed legacy geometric formula or numeric operation order. Runtime differential evidence is still required.

## Tests inspected, not run

The integration test checks all63 ordered snapshots, all36 class totals, all36 actual vertex relations, exact independent cap residuals, per-face inflation, slot correspondence, narrow false flags, frozen output ownership, legacy geometry/receipt behavior, invalid fixed-profile inputs, forbidden flags, getters, and exact total/total-1 reservation behavior.

The native-position helper test supplies independent exact tensor derivatives and cap lifts, checks both actual source half-walls and distinct weight bits, tests exact versus rounded domain guards, includes an outside-domain/slack/clamp counterexample, checks supplied tiny vertex tolerances, owns prepared faces by Context, and exercises local work/operation/bit refusals.

These tests do not establish physical closure, orientation, Math.hypot error, actual solid mass, arbitrary native source families, arbitrary glyph loops, or product integration. None of those broader claims is returned by the reviewed implementation.
