# D1207 — Show the current Linked Inset binding in History

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2481](https://github.com/barocss/barocss/issues/2481)

The linked Sketch and its direct Extrude show the committed source face, sketch target and inset distance. The panel describes the existing source replacement and sketch detachment actions. The display reads the current document rather than the provisional replacement.

| Result | Check |
| --- | --- |
| FAIL | Parent Studio offered Replace inset source while hiding the current binding in the feature editor. |
| PASS | History initially showed n1.top, target Extrude 8 (n1) and 2 mm. The source became n3.side0 after Apply and Redo. Undo restored n1.top. The target and distance stayed fixed. |
| PASS | Enter and Escape returned focus to the opener, and Apply focused the Extrude History step. The accepted ring volume stayed 1024 mm³ within 1e-7 mm³. Desktop screenshot inspection, Studio type check, scoped lint, driver syntax, production build and frozen-source checks passed. |
| NOT_RUN | Direct sketch-chip editor, other source shapes, narrow scrolling Dock, automatic replacement refusal, full suites, CI and mobile. |

Keep #2481 open. The issue's latest desktop evidence adds an off-screen initial Cancel and automatic-refusal focus loss in the 1024 × 800 Chat/Dock layout. Desktop QA is **29/71 (41%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
