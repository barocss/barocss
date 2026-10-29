---
work_id: D315-loft-guide-control-range
artifact_type: kernel-repair-and-verification
status: verified_scoped
owner_role: geometry-reviewer
source_request: Reproduce and repair the existing D288 guide-control contract without raising Surface capacity or reducing source guide admission
last_updated: 2026-10-29
---

# D288 large guide controls: actual failure and bounded repair

The existing polynomial guide admits up to64 source controls, but generated one native Surface with the same V
control count. The native Surface limit is16. The resulting B-rep could be returned with a successful mass result
even though strict checking, surface evaluation and tessellation could not use it. This is an existing wrong-success
at the Kernel boundary, not a new frame feature. Raw Part evaluation also fails for the same reason.

The reproduced runtime is D314 `bb92da70b99114fb4e2b04149b52a3db05283804`, Node22.19.0. The current full-build receipt
was reused before the first probes because source and dist had not changed. All heavy work ran serially through
the gate. Original loft source/modules, full recipes, native B-reps, outputs and errors remain in this folder.

## Actual baseline

The baseline has two ruled square sections, z0 andz1; a degree3 clamped polynomial guide with16/17/64 controls,
all on the straight line x=y=0 with strictly increasing control heights. The prism uses unit squares at both ends.
The taper uses widths1 and2. Source weights are polynomial1. The recipe never includes weights on the guide object.

| Guide controls | Shape | loftSolid / mass callback | strict / native point / mesh / Part |
|---:|---|---|---|
| 16 | prism and taper | return | pass |
| 17 | prism and taper | return | `Surface V control point count must be in 2..16` |
| 64 | prism and taper | return | `Surface V control point count must be in 2..16` |

Independent prism V=1mm³, centroid(1/2,1/2,1/2)mm. Independent taper V=7/3mm³,
centroid(45/56,45/56,17/28)mm. With density1g/cm³ the taper mass is7/3000g. Exact rational inertia expectations are in
the focused test. `baseline-results.txt` uses an abbreviated diagnostic key named `mass` that actually prints the
returned **volume**; its values1 and7/3 are mm³, not mass. The full JSON has the complete mass-property object.
The original stdout is intentionally unchanged.

The first baseline probe stopped because `checkBrep(strict)` threw instead of returning a report. Its stack and
first two successful records remain in `baseline-first-failure.txt` and `baseline-first-partial-results.json`.
The harness then captured returned/thrown outcomes for every stage, producing the complete six-case baseline.

A related actual failure occurs with64 cubic controls and three valid section planes: the guide's section cut
inserts knots into a temporary whole Curve, takes it above64 controls, then native Curve validation refuses it.
`three-section-first-probe.json` preserves the full Greville-height straight-guide recipe and the actual
`Curve control point count must be in 2..64` refusal.

## Retained change

Only the guided-loft Kernel path changes:

- `loft.ts` calls the patch helper after constructing the original guided sides and caps, before B-rep assembly.
- `loft-guide-patches.ts` returns immediately for native sides with at most16 V controls. Larger polynomial V rows
  and rulings are restricted at original knots with the existing `curvePiece` helper. Each retained patch has at
  most16 V controls and keeps its original parameter subinterval. There is no reparameterization, fitting,
  flattening, degree reduction or approximation step.
- A canonical ruling is split once. Adjacent sides share its segment edges, cut vertices and boundary control rows.
  Internal rings use the child control columns. `buildBrep` creates the common twins and loop cycles. Section rings
  and caps remain intact; only affected edge names are rebuilt from their actual adjacent face names. New pieces
  use stable `#1`, `#2`, ... face suffixes. Existing at-most16-control names and bits remain unchanged.
- Each original U row has a constant V weight. Its V polynomial coefficients are restricted with unit weights;
  the original positive U weight is retained outside that restriction. Rational-U arc sides are covered. This
  avoids introducing unnecessary weight rounding while retaining the original rational Surface family.
