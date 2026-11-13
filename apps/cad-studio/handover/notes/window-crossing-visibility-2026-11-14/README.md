# D1049 — requalify crossing and window visibility

2026-11-14 · SMALL · P0 rows 20 and 21 · [#2454](https://github.com/barocss/barocss/issues/2454)

Reuse the D719, D714 and D713 desktop drivers on D1048. The crossing and window defects did not recur. This decision records current evidence without a product patch.

- **PASS** Orthographic right-to-left drag selects plate `b1` when the box crosses its silhouette or lies within its face. Both rectangles contain zero projected vertices from the 24-vertex, 12-triangle display mesh. The hole and partial left-to-right controls remain empty. A full left-to-right window selects the plate.
- **PASS** Both window directions exclude a hidden body in Model. The Print preview excludes it too. A previously explicit Browser selection remains additive. The current body order is used after Open. The perspective camera depth controls pass.
- **PASS** Actual WebGPU Studio, 56 snapshots across three runs and 856 frozen files per run. Visual review confirms the selected plate and the hidden body's exclusion. Native state and history are unchanged by the drags. Six focused checks and diff check pass.
- **FAIL** None in the current scope.
- **NOT_RUN** The reported right-click action target, arbitrary occlusion or perspective crossings without vertices, placed instances, full suites, production build and mobile.

The crossing/window criteria of #2454 pass in this scope. Check its context-action report before closure. Desktop QA remains 15/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
