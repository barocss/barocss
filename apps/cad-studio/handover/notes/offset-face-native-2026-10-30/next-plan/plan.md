# D343: stable longitudinal integrals for existing prismatic mass

Status: SOURCE-ONLY PLAN. No implementation, test, build, browser, benchmark, commit or push performed. D342 must finish actual Studio qualification and be published first. Re-pin this plan to that published source before implementation. Fixed source inspected: `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`.

This is the demonstrated urgent CG10/roadmap16 false-success defect discovered during D342. It belongs in the existing deduplicated acceptance ledger. Roadmap08 remains open;09 follows08, and Electron15 remains queued. No new parallel queue or broad mass project is proposed.

## User-visible problem and current evidence

An upright translated cylinder can have native strict-valid geometry and positive physical thickness, yet the Model reports its center of mass outside the body. The preserved D342 case is radius3, original height5.00009, translation `[.1234567,-.2345678,.3456789]`, positive-Z cap coordinate5.3457689, opposite.3456789 and inward request−5.00009. The actual retained upper level is .34567890000000023, giving positive2.220446049250313e−16 mm. Original Model centroid.z=.34375 lies below the retained interval. The exact intended/stored gap equality was verified independently in D342; this is not an exactly collapsed input.

Two distinct native classifications must remain separate. The corresponding rectangle target fails the existing strict native side-loop/sliver checks. The cylinder target passes that native checker but fails the current closed-form normal-centroid invariant. D342 now refuses both before publishing a recipe, for different reasons. D343 repairs the mass provider, not the geometry checker or Offset guard. After the repair, the captured cylinder may qualify if EVERY unchanged D342 condition and the actual result checks pass; the strict-invalid rectangle must remain refused.

Supplied immutable baseline evidence: `/tmp/d342-nearfull/original-nearfull-result.json`, `original-nearfull-*`, `boundary-first.log`, `boundary-results.json`, `receipt.md`; initial box evidence also `/tmp/d342-model/nearfull-result.json`. Read exact files and hash them in D343 before relying on them. These are prior author/root executions, not planner reproduction. Do not use prefix-result.json as immutable pre-fix evidence; D342 receipt records its later overwrite and names retained originals.

## Existing source seam

- Kernel `src/brep/solid-mass.ts:51-60`: prismaticMassProperties sums section moments times longitudinal integrals. Line54 uses h=b−a, h2=(b²−a²)/2, h3=(b³−a³)/3. Close translated products lose the small difference before division.
- `solidMassFromIntegrals:41-43` divides first moments by volume and subtracts raw second moments to form central inertia. Its own cancellation remains separate.
- `src/part/part-model.ts:4548`: existing massPropertiesOf uses prismaticMassProperties for upright solids unless a provider is already present. Upright Boolean at2621 preserves the slab representation; `features/prismatic-solid.ts:125-131` retains actual level endpoints.
- `cad-model/src/engine/evaluate.ts:147` uses massPropertiesOf for actual Model body fields. `src/app/mass.ts` scales volume/inertia for density; it does not repair centroid. Actual Studio reads these fields; SelectionInspector rounds its visible center to two decimals. That rounded label cannot prove a sub-ulp interval property.
- D342 `nativeOffsetFace.ts` uses an owned native unit section with explicit actual lo/hi slab/cap records, then unchanged strict native validity and existing prismaticMassProperties normal-centroid interval/midpoint checks. Keep this code intact.

## Smallest production change

Change only the longitudinal polynomial formulas in Kernel solid-mass.ts, retaining existing API, units, density validation, result method, section Green integration, accumulation order, native SI bookkeeping and geometry:

1. Keep h=b−a unchanged.
2. h2=h*(a/2+b/2).
3. h3=h*(a*a+a*b+b*b)/3, or a numerically equivalent factor order justified by the same independent cases.

The identities are exact over real numbers: b²−a²=(b−a)(a+b), b³−a³=(b−a)(a²+ab+b²). The half-sum avoids an unnecessary a+b overflow. This removes close-power subtraction; it is not an exact arithmetic implementation. Do not round coordinates, clamp centroids, add an EPS/minimum thickness, enlarge tolerances, recenter the geometry, weaken refusal predicates or add dependencies/schema/exported helpers.

