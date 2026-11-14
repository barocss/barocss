# D1233 — Explain unavailable tangent scope in mixed Chamfer

2026-11-14 · FEATURE · P0 desktop QA, rows 07 and 21 · [#2523](https://github.com/barocss/barocss/issues/2523)

The successful current Chamfer preview shows the confirmed native picks even when its result does not include an exact original tangent scope. It reports that the scope is unavailable instead of showing zero additions. Exact reports continue to show the original edge names and counts.

| Result | Check |
| --- | --- |
| FAIL | The first baseline driver timed out because the mouse helper did not hold Shift. The corrected baseline selected both edges in both orders and reproduced the missing scope notice. |
| PASS | Chrome WebGPU at 1024 × 800 showed two exact picks and the unavailable message for both orders of straight e9 and arc e10. Apply stored the ordered original picks and 0.1 mm. Undo, Redo, Studio Save and fresh Open passed. |
| PASS | Each mixed native result was one strict closed solid with 10 finish faces and volume 533.9952841677082 mm³. Volume matched the reproduced parent within 1e-7 mm³. Native reports matched their respective saved and reopened geometry. The shared count and volume do not establish exact tangent scope. |
| PASS | Single-edge controls showed 1/0 and 1/7. Their independent wedge and full-rim volumes matched within 1e-7 mm³. |
| PASS | Sol High read-only review, 20 focused Studio tests, Studio type check, scoped lint, driver syntax, production build and frozen-source checks. |
| NOT_RUN | Other mixed geometries, exact enumeration of their ambiguous original edges, live Chamfer deselection, assistive technology, full suites and CI. |

The stated #2523 acceptance is met. Desktop QA is **31/86 (36%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
