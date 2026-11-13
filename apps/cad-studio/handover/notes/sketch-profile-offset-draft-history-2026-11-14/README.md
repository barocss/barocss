# D1077 — verify ordered coordinate and inward profile Offset history

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2455](https://github.com/barocss/barocss/issues/2455)

Replay the historical coordinate and Offset workflow on current source. The existing history handles the complete case. This decision adds a desktop regression driver.

- **PASS** Desktop WebGPU changes the right edge from X60 to X66 and applies a 2 mm inward Offset. Undo removes the inner outline before restoring X60. Redo restores X66 before the same inner outline. The two input routes agree and the accepted 3,000 mm³ solid stays unchanged until Finish.
- **PASS** Finish retains the 3 mm Extrude and outer IDs. The ring has a 46 × 25 mm outer boundary, a 42 × 21 mm inner boundary, and a volume of 804 mm³. Document Undo and Redo restore both exact documents and volumes. Visual review, 13 focused tests, driver syntax and diff checks passed.
- **NOT_RUN** A new run on the historical failing revision, full suites and production build.

#2455 remains open. Desktop QA is 18/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
