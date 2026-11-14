# D1210 — Retry Linked Inset from Offset distance

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2481](https://github.com/barocss/barocss/issues/2481)

Enter in Offset distance runs the existing link action when the selected face supports a link and the sketch is empty. The field consumes Enter while the link action is present. An action key repeat cannot finish the sketch. The inline refusal gives one instruction for reducing the distance.

| Result | Check |
| --- | --- |
| FAIL | Parent Studio refused a 6 mm inset, returned focus to Offset distance, and closed the unchanged sketch when Enter was pressed after correction to 2 mm. |
| PASS | The same Enter created the linked draft after correction. Finish saved n3.top, and the separate 4 mm extrusion measured 416 mm³ within 1e-7 mm³. The inline refusal kept the original value, document, History and selection, with one distance-reduction instruction. |
| PASS | The rounded-cap copy and straight-cap button controls passed in another real desktop Studio run. The refusal screenshot was inspected. |
| PASS | Studio type check, scoped lint, driver syntax, production build and frozen-source checks. |
| NOT_RUN | Key-repeat injection, IME composition, other source shapes for this keyboard path, full suites, CI and mobile. |

Keep #2481 open for remaining conditions. Desktop QA is **29/71 (41%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
