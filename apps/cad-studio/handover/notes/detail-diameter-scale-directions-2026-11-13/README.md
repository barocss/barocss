# D941 — verify Detail diameter attachment after scale and label changes

2026-11-13 · P2 rows 11 and 16 · SMALL evidence supplement · [#2322](https://github.com/barocss/barocss/issues/2322)

- **PASS** Studio changed the saved Detail B from 5:1 to 2:1. First Undo and Redo restored the exact documents. At 2:1 the initial right placement and three pointer drags exercised right, above, left and below the source circle. The diameter remained 8 mm and its saved source, tolerance and ordinary Top control were retained.
- **PASS** Four actual SVG reads used the current saved label locations and the analytic surviving angular interval of the selected edge. At 2:1 the source radius is 8 paper mm and the crop radius is 4 paper mm. The right and above positions produced (310,85) paper mm. The left and below positions produced (309,88.873). The source-arc and leader checks used 0.0001 paper mm.
- **FAIL** The first observer stopped on the above drag. Pixel conversion gave a 0.7143 model-mm difference from its nominal point at 2:1. The revised input bound is 1 model mm. The file-coordinate check still uses the actual saved placement and its original 0.0001 paper-mm bound.
- **PASS** Driver syntax and diff check. This evidence supplement changes the browser driver only and retains the D940 product checks.
- **NOT_RUN** New 2:1 DXF, crop center or radius edits, source deletion and the remaining negative matrix, production build, full suites, PDF and mobile. #2322 stays open for the remaining acceptance. B06 remains 6/7 with PDF held.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
