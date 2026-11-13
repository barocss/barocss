# D1130 — Explain the one-sketch limit before Extrude

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2459](https://github.com/barocss/barocss/issues/2459)

| Result | Check |
| --- | --- |
| FAIL | Desktop Studio kept two canvas-selected sketches but gave a generic prompt to pick a flat face or a finished sketch. |
| PASS | With both sketches selected, E says “Select one finished sketch to extrude.” The HUD stays closed. The document, selected sketches and Undo/Redo controls stay exact. |
| PASS | Shift-click removed the first selection. The HUD identified Sketch 2 and preview left the document unchanged. Apply referenced Sketch 2 and produced a 240 mm³ body at 2 mm. First Undo and Redo restored the exact documents. |
| PASS | 48 focused Model tests, both type checks, production build, scoped lint, driver syntax and diff check. |
| NOT_RUN | A subset of regions inside one sketch, fresh Save/Open, full suites and mobile. |

#2459 remains open. Desktop QA is **21/54**. Initial scenarios are **8/10**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
