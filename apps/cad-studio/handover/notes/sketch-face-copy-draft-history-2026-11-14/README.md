# D1069 — replay face outline copies in Sketch draft history

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2455](https://github.com/barocss/barocss/issues/2455)

Route both face-outline buttons through the document-owned draft history. Confirm that the sketch remains on the original face plane with no offset or tilt before copying.

- **FAIL** The parent Studio copies both boundaries of a face with a through hole. Cmd+Z leaves both material boundaries visible.
- **PASS** Desktop WebGPU selects the face with a pointer and copies its two boundaries. Undo removes both together for Use its outline and As references. Redo restores their exact geometry and material or construction state. Toolbar and keyboard replay the same history. The source document stays exact.
- **PASS** Finish after copying the material outline retains the hole and source reference. A 2 mm New Extrude produces a separate 1,174.867 mm³ body while the source remains 4,699.469 mm³. Both match the analytic area times height. Visual review, Studio type-check, 13 focused tests, driver syntax and diff checks passed.
- **NOT_RUN** Rotated STEP replay, reference-only downstream snapping on this fixture, other draft routes, production build and full suites.

#2455 remains open. Desktop QA is 18/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
