# D1143 — Share the zoomed Sketch arc path

2026-11-14 · SMALL · P0 desktop QA, rows 09, 20 and 21 · [#2473](https://github.com/barocss/barocss/issues/2473)

The active Sketch arc uses one projected path for outline, hover, selection and hit testing. In orthographic view, the segment count follows the projected radius and a 0.25 CSS px sagitta limit until the 512-segment budget. Endpoints and edge indices stay authored. The perspective path uses fixed sampling shared by the same consumers. Existing Model callers retain the default sampling and pick priority.

| Result | Check |
| --- | --- |
| FAIL | The parent displayed 16 segments at both zoom levels and highlighted 32. The maximum sampled outline errors were 0.668 and 3.229 CSS px. |
| PASS | Desktop Ortho measured the 10 mm radius at 138.889 and 670.936 CSS px. Outline and hover had identical samples at each zoom, using 27 and 58 segments. Independent semicircle evaluation gave maximum errors 0.235 and 0.246 CSS px. The real click used the same edge and did not change the document. |
| PASS | Desktop nearest-curve controls and D718 arc Radius/Diameter, clockwise and counterclockwise, small and large arcs, and native replay passed. D718 required the actual discard prompt after reopening with an unfinished input. |
| PASS | Two focused Model tests, 24 Studio tests, both type checks, production build, scoped lint, syntax and diff checks. |
| NOT_RUN | Dimension editor placement, committed Band and cylinder, Bézier, orthographic limits above the segment budget, full suites and mobile. |

Keep [#2473](https://github.com/barocss/barocss/issues/2473) open. Desktop QA is **24/54**. Initial scenarios are **8/10**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
