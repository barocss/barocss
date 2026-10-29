# D338 independent HIGH source review

## Result

**NO_REQUIRED_FINDINGS** in the reviewed production changes. No hard geometry defect, snapshot ownership defect, trim-context bypass, or acceptance-path defect was found by source inspection. This is a source review, not a runtime or product PASS.

Worktree: `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`, branch `local/cad-dev`. Base HEAD: `8c0710d7ab0cce6e09d4fb9c8c7379dba1f3d717` (published D337) plus D338 WIP. The listed 32 source/test inputs are hashed in `snapshot.json`. Workers were active during the review; the capsule identifies this inspected source, not an independently established whole-repository freeze. No repository source was edited by this reviewer.

Reviewer runtime, builds, typechecks, tests, browser, heavy work, commit and push: **NOT_RUN**. Parent/worker receipts remain separate evidence. Only `/tmp/d338-review` was written.

## Contract and ownership

- `packages/barocss-cad/src/api/surface-snapshot.ts:9-60` captures exactly the six own data fields, allows only plain/null-prototype records and plain dense arrays, refuses extra string/symbol metadata and accessors, and copies every numeric array/point. Array size bounds 16 per pole axis / 22 per knot axis follow native maxima (16 + degree 5 + 1). The helper then uses existing `validateSurface`, rather than introducing a second geometric validator. Original nonunit knot domains, degree 1..5, coordinate/weight limits remain those of `src/core/math.ts:9-39,60-80`.
- `src/api/spec.ts:193-199` checks positive finite thickness, the existing 10000-mm maximum, and the three side values. Default `normal` is omitted. No trim wrapper, identity, transform, live source, quality/grid option, or new geometric tolerance is admitted. This is a raw whole-support recipe; it cannot restore trim metadata that an external caller has already discarded.
- `src/api/part.ts:151-152,248-267` uses the common parameter resolver and constructor `#make`, preserving an existing chosen body. Its TOOL branch focuses the sole new body for the existing Boolean callback contract. Kernel binding is `t -> thickness` (`src/api/kernel.ts:145-148`); Model binding is `t -> edit field t` (`cad-model/src/api/studio.ts:74-84`). Side and geometry cannot obtain a successful binding through the new route.
- Kernel writes the existing `thicken` feature and evaluates before returning (`src/api/kernel.ts:48-49,187-194`). Part constructor/next/get-doc copying (`src/api/part.ts:82-90`) prevents caller input and returned document mutations from changing an accepted Part. Model captures again through `thickenSpec` before storing the existing node (`cad-model/src/engine/thicken.ts:42-45`). No new saved-node/schema identity or source lifetime system is introduced.

## Context retention and actual Studio acceptance

- `cad-model/src/engine/thicken.ts:11-15` handles a supplied raw snapshot before asking for `directNow`; the public Model facade therefore does not require a Direct module or selected body. `src/api/studio.ts:44-47` sets the explicit `Whole surface snapshot` label.
- For a selected Direct source, `engine/thicken.ts:16-28` requires exactly one selected ID and exactly one matching current Direct object. It checks nonempty and malformed trim containers **before** reading the source model or copying six geometry fields. It then requires an own current source and exactly one source geometry of kind surface. The source name is a label, not a dependency. Existing direct geometry is retained visible and unchanged by `withNode`.
- `app/thickenCommand.ts:5-18` shares admission, defaults, side fields, and node construction. `DirectInspector.tsx:10-24` delegates its old immediate callback to that command through `App.tsx:1926-1931`; it no longer clears selection or commits an unevaluated thicken node itself.
- `App.tsx:1091-1097,1137-1139` checks availability and captures the command document. Existing `state/useCommandPreview.ts:48-91` catches build errors, runs native preview, and records success/error without document acceptance. `App.tsx:1029-1048` refuses Apply when `commandDoc` has changed, waits while preview is busy, requires preview `ok`, then builds/commits; selection clears only after successful commit. Native fold failure therefore cannot reach the new command's accepted document through a failed preview. `App.tsx:1009` cancels without commit. The stale-source comparison is deliberately conservative: unrelated model changes can require restarting Thicken, but stale geometry is not silently accepted.
- Reopened thickness and side are editable (`cad-model/src/app/editFields.ts:532-543`); explicit normal removes the saved optional side. `chat/features.ts:43-46,139-145` runs ordinary field checks and strict raw snapshot admission for checked feature nodes. `chat/part/features.ts:28-34` excludes Thicken from chat run-command enumeration because that tool has no raw-snapshot or Direct-selection argument. Checked features.add and public API remain available. No arbitrary tool blob/argument extension is needed.

