---
work_id: D561
artifact_type: body-clipboard-template-qualification
status: qualified-for-saved-local-template
last_updated: 2026-11-10
---

# D561 — Verify stale Paste after a saved local template replaces the part

P0, rows 12 and 16. The parent is `260627161e603b1ba21149163dc496c2f4e92630`. This is the saved-template case in [#2310](https://github.com/barocss/barocss/issues/2310), after [D560 New part](../body-clipboard-new-part-2026-11-10/README.md). The delivery adds a desktop regression driver.

## Actual Studio

Open the retained D326 A box, 10 × 10 × 10 mm, and save it as a browser-local template through Templates. Open the independent D326 B box, 12 × 13 × 14 mm. Copy B's b1. Start a new part from the saved template. Studio adopts the exact A document and its own b1. The two b1 bodies have volumes of 1,000 mm³ and 2,184 mm³.

Paste from the prior clipboard preserves the accepted template document, its single body, selection, history rows, Undo and Redo controls, file name and dirty state. Undo returns exact B. Redo returns the exact adopted template. An explicit new Copy of the template body then allows Paste at X +20 mm. The result selects b4, and the two bodies have centroids [5, 5, 5] and [25, 5, 5] mm. Independent box arithmetic checks three states at an absolute tolerance of 1e-9.

Root reviewed the template after stale Paste. The old Copy notice remained visible. The run recorded eight snapshots and three independent joins. The source pins match through cleanup. Commands, hashes and timing are in [qualification](qualification.json).

- **PASS** — real local template Save and replacement, stale Paste state and history, exact Undo and Redo, fresh +20 mm Paste, driver syntax and final Model types.
- **FAIL** — none in the selected checks.
- **NOT_RUN** — other template content, browser project, version, recovery and edit-in-place replacements, full kernel and mobile.

Next is D562, P0 rows 12 and 16. Check same-key clipboard isolation across browser project Open and saved version Restore. [#2310](https://github.com/barocss/barocss/issues/2310) remains open. Whole CAD remains NOT_MEASURED.
