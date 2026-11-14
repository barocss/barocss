# D1204 — Return focus after Linked Inset source review

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2481](https://github.com/barocss/barocss/issues/2481)

The review puts focus on Cancel when it opens. Cancel and Escape return focus to Replace inset source. Apply closes the feature editor and focuses its History step, or the History overflow button if the step is hidden. Replacing the active editor or document retires the request without restoring its old focus.

| Result | Check |
| --- | --- |
| FAIL | Parent Studio lost focus to the document body after Enter on Cancel. The first fixture used a band, which the linked recipe refuses. The reproduced focus failure used a valid polygon with a hole. |
| PASS | Desktop Chrome opened the review by keyboard. Enter and Escape returned focus to Replace inset source. The document and picked face stayed the same. Clicking a different History feature closed the review and kept focus on the feature just clicked. |
| PASS | Tab reached Apply source. Enter restored focus to Extrude 4 in History. Only the link changed from n1.top to n3.side0. Studio measured 1024 mm³, matching `(60 × 8 − 56 × 4) × 4` within 1e-7 mm³. Undo and Redo restored both bindings. |
| PASS | Studio type check, scoped lint outside App.tsx, browser driver syntax, production build, diff and frozen-source checks. Chrome and Vite closed after both valid runs. |
| FAIL | App.tsx lint has the existing unused `_k` at line 2298. The same line is present on the parent commit. |
| NOT_RUN | Automatic focus on the collapsed History overflow, pending-review cancellation, another input mode or source geometry, full suites, CI and mobile. |

Keep #2481 open for face eligibility and recovery guidance. Desktop QA remains **29/54 (54%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
