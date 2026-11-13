# D1052 — pick the closest Sketch curve

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2460](https://github.com/barocss/barocss/issues/2460)

Use one projected distance for outline edges, attached circles and finished circles. Keep vertex priority, inclusive hit radii and the previous category order for exact curve ties. Hover and click share this function.

- **FAIL** In 1024 × 800 WebGPU Studio, the projected line and circle were 4.00002 CSS px apart. Hover and click chose edge 0 both at the circle rim and one CSS pixel toward the line.
- **PASS** The same five real pointer positions now give edge 0, edge 0, circle 0, circle 0 and vertex 0 for both hover and click. The accepted document is exact. Visual review confirms the circle highlight.
- **PASS** 33 focused Model tests, including finished circles, ties and the hit radius. Model and Studio type-checks, driver syntax and diff checks pass.
- **NOT_RUN** Rendered stroke gaps, close dimension editing, broader constraint mark coverage, WebGL2, full suites, production build and mobile.

#2460 stays open for the remaining visual and edit criteria. Desktop QA is 17/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. The Sketch scope is row 09. [Commands and hashes](qualification.json).
