# D1091 — record Slot panel edits in sketch draft history

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2456](https://github.com/barocss/barocss/issues/2456)

Record settled Slot panel edits in the existing outline history. Keep shape metadata when replacing a Slot field. New pointer placements still use the existing placement path.

- **FAIL** Parent Studio updates the Length and visible outline but creates no draft Undo step.
- **PASS** Desktop Studio draws the Slot with three actual canvas clicks. Length 35→45 mm, Width 20→14 mm and Angle 0→30° each produce one independent Undo and Redo. The field values and visible outline replay exactly before Finish. Finish produces two lines and two arcs with four side IDs. Both end walls have radius 7 mm. Strict native validation and the independent 3 mm extrusion formula agree at 2351.812549841714 mm³. Document Undo and Redo pass.
- **PASS** Studio type check, 31 focused tests, SketchPanel lint, driver syntax, diff and visual review.
- **NOT_RUN** Slot controls after Save and Open, full App.tsx lint, broader profiles, full suites and production build.

#2456 remains open. Desktop QA is 19/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
