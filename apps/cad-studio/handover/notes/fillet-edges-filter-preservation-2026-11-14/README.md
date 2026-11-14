# D1188 — Keep active Fillet selection in Edges mode

2026-11-14 · FEATURE · P0 desktop QA, rows 07 and 21 · [#2466](https://github.com/barocss/barocss/issues/2466), checklist lines 3344 and 3362

An active Edge Fillet respects the Edges filter. A face miss cannot replace the authored edge list, and the rejected pick cancels any queued Apply through the existing transition. Face selection through the normal unfiltered path remains available. Removing an authored edge from a tangent chain continues to report it as an automatic addition when the native finish uses it.

| Result | Check |
| --- | --- |
| FAIL | Parent desktop Studio replaced five edges with face 0 on a Shift-click at (10, −4, 1) during a two-rim preview. Whole-App lint reported the preexisting unused `_k` binding. Parent and current diagnostics were byte-identical. |
| PASS | Current desktop Studio preserved the same five picked edges and three tangent additions after the face miss. Removing the original lower seed kept only the top rim. Removing one top pick reported three authored edges and the exact removed name as one automatic addition with R1. Root checked the screenshot. |
| PASS | Apply, Undo, Redo and fresh Open kept the correct lifecycle. The final document stores three original picks. Strict native geometry has four top blend patches, the unchanged bottom edge names, and volume 1247.9164744094264 mm³, within 1e−7 mm³ of the analytic sweep. |
| PASS | 19 focused Studio tests, Studio type check, D1187 varying desktop regression, syntax, diff, frozen-source verification and production build. |
| NOT_RUN | Narrow desktop, noncircular sections, suppression of kernel propagation and variable-radius removal during the preview. Full suites, CI and mobile. |

The main Fillet repros now have bounded evidence in D1183–D1188. #2466 remains open for the outstanding variants. Desktop QA is **29/54 (54%)** and initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. Proceed to the imported Shell opening defect. [Commands and hashes](qualification.json).