The reported modeling interval is bounded by coordinateAbs10000 and has a normal binary64 gap; its relevant intermediates are finite. Public prismaticMassProperties itself accepts an explicit PrismaticSolid and has no matching global coordinate validator. Do not claim this formula certifies every finite number, underflowing volume/first moment, overflowed raw moments or arbitrary tiny subnormal intervals. Check ordinary large/small controls for regression, and record pre-existing unsupported numerical extremes without inventing a new admission range. If this narrow formula exposes a material new failure, stop and review the specific case rather than growing a generic mass rewrite automatically.

## Independent oracle and exact stored controls

Default registered Node tests should use native BigInt normalized rational arithmetic and direct binary64 bit decoding; no Python process prerequisite. A separate Python Fraction reference is useful as an optional evidence cross-check. Both have zero product imports in their arithmetic. Reuse only already-independent rational utilities if their semantics fit; never import the production h2/h3 formula to build expected values.

Decode each stored a,b exactly. Compute exact h=b−a, J1=(b²−a²)/2, J2=(b³−a³)/3 using rational powers/subtraction, rather than copying the implementation's factorization. For rational rectangular sections, compute exact area and all first/second area moments from authored vertices, then exact10volume integrals and exact centroid/central tensor. Compare to the actual public function/output. Keep exact fractions as strings in evidence; avoid Number(hugeBigInt)/Number(hugeBigInt), which can become Infinity/Infinity. Use a proven bounded conversion or compare binary64 outputs as exact rationals against rational thresholds.

Required fixture families:

- Captured `[.3456789,.34567890000000023]`, its reflected negative interval and ordinary translated siblings. Explicit endpoint metadata is necessary; a fixture that reconstructs b as a+(b−a) can accidentally test another interval.
- Adjacent stored numbers and gaps of2/4/16ulps around positive/negative .3456789,1,1024 and near9999, with independently decoded expected endpoints. A midpoint can round to either endpoint for a one-ulp interval; require closed-interval containment, not strict interior. Do not assert universal exact midpoint rounding for all fixtures.
- Exact easy intervals `[0,1]`, `[-1,0]`, `[-1,1]`, `[2,5]` and their sign/reflection controls. These retain density/method/units and ordinary inertia checks.
- Two unequal-area, disjoint or adjoining explicit slabs with rational rectangular sections. Exact centroid is the area×height weighted midpoint, not the overall bounding-box midpoint. Include a simple hole or unequal sections only if needed to exercise existing summation, without broadening geometry production.
- A circle section constructed by the existing native producer with explicit slab endpoints. Normal centroid is the exact interval midpoint regardless of pi/section area. Use that symmetry, strict interval containment and independently rounded analytic volume guides; do not call rounded pi an exact rational area.

Acceptance must include finite positive volume, correct normal centroid and closed-interval containment. An unchanged volume is expected because I0/A*h is unchanged; preserve exact stored volume/mass bits on unchanged ordinary fixture inputs where the old path is finite. This distinguishes the bug from a volume-only test. Use a tight rational error bound chosen for each declared fixture (e.g. a small documented number of midpoint ulps), together with existing1e−7 admission policy where applicable. The captured .34375 already fails the1e−7 comparison, but that tolerance alone can miss smaller physical violations in other tiny intervals; containment is independently required.

For h3, ordinary well-conditioned intervals should check the independent tensor. Raw-to-central subtraction can erase a tiny normal variance for highly translated thin slabs even after the raw h3 improvement; do not require or claim globally accurate thin central inertia from this change. If an extra internal observation is needed, prefer source/math proof plus public well-conditioned tensor controls to a new public raw-integral API.

## Tests and affected paths

Add a focused Kernel test (for example `test/prismatic-mass-stability.test.mjs`) using public exports and exact explicit slabs. Existing `test/prismatic-solid.test.mjs` primarily validates geometry/Boolean volume; the inspected suite contains no direct prismaticMassProperties longitudinal stability test. Existing `part-model.test.mjs:431+` tests ordinary closed-form volume/inertia and transformed providers. `mass-polyhedral.test.mjs` tests native planar/quadrature providers and should retain its separate results. Existing Model `test/mass.test.ts` tests ordinary steel box inertia/scaling and combined centers.

