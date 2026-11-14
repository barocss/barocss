# D1234 — Distinguish an Align target request from a refusal

2026-11-14 · FEATURE · P0 desktop QA, rows 07 and 21 · [#2506](https://github.com/barocss/barocss/issues/2506)

Align waits for an actual face before evaluation. The waiting instruction is in one step. The Onto field identifies the selected body and face and recalls that choice after Floor. The existing invalid-pick notice remains available and clears after a valid pick.

| Result | Check |
| --- | --- |
| FAIL | Parent Studio marked the first missing face as invalid input. |
| PASS | Chrome WebGPU at 1024 × 800 and 1440 × 900 showed the selection instruction once and kept Apply locked. The source face was refused with recovery text. A real B pick changed the preview. Picking the generated moving face kept B. Picking C and switching Floor → Face restored `Stock · n5.top` even with two stocks of the same name. |
| PASS | Apply preserved the accepted references and produced a strict native body with centre [95, 10, 17] mm and volume 720 mm³, matching independent dimensions within 1e-7. Undo and Redo passed. The separate Align History draft, native Save and fresh Open control passed. |
| PASS | Three focused Model tests, 20 focused Studio tests, both type checks, scoped lint, driver syntax, production build and frozen-source checks. |
| NOT_RUN | History Gap bounds, assistive technology, full suites and CI. |

Keep #2506 open for History Gap validation. Desktop QA is **32/89 (36%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
