# D1060 — record numeric Circle draft edits

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2455](https://github.com/barocss/barocss/issues/2455)

Record a changed Circle centre or radius when the Sketch panel sends the edit. Use the same draft history as Rectangle. Pointer construction continues through its existing route.

- **FAIL** The parent leaves Sketch Undo disabled after changing Diameter 16→15 mm. Cmd+Z outside the input leaves the diameter at 15 mm.
- **PASS** Actual desktop WebGPU restores 16 mm through Cmd+Z and the toolbar, and restores 15 mm through Redo. The document stays unchanged while editing. Finish writes centre [0, 0] and radius 7.5 mm. Document Undo and Redo restore the exact states. The Rectangle regression passes.
- **PASS** Visual review, six focused Studio tests, Studio type-check, driver syntax and diff checks.
- **NOT_RUN** Centre-field Studio replay, two-point Circle creation, Sketch tool conversion, full suites, production build and mobile.

#2455 remains open. Desktop QA is 18/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
