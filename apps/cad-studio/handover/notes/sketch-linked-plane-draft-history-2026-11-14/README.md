# D1070 — replay linked inset plane and face association

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2455](https://github.com/barocss/barocss/issues/2455)

Record plane edits in a linked or detached inset draft. Replay the plane, anchor, face body and association together. Reframe the viewport when replay changes the plane. Equal anchor inputs make no history step.

- **FAIL** The parent Studio leaves the plane at Z12 and the inset detached after Cmd+Z.
- **PASS** Desktop WebGPU uses a picked top face and a 1 mm linked inset. A 2 mm offset detaches it. Toolbar and keyboard Undo restore Z10 and the original link. Redo returns to Z12 and detaches it again. Entering the same offset preserves the replay order.
- **PASS** Finish after Undo stores the original source face, plane and link. A 4 mm independent Extrude gives 224 mm³. Increasing the source height from 10 to 12 mm moves the ring centroid from Z12 to Z14 without changing the sketch node or ring volume. Visual review, Studio type-check, 13 focused tests, driver syntax and diff checks passed.
- **NOT_RUN** Tilt and other plane choices in linked drafts, generic plane history, other draft routes, production build and full suites.

#2455 remains open. Desktop QA is 18/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
