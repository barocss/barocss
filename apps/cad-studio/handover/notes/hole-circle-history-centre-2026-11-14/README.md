# D1182 — Edit the centre of a circular Hole layout in History

2026-11-14 · FEATURE · P0 desktop QA, rows 07 and 21 · [#2490](https://github.com/barocss/barocss/issues/2490), checklist line 2436

Circular Hole History uses the saved face axes for both centre coordinates. The first hole is retained when the circle centre changes. The same finite-coordinate and degenerate-radius checks apply in creation and when editing the changed pattern.

| Result | Check |
| --- | --- |
| FAIL | Parent desktop Studio made the four bores but History had no Circle centre X or Y field. Two interim Model type checks rejected the tuple access types. The final code uses discriminated pattern fields and passed. |
| PASS | Studio made four Ø4 through bores after a real top-face pick at (28,20). The original centre was (20,20). History refused a centre coincident with the first hole and kept the accepted document. Changing the centre to (22,18) kept (28,20) and moved the other bores to (20,24), (16,16) and (24,12). |
| PASS | Native bore centres, radii and volume-weighted centroid matched the independent 90° rotations and cuboid-minus-four-bores checks within 1e−7 mm. The strict-valid single solid had native volume 18596.814210510787 mm³, within 1e−7 mm³ of 19200 − 192π. Undo, Redo and fresh Open kept the correct layout and exact accepted document. |
| PASS | D1181 desktop straight-row regression, 18 focused Model tests, both final type checks, scoped lint, syntax, diff check and production build. |
| NOT_RUN | Changing the saved thread designation without eligible person-loaded data, partial-circle layouts, full suites and mobile. |

The independent [#2490](https://github.com/barocss/barocss/issues/2490) position, keyboard and pattern proofs are in D1179–D1182. Keep #2490 and #2465 open for their outstanding thread acceptance. Desktop QA is **29/54 (54%)** and initial scenarios **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. D1183 starts [#2466](https://github.com/barocss/barocss/issues/2466) with the authored and actual tangent Fillet scope. [Commands and hashes](qualification.json).
