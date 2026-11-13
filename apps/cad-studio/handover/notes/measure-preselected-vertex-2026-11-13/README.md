# D1015 — retain a preselected vertex when Measure starts

2026-11-13 · FEATURE · P0 rows 05, 15 and 16 · [#2446](https://github.com/barocss/barocss/issues/2446)

- **FAIL, baseline** A real viewport click selected the corner [0, 0, 10] mm. Shift+M opened an empty Measure panel.
- **PASS, fixed** Measure now uses the selected vertex when no face or edge is selected. The desktop WebGPU Studio panel displays the original corner as From and the opposite corner [30, 40, 10] mm as To. The panel and viewport both display the independent 30–40–50 diagonal of 50 mm. The document, bodies and history are unchanged.
- **PASS** Visual review, 12 focused Model tests, 10 focused Studio tests, both type-checks, driver syntax and diff check.
- **NOT_RUN** Multiple preselected vertices, clipped edges, Zebra seam, production build, full suites and mobile.

The existing face and edge priority is preserved. Desktop QA remains 7/54. Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
