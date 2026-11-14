# D1168 — Replace one active Sweep input during preview

2026-11-14 · FEATURE · P0 desktop QA, rows 07 and 21 · [#2462](https://github.com/barocss/barocss/issues/2462)

A Browser pick during Sweep replaces its captured profile or path and keeps the other input. Retire the old preview, clear its pending Apply, and enable Apply after the new result. A pick of a surface leaves the current inputs and preview in place.

| Result | Check |
| --- | --- |
| FAIL | The parent highlighted Rail B while the command and visible body still used Rail A. An intermediate Model type check reported two sketch property accesses and an invalid refusal code. Final checks passed after correction. |
| PASS | Desktop Studio switched Rail A to Rail B with Sketch 1 (Ø6) retained. Clicking a surface was refused and both inputs stayed selected. Shift-clicking Ø12 and then the earlier Ø6 sketch changed only the profile. Rendered preview volumes matched independent regular-32-gon prism values 898.976203850, 618.046140147, 2472.184560588 and 618.046140147 mm³ within 0.01 mm³. |
| PASS | Apply and fresh Open kept Rail B's exact stored endpoints (30,0,0) and (30,0,22) mm, with a 3 mm vertex radius at both ends of one valid faceted native body. Undo returned to the original document, and Redo restored the same result. |
| PASS | D1167 desktop regression, 68 focused Model tests, 4 focused Studio tests, both type checks, scoped lint, driver syntax, diff check and production build. |
| NOT_RUN | Replacing or inspecting a Sweep's inputs through History, viewport pick coverage, Join/Cut retarget, full suites and mobile. |

Keep #2462 open. D1169 checks Sweep History input inspection and replay. Desktop QA is **27/54 (50%)** and initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
