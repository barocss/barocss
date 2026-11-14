# D1248 — pick geometry beneath an idle dimension handle

2026-11-14 · SMALL · P0 rows 15, 20 and 21 · [#2497](https://github.com/barocss/barocss/issues/2497)

- **FAIL, baseline** Actual Chrome WebGPU at 1440 × 900 and 1024 × 800 opened Edit Box on a Shift click over Width X in both Faces and Edges. The first selection remained alone.
- **PASS** A mouse Shift press over a passive feature handle in Faces or Edges waits for drag travel. Releasing within 5 CSS px takes the ordinary additive geometry path. Travel beyond the threshold starts the original handle drag. Active command gizmos keep their normal path.
- **PASS** A real Right face click and Top edge click added and then removed the overlapping target at both sizes. Plain click still starts Edit Box. A deliberate plain drag to width 23 mm previewed and cancelled. A deliberate Shift drag to width 23 mm previewed and applied, preserving the first edge selection. Stored rectangle bounds and 4,600 mm³ matched the independent 23 × 20 × 10 mm result within 1e-8 mm³. Undo and Redo passed.
- **PASS** A real Shift drag on the active Move X gizmo set ΔX to 0.4 mm. Escape kept the document. The separate actual mixed Shift pick regression passed. Visual review, 33 focused Studio tests, Studio type-check, targeted lint, production build, driver syntax and diff passed.
- **FAIL, harness** Two preliminary checks read the created Box metadata rather than the native Edit Box output, or used the creation field's label. The final run checked the actual edit Width, then the stored rectangle and volume.
- **NOT_RUN** Native Save/fresh Open, active Rotate or Scale, full suites and mobile. Desktop QA was 42/108 (39%). Whole CAD readiness remains **NOT_MEASURED**.

[Commands and receipt hashes](qualification.json).
