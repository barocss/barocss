# D1176 — Show the saved Hole entry, direction, ends and cosmetic thread

2026-11-14 · FEATURE · P0 desktop QA, rows 07 and 21 · [#2465](https://github.com/barocss/barocss/issues/2465)

Hole History shows the named entry or body end, signed drill direction, depth mode and saved cosmetic thread designation. A legacy named entry with no explicit side reads the plane from the original native stock. The History viewport handles use that same plane, including when the entry is the underside.

| Result | Check |
| --- | --- |
| FAIL | At the parent, desktop History displayed the tapped bore diameter, centre and depth but omitted the entry face and thread designation. An interim capture of a legacy named underside showed the depth arrow pointing the wrong way. |
| PASS | Studio opened the retained legacy part with no catalog. The blind hole showed `n1.top`, −Z, To a depth and M6×1 · Cosmetic. The through hole showed Through and M3×0.5 · Cosmetic. The blind bore centre moved from (15, 20) to (17, 20) mm and its depth from 12 to 9 mm. The native wall stayed radius 2.5 mm and ran from Z8–20 to Z11–20. Independent cuboid-minus-three-bores volumes were 46815.0305209741 and 46873.9353832289 mm³. Native values matched within 1e−7 mm³ and wall geometry within 1e−7 mm. The saved designation continued to produce viewport cosmetic ring data. |
| PASS | Undo, Redo, Save and fresh Open retained the intended document and bore. The named-underside comparison showed +Z in both the History readout and the actual viewport depth arrow, starting at the expected bore end. |
| PASS | D1000 desktop X/Y/Z centre regression, 13 focused Model handle tests, both type checks, scoped lint, driver syntax, diff check and production build. |
| FAIL | Existing O7 snapshots for die-casting-zinc, drawing-holes and sand-casting-a356. The combined run passed 19/22, and all three failures reproduced with the parent Model source. The selected legacy tapped fixture passed both runs. |
| NOT_RUN | New catalog-tapped creation without eligible person-loaded rows, changing the stored M6 designation, modeled helical thread, broad rematching/obstructed entry cases, full suites and mobile. |

Desktop QA is **29/54 (54%)** and initial scenarios **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [#2465](https://github.com/barocss/barocss/issues/2465) stays open for remaining acceptance. D1177 measures native angled Split cap coordinates and History. [Commands and hashes](qualification.json).
