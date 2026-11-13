# D1061 — record numeric Bézier draft edits

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2455](https://github.com/barocss/barocss/issues/2455)

Record a changed control polygon from the Sketch panel when it retains its number of poles. The existing Bézier validation still runs before history records the edit.

- **FAIL** Actual Studio applies Control point 2 Y42→34 mm on Enter but leaves Sketch Undo disabled. The first repaired run passed Enter and blur replay but the driver used the visible text in place of the accessible name for Make curves.
- **PASS** Desktop WebGPU replays Y42→34 and Y34→38 through the toolbar and shortcuts. The curve midpoint follows [27, 34], [27, 31] and [27, 32.5] mm within 0.05 CSS px of the projected cubic midpoint. The draft preserves the accepted document. Make curves writes a cubic with the expected four control points, clamped knots and unit weights. Document Undo and Redo pass.
- **PASS** Visual review, the Circle desktop replay, 11 focused Studio tests, type-check, driver syntax and diff checks.
- **NOT_RUN** Quadratic product replay, Bézier draft tool transitions, full suites, production build and mobile.

#2455 remains open for other draft routes. Desktop QA is 18/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
