---
work_id: D563
artifact_type: body-clipboard-recovery-qualification
status: qualified-for-browser-local-recovery-restore
last_updated: 2026-11-10
---

# D563 — Verify clipboard isolation on browser-local recovery Restore

P0, rows 12 and 16. The parent is `48719101dff25f9f661f8bbb2b000fd59b301eb3`. This covers browser-local unsaved-work Restore for [#2310](https://github.com/barocss/barocss/issues/2310), after the [D562 project and version case](../body-clipboard-project-2026-11-10/README.md).

## Actual Studio

Open the retained D326 A box, edit its extrusion to 11 mm and wait for Studio to autosave the accepted document. Reload the page. The recovery offer retains the exact autosaved record. Open the independent D326 B box and Copy its b1 while the offer remains. Choose Restore. The offered record clears and Studio adopts the exact recovery document with a 1,100 mm³ b1. The prior b1 measured 2,184 mm³.

Paste from the prior clipboard preserves the document, its one evaluated body, selection, history rows, Undo and Redo controls, file name and dirty state. Undo restores exact B and Redo restores the exact recovery document. After a fresh Copy, Paste creates and selects b4 at X +20 mm. Independent box arithmetic checks four states at an absolute tolerance of 1e-9. Root reviewed the recovery stale-Paste capture.

The first run reached all four geometry joins, then failed the file-watcher assertion. It reported one event for the new helper. Its recorded modification time precedes Chrome launch, and every source hash matches through cleanup. The repeat used the same driver and source hashes and passed with nine snapshots. Both receipts stay in external evidence. Commands, hashes and timing are in [qualification](qualification.json).

- **PASS** — actual local autosave, reload and Restore, stale Paste state and history, exact Undo and Redo, fresh +20 mm Paste, driver and helper syntax, and final Model types.
- **FAIL** — the first run's file-watcher assertion.
- **NOT_RUN** — project autosave Restore, mesh recovery, edit-in-place, full kernel and mobile.

Next is D564, P0 rows 12 and 16. Verify edit-in-place entry and return with the same body key. [#2310](https://github.com/barocss/barocss/issues/2310) remains open. Whole CAD remains NOT_MEASURED.
