# D1095 — keep the shared sketch edge pickable beside length labels

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2456](https://github.com/barocss/barocss/issues/2456)

Place reference length labels away from projected straight segments of the active outline and earlier labels when a nearby in-view position is available. Keep the inline editor anchored to the displayed label.

- **FAIL** At 1024 × 800 the parent routes a click at shared midpoint [14,11] mm to a dimension chip and leaves the edge unselected.
- **PASS** At the same screen coordinate the click reaches the canvas and selects edge 4 of the active rectangle. The relocated reference label still opens a 10 mm editor by double-click. Escape and the shared-edge click preserve the accepted document.
- **PASS** D1054 desktop regression at a 4 CSS px edge gap keeps the two 54 mm chips separate, opens each correct editor, and applies a 55 mm length with document Undo and Redo. Studio type check, 30 focused tests, lint, driver syntax, diff and visual review pass.
- **NOT_RUN** General dense annotation layout, other viewport sizes and planes, full suites and production build.

#2456 remains open. Desktop QA is 19/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
