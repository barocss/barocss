# D1068 — replay Band dimensions and removal in Sketch draft history

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2455](https://github.com/barocss/barocss/issues/2455)

Record Band dimension edits and removal in the same owned history as Make band. An unchanged width and offset make no history step.

- **FAIL** The parent Studio changes width and offset, then removes the draft strip. Cmd+Z leaves it absent while both source circles remain.
- **PASS** Desktop WebGPU applies width 3→5 mm with Enter and offset 0→2 mm on blur. Undo restores the strip, then replays the two dimensions in reverse order. Redo replays width, offset and removal in order. The toolbar and keyboard share the draft history. Both source circles retain their geometry.
- **PASS** Finish after undoing the removal keeps the 4 mm Extrude and both references. Analytic volume changes from 970.088 to 1,993.805 mm³. Document Undo and Redo restore the exact native documents and both volumes. Visual review, Studio type-check, 16 focused tests, driver syntax and diff checks passed.
- **NOT_RUN** Parameter-bound Band dimension edits, other draft routes, production build and full suites.

#2455 remains open. Desktop QA is 18/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
