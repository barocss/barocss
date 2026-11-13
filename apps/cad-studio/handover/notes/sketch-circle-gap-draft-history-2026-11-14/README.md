# D1074 — replay Cut circle gap in Sketch draft history

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2455](https://github.com/barocss/barocss/issues/2455)

Apply the path-gap result through the owned Sketch draft history after the existing document, generation and original-shape checks.

- **FAIL** The parent Studio applies a 4 mm arc-length gap to a new R10 circle. Cmd+Z leaves the remainder open.
- **PASS** Desktop WebGPU refuses Finish while the arc is open. Undo restores the exact circle and clears the warning. Redo restores the same arc and endpoints. Both toolbar and keyboard replay the change in Select. The native document stays empty until Finish.
- **PASS** Finish after Undo stores center [20, 20] mm and radius 10 mm. A 2 mm Extrude produces 628.318531 mm³. Document Undo and Redo restore the exact sketch and extruded documents. Visual review, Studio type-check, 19 focused tests, driver syntax and diff checks passed.
- **NOT_RUN** Path-gap history on construction lines or arcs in Studio, extending the tool to reopened ordinary circles, production build and full suites.

#2455 remains open. Desktop QA is 18/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
