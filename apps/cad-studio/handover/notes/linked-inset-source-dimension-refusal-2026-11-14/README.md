# D1213 — Name the linked inset blocked by a source dimension

2026-11-14 · FEATURE · P0 desktop QA, rows 09 and 21 · [#2481](https://github.com/barocss/barocss/issues/2481)

The native offset refusal carries the affected linked sketch's stable feature ID. For the History edit of its source feature, the editor shows the failed sketch, face, stored inset distance and two available actions: increase the source dimension or reset the edit. The accepted model continues to own the displayed geometry.

| Result | Check |
| --- | --- |
| FAIL | Parent Studio refused to change Extrude height from 10 to 9 mm but suggested an Undo. The failing linked sketch and the 4.5 mm distance were not visible outside the kernel detail. |
| PASS | The same refused edit left the document, History, selection and native bodies unchanged. The notice named n4, source n3.side0 and the 4.5 mm inset. The screenshot was inspected. |
| PASS | Entering 12 mm and applying changed only the source height. The link stayed unchanged and the separate extrusion measured 2268 mm³, matching `4 × (60 × 12 − 51 × 3)` within 1e-7 mm³. Undo and Redo restored both accepted heights. |
| PASS | The separate 1024 × 800 automatic replacement refusal retained its focus recovery and 960 mm³ ring. |
| PASS | 20 focused Model and 4 focused Studio tests, both type checks, scoped lint, driver syntax, production build and frozen-source checks. |
| NOT_RUN | Failure after editing an indirect earlier ancestor, direct linked-distance editing, full suites, CI and mobile. |

Keep #2481 open. Desktop QA is **29/71 (41%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
