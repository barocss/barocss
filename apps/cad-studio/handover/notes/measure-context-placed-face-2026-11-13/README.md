# D1040 — start Measure from a static placed face

2026-11-13 · FEATURE · P0 rows 11 and 20 · [#2450](https://github.com/barocss/barocss/issues/2450)

Route an occurrence face from the renderer to Measure from here. The menu checks the accepted document, placement, visibility and rendered mesh before it offers Measure. It rechecks live document and display state when the action runs. Placed context menus offer view actions and do not expose root body edits.

- **FAIL** Baseline desktop Studio had no Measure from here on the visible bottom face of Witness plate.
- **PASS** Desktop Studio starts at `Witness plate (inst1/b1)` and measures to the base top. The inspector shows 20.62 mm shortest, 5 mm normal and Δ=[−20, 0, −5] mm, consistent with √425 mm. No native pin is offered for this cross-occurrence pair. Explode removes the line and refuses a new Measure from here on the displaced occurrence. Returning to the accepted placement allows a new start. The authored document remains unchanged.
- **PASS** Desktop ordinary placed Measure, root context pin through edit/history, original Section face Measure, and Section instance picking. Visual review, independent source audit, 10 focused Studio tests, Studio type-check, driver syntax and diff checks pass.
- **NOT_RUN** WebGL2, rotated or nested placements, transient frames before the renderer applies an updated transform or clip, production build, full suites and mobile.

D1035–D1040 qualify the reported #2450 scope. Desktop QA acceptance advances to 12/54 with this item. Initial scenarios are 8/10, and whole CAD and core readiness are **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