Run new focused cases against the immutable D342 source first. Preserve the original expected failure and exact input; then run the new formulas and keep both receipts. Do not rebuild or run tests in this planning task. After D342 publication, coordinate one heavy owner at a time: Kernel build/focused+relevant mass/Part/native-SI tests/types/lint, then Model affected tests/types/lint, then API/Studio affected build gates before actual browser. Since this is a shared mass primitive, root should decide the full Kernel gate after focused proof; do not claim a fullsuite from related subsets.

Density error behavior, empty/no-positive-volume error behavior and `method:'closed-form'` remain the same. recordIntegralMass still records the computed central moments; run existing native SI provenance/conversion tests because those numbers can change without changing the public schema. No worker/caching lifetime change is needed; start new processes/contexts so a previous D342 last-refusal witness or mass WeakMap cannot masquerade as a corrected computation.

## D342 compatibility and actual consumer proof

Keep D342 guard production source byte-equal. The captured polygon still must refuse FACE_DISTANCE from strict native geometry, with source/selection unchanged and an ordinary positive retry succeeding. The captured strict-valid cylinder should be reclassified by the UNCHANGED guard after the corrected provider, not by removing its mass check. Update only tests whose historical expected mass refusal has become valid corrected success, and retain the old D342 refusal receipt. Require actual final native strict-valid one-solid/one-closed-shell geometry, original tangent footprint, actual stored cap levels, public Kernel/Model centroid inside that interval, and unchanged input ownership. If the guard or actual result still fails another existing policy, record that classification instead of forcing success.

Z-upright mass is the directly repaired provider. X/Y cardinal rotations can use BRep/analytic Boolean providers or moved mass callbacks; retain ordinary signed controls and classify their actual providers, but do not attribute their accuracy to this longitudinal fix or require every tiny rotated request to become admitted. BRep quadrature/polyhedral, revolved, swept, combined and general transformed providers remain separate.

Model proof must consume actual evaluateDoc/public body mass, including deferred mass completion where present, not merely a separately reconstructed native brepMassProperties value. Save/current-schema fresh Open must recompute the same corrected result with semantic recipe equality. Do not claim raw file byte identity unless checked separately. Neither geometry nor authored parameters/node arrays should change just because a mass query runs. Deep-freeze input fixtures and compare original recipe/section geometry before/after; retain primitive/body names and counts/support planes when running the actual Offset composition.

One actual Studio flow is sufficient: load the public API-authored translated cylinder source, select its positive-Z cap by actual mouse after read-only world projection, request the captured inward value in the real Offset UI, wait for accepted massReady state, and apply only if every unchanged guard passes. Observe actual accepted Model centroid/volume through the existing read-only body hook, compare to exact original stored interval, save and fresh Open, and recheck; include Undo/Redo and unchanged source prefix. A companion actual direct mass read of an explicit tiny upright recipe is possible if the Offset composition remains refused by another qualified policy. Do not use document/selection mutation hooks to manufacture a browser success.

The tiny thickness is not visually resolvable and Float32 display bounds can collapse its normal extent. Screenshot review verifies actual UI/accepted state/renderer presence; exact native endpoints and actual raw Model centroid provide the interval evidence. The rounded center-of-mass label and display bounds cannot replace that proof. Keep an ordinary translated prism/cylinder control with visible mass/center readout. Explicitly assert public/Model mass in the browser verifier; D342's inspector captured publicMass but its independent oracle only asserted native mass.

## Completion boundary

Deliver a tiny reviewable Kernel formula change and independent tests, with baseline failure, final exact-input results, unchanged geometry/source/API/tolerance, actual Model mass and one actual Studio/file consumer proof. Report source, focused/runtime, fullsuite, browser/visual, file, local commit and remote publication separately. No performance claim without measurement. No claim that global central inertia, 2D Green moments, arbitrary curved mass, allfinite/subnormal inputs, strict native validation or roadmap16 as a whole is complete.
