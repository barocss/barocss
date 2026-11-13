# D1138 — Refuse an empty numeric field in feature history

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2461](https://github.com/barocss/barocss/issues/2461)

An explicitly cleared numeric editor field blocks Apply and Enter. The panel marks the input and gives its name. Reset remains available while a missing field is present.

| Result | Check |
| --- | --- |
| FAIL | In the parent Studio, Distance 10 → 14 → empty followed by Width 40 → 42 and Enter committed a 42 × 30 × 14 mm result with no warning. The failed run captured the changed document after the editor closed. |
| PASS | Desktop Studio left Distance visibly empty, named it, and disabled Apply. A real pointer click on Apply and Enter on Distance preserved the document, accepted geometry and both history controls. |
| PASS | Restoring Distance to 10 mm applied only the 42 mm width. Volume was 12,600 mm³. First Undo and Redo restored the exact documents. |
| PASS | 48 focused Model tests, Studio type check, scoped lint, driver syntax and diff passed. |
| NOT_RUN | Separate Box and Fillet controls, 3D Sketch zero length, fractional Circular Count, full suites and mobile. |

#2461 remains open. Desktop QA is **23/54**. Initial scenarios are **8/10**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
