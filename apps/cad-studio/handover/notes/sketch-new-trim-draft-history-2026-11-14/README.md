# D1072 — keep Trim history across Select for a new rectangle

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2455](https://github.com/barocss/barocss/issues/2455)

Replay a parked new rectangle in Select or Dimension when it is the only material shape. Match its converted outline and ordered construction shapes before replay.

- **FAIL** The parent Studio trims the construction line in a new sketch. Cmd+Z after switching to Select leaves the line absent.
- **PASS** Desktop WebGPU restores the exact construction line with Undo and removes it with Redo. The 40 mm edge remains active in Select throughout. Both controls replay the same states. Finish and a 2 mm Extrude retain the line as construction and produce 1,600 mm³. Document Undo and Redo restore both native documents.
- **PASS** Visual review, Studio type-check, 13 focused tests, driver syntax and diff checks.
- **FAIL → PASS** The first candidate restored the construction line but did not reactivate the rectangle when an open line followed it. The final replay keeps the rectangle active.
- **NOT_RUN** Other new-profile types, repair Line, production build and full suites.

#2455 remains open. Desktop QA is 18/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
