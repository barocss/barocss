# D1075 — replay a confirmed Circle from chord candidate

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2455](https://github.com/barocss/barocss/issues/2455)

Record a confirmed Circle from chord candidate with the existing sketch placement history.

- **FAIL** The parent Studio keeps the confirmed circle after Cmd+Z.
- **PASS** Desktop WebGPU removes the confirmed circle on Undo and restores its exact outline on Redo. The diameter edit 10→12 mm and the preceding confirmation replay in order with the toolbar and keyboard. Undo keeps the document empty and leaves the candidate picker closed.
- **PASS** Finish retains center [23, 16] mm and radius 5 mm. The 2 mm Extrude gives 157.079633 mm³. Native geometry, document Undo and Redo, visual review, the existing Circle from chord desktop flow, Studio type-check, 11 focused tests, syntax and diff checks passed.
- **NOT_RUN** Draft replay on tilted planes or with a construction chord, production build and full suites.

#2455 remains open. Desktop QA is 18/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
