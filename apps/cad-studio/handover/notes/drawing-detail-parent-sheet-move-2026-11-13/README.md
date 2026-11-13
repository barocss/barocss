# D981 — open the parent sheet for a split Detail boundary edit

2026-11-13 · SMALL · P0 rows 07 and 21 · [#2442](https://github.com/barocss/barocss/issues/2442)

- **FAIL on parent** The empty Detail B was on Sheet 2 and its top parent was on Sheet 1. Move refused to start on Sheet 2 and no Move issue was present on the parent sheet.
- **Change** Locate the authored parent sheet when starting Move. Carry the centre-pick request into that sheet and retain the model and drawing ownership checks. Commit the existing Detail boundary in the whole drawing.
- **PASS** Desktop WebGPU Studio started Move from Sheet 2 and selected Sheet 1. Escape preserved the exact document. A second Move repaired centre [48, 16] mm and radius 9 mm. Sheet 2 retained Detail B at 2:1, its Ø12 diameter and both geometric frames. Undo restored the exact empty detail. Redo restored the repaired document.
- **PASS** Visual review, 19 focused drawing checks, Studio type-check, driver syntax and diff check. No page errors, console errors or downloads.
- **NOT_RUN** Save/reopen, SVG/DXF/PDF exports, other parent families, WebGL2, production build, full suites and mobile. #2442 remains open.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
