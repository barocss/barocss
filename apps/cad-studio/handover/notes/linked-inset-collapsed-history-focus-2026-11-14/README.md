# D1218 — Verify Linked Inset Apply focus with collapsed History

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2481](https://github.com/barocss/barocss/issues/2481)

Desktop Studio opens the linked extrusion from an expanded labeled History, then collapses it before review. Twenty-eight suppressed earlier extrusions give the bar a real overflow without changing the active three solids. No product edit was needed.

| Result | Check |
| --- | --- |
| FAIL | Two initial driver setups did not exercise the path. One omitted canonical output entries for suppressed solids. The next used icon-only chips that all fit. The final setup included canonical outputs and enabled History step names. |
| PASS | After keyboard Apply, the original feature step remained hidden and the visible History overflow button held focus and passed hit-testing. Enter reopened the list and exposed the linked extrusion's new n3.side0 source. |
| PASS | The only authored change was the association. The ring measured 1024 mm³ within 1e-7 mm³. Undo and Redo restored both source bindings. Driver syntax, diff and source custody passed. |
| NOT_RUN | Other overflow arrangements, assistive-technology interpretation, full suites, CI and mobile. |

Keep #2481 open for the remaining acceptance audit. The live desktop index shows **29/81 (36%)** checked, pending its closed #2510 tick. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
