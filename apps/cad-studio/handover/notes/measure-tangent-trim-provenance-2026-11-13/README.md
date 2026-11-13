# D1039 — label shortest distances across hidden curved trims

2026-11-13 · SMALL · P0 rows 11 and 20 · [#2450](https://github.com/barocss/barocss/issues/2450)

Mark planar display faces with non-linear B-rep boundaries before the viewport removes tangent edges. Measure uses the flag to label the mesh shortest distance. Internal edges of a merged face do not set the flag.

- **FAIL** Baseline desktop Studio showed `5.11 mm` with no approximation label. Strict native validation passed for both filleted solids. Each measured cap has two quadratic trim arcs and zero adjacent display edges.
- **PASS** Desktop Studio shows `5.11 mm (mesh approximation)` in the inspector and `≈5.11 mm` on the model. The parallel plane normal distance is 5 mm. With a 9 mm center separation, R5 and R3 native trims, and a 5 mm axial gap, the analytic shortest distance is √26 ≈ 5.0990195136 mm. The quality 4, 8 and 16 mesh results are 5.1218106567, 5.1067140445 and 5.0990195136 mm. The fix does not change those mesh results.
- **PASS** Actual cylinder and straight-edged placed face controls, visual review, 59 Model and 5 Studio focused tests, both type checks, driver syntax and diff checks.
- **NOT_RUN** Placed context-menu Measure, WebGL2, production build, full suites and mobile.

#2450 stays open for the placed face context path. Desktop QA is 11/54, initial scenarios are 8/10, and whole CAD and core readiness are **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
