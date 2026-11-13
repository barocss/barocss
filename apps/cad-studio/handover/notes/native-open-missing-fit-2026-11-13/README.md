# D990 — refuse a native Open with a missing fit row

2026-11-13 · SMALL · P0 rows 15 and 21 · [#2444](https://github.com/barocss/barocss/issues/2444)

- **FAIL, baseline** Native Open adopted a file with no row for the live Ø12 mm g6 class. The new file name and document appeared while the prior plate remained visible and the base was not current.
- **PASS, fixed** Desktop WebGPU Studio kept the selected prior plate, exact document, file name, dirty flag and Undo/Redo state. A fresh context with a new empty part also refused the file and kept the empty canvas and its history. The notice stated the missing row and how to recover.
- **PASS** In both contexts a corrected file with the covering table opened. The resulting cylinder matched π × 6² × 24 mm³ within 1e-7 mm³. All 13 document-file tests, Studio type-check, driver syntax, visual review and diff check passed.
- **NOT_RUN** Browser project Open and Save, nested fit failures, stale face consumers after a different evaluation failure, Drawing PDF, dependent Fillet suppression, WebGL2, production build, full suites and mobile.

The shared native Open check only intercepts FIT_TABLE_MISS for root models with authored face fits. Existing reference recovery remains on its original path. It is called before document adoption for both file and project Open.

Desktop issue acceptance remains 6/54. Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
