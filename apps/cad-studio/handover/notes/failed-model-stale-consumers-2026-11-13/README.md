# D992 — exclude the previous result after model evaluation fails

2026-11-13 · SMALL · P0 rows 15 and 21 · [#2444](https://github.com/barocss/barocss/issues/2444)

- **FAIL, baseline** Opening a native zero-height Extrude failed model evaluation. An actual pointer click still selected a face of the previous plate.
- **PASS, fixed** Desktop WebGPU Studio kept the previous plate visible with an explicit previous-result status. Its hover highlight and cursor coordinates were removed. Left click, right click and double click did not select the previous shape or offer its measurement.
- **PASS** Actual Command Palette activation of Hole, Sketch and Measure gave a refusal and did not start an editor, sketch or measurement. The existing STEP guard refused preparation. Opening a corrected 8 mm Extrude restored pointer selection on the current 16,384 mm³ plate within 1e-7 mm³.
- **PASS** Visual review, 27 focused Studio tests, Studio type-check, driver syntax and diff check. The first fixed run reached the unselected stale body, but the cursor coordinate readout made the status locator fail. The final status stands on its own and the hover treatment remains inactive.
- **NOT_RUN** Save and Make version, Drawing PDF, placed or nested failures, WebGL2, production build, full suites and mobile.

The earlier result remains a visual reference until a new evaluation succeeds. A failed root result cannot be used for the qualified actions. Desktop issue acceptance remains 6/54. Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
