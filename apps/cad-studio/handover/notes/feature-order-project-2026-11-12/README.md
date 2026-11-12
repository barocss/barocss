# D808 — Reorder an independent extrusion in Studio

P1, rows 07, 12 and 16. SMALL verification of existing behavior. The source contains a 30 × 20 × 8 mm plate with a centered through Hole of radius 2 mm and a separate cylinder of radius 5 mm and height 6 mm. Retained source coverage includes Model dependency checks and the original Studio Hole-before-Box refusal. This run adds a successful move with surviving dependencies, exact project persistence and re-edit.

| Result | Check |
| --- | --- |
| PASS | Actual History moves the cylinder and its circle sketch before the plate and its rectangle sketch. Order changes from n0,n1,n2,n3,n4 to n2,n3,n0,n1,n4. The Hole parent index changes from 1 to 3 and its face remains n1.top. The two bodies retain keys b3 and b4. |
| PASS | Studio refuses to move the Hole before the plate. The accepted document stays exact. The first Undo restores the source order, and the first Redo restores the new order. |
| PASS | Actual project Save, Close project and fresh Open restore the exact 981-byte document. The reopened extrusion editor changes the plate from 8 to 10 mm. The Hole remains through the plate and the separate cylinder retains its size and location. |
| PASS | Both live Worker results and a fresh native read agree with the independent analytic volumes within 1e-5 mm³ and centroids within 1e-6 mm. Native outputs are valid at source, after the move, after Open and after the edit. The drilled plate measures 4699.4690350851 mm³ at 8 mm and 5874.3362938564 mm³ at 10 mm. The cylinder measures 471.2388980385 mm³ throughout. |
| PASS | 27 focused Model tests, driver syntax, diff check and visual review. Desktop has zero page errors, console errors and downloads. |
| NOT_RUN | Selected free-sketch ownership during reorder, selective-cache instrumentation, arbitrary topology and reorder families, full suites, mobile and other browsers. |

[Commands and receipt digest](qualification.json). [#551](https://github.com/barocss/barocss/issues/551) remains open for the wider feature graph. Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**.
