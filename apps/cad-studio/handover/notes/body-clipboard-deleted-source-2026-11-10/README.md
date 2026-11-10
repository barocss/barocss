---
work_id: D565
artifact_type: body-clipboard-deleted-source-qualification
status: qualified-for-deleted-source-and-undo
last_updated: 2026-11-10
---

# D565 — Verify Paste after the copied source is deleted

P0, rows 12 and 16. The parent is `330a583e37c2af59ef70fe3dd7c7941082b98d84`. This covers the deleted-source case of [#2310](https://github.com/barocss/barocss/issues/2310), after the [D564 edit-in-place case](../body-clipboard-in-place-2026-11-10/README.md).

## Actual Studio

Open the retained D326 B box and Copy b1. Paste once to create b4 at X +22 mm. Select the original in the Browser and press Delete. The original b1 disappears and b4 retains its 2,184 mm³ volume. Paste preserves the document, current bodies, selection, history rows, Undo and Redo controls, file name and dirty state.

Use Box to add a different 8 × 9 × 11 mm body. It has key b6 and volume 792 mm³. The old clipboard still leaves Paste inert while b4 and b6 are present. Undo the new box, then Undo the deletion. Both operations restore the exact documents. The original copied b1 returns. Without another Copy, the next Paste creates and selects b7 at X +44 mm. Undo and Redo restore the exact documents around that Paste.

Independent box arithmetic checks four states at an absolute tolerance of 1e-9. Root reviewed the capture with both different bodies present. The earlier Copy notice remained visible. The run recorded 12 snapshots and four independent joins. Commands, hashes and cleanup evidence are in [qualification](qualification.json).

- **PASS** — real source deletion, both missing-source Paste checks, exact Undo, restored-source +44 mm Paste, Undo and Redo, driver and helper syntax, and final Model types.
- **FAIL** — none in the selected checks.
- **NOT_RUN** — reuse of the copied key on a new Undo branch, other body types, full kernel and mobile.

Next is D566, P0 rows 12 and 16. Verify whether a new branch can reuse the copied key after Undo removes its creation. [#2310](https://github.com/barocss/barocss/issues/2310) remains open. Whole CAD remains NOT_MEASURED.
