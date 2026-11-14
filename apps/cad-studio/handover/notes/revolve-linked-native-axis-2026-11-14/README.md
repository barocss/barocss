# D1163 — Follow a linked native Revolve axis

2026-11-14 · FEATURE · P0 desktop QA, rows 07 and 21 · [#2480](https://github.com/barocss/barocss/issues/2480)

Save an explicit reference when the picked edge belongs to an earlier upright rectangular extrusion and lies in the canonical XY sketch plane. Resolve the original top-side edge from native geometry on every evaluation. Refuse an edit that moves the edge out of the sketch plane or changes its supported identity. An edge axis without a reference continues to use its saved coordinates.

| Result | Check |
| --- | --- |
| FAIL | On the parent commit, Studio moved the source edge from Y20 to Y24 and Revolve remained at Y20. An intermediate type check failed on a control-flow narrowing error. |
| PASS | Desktop Studio moved the linked axis from Y20 to Y24. The same Revolve node produced one valid native solid. Its radii changed from 11 and 14 mm to 15 and 18 mm, and volume changed from 2356.194490192 to 3110.176727054 mm³ within 1e−7 mm³ of 750π and 990π. |
| PASS | Raising the stock top from Z20 to Z24 was refused with a sketch-plane error and the accepted document stayed unchanged. Undo, Redo and Save followed by fresh Open retained the linked result. The legacy fixed-axis control stayed at Y20 and 750π, with its axis mode shown in History. |
| PASS | The D1162 desktop Join and generated-edge refusal regression passed. Focused Model and Studio tests passed (53 and 4), including native precision, missing references, copy and flatten. Final Model and Studio type checks, scoped lint, driver syntax, diff check and production build passed. |
| NOT_RUN | History axis replacement, wider source or plane families, partial-turn display, full suites and mobile. |

Keep #2480 open. D1164 starts with replacing the axis through History on a standalone Revolve. Desktop QA is **26/54 (48%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
