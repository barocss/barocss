# D1057 — keep document Redo after a restored Sketch Finish

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2455](https://github.com/barocss/barocss/issues/2455)

After rebuilding the existing sketch and rebinding its dimensions, compare the complete replacement node with the stored node using canonical JSON. When they match, close the sketch before evaluation, commit or downstream metadata changes. Keep positional-side migration eligible.

- **FAIL** In desktop WebGPU, Trim removed the isolated guide and Select Undo restored it. Finish kept the same authored node values but consumed the pending 3 mm Extrude Redo. The initial driver wrongly assumed Undo would be disabled before Sketch. The corrected reproduction reads the actual pair of controls.
- **PASS** Finish preserves the exact native document, history labels, dirty indicator and both document history controls. Redo restores the exact accepted 3 mm Extrude and 2,400 mm³. Visual review confirms the current 2 mm solid before Redo.
- **PASS** Desktop numeric/Trim and 55 mm driving dimension replays still commit the real edits. Six focused Studio tests, Studio type-check, driver syntax and diff checks pass.
- **NOT_RUN** Clean project autosave, legacy side migration product replay, new and curved draft history, other tools, production build, full suites and mobile.

#2455 remains open. Desktop QA is 18/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
