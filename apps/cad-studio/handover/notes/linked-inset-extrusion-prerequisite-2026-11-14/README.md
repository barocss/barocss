# D1212 — Explain the linked inset replacement prerequisite

2026-11-14 · FEATURE · P0 desktop QA, rows 09 and 21 · [#2481](https://github.com/barocss/barocss/issues/2481)

History and the native replacement share the same authored-graph checks. A free linked sketch shows that it needs a straight New body Extrude before source replacement. The native resolver still validates the picked face and resulting solid.

| Result | Check |
| --- | --- |
| FAIL | Parent Studio enabled Replace inset source in History before the linked sketch had a consuming extrusion. |
| PASS | On the same free sketch, History kept the binding and Edit sketch action, hid replacement and displayed the extrusion prerequisite. The actual New body command added a 4 mm straight extrusion without rewriting the sketch. The output volume was 960 mm³ within 1e-7 mm³, replacement became available, and Undo restored the free sketch. The screenshot was inspected. |
| PASS | A separate desktop run replaced the source after a valid terminal extrusion and verified keyboard focus, displayed binding, Undo and Redo. |
| PASS | 20 focused Model tests, both type checks, scoped lint, driver syntax, production build and frozen-source checks. |
| NOT_RUN | Actual attached Drawing and later dependent-feature UI routes, full suites, CI and mobile. |

Keep #2481 open for source dimension and link-distance History cases. Desktop QA is **29/71 (41%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
