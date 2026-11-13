# D1124 — restore the normal view of an active sketch

2026-11-14 · FEATURE · P0 desktop QA, rows 09 and 21 · [#2458](https://github.com/barocss/barocss/issues/2458)

The view controls offer **Normal to sketch** while a 2D sketch is active. The action uses the viewport's current sketch plane and camera orientation method. It keeps zoom and camera target and does not edit the sketch.

| Result | Check |
| --- | --- |
| FAIL | The parent had no normal-view action for an orbited sketch. Early driver iterations used a locator for the wrong History control, a closed browser page and creation fields during history editing. |
| PASS | Desktop Studio at DPR 1 and 2 restored the 6 × 4 mm draft on a plane with normal (0, 0.6, 0.8). In the sampled run, the projected axis length ratio moved from 1.173059 to 1.000000011 and the axis cosine from 0.121904 to 0. The draft coordinates and accepted document stayed exact. |
| PASS | Save and fresh Open preserved the tilted sketch. Editing it from History and using the action again preserved all four edge lengths. The action was absent outside Sketch. Root reviewed the restored view. |
| PASS | Studio 50/50 and Model 22/22 focused tests, both type checks, production build, scoped lint, driver syntax and diff check. |
| NOT_RUN | Other plane families, placed-face start, refusal diagnostics and full suites. |

#2458 remains open. Desktop QA is 20/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
