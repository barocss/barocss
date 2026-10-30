# D338 Model and Studio source receipt

Checkout: /Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b
Base: 8c0710d7ab0cce6e09d4fb9c8c7379dba1f3d717
Runtime: /Users/user/Library/pnpm/nodejs/22.19.0/bin/node (v22.19.0)
Heavy: acquired serial d338-model gate for each run; final run exited and released its gate.

Implemented: one thicken snapshot/context/node helper using public thickenSpec; one t/side command; Ctx registration; Studio facade snapshot payload and t binding; Model API types; strict checkNode admission; native side editor; DirectInspector callback into existing App.start/preview/Apply; source-current Apply guard; selection clear only after successful commit; Model README.

Contract: Ctx.thickenSnapshot = {surface: RawNurbsSurface, name:string}. API supplies Whole surface snapshot. Selected direct input must be one current unique object and geometry with its existing source; trim admission occurs before model compilation/copy and malformed non-array trim containers refuse. Native node stores copied six-field surface, thickness:t and optional non-normal side. No live association. No second raw surface validator. Direct Sew behavior is retained.

PASS final new api-thicken: 6/6 (focused-final.log).
PASS existing Model api-studio-commands/editFields: 7/7 (related-model.log).
PASS existing Studio direct-curve-candidate/stop-work-ownership: 20/20 (related-studio.log).
PASS Model TypeScript (model-types-first.log, then model-types-final.log after test assertion repair).
PASS Studio TypeScript (studio-types-first.log); Studio source did not change afterward.
PASS targeted ESLint on all owned source/test files (lint-first.log).
PASS git diff --check at handoff (diff-check.log).

Focused tests verify empty-part three-side volumes 2400 and z centroids4/2/3, bounds, closed valid solid, exact snapshot ownership, t parameter/native reopen/editor changes to3600, independent stock body/focus, raw strict admission and chat node checks, selected-source trim/identity refusal, source deletion independence, fold preview refusal before accepted doc mutation, and immutable facade input. Numerical mass/centroid/bounds absolute tolerance1e-7.

Names: Model public selector has6 composite names; native partBreps has73 facet names. The display grouping joins exact native names with + (engine/mesh.ts129-132). New test checks6 unique public names, exact native atom coverage73, stable groups across all three sides, t edits and native reopen. Actual names and equality-evidence references are in names-observed.json. No grouping or geometry algorithm changed.

Initial failure preserved: focused-first.log 5PASS/1FAIL because test assumed Kernel native73 equals Model public selector count. focused-retry1.log preserves second failed guessed single-facet name regex. Test-only corrections use actual native atom membership and display grouping. focused-retry2.log has repaired first test1/1PASS. No production changes followed these failures; root requested final whole new6 rerun, now6/6PASS.

Error boundary: Model facade fold code OFFSET_FOLDS, where evaluate, details.friendly. Its adapter does not expose details.kernelCode/category. Existing native Core category CAPABILITY is a separate receipt. No error adapter or tolerance was changed.

No browser/product-flow run by this worker. Existing Studio ownership tests cover the reused state machinery; they do not prove the new UI flow. No commit/push, API expected-inventory change, Core geometry edit, schema/dependency/lockfile change or broad suite. Root owns tool inventory and browser qualification. Owned source hashes: owned-source-sha256.txt. Source frozen for review/browser handoff.
