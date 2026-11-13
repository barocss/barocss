# D1120 — verify a sub-millimetre Circle radius from an End snap

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2457](https://github.com/barocss/barocss/issues/2457)

This decision verifies the existing fractional Circle input below the old 1 mm pointer radius floor. The geometry uses a construction line with length 1.5 mm on the tilted sketch plane.

| Result | Check |
| --- | --- |
| FAIL | The first driver aimed at an endpoint projection covered by a diameter chip. The passing driver clicks two CSS pixels beside the opposite End and verifies that the click hits the canvas. |
| PASS | Desktop Studio at DPR 1 and 2 showed Middle and End and accepted diameter 1.5 mm. It stored centre (12.95, 17.1) mm and radius 0.75 mm. The two construction endpoints lie on the saved circle. Root reviewed the preview. |
| PASS | Undo, Redo, project Save and fresh Open kept the exact document. A separate 2 mm New Extrude produced a valid solid of 3.534291735288503 mm³ within 1e-9 mm³ of the independent calculation. |
| PASS | Studio 9/9 and Model 22/22 focused tests, both type checks, production build, scoped lint, driver syntax and diff check. |
| NOT_RUN | Smaller modelling limits, a downstream Hole and full suites. |

#2457 remains open. Desktop QA is 19/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
