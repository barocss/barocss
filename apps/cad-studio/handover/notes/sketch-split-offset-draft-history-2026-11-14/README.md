# D1078 — verify ordered circle Split and Offset draft history

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2455](https://github.com/barocss/barocss/issues/2455)

Replay the historical Split and Offset workflow on current source. This decision adds a desktop regression case to the existing native geometry driver.

- **PASS** Desktop WebGPU splits a radius-10 mm circle into two semicircles and offsets outward 2 mm. Undo restores the split outline before the ordinary circle. Redo restores the split outline before the ring. An invalid 12 mm inward Offset between the Redo actions preserves the outline and the pending Redo.
- **PASS** Finish and a 2 mm Extrude retain two arcs on each boundary, native radii 10 and 12 mm, and volume 276.460154 mm³. Native validity, document Undo and Redo, visual review, 13 focused tests, driver syntax and diff checks passed.
- **NOT_RUN** Draft replay on the rotated plane or the historical failing revision, full suites and production build.

#2455 remains open. Desktop QA is 18/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
