# D1125 — refuse the silent XY fallback from a selected placed part

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2458](https://github.com/barocss/barocss/issues/2458)

A placed part selected in the assembly Browser or viewport does not provide a root Sketch face. With a placed selection and no root face, Sketch reports the limit. The user can enter Edit part for its face or clear the selection for a root XY sketch.

| Result | Check |
| --- | --- |
| FAIL | In the parent desktop Studio, clicking the placed top face in Top, Ortho and Faces selected Left box. Sketch then opened silently at XY Z0. |
| PASS | The same click now retains the placed selection and shows the limit. The document stays exact. Clicking the original root face opens a sketch at Z6. Clearing selection opens the explicit XY sketch at Z0. Root reviewed the refusal and retained placement. |
| PASS | The placed quarter-turn snap and active tilted normal view desktop controls passed. Studio 11/11 and Model 22/22 focused tests, both type checks, production build, scoped lint, driver syntax and diff check passed. |
| NOT_RUN | Direct root sketch attachment to a placed face, arbitrary rotated face start, mixed-body and collinear diagnostics, and full suites. |

#2458 remains open. Desktop QA is 20/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
