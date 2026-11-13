# D1096 — restore and edit a saved secondary outline Length

2026-11-14 · FEATURE · P0 desktop QA, rows 09 and 21 · [#2456](https://github.com/barocss/barocss/issues/2456)

Save a Length and its H/V constraints on a straight secondary material region when the ordered stable side IDs and literal native points match. The recipe keeps the original anchor and uses the existing 1e-7 mm solver residual. Open ignores stale or ambiguous recipes and still opens the native geometry. Reopened Select and Dimension can activate a closed outline without changing native region order. Draft history can undo an edit to a parked outline after an outline switch.

- **FAIL** The parent retained a width of 24 mm after Save and Open but had no secondary Length recipe or editing target. With initial recipe support, switching to the main outline before Undo left the second width at 26 mm.
- **PASS** Desktop Studio authors 20 → 24 mm on the second rectangle and uses a 2 mm Extrude. A fresh Open restores the locked 24 mm Length. Editing to 26 mm, then switching to the main outline, leaves that outline active while Undo restores 24 mm and Redo restores 26 mm. Finish retains both ordered side ID arrays, the original Extrude node and all 12 native face names. Document Undo and Redo restore the exact documents. A second Save and fresh Open restores the locked 26 mm Length.
- **PASS** Strict native B-rep checks and independent rectangle area times depth agree at 1280 and 1340 mm³. The native result is one output with two disjoint extruded regions. Model 79/79, Studio 32/32, both type checks, scoped lint, driver syntax, diff and visual review pass. A focused Model case also preserves the secondary Length while binding, solving and unbinding a named parameter on the main outline.
- **NOT_RUN** Constraints between separate outlines, curved or hole recipes, unrelated tools and viewports, full suites and production build.

#2456 remains open. Desktop QA is 19/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
