---
work_id: D567
artifact_type: body-clipboard-project-autosave-qualification
status: qualified-for-browser-project-autosave-restore
last_updated: 2026-11-10
---

# D567 — Verify clipboard isolation on project autosave Restore

P0, rows 12 and 16. The parent is `3c2401ae7961ce01c412babc3b50ef04231c33a4`. This covers project autosave Restore for [#2310](https://github.com/barocss/barocss/issues/2310), after [D563 browser-local recovery](../body-clipboard-recovery-2026-11-10/README.md) and [D566 history branching](../body-clipboard-history-branch-2026-11-10/README.md).

## Actual Studio

Open the retained 10 mm D326 A box and save it in a fresh browser project. Edit its extrusion distance to 11 mm. Studio writes the exact accepted edit to the project autosave while retaining the exact saved document. Leave the project file by opening D326 B, then reopen the saved A file from the project list. Its autosaved-work offer matches the retained project autosave.

Copy the saved box's 1,000 mm³ b1. Use Restore autosaved work. Studio adopts the exact autosaved 1,100 mm³ b1. Stale Paste preserves the restored document, one evaluated body, selection, history, file name and dirty state. Undo restores the saved document and Redo restores the autosaved edit. A fresh Copy allows Paste at X +20 mm and selects b4. The saved native document remains exact at the end.

Independent box arithmetic checks four states at an absolute tolerance of 1e-9. Root reviewed the autosave stale-Paste capture, where the earlier Copy notice remained visible. The run recorded nine snapshots and four independent joins. Commands, hashes and cleanup are in [qualification](qualification.json).

- **PASS** — actual browser-project Save, autosave, reopen and Restore, stale Paste state and history, exact Undo and Redo, fresh +20 mm Paste, driver and helper syntax, and final Model types.
- **FAIL** — none in the selected checks.
- **NOT_RUN** — other project stores and autosave content, full kernel and mobile.

Next is D568, P0 rows 12 and 16. Check two admitted copies across native Save and a fresh Open. [#2310](https://github.com/barocss/barocss/issues/2310) remains open. Whole CAD remains NOT_MEASURED.
