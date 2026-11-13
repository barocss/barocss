# D1094 — select the exact sketch edge from an overlaid-line occurrence

2026-11-14 · FEATURE · P0 desktop QA, rows 09 and 21 · [#2456](https://github.com/barocss/barocss/issues/2456)

Use the selected occurrence from the current scan to activate an exact closed outline edge. Match the directed or reversed endpoints and the stored side identity where available. Close the scan and use the existing Dimension action. Keep authored order when a fresh sketch activates an earlier outline.

- **FAIL** Parent Studio identifies both overlapping occurrences but cannot select the highlighted first edge for editing.
- **PASS** At 1024 × 800, two rectangles share one exact edge. The scan shows both directions. Keyboard selection activates Shape 1, segment 2 and opens its 10 mm length through the existing Dimension action. Applying 12 mm changes only the first rectangle. Draft Undo and Redo restore the visible outline. Finish keeps the first rectangle as the main profile and the untouched second rectangle as its region.
- **PASS** Studio type check, 34 focused tests, scoped lint, driver syntax, diff and visual review. The changed App.tsx path was type-checked. Whole-file App.tsx lint was not repeated after the inherited failure in D1089.
- **NOT_RUN** Direct canvas label interception, scan editing of open or construction shapes, cross-outline constraints, full suites and production build.

#2456 remains open. Desktop QA is 19/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
