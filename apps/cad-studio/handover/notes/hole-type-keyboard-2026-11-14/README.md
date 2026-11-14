# D1180 — Use Hole Type from the keyboard without applying the feature

2026-11-14 · SMALL · P0 desktop QA, rows 07 and 21 · [#2490](https://github.com/barocss/barocss/issues/2490)

Hole Type and Hole presets share the same focused select stepping for unmodified arrow keys. Enter on the Type control leaves the preview active. Explicit Apply commits it.

| Result | Check |
| --- | --- |
| FAIL | In parent desktop Chrome, ArrowDown and Enter left Through selected. The reported premature Apply did not reproduce. The command, document and History remained open and intact. |
| PASS | After the fix, a real top-face pick at (8,8) followed by H opened Hole. ArrowDown and Enter on Type changed Through to To a depth and exposed Depth. The accepted document and History count stayed fixed. Enter with focus on Apply created one Ø4 blind hole at (8,8), depth 6. Native bore radius was 2 mm and total volume 19124.601776313844 mm³, within 1e−7 of 19200 − 24π. Undo restored the exact stock. |
| FAIL | The first type check required reading isComposing from the native event. The final type check and both desktop reruns passed. |
| PASS | D1178 desktop preset regression, three scoped Studio tests, Studio type check, scoped lint, syntax and diff check. |
| NOT_RUN | Other Hole mode combinations by keyboard, pattern History edits, full suites and mobile. |

Desktop QA is **29/54 (54%)** and initial scenarios **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [#2490](https://github.com/barocss/barocss/issues/2490) remains open for row and circular pattern History and thread editing. D1181 starts with the saved straight-row step coordinates. [Commands and hashes](qualification.json).
