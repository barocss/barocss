# D335 independent source review

Scope: Kernel, Model and Studio source in the specified worktree. Base is 9229acb83c77fa56d4b1649df84e412d05e8e4df. Other workers edited their owned files while this review ran. source-manifest.json identifies the captured end state. reviewed-diff.patch captures tracked changes. New file contents are identified by hashes in the manifest.

## Result

No P0/P1/P2 issue identified in the inspected implementation. One P3 snapshot-source admission issue is described below. This is a source review, not a runtime or product PASS. The reviewer did not edit product files, run tests/builds/browser, commit or push. Independent planning arithmetic was read from /tmp/d335-plan/independent-oracle.json; it was not promoted to runtime proof.

## Finding

[P3] Require full Vec3 shape before treating an explicit sketch plane as world XY.

File: packages/barocss-cad-model/src/engine/fillFeaturePattern.ts:16.

Evidence: each explicit plane vector is checked only with .every against a canonical array. Empty vectors (origin: [], normal: [], xAxis: []) satisfy all three .every calls and the plane has the expected three keys. fillRegionSnapshot can then return an inline polygon and eligibleFillPatternRegions can list this invalid sketch as a world-XY region. This contradicts the source helper's declared admission contract. The Kernel's frameOf at packages/barocss-cad/src/part/part-model.ts:1181-1196 separately requires length 3, so geometry evaluation still refuses this malformed source. This limits severity; the normal GUI-created plane is not affected.

Inference, not executed reproduction: a plain polygon sketch with the explicit empty-vector plane passes this helper guard. Recommended focused correction: require three dense finite numeric components on all three vectors before comparing exact canonical world-XY values. No general frame conversion or new profile is needed.

## Checked source contracts

- packages/barocss-cad/src/features/fill-cut-pattern.ts:10-43 snapshots own data descriptors, refuses sparse/extra point data, non-finite values, out-of-range coordinates and unsupported region shape; calls the unchanged native 3..16 simple-loop qualifier.
- packages/barocss-cad/src/features/fill-cut-pattern.ts:46-71 uses positive-denominator exact homogeneous coordinates, exact orientation, closed-boundary intervals and half-open crossing parity. It adds the authored anchor and represented grid offset as rationals. No Number sum is used for admission. The arithmetic and crossing orientation agree with the frozen contract by source inspection.
- packages/barocss-cad/src/part/part-model.ts:1929-1944 checks finite signed nonzero spacing and count/product bounds before mask generation; calls cutSource before one-cell, empty-tool or zero-extra returns. It retains the original seed and sequentially subtracts only admitted translated original tools, using original @i,j suffixes.
- packages/barocss-cad/src/api/spec.ts:199-207 enforces positive public spacing and safe 1..64 counts/product. Public API options/spec/method and Kernel adapter are wired. Both spacing bindings exist; count bindings are absent and use the existing PARAMETER_UNBINDABLE path.
- packages/barocss-cad-model/src/engine/fillFeaturePattern.ts:35-66 validates active direct-difference parents and all raw recipes including suppressed/nested/pending nodes. Model compiler, native reader and wire admission invoke it. Added assembly add/copy/revision and flatten preflights were inspected after they appeared during review. Generic shiftNode parent shifting and placedDoc post-pattern transforms preserve inline snapshot semantics.
- packages/barocss-cad-model/src/engine/fillFeaturePattern.ts:13-25 copies stored resolved rectangle/polygon/straight-line starts, as featureOf removes GUI outline edit metadata before compilation. It resolves parameter coordinates to plain numbers and refuses holes, regions, on/association, curved or non-world-XY sources (subject to the P3 malformed plane shape above).
- packages/barocss-cad-model/src/app/commands.ts:788-805 and src/app/editFields.ts:558-566 expose the real creation command and snapshot reselection, with reference coordinates, both spacings and counts. Counts and anchors refuse parameter binding. Snapshot input is copied before accepted node creation.
- apps/cad-studio/src/ui/FillPatternHints.tsx, Hud.tsx and NodeEditor.tsx visibly explain snapshot lifetime and reference-point masking. The hint says a cut may cross the region boundary.
- apps/cad-studio/src/app/directCurveCandidate.ts:31-37 stages fill edits through the established unaccepted Worker lane. App.tsx:658-752 guards the candidate by accepted document, evaluated input, request and work token; failures preserve accepted bodies/document; acceptance occurs only after successful evaluation/reference refresh/key construction. Existing discard, Escape, Stop and Open paths invalidate this direct-kind candidate. Source coverage is not a native UI proof.

## Remaining proof boundary

