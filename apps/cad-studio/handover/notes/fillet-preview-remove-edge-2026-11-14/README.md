# D1185 — Remove a picked edge while Fillet is in preview

2026-11-14 · FEATURE · P0 desktop QA, rows 07 and 21 · [#2466](https://github.com/barocss/barocss/issues/2466), checklist lines 3347–3361

Open **Edit picked edges** in the Edge Fillet panel to remove an original selection. The list uses source edge names. It remains available when the result has consumed the sharp edge, so there is no need to pick an edge of the preview or clear the radius. Removing a row retires the current preview and queued Apply. Native tangent propagation still determines the result from the remaining picks.

| Result | Check |
| --- | --- |
| FAIL | Parent Studio made the two-rim preview after the bottom Shift-click. It had no control for removing the original edge from the preview. Whole-`App.tsx` lint also fails on the existing unused `_k` binding. The same failure was reproduced on the parent. |
| PASS | Desktop Studio picked the four top edges and added one bottom source edge with Shift-click. The R1 preview showed five picked native edges plus three tangent additions. Enter on the bottom row's Remove button kept the document unmodified and recalculated the preview as four top edges with no additions. Root checked the preview screenshot. |
| PASS | Apply and fresh Open yielded one strict-valid solid with four R1 top patches, all four original bottom edge names, and volume 1247.9164744094264 mm³ against 1247.9164744094167 mm³ from the analytic sweep. Undo and Redo restored the original and accepted documents. |
| PASS | D1183 desktop single-edge and chain regression, 19 focused Studio tests, Studio type check, lint for the changed UI components, browser-script syntax, frozen-source checks and production build. |
| NOT_RUN | Direct pointer removal on generated preview edges, limiting propagation inside one chain, variable-radius and narrow desktop cases, full suites, CI and mobile. |

Keep #2466 open. Desktop QA is **29/54 (54%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
