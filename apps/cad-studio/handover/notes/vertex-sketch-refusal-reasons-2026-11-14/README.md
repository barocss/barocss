# D1126 — distinguish mixed-body and collinear sketch picks

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2458](https://github.com/barocss/barocss/issues/2458)

Sketch reports different bodies when the three selected vertices span bodies. It reports collinear or too-close points when three distinct current native picks do not define a stable plane. The same native point and plane admission checks remain in use.

| Result | Check |
| --- | --- |
| FAIL | The parent used the generic vertex selection hint for the tested mixed-body pick. |
| PASS | Desktop Studio displayed distinct reasons for the mixed-body selection and the three collinear points. The selected points and accepted document stayed exact in both cases. Root reviewed the collinear selection and message. |
| PASS | The original native vertex flow passed with valid ordered picks, an independent extrusion, Undo/Redo and fresh Open. Studio 9/9 and Model 8/8 focused tests, both type checks, production build, scoped lint, driver syntax and diff check passed. |
| NOT_RUN | Exactly overlapping projections from Top and full suites. |

#2458 remains open. Desktop QA is 20/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
