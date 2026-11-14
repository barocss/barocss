# D1217 — Keep moved focus when a delayed Linked Inset refusal arrives

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2481](https://github.com/barocss/barocss/issues/2481)

A Studio driver holds delivery of the actual native Worker refusal for a 2 mm inset on a 60 × 3 mm face. It does not replace the result. No product edit was needed.

| Result | Check |
| --- | --- |
| PASS | In the 1024 × 800 Chat/Dock layout, the pending review focused Cancel. Focus then moved to Close editor. Delivering the held refusal closed the review and kept Close editor focused and visible. |
| PASS | The real unheld refusal returned focus to Replace inset source. In both runs the recovery text, document, History, face selection and 960 mm³ ring agreed. No page or console errors occurred. |
| PASS | Browser driver syntax, diff and source custody checks. Both Chrome runs and Vite servers closed. |
| NOT_RUN | A different pending worker order, collapsed History, assistive-technology interpretation, full suites, CI and mobile. |

Keep #2481 open for its remaining conditions. [#2510](https://github.com/barocss/barocss/issues/2510) is closed with evidence. The live desktop index shows **29/81 (36%)** checked and has not ticked #2510. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
