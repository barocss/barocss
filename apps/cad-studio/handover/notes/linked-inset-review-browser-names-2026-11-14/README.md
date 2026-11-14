# D1223 — Identify linked inset review bodies by Browser name

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2481](https://github.com/barocss/barocss/issues/2481)

Review shows separate current source, candidate source and target rows. Rows use the original Browser body names where a current body exists and retain the stable face or feature identity. The preview labels its volume and puts plane coordinates in a disclosure.

| Result | Check |
| --- | --- |
| FAIL | Parent Studio displayed only n1.top, n3.side0 and target n1, even with distinct Browser body names. |
| PASS | Actual review identified Original stock, Replacement stock and the original target. Plane details started closed and exposed normal (0, −1, 0) when opened. Apply retained keyboard focus, changed only the association and created the 1024 mm³ ring. Undo and Redo passed. |
| PASS | In the 1024 × 800 Chat/Dock test, the initial Cancel and restored opener remained visible. The opposite-normal oblique case passed the existing native checks, preserved the target and regenerated on source width edit. |
| PASS | Studio type check, scoped lint, both driver syntax checks, production build and frozen-source checks. |
| NOT_RUN | Historical source absent from the current Browser, duplicate custom names, full suites, CI and mobile. |

Keep #2481 open for its remaining lifecycle cases. Desktop QA is **30/81 (37%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
