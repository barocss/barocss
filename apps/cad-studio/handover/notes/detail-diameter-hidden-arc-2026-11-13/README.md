# D939 — verify hidden-only Detail diameter restoration

2026-11-13 · P2 rows 11 and 16 · SMALL evidence supplement · [#2322](https://github.com/barocss/barocss/issues/2322)

The D938 starter plate gains a separate 10 × 12 × 2 mm cover from Z=10 to 12 mm. It obscures the surviving arc of the true Ø8 Top bore. Its straight edge still draws inside the 2 mm Detail crop when Hidden lines is off.

- **PASS** Open with Hidden lines off reports `DIMENSION_LOST` with the specific no-drawable-arc reason. The saved reference is retained. The actual SVG and DXF omit the dimension. The detail and its visible cover edge remain.
- **PASS** Turning Hidden lines on restores the saved Ø8 dimension with the original 0.15 mm tolerance. The only document difference is the display flag. First Undo restores the refusal and first Redo restores the same dimension. Native Save and fresh Open preserve the on-state.
- **PASS** An independent reader verifies the dashed bore arc and actual SVG and DXF leader definition at (307.5, 94.6825) paper mm. The restored and reopened exports match byte for byte. DXF has measurement 8 mm and 40 mm between definition points at 5:1.
- **PASS** Driver syntax and diff check. This evidence supplement changes the browser driver only. It reuses the unchanged D938 product source and its 142 Model and four Studio focused passes.
- **NOT_RUN** Direct creation and cancellation, crop scale changes, the remaining negative matrix, production build, full suites, PDF and mobile. #2322 stays open. B06 remains 6/7 with PDF held.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
