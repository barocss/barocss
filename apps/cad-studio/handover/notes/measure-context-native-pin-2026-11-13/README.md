# D1038 — pin the native face picked with Measure from here

2026-11-13 · SMALL · P0 rows 11 and 20 · [#2450](https://github.com/barocss/barocss/issues/2450)

The context menu captures the current original measurement target when opened. A native pin is eligible only when the menu's document and mesh still match, and the other cap passes the existing pin checks.

- **FAIL** Baseline Studio measured 8 mm between the original caps from the context menu but did not offer Pin measurement.
- **PASS** Desktop Studio pins 8 mm from Measure from here. Editing Extrude to 13.25 mm updates the pin. Selecting the top face while the pin is active does not change it. Undo and Redo restore 8 and 13.25 mm respectively. Clear removes the pin and leaves the accepted document unchanged.
- **PASS** Separate desktop runs preserve the original Section face and retained edge Measure paths and refuse generated caps. Visual inspection, five focused Studio tests, Studio type-check, driver syntax and diff check pass.
- **NOT_RUN** Placed context-menu Measure, keyboard pin/clear in the narrow dock, worker-delay menu replacement, production build, full suites and mobile.

#2450 remains open. Desktop QA is 11/54, initial scenarios are 8/10, and whole CAD and core readiness **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
