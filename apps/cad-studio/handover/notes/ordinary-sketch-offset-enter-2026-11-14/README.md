# D1216 — Keep Sketch open on ordinary Offset distance Enter

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2510](https://github.com/barocss/barocss/issues/2510)

The distance field consumes Enter. In an empty draft on an eligible face, Enter invokes Linked Inset. Ordinary Offset keeps In and Out as explicit direction controls.

| Result | Check |
| --- | --- |
| FAIL | Parent Studio closed an empty unlinked Sketch on Enter in Offset distance. The first post-change driver expected a new shape inside the copied circular hole. The existing profile rule refuses an island there. |
| PASS | Enter kept the sketch open, the distance field focused, the document unchanged and the same number of draft outlines for empty, single-outline and copied-hole drafts. |
| PASS | Keyboard Out added an outline to the single-outline draft. Keyboard In reached the existing copied-hole refusal and preserved both original drafts. Escape returned to the original document in all three cases. |
| PASS | The separate keyboard Linked Inset run retried the oversized value, created its 2 mm linked draft, and made a 416 mm³ New body extrusion. |
| PASS | Studio type check, scoped lint, driver syntax, production build and frozen-source checks. |
| NOT_RUN | IME, injected key repeat, new island geometry support, full suites, CI and mobile. |

The three desktop acceptance conditions in #2510 are satisfied. The live desktop index showed **29/81 (36%)** checked before this closeout. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
