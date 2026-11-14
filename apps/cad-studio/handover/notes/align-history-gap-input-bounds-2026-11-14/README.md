# D1235 — Validate the Align History Gap before Apply

2026-11-14 · SMALL · P0 desktop QA, rows 07 and 21 · [#2506](https://github.com/barocss/barocss/issues/2506)

Align History uses the native nonnegative Gap range. A value outside it shows the existing field error, retires the draft preview and blocks Apply and Enter. A valid value still goes through native preview and acceptance.

| Result | Check |
| --- | --- |
| FAIL | Parent Studio enabled Apply for −1 mm and did not flag the field. |
| PASS | Chrome WebGPU kept −1 and 10000.1 mm as draft text, showed the range once as the field error and blocked Apply and Enter. Empty input retained its number prompt. Reset restored the accepted 2 mm. |
| PASS | Zero is valid. Its preview and Apply produced a strict solid at centre [95, 10, 15] mm with volume 720 mm³. Independent box dimensions matched within 1e-7. Undo, Redo, Studio Save and fresh Open passed. |
| PASS | The Align History delayed-reply regression, 20 focused Studio tests, type check, scoped lint, driver syntax, production build and frozen-source checks. |
| NOT_RUN | A solid whose resulting placement is valid at the exact 10000 mm maximum, assistive technology, full suites and CI. |

The D1234 command and D1235 History evidence meet #2506. Desktop QA is **33/91 (36%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