- `loft-nurbs-guide.ts` uses direct existing `curvePiece` restrictions only when the temporary whole-Curve
  refinement would exceed64 controls. Each returned child remains within the original Curve bound. Existing
  successful refinement paths remain unchanged.

The original guide/profile/knots/weights remain in the recipe. Global Surface/Curve capacities, work limits,
numeric policy and tolerances are unchanged. `guidedSpanMoments` and all mass integration arithmetic remain
unchanged. Framed adapters, Model production code, public APIs, schema and Studio guide encoding do not change in
this lane. Existing height sections include non-XY sketch planes; those existing paths remain supported.
No per-element callbacks or nested closure factories were added to the patch loops.

The reused native `curvePiece` operation inserts original knots in homogeneous coordinates and restricts the
coefficient range. For the admitted degree1–5 /64-control polynomial source, its temporary arrays remain bounded;
children are valid native curves. The public Surface split provider cannot be used on an already oversized source
Surface because it first validates the16-control Surface bound. No public provider was widened or bypassed.

## Evidence and proof scope

Final library build passes on Node22.19.0. Related Kernel five-file suite passes94/94, zero failures or skips:
`loft-guide-control-range`, `loft-nurbs-guide`, `loft-cubic-guide`, `oriented-loft`, `loft-multi-conic`.
Kernel lint and code-shape pass with unchanged hot-folder counts119/32/273/75. These final checks were run after the
module-level state/helper refactor; successful checks on the same source were not repeated again.

The five new tests cover17/64-control prism/taper geometry with independent V/C/I, native evaluation, one closed
body/genus0, complete reciprocal coedges, exact shared edge endpoints and watertight actual triangles. They also
cover degrees1–5, repeated knots, non-unit authored knot domains, nonlinear height, transverse bows,64-control
three/eight-section cuts, original16-control names, refusal atomicity, later caller edits and preserved input arrays.

`compare-legacy.mjs` loads the frozen original module independently. Nine complete actual B-rep/name/knot/weight/
coordinate/mass bit trees match, including signed zero: degree1–5 /16-control bowed guides, unguided loft, smooth
loft, quadratic framed guide and cubic framed guide. Full before/after trees are preserved in
`legacy-preservation.json.gz`. This is a result comparison, not a source-checksum test.

`compare-surfaces.mjs` independently evaluates the original unvalidated Surface coefficient tables with homogeneous
de Boor. It does not call or bypass production Surface admission. It compares the real production child surfaces
at their original V parameters on boundaries/interiors, every source knot, each knot interval midpoint, adjacent
binary64 values and a grid. Twelve fixtures cover degrees1–5,17/64 controls, repeated/non-unit knots and nonlinear
height/bows; two fixtures have the originally admitted rational-U arc sides.31,536 native point observations pass.
Maximum observed coordinate difference is1.7763568394002505e-15mm, below the unchanged1e-9 comparison allowance.
All twelve large-guide mass bit trees match the original callback exactly.

`coefficient-bound.py` separately replays knot restriction with Python exact Fractions on the original represented
row coefficients. Across168 child surfaces, original U knots/weights and degrees are unchanged. The B-spline
convex-hull property and positive U weights bound the **entire ideal represented geometry**, with maximum L1 bound
approximately4.979143550714454e-16mm. Exact numerator/denominator bounds are in `coefficient-bound.json`.
This coefficient bound does not include native evaluator roundoff; that is the separate observed grid comparison
above. Neither check claims a general native D0 certificate for unrelated geometry.

## Failures and handoff

`focused-before.tap`: two intended contract tests fail on the original build with the native Surface16 error.
`focused-first.tap`: initial patch fixes those two. The discovered64-control intermediate-section issue was then
fixed and covered. `focused-final.tap` is the final94/94 result; the final source/module hashes are in
`source-identity.json`.

Two command setup failures are retained. An unused type-import cleanup used a root-relative path from the package
cwd (`prep-first-failure.txt`). The next library build was launched from the root instead of the package and failed
with TS5058; `build-second.txt` retains that output. A full build from the correct package cwd then passed, followed
by the final build after the loop/state refactor. These were command setup failures, not geometry test differences.
No numeric expectation, capacity, work limit or tolerance was relaxed to make a check pass.

