# D1117 — verify a Circle through a tilted construction endpoint

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2457](https://github.com/barocss/barocss/issues/2457)

The current product source already places the Circle rim through an eligible construction endpoint. This decision adds the missing desktop consumer check from the tilted construction-line report.

| Result | Check |
| --- | --- |
| FAIL | The first driver left Construction active after drawing the line and tried to finish with only construction geometry. The passing driver explicitly turns Construction off before drawing the Circle. |
| PASS | Desktop Studio at DPR 1 and 2 drew the reference line on a plane with normal (0, 0.6, 0.8). Middle selected (17, 22.5) mm. End set the diameter to 15 mm with Grid off. Both saved construction endpoints lie at radius 7.5 mm. Root reviewed the End cue at the Circle rim. |
| PASS | Undo, Redo, project Save and fresh Open kept the exact document and the source prism. A 2 mm New Extrude of the reopened Circle had a valid solid and matched the independent volume of 353.4291735288517 mm³ to 1e-9 mm³. |
| PASS | Studio 9/9 and Model 22/22 focused tests, both type checks, production build, scoped lint, driver syntax and diff check. |
| NOT_RUN | A downstream Hole, other construction source types and full suites. |

#2457 remains open. Desktop QA is 19/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
