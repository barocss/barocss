# D346 Model/API/Studio source map

Status: READ_ONLY_PREPARATION. No repository edit, build, test, browser or geometry execution. D345 artifacts remain frozen. The Kernel numerical contract is not yet fixed; no implementation is authorized by this note.

## Current contracts and propagation

| Layer | Source | Current behavior |
| --- | --- | --- |
| Public raw shape | packages/barocss-cad/src/api/spec.ts:106-108 | CurveFeaturePatternPath is RawNurbsPath or objectId; options path, spacing:Dim, count:Dim |
| Public spec | api/spec.ts:238-242 | positive spacing<=10000, integer count1..64, original included; carries path without a new curve schema |
| Core facade | api/part.ts:213; api/kernel.ts:103 | same curveFeaturePattern method; raw path goes to existing curve-feature-pattern node |
| Model facade | packages/barocss-cad-model/src/api/studio.ts:46,87 | raw/live path passes through existing command context; spacing bindable, count not bindable |
| Model node/compiler | engine/doc.ts existing curve-feature-pattern union; engine/part.ts:139 | current node shape already fits new curve data; live path resolved on every compilation |
| Model raw admission | engine/curveFeaturePattern.ts:16-48 | unit weights, degree1 or straight degree2, exact middle-pole midpoint, open path, valid knots and bounded coordinates; chord-sum length |
| Model live lookup | engine/curveFeaturePattern.ts:52-73 | exactly one base-document objectId, native mm source, curve-only matching geometry, no unsupported object/source metadata; hidden/rename preserve identity |
| Model placement admission | engine/curveFeaturePattern.ts:100-118 | duplicates chord segment walking, distance bounds and represented offset checks; changing only midpoint admission would leave this wrong for curved spans |
| Kernel planner/replay | packages/barocss-cad/src/features/curve-cut-pattern.ts:25-73; part/part-model.ts:1946-1958 | straight offsets only; existing original CUT/source activity, identity orientation, @k names, unchanged Boolean replay |
| Picker and fields | Model app/commands.ts:812-822; app/editFields.ts:577 onward | actual Path choice, spacing/count, live objectId, existing editor and Current/Inline path policies |

`curvePatternPathLength(value):number` is an existing exported Model function, already captured by D334 API inventory and tests. Its old straight results must remain unchanged. No new method, node type, fields, units, format version or schema is inherently required for one quadratic span. Accepted-input semantics would widen under the existing method. Any new shared Kernel planning export/subpath must be explicitly agreed with root and counted in API adoption; do not assume zero API delta before that decision.

## Existing lifecycle and file gates

- Model `curveFeaturePattern.ts:121-140` validates saved, suppressed, nested and pending recipes. Live objectId paths remain base-document-only; inline raw paths retain existing nesting policy.
- Model `engine/migrate.ts:63-64` invokes complete curvePatternDocumentProblem before accepting native data. `engine/container.ts` invokes readStudioDoc for decode/encode checks. Wire/native file must preserve original raw curve or live objectId and spacing bindings; no migration is needed merely to admit new values in existing fields.
- Model `curveFeaturePattern.ts:145-158` compares old/new resolved paths and marks live consumers affected. Renaming/hiding or translating the complete source can preserve relative placements; missing, shortened or changed source is revalidated.
- Studio `app/directCurveCandidate.ts:7-27` keys consumed live paths and prepares unaccepted candidates; lines31-40 stage edited feature nodes and reject unsupported inserted live parts.
- Studio `App.tsx:840-856` routes Direct edits through prepareDirectCurveCandidate and existing owned evaluation before commit; `App.tsx:247` revalidates path documents at general setDoc; `App.tsx:1946` stages edited pattern nodes. Invalid curve edits must preserve accepted source, body, document and Undo state.
- Existing D334 actual harness `apps/cad-studio/test/curve-cut-pattern-browser.mjs:174-239` maps Path/Spacing/Count, preview refusal, source Move/Stretch/delete, Undo and native fresh Open. Reuse its public selectors, not its old straight-only expected geometry.

## Minimal Model changes after High fixes the contract

1. Replace or delegate only the numerical admission/length/placement parts of engine/curveFeaturePattern.ts. Both curvePatternPathLength and curveFeaturePatternProblem must consume the same qualified curve family and length/placement authority as Kernel. Do not leave the chord loop active for curved paths, and do not write an independent second arc-length solver in Model.
2. Keep object lookup, source metadata limits, live identity, parent CUT activity, nesting, suppressed admission and source candidate ownership policies. Refuse with existing VALUE/BAD_REFERENCE mapping; do not invent a refusal code.
3. Preserve old degree1 and exact straight degree2 results, order, raw serialization, offsets and names. No-hole Fill and D344 mass code are unrelated and stay frozen.
4. Update only the two Path cut pattern product strings in commands.ts once the accepted family is fixed. The existing path choice/editor, compiler and API node shape already propagate it; change those only if a verified wiring defect requires it.
5. Add focused Model tests under a new D346 test, retaining all D334 no-change controls. API root inventory/type adoption belongs to root. Whether a shared helper adds an export is a pending Kernel boundary decision.

## Confirmed actual UI authoring route (source only)

No imported curve injection or new creation tool is needed:

1. Clear selection, start a standalone world XY Sketch, choose Line, and draw an open single segment P0=(0,0) to P2=(20,20). Use existing Point N X/Y numeric fields to remove pixel/snap uncertainty. Do not Finish as a closed profile.
2. Click existing `Make curves` (`SketchPanel.tsx:185`). `sketch/useSketchActions.ts:54-66` calls outlineCurve and imports its CAD source, then selects the newly added direct object.
3. `Model engine/curveSource.ts:13-16,31-37` guarantees a one-line span becomes degree2, three poles P0,(P0+P2)/2,P2, knots[0,0,0,1,1,1], weights[1,1,1]. This is a source fact to assert against the actual stored source during the browser run, not a completed product observation.
4. In `Direct geometry`, choose `Control point` value `1` (label P1). `DirectPanel.tsx:126-127,190-200` exposes lazy X/Y/Z and Weight fields. Set X=20 and Y=0, committing each with Enter or blur. These controls have explicit aria-label X/Y, unlike the unrelated Sketch rectangle unit-label issue retained in D345.
5. `directOps.editCurvePole` (`Model engine/direct.ts:155-157`) edits native source coefficients through the existing public operation; `DirectInspector.tsx:17-19` and App commitDirect own the actual edit. Decode the actual source via public compile/model query and verify degree, knots, exactly3poles, weights1 and P0/P1/P2. Before a consumer exists, both intermediate edits remain ordinary direct-geometry edits. After consumption, the candidate lane must admit or reject them atomically.
6. Select original CUT, open existing Path cut pattern, choose that same live objectId and use root-approved literal spacing/count. The new curved source currently fails the intentional straight-only admission; actual acceptance is pending implementation and tests.

## Selection lifecycle priority

Current successful App Apply clears geometry selection only for Offset and Fill (App.tsx:1049). Path cut pattern is not in that branch. With witness420 placed after the original CUT, appending a replacement path-pattern result may reorder bodies and leave the old body index pointing to the witness. This is a source-identified risk, not a reproduced D346 defect. The actual D346 driver must record selected indices and body keys immediately after Apply and fail on witness alias. Do not repair through hooks or hide it with a later pick. Root can assign a bounded Path-specific acceptance fix only after actual evidence. The D345 alias was separately confirmed/repaired and is not reopened here.
