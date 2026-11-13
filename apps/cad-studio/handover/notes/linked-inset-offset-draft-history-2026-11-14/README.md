# D1063 — replay Offset and Trim in one Sketch history

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2455](https://github.com/barocss/barocss/issues/2455)

Record the complete Offset draft with the same history function as Trim. Confirm the current document and sketch generation before applying the Offset.

- **FAIL** Desktop WebGPU trims the linked inset's inner edge and offsets the remaining outline outward by 1 mm. The parent adds a third shape and leaves Undo disabled.
- **PASS** Toolbar Undo removes the Offset and retains the Trim gap. Cmd+Z restores the edge and association. Toolbar Redo and Cmd+Shift+Z replay the two actions in order. Two Undo actions and Finish restore the exact native document. The restored ring keeps 224 mm³ and follows the source height edit from 10 to 12 mm.
- **PASS** Visual review and desktop linked coordinate and Trim→Select replays. Six focused Studio tests, Studio type-check, driver syntax and diff checks.
- **NOT_RUN** Offset validity for overlapping or duplicate outlines, linked plane history, other draft actions, full suites, production build and mobile.

#2455 remains open. Desktop QA is 18/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
