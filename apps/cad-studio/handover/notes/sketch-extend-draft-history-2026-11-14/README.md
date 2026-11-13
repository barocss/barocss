# D1064 — replay Sketch Extend in draft history

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2455](https://github.com/barocss/barocss/issues/2455)

Record a successful Extend with the same draft history as Trim. Check the document and sketch generation before applying either operation.

- **FAIL** On the parent source, Extend closes the 5 mm gap in a separate material outline. Cmd+Z leaves the outline closed. The accepted 3 mm Extrude remains at 1,800 mm³.
- **PASS** Desktop WebGPU restores all five original chain points on Undo. Redo closes the same outline again. Both toolbar and keyboard controls replay the change. Finish rejects the restored open chain and retains Redo.
- **PASS** Finish after Redo retains the Extrude and produces 2,700 mm³. Document Undo restores the original native document and 1,800 mm³. Document Redo restores the exact edited document and 2,700 mm³. Visual review confirms the gap and the two extruded regions.
- **NOT_RUN** Split and remaining draft routes, wider Extend variants in Studio, production build and full suites.

#2455 remains open. Desktop QA is 18/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).

Studio type-check, 13 focused tests, driver syntax and diff checks passed.
