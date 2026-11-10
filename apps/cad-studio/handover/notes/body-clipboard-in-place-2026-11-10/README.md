---
work_id: D564
artifact_type: body-clipboard-in-place-qualification
status: qualified-for-edit-in-place-entry-cancel-and-finish
last_updated: 2026-11-10
---

# D564 — Verify clipboard isolation on edit-in-place entry and return

P0, rows 12 and 16. The parent is `bb6d4295b1b4e5a557d1743330262b7c105c6016`. This covers edit-in-place clipboard boundaries for [#2310](https://github.com/barocss/barocss/issues/2310), after [D563 local recovery](../body-clipboard-recovery-2026-11-10/README.md).

## Actual Studio

Open the D326 B box as the assembly base. Use Insert part to place the independent D326 A box. The base b1 measures 2,184 mm³. The placed definition's b1 measures 1,000 mm³ in its own document. Copy the base b1 and enter Edit part through the instance panel. The child document and its empty history are exact. Stale Paste preserves the child document, evaluated body, selection, history controls, file name and dirty state.

Copy the child b1 and Cancel the unedited session. Studio restores the exact assembly and both saved history stacks. Stale Paste preserves the base b1 and the assembly state. Enter again and set the child's extrusion distance to 12 mm. The edited child b1 measures 1,200 mm³. Copy it and Finish. Studio updates the placed definition and preserves its position, rotation and base geometry. Stale Paste again preserves the assembly. Undo restores the exact original assembly and Redo restores the exact edited assembly.

A fresh Copy of the base b1 allows Paste at X +22 mm. The new b4 is selected, with centroid [28, 6.5, 7] mm. The placed instance remains exact. Independent box arithmetic checks five states at an absolute tolerance of 1e-9. Root reviewed the entry stale-Paste capture, where the earlier Copy notice remained visible. The run recorded 15 snapshots and five independent joins. Commands, hashes, timing and cleanup evidence are in [qualification](qualification.json).

- **PASS** — actual insert, Edit part, Cancel, Finish, three same-key stale Paste checks, exact assembly Undo and Redo, fresh +22 mm Paste, driver and helper syntax, and final Model types.
- **FAIL** — none in the selected checks.
- **NOT_RUN** — nested edit-in-place, additional instance layouts, full kernel and mobile.

Next is D565, P0 rows 12 and 16. Check Paste after deleting the copied source in the same document and creating a different body. [#2310](https://github.com/barocss/barocss/issues/2310) remains open. Whole CAD remains NOT_MEASURED.
