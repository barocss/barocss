# D339 independent HIGH source review

## Result and proof boundary

**NO_REQUIRED_FINDINGS.** Source inspection found no required production change in the reviewed Sew facade, command, context capture or Studio acceptance path. No new geometry algorithm or tolerance expansion is present.

Fixed worktree: `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`, branch `local/cad-dev`. Base HEAD: `fec23cf2acef80210c28092981f54e6191e90eeb` (published D338), plus D339 WIP. Model production freeze was reported by the owning worker in `/tmp/d339-model/source-ready.md`. `snapshot.json` identifies the 35 inspected inputs. Kernel test assertion work may still be active; this is a listed-source capsule, not a whole served-graph freeze or runtime receipt.

Reviewer runtime/build/typecheck/lint/tests/browser/heavy work/commit/push: **NOT_RUN**. Only `/tmp/d339-review` was written. Parent and worker runtime results must be reported separately. The original listed-input recheck found0 changes at its capture time. A later post-worker recheck found exactly1 changed input: `packages/barocss-cad-model/test/api-sew.test.ts`, with no production change. Its original reviewed hash was `dd13fcb199dd637f5ffdc764a5adcc150c5ccae18fe0b890b7d69079de5d6c3b`; final hash is `8750a6dac9031c7a5799cad66b4fac03b453b802c73e5ee5734222bacbc04364`. Final source inspection confirms the test's explicit ModelNode import and ModelNode[]/ModelNode annotations at lines8,74. The parent identifies this as the TS7022 assertion-source correction. `final-snapshot.json` is the final35-input table, `final-recheck.json` retains the exact delta, and the original `snapshot.json` is preserved. Every final worker-owned hash matches; no geometry or production-source review finding changes.

## Strict admission, ownership and ordering

- `packages/barocss-cad/src/api/surface-snapshot.ts:16-21,63-69` requires a plain dense own-data outer array of2..64 surfaces. Getters, sparse entries, string/symbol metadata, foreign containers and count overflow refuse. Each surface uses the D338 exact six-field capture and existing `validateSurface` (`:35-60`). Numeric coefficients, knots, rows, points and weights are copied, not retained. The label parameter defaults to the original `thicken surface`, so existing Thicken helper diagnostics retain their words. Native surface degree/pole/domain/coordinate/weight rules are reused.
- `src/api/spec.ts:203-207` defines the new scalar contract: omitted/0 selects native auto; finite explicit(0,1] is retained without clamping; invalid values refuse VALUE. `SewOptions.tol` is numeric (`:95-96`), not Dim. No Core or Model saved-node tolerance type is widened.
- `src/api/part.ts:151-155` uses inherited `#make`; no target body is consumed. Existing `#spec/#make` behavior preserves body choice and focuses the sole new body in a Boolean tool callback. Kernel `src/api/kernel.ts:48-51` writes the existing Sew feature, omits tolerance for0, and introduces no Sew binding table. Existing evaluate-before-return and Part constructor/doc copying preserve accepted ownership and immutable facade failure.
- Neither helper nor backend sorts, deduplicates or rewrites surface order. Native `src/brep/sew-solid.ts:37-48,108-123,144-156` retains first welded-corner/first paired-boundary authority and face names `<feature>.surface<k>`. Reordering is deliberately a new ordered recipe; the same physical surface is not promised its old suffix after reorder.

## Original selected metadata is checked before support capture

`packages/barocss-cad-model/src/engine/sew.ts:24-63` has the required order:

1. Supplied raw snapshot returns through `capture` before any Direct state or module access (`:25`).
2. Direct selection must have2..64 distinct IDs, each resolving to exactly one current DirectObject in selection order (`:26-40`). Explicit loops retain order and reject ambiguous/missing IDs rather than filtering them.
3. **Every** original trim container is checked (`:41-45`) before **any** source lookup/compilation/support access. Omitted or empty plain unadorned array is whole support; nonempty, malformed, foreign or decorated array refuses. A late trimmed member therefore cannot be bypassed by first copying earlier supports.
4. Own current source strings are checked only afterward (`:46-48`), then Direct module availability and each unique current source geometry of kind surface (`:49-60`). All admitted geometry passes the same strict shared capture.

`capture` (`:10-20`) also requires a plain dense own-data names array matching the surface count, copies string labels and preserves order. Labels are metadata, not topology keys or live references. `sewNode` (`:71-73`) owns stored surfaces/names and maps0 to omitted native tolerance. Raw Model facade context (`src/api/studio.ts:47`) produces deterministic copied labels and has no Direct selection or visibility side effect. Moving/deleting/renaming originals cannot update an accepted node's saved coefficients. No new live-reference lifetime model is introduced.

## Tolerance editing and unsupported binding

`cad-model/src/app/editFields.ts:91-95` returns Sew tol as a number field without the generic bind wrapper. `:543` validates through shared `sewSpec` via `engine/sew.ts:66-68`, stores positive values exactly and deletes tolerance for auto0. It rejects the old silent clamp behavior at the new shared boundary. Native files retain the existing optional numeric tolerance shape.

`engine/parameters.ts:69-76` now rejects fields without `bind` before invoking it and lists only fields carrying `bind` in the diagnostic. Thus direct `bindParameter` calls on Sew tol receive existing PARAMETER_UNBINDABLE rather than a missing-function error. Shared facade casted Params cannot succeed because neither backend defines BINDS.sew; unknown-parameter lookup keeps its existing earlier boundary. Other wrapped number fields retain their existing bind path. This is a narrow necessary integration change, not a general parameter redesign.

