# D1159 — Qualify a side Cut and an oblique Cut in desktop Studio

2026-11-14 · SMALL, evidence only · P0 desktop QA, rows 07 and 21 · [#2464](https://github.com/barocss/barocss/issues/2464)

Verify the current product by picking each actual stock face, drawing a rectangle on that face, applying a 2 mm Cut and editing Distance to 4 mm. Confirm the local opening, floor corners, supporting frame, mass and closed native solid through History, Undo, Redo, native Save and fresh Open.

| Result | Check |
| --- | --- |
| FAIL | First driver passed the side Cut in Studio, then supplied fixture data to the wrong inspector argument. This was a test harness failure. |
| PASS | On the right YZ work plane at X40, the Cut with an 8 × 4 mm opening moved its floor from X38 to X36. The body volume changed from 11936 to 11872 mm³. |
| PASS | On a 30° native face, the 12 × 8 mm Cut moved its floor from −2 to −4 along the face normal. Volume changed from 11808 to 11616 mm³. With +10° Draft on the same oblique plane, the opening remained 12 × 8 mm and the resulting volumes were 11821.774518946 and 11669.771517741 mm³. |
| PASS | Nine native reads of accepted geometry compared the exact frame, the four opening and floor vertices, one valid closed solid, the Studio's reported volume, and independent rectangular prism or frustum formulas. Tolerance was 1e−7 mm and 1e−7 mm³. Visual review, driver syntax and diff check passed. |
| NOT_RUN | Empty drafted or side-plane Cut, cross-family Through all associativity, full suites and mobile. |

Keep #2464 open until the remaining no-material path has a desktop result. D1154 certifies upright zero-draft candidates only. D1160 verifies a missed rectangular Cut on a side plane and on a drafted profile, and checks whether the same decision can be made from the current native candidate. Desktop QA remains **25/54 (46%)**. Initial scenarios remain **8/10 (80%)**. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and hashes](qualification.json).
