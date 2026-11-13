# D1111 — preserve fractional Slot width at an object snap

2026-11-14 · FEATURE · P0 desktop QA, rows 09 and 21 · [#2457](https://github.com/barocss/barocss/issues/2457)

Slot uses the exact perpendicular distance to a snap on its finite straight flank during preview and width placement. The centreline and points beyond either centre cannot show a flank snap. Candidate checks apply the kernel's minimum arc-start radius and straight length to the generated segments. The existing unsnapped width calculation remains in use.

| Result | Check |
| --- | --- |
| FAIL | The parent previewed width 23 mm while End marked a point on the intended 22.9384937745 mm outline. Two earlier driver trials had incorrect input and History locators. |
| PASS | In desktop Studio at DPR 1 and 2, width preview and acceptance showed 22.9385 mm. The two generated semicircles preserved the calculated radius of 11.4692468873 mm. The second-centre cue cleared at the phase change and did not return as a width snap. Undo, Redo, project Save and fresh Open preserved the expected documents. |
| PASS | A 2 mm New Extrude after reopening produced a valid solid with volume 1946.5129665820134 mm³. The independent area and depth calculation gave 1946.512966582013 mm³. The source prism stayed valid at 2800 mm³. Root reviewed the preview and extrusion screenshots. |
| PASS | Desktop Object snaps and Circle radius regressions. Studio 9/9 and Model 22/22 focused tests, both type checks, Vite production build, viewport lint, browser-driver syntax and diff check. Sol High checked the geometric calculation and the generated minimum-radius counterexample. |
| NOT_RUN | Desktop probes at the minimum radius and length, semicap snaps, and the full suites. |

#2457 remains open. Desktop QA is 19/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
