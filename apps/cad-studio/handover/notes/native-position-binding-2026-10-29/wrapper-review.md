# D304 native binding wrapper: independent read-only review

No actionable approval-path defect was found in the inspected frozen wrapper. This is a static review, not a build, lint, test, probe or execution result. No repository file was edited. The mathematical position helper itself was excluded from this independent review as requested.

Reviewed source root:
`/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`.

## Checked consumer obligations

* `src/features/cylindrical-wrap-assembly.ts`, `runAssembly` at line668: the native branch takes a separate original B-rep snapshot, freezes the source and compares the installed result against the retained baseline. Only the prescribed original face-loop and shell-face appends are allowed by `protect` at line655. The legacy path retains its original mutable result and original baseline behavior.
* `NativePieceEvidence` is made by the fresh internal run. Base/outer coefficients, their actual pcurves, errors and side coefficients are frozen before the wrapper consumes them. The API takes source Part/components/options, not an external evidence receipt or a purported finished B-rep.
* `nativeFamilyPhase` matches all54 actual world/pcurve Curve slots and9 actual Surface slots to the complete fresh D303 snapshots. Repeated pcurve IDs are not used as source correspondence. Per-coedge receipt slots are `edge.index`, `18+coedge.index` and `face.index`.
* `finishNativeAssembly` requires the fixed18-edge/36-coedge/9-face/12-vertex shape, unique actual coedge ownership, canonical matching [0,1] domains, per-pcurve exact range/native slack, and all36 per-edge-tolerance position comparisons. Expected classifier coverage is wall8/cap4/base4/outer4/side16. It checks all36 endpoint relations against the actual vertex tolerance, explicitly recording that this is stronger than checkBrep's max(vertex,edge) rule.

## Checked exact-model classifications

* `nativeWallResidual`: original horizontal world curves retain all five poles, complete half-wall U knots and matching weights. Target columns are the actual V0/V1 coefficients. Original struts have canonical unit pcurves, unit world weights, and actual boundary rows. Equality of the two surface weights in each row makes the endpoint-row V iso-curve affine. The returned maximum Cartesian pole L1 residual is valid under the matched positive rational basis.
* Original caps call the affine helper on the actual world Curve, actual pcurve and actual cap Surface. The wrapper does not impose top-cap axis order on the swapped bottom-cap basis. The helper is responsible for complete matching five-pole knots/weight bits and exact affine-net admission; the wrapper separately requires pcurve range.
* New base uses retain their fresh world/pcurve source and coefficient error. The wrapper verifies the actual five-row selected half-wall, its full two-span knots, the quarter's [0,0.5] knots and the exact first-three-row/pole-weight transfer. This transfers the fresh quarter binding bound to the original first span without mistaking its midpoint for the full half-wall domain endpoint.
* New outer uses match the fresh outer Curve/pcurve and actual fresh factor2 carrier. The separate side-family phase binds every actual side to the fresh base/outer pair, including full knots/weights and both pole columns.
* Side base/outer uses keep canonical unit pcurves; coedge reversal is not used to reverse their parameter direction. Their exact iso-curve coefficient checks support zero model error. Side radial uses require affine world curves and equal endpoint-row weights; their maximum Cartesian endpoint residual supports the stated model bound.
* All classifications consume the actual installed surface and Curve fields. Fresh metadata and full coefficient matches, rather than caller flags, establish the model receipt used by the numeric helper.

## Checked ledger composition

`Context.totalWork`, `importHelper` and native `check` combine the local q/direct ledger, structural work and imported helper work. Native UV orientation uses the same local q ledger; the legacy external exact predicate remains in the legacy branch only.

* Carrier rational counts are booked once as helper operations. Its separate integer count is added only in the new native profile. Carrier raw work and its q/GCD/float work are imported in the corresponding native work categories.
* Composition q operations are booked once by the old path. The native branch additionally imports their q/GCD/float work and maximum bits; it does not book those q operations a second time.
* The chart component's authentic context is continued by the side-family helper. The wrapper imports the final cumulative side-family counts once. It does not additionally import the component receipt separately. This matches `cylindrical-wrap-side-family.ts`'s cumulative `counts`, distinct from its `startedCounts` and `componentCounts` snapshots.
* D303 family `counts.work` already includes its q/GCD/float/direct/structural categories. The wrapper imports it once as complete work, without adding those subcounts again. Its `totalOperations` is booked once as helper operations.
* Later face, range, model and endpoint calculations use the original assembly Context. Phase receipts are snapshots; constructing their returned fields does not book the same phase again.
* Remaining exact limits are passed to the composition/component/family helpers. Successful aggregate admission remains <=200000 exact/direct operations, <=8192 bits and <=1048576 declared work. Helper exhaustion is an atomic refusal; no automatic retry or tolerance change is present.

The carrier's coefficient-only path currently has no atan/direct-integer workload. This review did not infer a new generalized accounting contract for a future full-map substitution; that would need a fresh work-category audit.

## Legacy and verification limits

The factored legacy call is `runAssembly(...,native=false,maximum=200000).publicResult`. New freezing, metadata, q orientation, extra helper work and complete-work checks are guarded by the native branch. The static operation paths inspected preserve the original legacy q calls and returned geometry/proof structure. Exact old-versus-new receipt equality and mutability require the parent's runtime differential; they were not executed here.

The review does not certify the independently owned D0/position math, D300/D301 primitive proofs, Math.hypot arithmetic, source-global geometry, retained-face closure, orientation, a closed physical reference, represented volume or mass. The wrapper's meaning flags keep these boundaries explicit. Its true claims are limited to actual native-position coedge and endpoint error coverage.

No additional source change is requested from this review.
