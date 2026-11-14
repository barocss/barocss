# D1199 — Resolve Align target faces after preview reorders bodies

2026-11-14 · FEATURE · P0 desktop QA, rows 07, 20 and 21 · [#2469](https://github.com/barocss/barocss/issues/2469)

While Align is active, Studio resolves a picked preview face through the shown body key, original body reference and face identity. A generated preview face cannot become a target. A new pick clears queued Apply. Apply checks that the original document and evaluation are current. Split shares the transform face resolver and retains its exact native axis requirement.

| Result | Check |
| --- | --- |
| FAIL | On the parent, drawing order changed from A/B/C to B/C/moved A. Clicking C during a B preview left B in the HUD and applied translation (44, 3, −10) mm. |
| PASS | Studio selected B, refused the generated moving face, kept the accepted document and then selected C in the same open Align. The HUD showed C. Apply produced translation (89, 5, −6) mm and a 2 mm gap. |
| PASS | The moved A was strict-valid at volume 720 mm³, centroid (95, 10, 17) mm and bounds (89, 5, 14)–(101, 15, 20) mm. Both stationary boxes retained their native dimensions, positions and volume. Undo returned the exact seed. Redo returned the accepted C result. |
| PASS | Actual Studio reran D1197 including tangent refusal, exact native plane, History and Undo/Redo. Studio type check, scoped lint, driver syntax, diff, production build and frozen-source checks passed. |
| NOT_RUN | Mirror preview retargeting, Align target editing in History, controlled worker-delay input, fresh Open, full suites, CI and mobile. |

Keep #2469 open. Desktop QA is **29/54 (54%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
