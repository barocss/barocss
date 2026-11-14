# D1203 — Replace the Align target from the preceding model

2026-11-14 · FEATURE · P0 desktop QA, rows 07 and 21 · [#2491](https://github.com/barocss/barocss/issues/2491)

The Align history editor lists eligible original target faces from the model immediately before Align. It omits the moving body and hidden bodies. The draft retains the stored source, Gap and Line up; Apply runs the existing native document evaluation before saving the new target. A stale editor reply cannot change the active document.

| Result | Check |
| --- | --- |
| FAIL | Parent Studio showed the target face but had no control to replace it. One driver attempt matched the entire option list as text. Another compared JSON property order after successful Redo. Both driver checks were corrected. |
| PASS | Studio replaced n5.top with n3.top. The moving body's faces were absent from the choices. Selecting the new target alone kept the accepted document. Apply changed only the target of n6. |
| PASS | The output key stayed b6, strict native volume stayed 720 mm³, and the centre moved from (95, 10, 17) to (50, 8, 13) mm. The physical gap stayed 2 mm and both reference bodies kept their independent dimensions and positions. The oracle used 1e-7 tolerance. |
| PASS | Undo restored C, Redo restored B, and fresh-context Open retained B, Gap 2 and centres lined up. Both type checks, scoped lint, driver syntax, diff, frozen-source checks and production build passed. |
| NOT_RUN | Live geometry preview while the History draft is still open, product Save command, advanced/nested targets, delayed file switching, full suites, CI and mobile. |

Keep #2491 open for History draft preview evidence. Desktop QA is **29/54 (54%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