`chat/features.ts:47,147` adds checked existing Sew nodes with strict shared capture/tolerance validation. `chat/part/features.ts:28-34` excludes Sew from run-command tools whose arguments do not contain raw surfaces or Direct IDs, while checked features.add and public Part/UI remain available. No tool blob or new argument shape is introduced.

## Candidate hide, preview, Apply, Cancel and latest source

- `cad-model/src/app/sewCommand.ts:15-19` builds the new existing Sew node first. Raw context returns without changing Direct state. Selected context changes hidden=true only for the validated selected IDs, **in the candidate**, preserving unrelated objects and original document state. No accepted document/Undo mutation occurs in this builder.
- `apps/cad-studio/src/ui/DirectInspector.tsx:6-23` now delegates Sew to App; its former immediate unevaluated commit, source-copy and selection-clear code is removed. Thicken continues its existing callback path. App verifies callback IDs equal the current ordered selection before start (`App.tsx:1926-1931`).
- App's existing start/preview mechanism remains: availability checks capture the current command document (`:1091-1097,1137-1139`); `state/useCommandPreview.ts:48-91` builds/evaluates candidates and records native failure as preview error. `App.tsx:1033-1048` checks source/document identity for both Sew and Thicken, waits for busy preview, requires preview ok, then rebuilds and commits. It clears Direct selection only after commit succeeds. `:1009` Cancel does not commit.
- Candidate Direct hiding is an intentional change, so existing `commit`/`carryOver` retains it with the new body in the same accepted Undo step; it is not a separate accepted hide action. `commandDoc` includes shown Direct sources even when the evaluated solid prefix is unchanged (`app/directCurveCandidate.ts:17-18`, `App.tsx:640,770`). A changed source/document blocks stale Apply and requires restart. This is conservative and coherent with the copied snapshot contract.

The source is consistent with failed preview/Cancel preserving accepted document, original visibility, selection and Undo. Actual App/Undo behavior is still browser proof; the pure Model candidate test cannot by itself establish it.

## Geometry, mass, topology and names

All six listed existing geometry/admission files are byte-equal to base HEAD in the capsule: `brep/sew-solid.ts`, `part/part-mesh.ts`, `part/part-model.ts`, `core/math.ts`, `brep/brep-core.ts`, `nurbs/surfaces/surface-isocurve.ts`.

Native default remains `max(1e-6,maxAbsControlCoordinate*1e-3)` (`sew-solid.ts:87-90`); explicit native tolerance remains(0,1] at `part-mesh.ts:54-61`. No auto value is replaced by the public0 sentinel:0 means omit tolerance, allowing native to calculate it. Source positions can affect auto tolerance; it is not a universal1e-7 or bbox-span tolerance.

Native sewing retains natural surface boundaries, bidirectional sampled boundary fits, orientation/connectivity/no-volume checks and final assertValidBrep (`sew-solid.ts:94-163`). Shared surfaces and paired edges are not repaired by new code. The implementation adds no trim sewing, generic healing, exact arbitrary curved fit/global intersection certification, performance claim or whole08 acceptance.

The independent oracle in `/tmp/d339-plan/oracle.json` is appropriate: six mixed-orientation nonunit-domain natural patches form `[10,-6,3]..[50,24,15]`, dimensions40x30x12, volume14400, centroid[30,9,9], area4080,8vertices/12edges/6faces and one closed shell. Ordered areas1200,1200,480,480,360,360 and physical centroids/normals catch reorder/transposition mistakes. Coincident planar boundaries preserve this geometry through explicit.01/.02 and auto0 (native.05 for this profile); no approximate-gap mass inference is needed.

Kernel test source checks per-name physical centroids, normals and areas and reverse-order name relations (`test/api-sew.test.mjs:29-49,67-69`), beyond aggregate mass. Model tests derive expected suffixes from the accepted node ID rather than assuming n0 (`cad-model/test/api-sew.test.ts:50-60`). Public Model names come from existing display grouping; capture native and public sets separately even though this orthogonal box should expose six groups. Count6 is qualified only for this box, not arbitrary Sew results. The separate witness420 and Boolean callback controls establish constructor focus/body independence.

## Refusal and remaining qualification

The helper rejects invalid caller data with VALUE. Native closure failure follows unchanged `part-mesh.ts:64-66` mapping and existing facade/Model error adapters. A raw SewError, CadPartError category and public mapped error are different boundaries; this review does not guess their observed top-level codes. Record actual Kernel code/details and Model code/friendly details from their focused runtime receipts. No native error semantics need to be rewritten to satisfy a guessed assertion.

Focused test sources include outer/inner ownership and accessors, native limits, input order and physical names, auto/explicit tolerance, numeric-only binding/refusal, independent closed-box geometry, witness/TOOL focus, semantic file roundtrip, all-trims-before-source validation (late member plus throwing source getter), candidate-only hiding, copied lifetime and open-shell failure. Those are substantive checks, but source presence is not test execution. BrepBody.shells is a list of IDs; the corrected Kernel test resolves that ID through brep.shells before checking closed, which is a test-shape correction rather than a product geometry fix.

Root's actual Studio flow must still prove six selected surfaces in authored order, preview/Cancel/Apply, exact source hiding in the accepted Undo step, UndoRedo, tol.01->.02->auto editing, Save/New/fresh Open/reeditable numeric tolerance and ordered snapshot/name retention, copied source move/delete lifetime, invalid trim/open-shell no accepted change/no extra Undo and valid retry. The API-produced native file and actual selected-source UI paths are separate proofs. No required production fix was found before that qualification.
