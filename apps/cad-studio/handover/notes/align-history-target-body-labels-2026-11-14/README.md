# D1231 — Identify the body in each Align History target

2026-11-14 · FEATURE · P0 desktop QA, rows 07 and 21 · [#2491](https://github.com/barocss/barocss/issues/2491)

The Align History chooser shows the Browser body name beside each persistent native face ID. The chooser keeps the label outside the saved target. The moving body's faces remain excluded.

| Result | Check |
| --- | --- |
| FAIL | Parent Studio listed native face IDs only. |
| PASS | Chrome WebGPU desktop distinguished `Stock · n3.top` and `Stock · n5.top` when two eligible bodies shared the name Stock. Untitled bodies used their Browser default labels. Reset restored the original target. |
| PASS | Apply stored only the new target binding. The moving body kept volume 720 mm³ and its centre moved from [95, 10, 17] to [50, 8, 13] mm. Independent box bounds, mass and strict native B-rep all matched within 1e-7. Undo, Redo, Studio Save and fresh Open passed. |
| PASS | 20 focused Studio tests, Studio type check, scoped UI lint, syntax, production build and frozen-source checks. |
| FAIL | Whole-file App lint retains the inherited unused `_k` from D1228. |
| NOT_RUN | Align History draft geometry preview, assistive technology, full suites and CI. |

Keep #2491 open for History draft preview. Desktop QA is **30/83 (36%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
