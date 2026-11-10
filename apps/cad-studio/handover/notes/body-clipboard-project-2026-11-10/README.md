---
work_id: D562
artifact_type: body-clipboard-project-and-version-qualification
status: qualified-for-browser-project-open-and-version-restore
last_updated: 2026-11-10
---

# D562 — Verify clipboard isolation across project Open and version Restore

P0, rows 12 and 16. The parent is `80e510a308bfbb3a22c44080451fda97287a8c04`. This covers two project-document routes of [#2310](https://github.com/barocss/barocss/issues/2310), after the [D561 template case](../body-clipboard-template-2026-11-10/README.md).

## Actual Studio

Save the 10 × 10 × 10 mm D326 A box in a fresh browser project and keep a named version. Open the separate 12 × 13 × 14 mm D326 B box through the file chooser and copy its b1. Use the project document list to open the saved A. The file name and 1,000 mm³ b1 match the saved A document. Stale Paste preserves the document, evaluated body, selection, history rows, Undo and Redo controls, file name and dirty state. Undo restores exact B and Redo restores exact A.

Edit A's extrusion distance to 15 mm using the feature editor. Its body stays b1 and measures 1,500 mm³. Copy that b1 and restore the named version from the version list. Stale Paste preserves the restored 1,000 mm³ b1 and the same observed state. Undo restores the 15 mm document and Redo restores the exact original version. A fresh Copy then permits Paste at X +20 mm and selects b4. Independent box arithmetic checks five accepted states at an absolute tolerance of 1e-9.

Root reviewed the version stale-Paste capture. The earlier Copy notice remained visible. The run recorded 14 snapshots and five independent joins. The source pins match through cleanup. The browser project used local origin storage. Commands, hashes and timing are in [qualification](qualification.json).

- **PASS** — real browser project Save and Open, named version Restore, both same-key stale Paste checks, exact Undo and Redo, fresh +20 mm Paste, driver syntax and final Model types.
- **FAIL** — none in the selected checks.
- **NOT_RUN** — branch switches, merges, recovery, edit-in-place and other project stores, full kernel and mobile.

Next is D563, P0 rows 12 and 16. Verify the same-key boundary when restoring a browser-local recovery document. [#2310](https://github.com/barocss/barocss/issues/2310) remains open. Whole CAD remains NOT_MEASURED.