The candidate tests read during review exercise helpers and workOwnership state; they do not mount App or perform actual UI Cancel/Stop/Open. Actual native authoring, preview, independent mass/centroid, Apply, Undo/Redo, fresh Save/Open, spacing2 edit and snapshot replacement remain the product acceptance responsibility. No natural Boolean failure was produced by this review. Retain all first-failure and segmented-flow receipts.


## Resolution addendum: strict snapshot plane guard

Reviewed current committed source at HEAD 1fc5c49615399bc7cf247f9563226481e157de23. Product working tree was clean except inherited untracked .claude/. This addendum supersedes the original open-P3 status. No new audit scope was added.

Original P3: RESOLVED BY SOURCE INSPECTION.

Evidence: packages/barocss-cad-model/src/engine/fillFeaturePattern.ts:7-16 now implements a module-level worldXY guard. It requires the expected three enumerable plane keys, requires each vector to be an array of length 3, and checks all three own indices for finite numeric values equal to the canonical identity plane. Empty, short and sparse vectors fail before the helper can capture a snapshot. At line31 an explicitly supplied plane must pass this guard. The former empty-vector counterexample therefore cannot reach profile extraction.

The same line now checks holes and regions through emptyLoops (line18). Omitted fields and empty array containers are admitted; malformed/non-array containers and nonempty arrays refuse. The point helper is module-level (lines24-26). Polygon and straight-loop collection use explicit loops (lines36-42); loop segment-kind refusal occurs before reading segment starts, as before. The final fillFeaturePatternSpec still validates and owns the captured numeric polygon. These source changes address the reported admission issue without changing the frozen XY snapshot contract.

packages/barocss-cad-model/src/app/editFields.ts:89 keeps prior callers compatible: EditScope.doc still requires only the prior direct slice; parameters is an optional additional slice. Counts and numeric edit-field signatures are unchanged by this compatibility adjustment.

No remaining P0/P1/P2/P3 finding from this bounded review. No product file was edited by the reviewer. No test, build, geometry evaluation or browser run was performed for this addendum. Root-reported Model test/type receipts are external evidence and are not claimed as reviewer runtime validation. resolution-source-manifest.json and the resolved-source text copies pin the reviewed source.


## Bounded sketch identity fix addendum

Reviewed HEAD 84c30e0aa12fce5ffaf1a1f9d7f9525a8dd31ce4 plus the one-line uncommitted production change in apps/cad-studio/src/sketch/useSketchActions.ts:134. Scope was only the ordinary edited-sketch identity fix and its immediate control flow. No broader audit was performed. Source and diff are captured in sketch-identity-source-manifest.json, useSketchActions.identity-resolved-source.txt and sketch-identity-reviewed-diff.patch.

Result: no actionable finding in this diff. The identity correction is supported by source inspection. The reviewer did not run tests, builds, geometry or browser automation and did not edit product files.

Evidence: line134 now preserves an existing edited sketch's authored id whenever that id is defined. The old linked-only condition discarded the id when Finish replaced an ordinary sketch with the newly generated profile. The old source therefore explains the observed missing n5 id. withIds in packages/barocss-cad-model/src/engine/ids.ts allocates a fresh serial for that missing id when its index is below nextId, which explains fresh Open assigning n7 and advancing nextId from7 to8.

The replacement is constructed only inside the existing editNode branch (lines132-139). The node-list map still replaces only that index and spreads the existing document, so nextId, downstream fill id, outputs and unrelated nodes retain their prior values. placedNode profile, construction, plane, association and on metadata construction at lines128-131 is unchanged. dropStaleMade and positional side-tag remapping at lines135-137 are unchanged. Existing linked edits already preserved their id before this patch, and retain the same behavior now.

Ownership behavior is unchanged: canChangeDocument remains first; requestedGeneration, linked and requestCurrent are unchanged; evaluation/refusal/commit and the linked-only stale-generation check at line138 are unchanged. This review does not claim stronger ordinary-sketch generation safety than the existing implementation. The new-sketch branch still calls withNode at line143; withNode allocates exactly one fresh id and advances nextId for an id-less newly authored node. Existing edited sketches without any prior id retain the previous fallback behavior.

External evidence read, not rerun: /tmp/d335-sketch-identity-fix/focused-before.txt records the expected pre-fix failure undefined !== 'n5'. focused-final.txt records 2 passing hook/native-file tests. Their source calls the actual hook with Worker transport and App dispatch replaced; it verifies edited-source id, fill id, nextId and native encode/read equality, plus new-sketch allocation. This is focused hook/file evidence, not a real browser proof.

The retained /tmp/d335-root/native-tail-retake/receipt.json is FAIL at final native Save/fresh Open editable-fields comparison. It records the source sketch changing from n5 to n7 and nextId7 to8, while the retained nine-cut result has volume approximately22650. The failure remains part of the evidence history. The source correction and focused external tests do not replace the pending real native UI rerun, and no whole-flow PASS is claimed here.
