# D1059 — record numeric Rectangle draft edits

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2455](https://github.com/barocss/barocss/issues/2455)

Record a changed, nondegenerate Rectangle from the Sketch panel as an outline history step. Use the existing draft history and keep the pointer preview outside this new recording path.

- **FAIL** The parent left Sketch Undo disabled after Width 16→20 mm. The first browser driver's Tab landed in another input, where native input Undo could change the displayed value without advancing the Sketch history. The passing driver focuses Finish before sending the shortcut. One later Chrome context creation stalled and was retried.
- **PASS** Actual desktop WebGPU creates a 16 × 10 mm Rectangle without an Undo step. Width 20 mm adds one step. Cmd+Z restores 16 and enables Redo. Toolbar Redo and Undo restore 20 and 16. Cmd+Shift+Z restores 20. The accepted document stays unchanged during draft actions. Finish writes [0, 0] to [20, 10] mm. Document Undo and Redo restore both exact states.
- **PASS** Visual review and D1056 Polygon/Trim replay. Six focused Studio tests, Studio type-check, driver syntax and diff checks.
- **NOT_RUN** Circle and Bézier numeric history, Rectangle history across tool conversion, other draft tools, full suites, production build and mobile.

#2455 remains open. Desktop QA is 18/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
