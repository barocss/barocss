---
work_id: D560
artifact_type: body-clipboard-new-part-qualification
status: qualified-for-same-key-new-part
last_updated: 2026-11-10
---

# D560 — Verify stale Paste after New part recreates a body key

P0, rows 12 and 16. The parent is `0acec0dcbcdaaa43cc1f033bcdc049263a38115b`. This is the New part case in [#2310](https://github.com/barocss/barocss/issues/2310), after the [D559 failed Open case](../body-clipboard-failed-open-2026-11-10/README.md). The delivery adds a desktop regression driver.

## Actual Studio

Open the retained D326 B box in Studio and Copy its body b1. The original box measures 12 × 13 × 14 mm and 2,184 mm³. Use New part in the same page. The accepted empty document has no bodies and is named Untitled. Author an 8 × 9 × 11 mm box with the public Box command. Its evaluated body is also b1, with volume 792 mm³ and centroid [4, 4.5, 5.5] mm.

Press Paste using the prior clipboard. The accepted document, one evaluated body, selection, history rows, Undo and Redo controls, file name and dirty state match the state before Paste. The first Undo removes the box and restores the exact empty document. The second Undo restores the exact original document. Two Redo actions restore the empty document and the new box in order.

Copy the new b1 explicitly. Paste creates and selects b4 at X +18 mm, with centroid [22, 4.5, 5.5] mm. Both bodies measure 792 mm³. Undo removes this Paste and Redo restores it exactly. Independent box arithmetic checks three states at an absolute tolerance of 1e-9.

Root reviewed the stale-Paste capture. The old Copy notice remained visible after New part even though Paste left one body. The run recorded 12 snapshots, three independent joins and 298 source pins through cleanup. Commands, hashes and timing are in [qualification](qualification.json).

- **PASS** — same-key recreation, stale Paste with preserved state and history, fresh +18 mm Paste, Undo and Redo, driver syntax and final Model types.
- **FAIL** — none in the selected checks.
- **NOT_RUN** — template, project, recovery and edit-in-place replacements, full kernel and mobile.

Next is D561, P0 rows 12 and 16. Verify the same key boundary when opening a saved local template. [#2310](https://github.com/barocss/barocss/issues/2310) remains open. Whole CAD remains NOT_MEASURED.
