# D940 — pick the displayed source arc when creating a Detail diameter

2026-11-13 · P2 rows 11 and 16 · SMALL drawing input repair · [#2322](https://github.com/barocss/barocss/issues/2322)

In the D938 partial Top detail, selecting the upper surviving bore arc picked the coincident hidden bottom edge. Placement preview was absent and clicking saved an unresolved dimension at Z=0. The exact visible source edge is on the top at Z=8.

- **PASS** The Detail Diameter tool picks an actual drawable piece under its current Hidden lines policy. Placement rechecks the chosen reference against the same resolver used by preview before committing. Ordinary Diameter and other drawing tools retain their existing pick paths.
- **PASS** The actual Studio tool selected `n1.top|n2.side0#2` with near point (32,16,8). Cancel left the original document intact. Repeated preview and commit had equal arrow geometry. First Undo and Redo restored the exact documents. The committed drawing displayed Ø8 THRU.
- **PASS** Independent actual A3 SVG/DXF checks placed the tip at (307.5,75.3175) paper mm, the other analytic endpoint of the same cropped source circle. DXF retained 8 mm measurement and a 40 mm definition diameter at 5:1. D938 drag/reopen and D939 hidden-source desktop regressions, Model 29/29, Studio 4/4, both type checks, syntax and diff checks pass.
- **FAIL** The initial desktop run timed out waiting for a preview. The parent reproduction then confirmed it was a product failure and recorded the saved hidden bottom reference.
- **NOT_RUN** Crop scale changes, full quadrant and negative matrix, production build, full suites, PDF and mobile. #2322 stays open for the remaining acceptance. B06 remains 6/7 with PDF held.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
