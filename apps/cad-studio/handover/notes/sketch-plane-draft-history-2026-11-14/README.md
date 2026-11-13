# D1076 — replay an unlinked sketch plane edit before its earlier coordinate change

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2455](https://github.com/barocss/barocss/issues/2455)

Record unlinked work plane placement with the existing plane, anchor and base draft step.

- **FAIL** The parent Studio undoes X30→26 on the first Cmd+Z and leaves the newer plane change at Z7.
- **PASS** Desktop WebGPU undoes Z7→0 before X30→26. Redo restores X30 before Z7. Toolbar and keyboard agree. Entering an equal plane offset preserves history, and the accepted document stays empty during editing.
- **PASS** Finish and a 3 mm Extrude produce an 840 mm³ solid with centroid at Z8.5 mm. Document Undo and Redo restore the exact sketch and solid documents. Visual review, Studio type-check, 13 focused tests, driver syntax and diff checks passed.
- **NOT_RUN** Plane tilt and anchor changes in this flow, production build and full suites.

#2455 remains open. Desktop QA is 18/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
