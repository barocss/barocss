# D1240 — Enforce the Align Floor Gap range during creation

2026-11-14 · FEATURE · P0 desktop QA, rows 07 and 21 · [#2530](https://github.com/barocss/barocss/issues/2530)

The Align command shares the native 0 to 10000 mm Gap range with History. Both preview admission and command construction enforce it. The current field remains editable after a refusal.

| Result | Check |
| --- | --- |
| FAIL | Parent Studio accepted the negative Gap preview and enabled Apply despite the field minimum of 0. |
| PASS | Chrome WebGPU at 1024 × 800 and 1440 × 900 blocked blank, −1 and 10000.1 mm. The range appeared once, the input was marked invalid when out of range, and Enter left the document, selection, bodies and History unchanged. |
| PASS | Returning to 0 mm previewed and applied one Move [0, 0, −20] mm. Strict B-rep gave Z bounds [0, 6] mm, centre [6, 5, 3] mm and 720 mm³. Independent dimensions matched within 1e-7. Undo, Redo, real Studio Save and fresh Open passed. |
| FAIL | The first Model type check rejected the proposed refusal code. The existing Model VALUE code passed the corrected check. |
| PASS | The face-target desktop control, three focused Model tests, 20 focused Studio tests, both type checks, scoped lint, driver syntax, build and frozen-source checks. |
| NOT_RUN | Additional Floor bodies, new Face placement near the numeric maximum, assistive technology, full suites and CI. |

The stated #2530 acceptance is met. Desktop QA is **34/95 (36%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
