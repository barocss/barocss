---
work_id: D334
artifact_type: source-review
status: draft
owner_role: independent-reviewer
source_request: Root delegated read-only Kernel, Model and Studio review
last_updated: 2026-10-29T14:35:01.515945+00:00
---

# D334 independent review

Snapshot: `d149657cce7d0b7946589e6daa7fb9ff885cb896`, branch `local/cad-dev`, with active uncommitted D334 source edits. Source hashes are in `snapshot.json`. This document records discovered issues before owner fixes. It does not certify later source changes.

## Ranked findings

1. **P2: admitted endpoint distance can produce an extrapolated placement.**
   - Kernel: `packages/barocss-cad/src/features/curve-cut-pattern.ts:64-67`.
   - Model validator: `packages/barocss-cad-model/src/engine/curveFeaturePattern.ts:112-114`.
   - Source example: points `[[0,0,0],[1,0,0],[1,0.1,0]]`, degree 1, clamped knots `[0,0,1,2,2]`, unit weights; spacing `1.1`, count `2`.
   - The total is `1.1`. The admitted final distance equals that total, but subtraction and division give fraction `1.0000000000000009`, so Y becomes `0.10000000000000009`, past the authored endpoint `0.1`.
   - A small arithmetic-only Node probe reproduced this calculation. No Boolean or product failure was measured.
   - Root accepted the finding and owns an exact segment-end snap plus bounded admitted fraction, with no distance tolerance extension. Status: FIX_IN_PROGRESS.

2. **P2: chat value edits cannot rebind a live path.**
   - `packages/barocss-cad-model/src/chat/part/features.ts:208-215`.
   - `editFields` receives bearing context and fits, but no `doc` scope. The new path field gets `eligibleCurvePatternPaths({})`, which is empty.
   - Thus `edit_feature` with `values: {path: validExistingDirectObjectId}` always refuses, although the corresponding GUI choice and a whole-feature replacement can resolve that object.
   - Add `doc: state.doc` to the scope and cover the existing-object path value route. Root owns the fix. Status: FIX_IN_PROGRESS.

3. **P2: several placed/copy/revision helpers discard direct context before live-reference admission.**
   - `packages/barocss-cad-model/src/engine/flatten.ts:14`: `flattenAssembly` returns `direct: undefined` without curve preflight; `placedBase` calls it at `engine/doc.ts:798`.
   - `packages/barocss-cad-model/src/assembly/edit.ts:50`: `partCopy` strips direct sources before any path preflight.
   - `packages/barocss-cad-model/src/assembly/definitions.ts:35`: `offerRevision` strips direct sources into the pending revision before any path preflight.
   - Main document evaluation and Studio's central `setDoc` later reject these nested live nodes. Accepted Studio state is protected in those central routes. However, these helper functions can return a source-orphaned document or produce a missing-source refusal after the placed context was lost.
   - The D334 contract requires refusal before context loss. Preflight the placed wrapper before these operations strip direct sources. Root informed; scope decision pending. Status: OPEN_SOURCE_GAP.

4. **P3: inline raw paths are shown with a live-path selector.**
   - `packages/barocss-cad-model/src/app/editFields.ts:557-558` in the initial snapshot.
   - Raw paths return an empty selected value while all eligible direct objects are offered as options. A raw-only document has an empty select; a document with direct objects can show an option that is not the stored raw path.
   - Count and spacing edits preserve the raw path, so this is a UI state representation issue rather than demonstrated geometry loss.
   - Root already identified this issue and notified the Model owner. Status: FIX_IN_PROGRESS.

## Confirmed source properties

- Kernel raw admission calls `validateCurve`, including the native 2..64 control-point bound, finite coordinates, clamped knots, and degree-limited interior multiplicity.
- Degree 1 uses the authored poles. Degree 2 requires odd pole count, doubled interior knots and exact endpoint midpoints; unit weights are required. Unsupported curves are refused, without sampling or projection.
- Kernel exact midpoint uses binary64 dyadics. Model midpoint uses error-free TwoSum under bounded finite coordinates; the inspected subnormal/cancellation cases were consistent with that contract.
- Count is 1..64. Spacing is finite positive and at most 10000 mm. Count one still validates the path and source before returning the seed.
- Original CUT history is retained. The feature uses the direct difference's original tool, fixed identity orientation, and offsets relative to path start.
- Model raw and `{objectId}` variants use disjoint field admission. Live objects resolve from current direct sources. Unsupported object/source metadata is refused.
- `evaluatedPart` retains direct sources when live path nodes are present. Native file admission lists the new kind and invokes document preflight without a schema bump.
- The document walker checks instances and pending revisions, including hidden nested documents. It rejects live paths below the base document.
- Studio `prepareDirectCurveCandidate` checks the whole candidate and resolves the affected consumers. Source edits use the existing staged Worker lane.
- Studio stages reserve ownership synchronously. Completion checks request, accepted document, evaluated input, and work token after asynchronous operations.
- Escape, Cancel and Open intent invalidate the request and release the candidate work token. Stop invalidates the candidate and cannot borrow a committed history transition. Central `setDoc` validates before Undo and accepted-state mutation.
- Studio insertion explicitly preflights the placed context before stripping `direct`.
- The new selected-direct Delete/Backspace branch runs after composing, typing, palette and workspace guards. It calls `commitDirect`, so consumed path deletion is refused before source loss.

## Proof boundary

This review ran only read-only source commands and one small arithmetic probe. It did not run builds, package tests, Worker tests, browser tests, or Boolean evaluation. It did not edit source, commit, push, or repeat another lane's successful checks. Root and lane receipts remain separate evidence.

## Source resolution update 1

Timestamp: 2026-10-29T14:36:05.505722+00:00. Source hashes: `resolved-source-1.json`.

- Finding 1: SOURCE_RESOLVED. Kernel snaps an admitted distance equal to the segment end and clamps the interior fraction to [0,1]. Model uses the same rule. The strict total-distance check stays in place.
- Finding 2: SOURCE_RESOLVED. Chat `editFields` now receives `doc: state.doc`, so live path options use the current document.
- Findings 3 and 4: still open in this update snapshot.
- This update is source-only. Root owns focused regression execution. Initial discovery references describe the earlier source read, while `snapshot.json` was captured during active owner updates; use this update for resolution state.

## Final source resolution

Timestamp: 2026-10-29T14:37:08.947186+00:00. File hashes: `final-source-snapshot.json`.

All four findings are SOURCE_RESOLVED in the final reviewed source.

- Finding 3: `flattenAssembly`, `addPart`, `partCopy`, and `offerRevision` now validate a placed-context wrapper before source removal or revision comparison. The focused source test checks helper refusals, unchanged inputs, and an inline-path positive route.
- Finding 4: raw paths now show an explicit empty-valued `Inline path` option. Choosing that value preserves the raw path; live references use their ordinary object choices.
- Final numeric regression source asserts exact endpoint `[1,0.1,0]` and refusal for `1.1000000000000003`.
- Final chat regression source rebinds an existing path object through `edit_feature` values and preserves feature identity.

Final source verdict: **NO_REMAINING_ACTIONABLE_FINDINGS_IN_ASSIGNED_SOURCE_SCOPE**. This is not a build, test, Worker or browser PASS. Those checks were NOT_RUN_BY_REVIEWER and must use the coordinator or owner receipts.
