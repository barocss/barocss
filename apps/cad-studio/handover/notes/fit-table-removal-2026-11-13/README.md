# D989 — reject a fit table edit that invalidates the model

2026-11-13 · SMALL · P0 rows 15 and 21 · [#2444](https://github.com/barocss/barocss/issues/2444)

- **FAIL, baseline** Removing the only table that covers the active Ø12 mm g6 fit committed the empty table list. Evaluation reported FIT_TABLE_MISS and the previous cylinder remained visible with freshness false.
- **PASS, fixed** Desktop WebGPU Studio kept the table, document, selected cylinder, dirty flag and Undo/Redo unchanged. The current cylinder remained valid. The error identified g6 at Ø12 mm and the Library recovery path.
- **PASS** An in-range same-ID replacement worked. After adding a second compatible table, removing the first worked. Undo restored both tables and Redo restored the replacement alone. Cylinder volume matched π × 6² × 24 mm³ within 1e-7 mm³ and remained identical through the valid replacement.
- **PASS** Visual review, 3 model fit tests, 13 Studio ownership tests, Studio type-check, driver syntax and diff check.
- **NOT_RUN** Opening a previously failed document, stale mesh consumers, Drawing PDF, suppression and Save, WebGL2, production build, full suites and mobile.

The Library checks the full candidate in the worker's read slot. This includes inherited shop rows during in-place editing. A result can commit only while its request and document, view and worker ownership are current. Successful changes use one history entry.

Desktop issue acceptance remains 6/54. Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
