# D1222 — Distinguish applied and draft Linked Inset distances

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2481](https://github.com/barocss/barocss/issues/2481)

History shows one distance while the input represents the accepted value. A changed or empty input reveals the applied value with a distinct label. Source replacement prerequisites step aside while the distance draft differs. The source face and target remain visible.

| Result | Check |
| --- | --- |
| FAIL | Parent Studio showed the accepted distance and editable input with the same label even when both read 2 mm. |
| PASS | Studio showed Applied inset distance 2 mm beside an uncommitted 3 mm input. The underlying document stayed unchanged. The later-Move replacement guidance returned on Reset, then hid during distance editing. The screenshot was inspected. |
| PASS | 0 mm disabled Apply, 12 mm was refused and 3 mm was accepted. Only the link scalar changed. Source, target, 4 mm extrusion and downstream Move were retained. The ring volume was 1392 mm³. Undo, Redo and fresh Open of accepted bytes kept the distinction. |
| PASS | The wider Studio source replacement regression retained keyboard focus and current binding. |
| PASS | Studio type check, scoped lint, driver syntax, production build and frozen-source checks. |
| NOT_RUN | Product Save in this case, cleared-input visual proof, another downstream feature, full suites, CI and mobile. |

Keep #2481 open for the remaining source presentation and lifecycle checks. Desktop QA is **30/81 (37%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
