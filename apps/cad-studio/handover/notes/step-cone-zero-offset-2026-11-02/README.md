---
work_id: D444
artifact_type: step-cone-zero-offset
status: bounded-qualified
owner_role: executor
source_request: "Continue roadmap row 13 after D443; defer UI discussion"
last_updated: 2026-11-02
---

# Read exact-zero direct cone STEP frustums

D444 continues rows 13/16 at `aff54c47d5186cb8f156771982570df5cf23e40e`. Overall progress remains about 43%. **PASS:** current CAD 161 and Model 12 tests, independent source/math/25 behavior checks, eight valid semantic mutants, and one three-state actual Studio flow. **FAIL retained:** the first compiler errors and original rank-test fixture assertion. **NOT_RUN:** full kernel, nonzero cone admission and new physical accuracy. [qualification.json](qualification.json) records exact commands, hashes, reuse and limits.

## Selected capability

A direct `CONICAL_SURFACE` wrapped by `OFFSET_SURFACE` can now use an exactly zero scalar distance on the declared positive regular-frustum subset. Private metadata is tied to the actual parsed third attribute of the simple entity. Its numeric token must have an all-zero mantissa; exponent digits are separate. Numeric equality alone would admit a mathematically nonzero value that underflows to binary64 zero.

Cone-local guards validate the reached source attributes and orientations before shared-edge cache returns. The profile requires one connected outer four-use loop: two closed CIRCLE rims and one LINE seam in opposite senses. Existing source endpoint/pinning checks remain after splitting. Actual padded chart endpoints must have finite nonzero spans and positive computed/exact represented-coefficient radii. Every stored control and positive weight is checked before an exact affine-rank-three witness, using the original rational budgets.

Construction uses the unchanged legacy `frameOf`/radius/`Math.tan` expressions. `offsetFrameOf` has a different normalization order, so its output is used only for validation. Complete paired native results retain IDs, coordinates, knots, weights, senses, names and original tolerances. Canonical output retains D443's native hash; oblique/nonunit and cap-first pairs also match exactly. Old plane/cylinder/sphere paths and the sphere precision helper remain unchanged. No B-rep core, public API, fitter, dependency, unit, schema or tolerance change is selected.

The [surface definitions](https://www.steptools.com/stds/smrl/data/resource_docs/geometric_and_topological_representation/sys/4_schema.htm), sections 4.5.61/4.5.86, support zero displacement on regular cone support. The selected guards are necessary bounded representation/source conditions. They do not establish global immersion, trim validity, full schema conformance, normal fidelity or improved legacy physical accuracy. Other cone profiles and all nonzero distances retain named refusals.

## Verification and preserved history

D443's existing refusal is reused as baseline. No baseline product run is repeated. Source audit finds and fixes two issues before execution: validate all controls/weights before returning a rank witness, and require cyclic loop endpoint connectivity.

The first build stops on six TypeScript narrowing diagnostics before product tests. Three erased assertions after existing runtime guards correct it; independent byte reversal recovers the reviewed source exactly. Failed emitted files remain unqualified. The next admission attempt is NOT_RUN because a foreign gate holder is active; its process is untouched.

The successful build then passes 23 new cases and fails one fixture assertion. That original far-XY fixture reaches an older seam/opposite-side refusal before the intended rank guard. A test-only exact 90-degree Z permutation retains Y/seam/opposite and height while X rounds to a plane. Radius, height, angle, source guards, budgets, tolerances and expected reason stay unchanged. Independent source/math review approves it before execution. The isolated corrected case passes; exact block reversal permits reuse of the other 23 passing bodies. The eight previously unrun affected STEP files pass 137 cases. CAD types, owned lint and code-shape checks pass. No 24-case replay or rebuild follows this test-only change.

The independent campaign passes 25 behavior checks and kills eight valid semantic mutants: six wrong successes, one wrong refusal and one native-output mismatch. There are no survivors, invalid/crashing mutants or fallback-only reason kills. The scratch harness records actual native returns and typed/untyped outcomes; loader/runtime errors cannot become semantic kills. Root rehashes all 730 input rows and verifies the owned PID and released lease.

Public Model calls compare the entire native and display/body results, including all IDs and seven quantities. Both 9,696-byte prepared files differ only in one explicitly matched source-revision description; distinct authored source keys remain. Six existing unit/refusal and six profile-loss tests pass with their original physical limits. One stale expected basis word changes from SPHERICAL to CONICAL to match the unchanged D436 negative fixture; the original file/hash and exact inverse are preserved. No known-stale test is run merely to fail. Final Model types follow the last test/driver edit.

## Actual Studio

One run uses public Open/Fit for the plain file and the exact-zero file, then attempts a raw nonzero-underflow file. The distance token `1.E-9999` follows [Part21 Table 2/6.4.2](https://www.steptools.com/stds/step/IS_final_p21e3.html). An exact Decimal check is nonzero while binary64 is zero; the new file differs only in that token and reverses exactly to D443's zero bytes. The older bare-exponent draft is retained unexecuted. This qualifies the selected distance token and unchanged graph, not every fixture's full schema.

Plain and zero native display records and seven quantities are exact. Zero read request 6/revision 4 adopts evaluate request 7/revision 5. Underflow read request 9/revision 6 returns real `CAPABILITY` with the existing named cone detail. The authored zero document, native/adopted data, quantities, accepted source, camera/matrix bytes, meshes and effects remain exactly equal after refusal. Root views three PNGs and sees both accepted models and the readable refusal.

All 772 fixed inputs and 1,042 frozen paths match through cleanup and current root verification. All 70 passive runtime bodies are rehashed. Missing direct Camera.ts/flow-helper responses remain explicit; fixed source pins cover them. Errors, console errors, changes and downloads are zero. Owned resources close, PID 7755 is absent and the gate is released. The entire worktree remains frozen through cleanup. Geometry/audit work uses Sol High; Model/driver work uses Sol Medium.

## Follow-ups

[#2263](https://github.com/barocss/barocss/issues/2263) stays open. Nonzero/general offsets, remaining topology, assemblies, AP242 presentation/names/colours, sheets and PMI acceptance are incomplete. Nonzero cone admission needs signed-normal/nappe/apex and raw-angle/frame/reduction-error proof against original tolerances. #2258 fitter/public-thicken and #2266 widening HOLDs remain. UI stays deferred to row 15. No OCP, download, paid call, develop integration or release occurs.