## Existing geometry and refusal boundaries

The following files are byte-equal to base HEAD in the review capsule: `core/math.ts`, `brep/thicken-solid.ts`, `blend/offset-cavity.ts`, `mesh/mesh-brep.ts`, `part/part-shell.ts`.

`thicken-solid.ts:25-43` retains grid 40, du-cross-dv normal, normal fallback, offset direction, and fold check. `:45-61` retains the sampled two sheets/four walls and existing mesh-to-Brep construction. It makes a faceted approximation for curved supports; D338 does not certify generic smooth offsets, global offset nonintersection, trimmed solids, or arbitrary curved mass.

Raw Core refusal category and facade refusal are distinct. Existing `part-shell.ts:24-28` maps native `[OFFSET_FOLDS]` through Core CAPABILITY; the Kernel facade can expose `code=OFFSET_FOLDS`, `where=evaluate`, `details.kernelCode=OFFSET_FOLDS`. Model's existing `api/refusal.ts:13-15` exposes the mapped code and `details.friendly`. A claim that the facade preserves raw Core CAPABILITY as its top-level code would be inaccurate. No native error/tolerance rewrite is required.

## Native versus public Model names

The reported flat-fixture native 73 faces and public Model 6 faces have different, source-grounded meanings:

1. `cad/src/mesh/mesh-brep.ts:64-76` joins triangles only after normal/plane proximity **and exact binary64 coplanarity**. A mathematically flat sampled support can retain additional native side-wall partitions when evaluation produces slightly different represented coordinates. `:85-88` names those native groups `<feature>.facet<k>`. These are not six newly canonicalized top/bottom/side names.
2. `cad-model/src/engine/mesh.ts:101-114` separately merges adjacent planar native faces for display using its existing normal threshold and `1e-6 * scale` plane threshold. `:129-132` preserves all member names, joined with `+` when more than one name remains. It changes the display grouping, not the native B-rep.
3. `cad-model/src/api/studio.ts:116` calls `meshSelection`; `src/api/select.ts:20-24` feeds those display faces to the shared query. Shared `cad/src/api/select.ts:118` returns each composite display name. Thus 6 queried names do not imply 6 native B-rep faces. A stored joined selection name is a composite reference; it does not assert an exact individual native face or a new per-member signature guarantee (`cad-model/src/engine/part.ts:86-101` already distinguishes merged signatures).

The worker log `/tmp/d338-model/focused-retry2.log` was read as external evidence: its diagnostics report 73 native names and 6 public names, four of which are `+` composites. That agrees with the source. This reviewer did not execute that test. Freeze native and public name sets separately for the qualified plane, thickness edits, side edits and file roundtrip. Neither count is a universal whole-family contract. Do not change coplanarity tolerance or redesign geometry to force six native faces.

## Verification sufficiency and remaining proof

The focused tests inspected cover the asymmetric nonunit-domain plane, the three directions, independent volume/centroid/bounds, validity/closed shells, owned arrays, invalid payloads, t binding, chosen witness body/TOOL behavior, actual native file semantics and names, direct trim/malformed/ambiguous reference refusal, raw context without Direct state, and native fold failure. They are meaningful acceptance checks; this review does not count their source presence as execution.

Browser proof still belongs to the root's serial flow: actual DirectPanel preview/Cancel/Apply/Undo/Redo, t/side editing, Save/New/fresh Open, copied source lifetime, trim/fold refusal with document and selection unchanged, valid retry, and explicit public-API-generated file. The pure Model command test builds an unaccepted candidate before `evaluateDoc`; that alone does not prove App acceptance/Undo behavior. The App source path is coherent, but runtime proof must remain separate. No further source fix is required by this review.
