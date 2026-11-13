# D1034 — explicitly reattach a lost assembly diameter

2026-11-13 · FEATURE · P0 rows 10, 12 and 20 · [#2449](https://github.com/barocss/barocss/issues/2449)

The DIMENSIONS row can reattach a standard orthographic assembly diameter with a hidden or missing occurrence reference. Select a current rim in the same view and confirm its named occurrence and diameter. The accepted edit changes the geometry reference in one history step. It retains the dimension's ID, placement and tolerance.

- **FAIL** The baseline lost Ø12 row offered no direct rim reattachment action.
- **PASS** Desktop Studio rejects a pick in the wrong view. The candidate shows Plate 1 and Ø8 before confirmation. Cancel and a settings change retire the candidate. Subsequent clicks do not create another dimension. Confirmation changes only `d2`'s edge, near point and stale reference metadata. Undo restores the original lost reference and warning. Redo and fresh browser Project reopen restore the confirmed reference and SVG Ø8. `d1` remains unchanged.
- **PASS** Independent audit, visual inspection, 91 Model tests, 19 Studio tests, both type-checks, driver syntax and diff check.
- **NOT_RUN** Nested reattachment in Studio, other annotation kinds or projected views, independent PDF/DXF readback, production build, full suites and mobile.

D1029–D1034 meet the reported desktop acceptance in #2449. Desktop QA is 11/54, initial scenarios are 8/10, and whole CAD and core readiness **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
