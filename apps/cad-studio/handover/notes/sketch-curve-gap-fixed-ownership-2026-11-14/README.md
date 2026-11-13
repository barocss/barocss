# D1055 — verify the Sketch circle gap and Fixed point ownership

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2460](https://github.com/barocss/barocss/issues/2460)

Extend the desktop drivers for the selected circle and line, and for individual Fixed constraints. Production source stays at D1054.

- **PASS** In 1024 × 800 WebGPU Studio, a 4.00002 CSS px gap retains at least one background pixel in every sampled column at DPR 1 across 11 CSS px. This holds with the line selected and the circle hovered, and after Shift selects both. Hover and click select the closer curve. Visual review confirms the gap.
- **PASS** The two Fixed marks have zero overlap and their leaders resolve to the original points. Selecting each point isolates its own Fixed row. Remove and sketch Undo restore each rule. The driving dimension, zoom/resize, no-op Finish and 1,096 mm³ Extrude controls pass. The 900 × 760 rail replay verifies visible and covered Fixed point ownership.
- **PASS** Seven focused Studio tests, driver syntax and diff checks. All three product runs have zero downloads, page errors, console errors and source changes.
- **FAIL** None in the current scope.
- **NOT_RUN** Other dense constraint glyph configurations, circle pixels at DPR 2, WebGL2, full suites, production build and mobile.

D1052–D1055 satisfy #2460. The related [#2377](https://github.com/barocss/barocss/issues/2377) retains its broader glyph and density acceptance. Desktop QA reaches 18/54 on issue closure. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
