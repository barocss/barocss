# D1066 — replay Clear profile in Sketch draft history

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2455](https://github.com/barocss/barocss/issues/2455)

Route Clear profile through the document-owned draft history. A second Clear on an empty draft makes no history step.

- **FAIL** In the parent source, Clear removes the material rectangle and construction line. Cmd+Z leaves both absent.
- **PASS** Desktop WebGPU restores both shapes with one Undo after two Clear clicks. Toolbar and keyboard Undo and Redo replay the same two states. The accepted document and its 1,800 mm³ solid remain stable while the sketch is open.
- **PASS** Redrawing a 20 × 10 mm rectangle and finishing retains the 3 mm Extrude at 600 mm³. Document Undo restores the original rectangle, construction line and 1,800 mm³. Redo restores the exact edited document and 600 mm³. Visual review, Studio type-check, 13 focused tests, driver syntax and diff checks passed.
- **NOT_RUN** Clear on a linked inset or a live Band in Studio, other draft routes, production build and full suites.

#2455 remains open. Desktop QA is 18/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
