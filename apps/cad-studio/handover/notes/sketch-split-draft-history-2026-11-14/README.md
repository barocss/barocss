# D1065 — replay Sketch Split and its midpoint snaps

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2455](https://github.com/barocss/barocss/issues/2455)

Record a successful Split with the same ownership check and draft history as Trim and Extend.

- **FAIL** On the parent source, the 270° construction arc splits near [30, 40] mm and gets two Middle snaps. After switching to Rectangle, Cmd+Z leaves the arc split.
- **PASS** In desktop WebGPU, toolbar and keyboard Undo restore the original arc and its one Middle snap. Redo restores the 90° and 180° pieces and their two Middle snaps. Each state excludes the other state's snap positions.
- **PASS** Finish keeps the endpoints and their IDs, adds one vertex with a fresh ID, and retains the material rectangle and 3 mm Extrude. The solid stays at 600 mm³ before and after Finish, document Undo and document Redo. Visual review confirms the original and split snap positions.
- **NOT_RUN** Split on material outlines and circles in Studio, remaining draft routes, production build and full suites.

#2455 remains open. Desktop QA is 18/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
