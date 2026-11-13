# D938 — attach a clipped Detail diameter to its source arc

2026-11-13 · P2 rows 11 and 16 · FEATURE drawing attachment repair · [#2322](https://github.com/barocss/barocss/issues/2322)

The 64 × 32 × 8 mm starter plate has a true Ø8 through hole. Detail B clips its Top projection with a 2 mm disk at the right rim. After dragging its label to the opposite side, the parent arrow tip was on the original circle but 39.99367 paper mm from the center of the 10 mm paper crop.

- **PASS** A cropped Detail diameter uses one leader on the nearest drawable arc of the resolved source edge. The original diameter, reference, tolerance and label placement are retained. Eligible arcs are transient and the leader is calculated from the current placement. Full-crop dimensions and radius dimensions use the existing path. A cropped referenced edge without drawable circular ink has a specific refusal reason.
- **PASS** Desktop Studio Open, drag preview and commit, first Undo/Redo, native Save and fresh Open. The unchanged Top diameter mark group stayed equal. The source diameter stayed 8 mm, and the SVG leader and DXF diameter definition used the same repaired tip. The actual post-drag and reopened exports match byte for byte.
- **PASS** Independent circle intersection and file reads found the repaired tip at (307.5, 94.6825) paper mm. It matches the analytic intersection within 0.0001 paper mm. DXF retained a 40 mm diameter between definition points at 5:1 and a measurement of 8 mm.
- **PASS** Model 142/142, Studio roundtrip 4/4, both type checks, driver syntax, diff check and independent Sol High source review.
- **FAIL** Three baseline observer attempts stopped before the exact reproduction. The driver corrected a frozen source declaration, the pixel-to-view tolerance, and explicit native drawing scope. The fourth baseline reproduced the product defect. The first type checks exposed a DXF union narrowing error, corrected before the final run. One browser retry timed out at navigation and passed with the 60-second navigation budget. The deliberate test placement still reports unrelated drawing diagnostics for missing and overlapping dimensions.
- **NOT_RUN** Hidden-only restoration, direct creation and cancellation, crop scale changes, full negative matrix, production build, full suites, PDF and mobile. Issue #2322 stays open for its remaining acceptance. B06 remains 6/7 with PDF held.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
