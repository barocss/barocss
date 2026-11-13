# D944 — verify Detail diameter attachment across drawing units

2026-11-13 · P2 rows 11 and 16 · SMALL evidence supplement · [#2322](https://github.com/barocss/barocss/issues/2322)

- **PASS** Studio switched the D938 clipped Detail from mm to inch and then dual units. The saved source, nodes, label placement and tolerance remained equal. The ordinary Top diameter and radius controls retained 8 mm and 4 mm. First Undo/Redo and native Save/fresh Open retained the exact unit settings and source document.
- **PASS** Four actual SVG/DXF pairs retained the clipped tip at (307.5,94.6825) paper mm, the 8 mm true measurement and the 40 mm DXF definition diameter at 5:1. The SVG displayed Ø8 THRU, Ø.315 THRU and the dual-unit equivalent at the same tip. The reopened dual files matched the earlier bytes.
- **FAIL** The first observer assumed a different dimension order. The second used serialized property order as a wait condition. Structural comparison of accepted settings and exact saved history corrected the observer. The fixture has intentional annotation crowding at its selected label locations.
- **PASS** Driver syntax and diff check. This evidence supplement changes only the browser driver and retains the D940 product checks.
- **NOT_RUN** Crop center/radius changes, remaining alternate-arc and no-anchor matrix, production build, full suites, PDF and mobile. #2322 stays open. B06 remains 6/7 with PDF held.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
