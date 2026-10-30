# D323 normal project-version consumer plan

Status: **NOT_RUN**. Wait for final producer source hashes, scoped tests/types/lint and root source-freeze execution approval. No new harness or production change is needed.

Reuse the existing selected check in `apps/cad-studio/test/browser-flow.mjs`: `CG6 project: open a folder, save into it, two versions, compare, restore the first; autosave kept in the project and offered back after a reload` (currently line 9566). Select only `FLOW_ONLY='^CG6 project:'`; the runner also always executes its starter smoke. Report one selected consumer case and one starter separately.

Existing actual UI path:

1. New part and real Box, open project, Make version First.
2. Add a second Box, public Save, Make version Second. Verify native part, version index and two snapshot files.
3. Compare First, restore First, verify one body and preserved two-version history.
4. Wait for real project autosave of the restored work.
5. Reload actual Studio, reopen the recent project and part, read both versions back, restore offered autosaved work.
6. Close the project and remove only its unique owned OPFS folder. Runner closes its owned page/browser/server.

This existing headless fixture substitutes the native folder picker with a real OPFS directory handle. Original native file/stream I/O and actual App project/version UI remain in use. It does not stage App documents or version snapshots. Describe this picker boundary explicitly; do not claim an actual OS folder-dialog interaction or external-folder proof. The reload remains in the existing browser profile/context, not a fresh-context claim.

This is a positive normal-project version consumer regression for the changed writeVersions/readVersions integration. UI-authored documents normally have nextId. The rare omitted-nextId canonical identity failure belongs to focused Model/storage API tests; this UI case does not directly create or reproduce that rare input. Do not expand its PASS into canonical corpus or new schema/Open/Save coverage.

After approval: use Node22, the serial heavy gate, actual Chrome WebGPU/DPR1, and the unchanged selected runner. Preserve a new raw log, selected artifacts and final source binding under this note only. Keep any first failure raw and stop for coordination if it needs source changes. No full browser/Model/Studio/Kernel suite, new dependency, commit or push.
