# D1201 — Edit a Scale pivot in History

2026-11-14 · FEATURE · P0 desktop QA, rows 07 and 21 · [#2491](https://github.com/barocss/barocss/issues/2491)

Scale History exposes Pivot X, Y and Z. A legacy feature with no pivot displays the kernel's implicit origin. Editing one coordinate creates the pivot if necessary and retains both other coordinates, the existing Factor, stable ID and parent.

| Result | Check |
| --- | --- |
| FAIL | The first driver estimated the imported rounded lid as a full-height box. Independent affine bounds and the historical native source volume replaced that incorrect volume premise. On the corrected parent run Scale History offered only Factor. |
| PASS | Actual Studio applied Factor 2 about (45, 5, 0) mm to the retained imported native STEP lid with an authored through bore. History showed the authored values. Editing them to (48, 7, 2) mm changed only the stored pivot. |
| PASS | Both native results were strict-valid at 6,720.5418374342735 mm³ within 1e-6 of the expected scaled source volume. Calculated bounds shifted by (−3, −2, −2) mm. The Ø12 mm bore moved from (45, 5) to (42, 3) mm. Undo, Redo and fresh-context Open retained the expected native geometry and History fields. |
| PASS | Model 24/24, both type checks, scoped lint, driver syntax, frozen-source checks, diff and production build. |
| NOT_RUN | Product Save command, browser edit of an omitted legacy pivot, named-parameter binding in Studio, unified Align History, full suites, CI and mobile. |

Keep #2491 open for Align History. Desktop QA is **29/54 (54%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
