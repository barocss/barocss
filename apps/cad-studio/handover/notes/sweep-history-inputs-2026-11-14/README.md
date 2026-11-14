# D1169 — Show the committed Sweep inputs in History

2026-11-14 · FEATURE · P0 desktop QA, rows 07 and 21 · [#2462](https://github.com/barocss/barocss/issues/2462)

History shows the saved profile and the path used by the Sweep. Circular profiles show their current diameter. The path displays both evaluated end coordinates from its stored NURBS domain. A route bundle member has its own mode label.

| Result | Check |
| --- | --- |
| FAIL | The parent could create the Sweep but History lacked the circular profile diameter and copied path endpoints. |
| PASS | Desktop Studio showed Sketch 1 at Ø6 mm, Rail B as Copied, and endpoints (30,0,0) and (30,0,22) mm after Apply, Undo and Redo, and Save followed by fresh Open. The original Direct curve was renamed and changed to (45,0,0)–(45,0,55) in the second input file. Studio displayed that curve under its new name, while the saved Sweep still used Rail B's copied coordinates. |
| PASS | The independent straight-profile dimensions predicted X[27,33], Y[−3,3], Z[0,22] mm. Every accepted study state reproduced those native bounds within 1e−7 mm on one valid faceted solid. |
| PASS | D1168 desktop regression, 55 focused Model tests, 4 focused Studio tests, both type checks, scoped lint, driver syntax, diff check and production build. |
| NOT_RUN | History input replacement for an already committed Sweep, linked route badge in Studio, curved-path and Join/Cut retarget, recovery of old duplicate IDs, full suites and mobile. |

The #2462 desktop criteria for input order, replacing one active input, generation, Apply, History and Undo are covered by D1167–D1169. Desktop QA is **28/54 (52%)** and initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. D1170 starts #2463 with the two-section Loft mode. [Commands and hashes](qualification.json).
