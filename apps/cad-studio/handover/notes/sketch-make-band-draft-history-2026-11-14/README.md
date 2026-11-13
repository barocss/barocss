# D1067 — replay Make band in Sketch draft history

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2455](https://github.com/barocss/barocss/issues/2455)

Record Make band with the source shapes, band definition and picks. The draft must still belong to the current document and sketch. Restore the picks when the Band tool is active.

- **FAIL** The parent Studio creates a strip around two construction circles. Cmd+Z leaves the strip visible and does not restore the source picks.
- **PASS** Desktop WebGPU uses real clicks to draw and pick both circles. Undo restores both picks and removes the strip. Redo restores the exact outline. The toolbar and keyboard replay the same states. Visual review confirms the strip and the two restored picks.
- **PASS** Finish keeps both source IDs. The 4 mm Extrude gives 970.08845396 mm³, within 1e-7 mm³ of the capsule area difference times the height. Document Undo and Redo restore the sketch-only and extruded documents exactly. Studio type-check, 16 focused tests, driver syntax and diff checks passed.
- **FAIL → PASS** Two inherited tests expected a commit from an unchanged Band Finish. They now check the existing no-op behavior, exact stored node and parameter bindings.
- **NOT_RUN** Band width and offset edits, Remove band, other draft routes, production build and full suites.

#2455 remains open. Desktop QA is 18/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
