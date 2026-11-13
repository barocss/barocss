# D979 — repair a Detail boundary without deleting its annotations

2026-11-13 · SMALL · P0 rows 07 and 21 · [#2442](https://github.com/barocss/barocss/issues/2442)

- **FAIL on parent** After a History edit moved the Ø12 Hole outside Detail B, the empty-detail Move action removed the detail and its diameter, leaving a standalone frame without a view.
- **Change** Move starts a two-pick boundary edit on the detail's existing parent view. Only its centre and radius change. The action keeps the letter, view, scale, sheet placement and annotations and rejects a changed source during the edit.
- **PASS** Desktop WebGPU Studio used a 64 × 32 × 8 mm plate. The History edit moved the Hole from [32, 16] to [48, 16] mm. Move restored Detail B with centre [48, 16] mm and radius 9 mm at 2:1. It retained the exact diameter and both geometric frames and cleared the empty-detail issue. Undo returned the exact empty detail. Redo restored the exact repaired document.
- **PASS** Visual review, 19 focused drawing checks, Studio type-check, driver syntax and diff check. No page errors, console errors or downloads.
- **NOT_RUN** Fix all, other sheets, Save/reopen, SVG/DXF/PDF exports, WebGL2, production build, full suites and mobile. #2442 remains open.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
