# D1215 — Show the actual distance of the linked inset draft

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2481](https://github.com/barocss/barocss/issues/2481)

Sketch shows the live association distance and directs a distance edit to History. The link creation action is only present for an empty draft on an eligible face. The ordinary Offset controls remain available. Enter in their distance field preserves an existing linked draft.

| Result | Check |
| --- | --- |
| FAIL | Parent Studio showed an enabled Link button after creating the linked draft and did not show its actual 2 mm distance. A first driver attempt took the prior regression branch, then the corrected driver reproduced this case. |
| PASS | Studio showed 2 mm and the History edit path. Changing ordinary Offset to 3 mm and pressing Enter did not change the association or close Sketch. Finish explicitly saved the 2 mm recipe. The 4 mm New body extrusion measured 416 mm³ within 1e-7 mm³. |
| PASS | A separate Studio regression retained linked-plane draft Undo/Redo, detachment and upstream regeneration. |
| PASS | Studio type check, scoped lint, driver syntax, production build and frozen-source checks. |
| NOT_RUN | General unlinked Offset Enter, later linked consumers, full suites, CI and mobile. |

Keep #2481 open for remaining acceptance evidence. Desktop QA is **29/72 (40%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
