# D1172 — Replace one copied Loft section in History

2026-11-14 · FEATURE · P0 desktop QA, rows 07 and 21 · [#2463](https://github.com/barocss/barocss/issues/2463)

History shows the source of each supported private Loft copy. Choose an earlier closed sketch at the same station. Copy its outline into the existing section frame and keep the copied node's ID. Other sections, the guide and their authored controls stay in place. A guide mismatch after a section replacement offers another section or Reset.

| Result | Check |
| --- | --- |
| FAIL | On the parent, a three-section guided Loft had no controls to replace its saved section source. |
| PASS | Desktop Studio created the guided Loft by picking Sketch 3, 1 and 2. It displayed and saved the actual height order 1 → 2 → 3. History offered replacement sketches at the middle station and excluded the Z12 candidate. The X1-shifted replacement was refused at the native guide crossing (0,0,10), with the recovery action visible and the accepted document unchanged. |
| PASS | Replacing Sketch 2 with Sketch 4 changed only the middle copied outline and its source reference. All section slots and IDs, the copied guide, other nodes and next ID stayed intact. Undo, Redo, Save and fresh Open replayed the exact state. Native volume changed from 2000 to 2400 mm³. The centroid changed from (5,5,10) to (109/18,5,10) mm. All four middle-ring vertices matched the expected rectangle within 1e−7 mm. Independent slice dimensions matched the native volume within 1e−7 mm³. |
| PASS | D1170 and D1171 desktop regressions, Sol High geometry and reference review, 74 focused Model tests, 4 focused Studio tests, both final type checks, scoped lint, driver syntax, diff check and production build. |
| NOT_RUN | Shared or tagged private-copy replacement, framed sections, later dependent geometry replay, full suites and mobile. |

D1170–D1172 meet the [#2463](https://github.com/barocss/barocss/issues/2463) desktop criteria for supported interpolation and section order, guide and section replacement, and actionable refusal. Desktop QA is **29/54 (54%)** and initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. D1173 starts #2465 with normal-signed cap Offset in History. [Commands and hashes](qualification.json).