## Final runtime and regression receipts

Runtime source and tests are committed locally as `dbfe93216`. The existing full library build and lint receipts
remain valid for the current source. The parent ran the final whole-Kernel suite once: 2,203 tests, 2,197 passed,
zero failures and six existing skips, 260291.518875 ms (`kernel-full-final.txt`). Final docs pass with 68 pages,
55 shots, 4,811 KiB and 858 labels (`docs-final.txt`). This includes all three generated checks; the API inventory
is unchanged. No push, PR or release is implied by the local runtime commit.

## Model and actual Studio consumers

Related Model coverage passes 19 distinct tests across two files, with zero failures or skips. The first combined
19-test run took 743.48675 ms. After two successful `Reflect.set` return assertions were added, the command file
alone passed its final 12/12 run (370.937917 ms) and changed-file lint passed. The API file's seven tests and final
type PASS are reused. These overlapping runs are not 31 distinct tests. Original stdout is retained in `consumers/`;
the successful type and lint logs are empty. The first type check found TS2540/TS2542 in the new test's deliberate
mutation of readonly guide input. Those two assignments became `Reflect.set` calls, with both successful returns
asserted. No geometry expectation or tolerance changed. The exact diagnostics remain in
`consumers/model-types-first-failure.txt`; final type and command receipts are separate.

The Model commands ran on Node 22.19.0 through the serial heavy gate from the Model package directory:
`node scripts/test.mjs api-loft-guide loft-guide-command`,
`node ../../node_modules/typescript/bin/tsc --noEmit -p .`, and
`node ../../node_modules/eslint/bin/eslint.js test/api-loft-guide.test.ts test/loft-guide-command.test.ts`.
The final follow-up ran only the affected command test file and its lint. Successful unrelated checks were reused.

The real Studio first run passes the starter step and both D315 browser flows, with 17 and 64 **source controls**,
not spans. Both use the canonical degree-3 polynomial guide, dense clamped knots, unit authored weights and the two
height-section taper described above. The operator path is real file Open, History Shift selection, Guide dropdown,
preview, Apply, Undo/Redo, Save download, New part and Open. No selection staging hook supplies those inputs.
The test binds the one fresh body to the actual new loft producer and waits for deferred `massReady: true`. It checks
finite raw volume against 7/3 mm³ and centroid against (45/56,45/56,17/28) mm, each within 1e-9, and no viewport error.
An actual rendered preview frame must differ from the sketch-only view. Apply, Redo and fresh Open retain the body
and volume. The full original guide controls and knots remain in the copied recipe; the direct authored source also
retains its original weights. Equal weights are intentionally absent from the polynomial copied recipe.

Save uses the existing asset-free, current-schema JSON writer. Saved bytes are strictly decoded and parsed, then
compared with the complete accepted document as semantic JSON. No container magic, schema change or migration is
assumed. `browser/` preserves both input and saved `.bcad` files, the unmodified first flow log, display metadata and
six actual preview/applied/reopened PNGs. The parent directly reviewed all six images and confirmed shapes, HUD,
one body and reopening. This run used Chrome WebGPU at DPR 1, CSS/backing viewport 1140×900; `display.json` records
the measured values. The small fixture's UI mass can round to 0 g. That displayed value is separate from the raw
kernel mass proof and the browser's volume/centroid assertions.

Additional exploratory UI checks, other DPR values and other browsers are NOT_RUN. Full Model and Studio unit
suites are intentionally not repeated for D315; affected-scope checks are used and earlier PASS receipts are reused
because their API/schema contract is unchanged.
The final whole-Kernel and docs results are recorded above. This lane made no commit, push, PR or release.
The raw explicit-frame guide adapter remains NOT_RUN and is a separate later boundary. `validation.json` and
`artifact-manifest.json` preserve check scope and exact evidence hashes.
