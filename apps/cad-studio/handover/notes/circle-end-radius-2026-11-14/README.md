# D1110 — preserve fractional Circle radius at an object snap

2026-11-14 · FEATURE · P0 desktop QA, rows 09 and 21 · [#2457](https://github.com/barocss/barocss/issues/2457)

The Circle radius preview and click take the distance to the same eligible object snap. Candidate selection skips points that would give a degenerate or out-of-range authored circle. The ordinary grid fallback and Circle from Chord stay on their existing paths. The overlay and constraint list show the diameter to four decimal places.

| Result | Check |
| --- | --- |
| FAIL | The parent showed End at local (4.2346, 6.3457) mm and previewed a 16 mm diameter with Grid off. The first D872 rerun still expected a rounded diameter of 14 mm. The test now checks the independently calculated snapped diameter before disabling End. |
| PASS | Desktop Studio at DPR 1 and 2 showed diameter 15.2578 mm and stored radius 7.6288757789074015 mm. The Origin cue cleared after the centre click. Returning to the centre offered no radius snap. Undo, Redo, project Save and fresh Open preserved the expected documents. |
| PASS | A 2 mm New Extrude after reopening produced a valid cylinder with volume 365.67978674966923 mm³ versus the independent 365.6797867496691 mm³. The original 2800 mm³ prism remained valid. Root reviewed the preview and cylinder screenshots. |
| PASS | Desktop anchor and chord controls and the object snap settings control. Studio 9/9 and Model 22/22 focused tests, both type checks, Vite production build, scoped lint, browser-driver syntax and diff check. Sol High reviewed the source and numerical result. |
| NOT_RUN | Radius near the modelling limits, manual diameter edits under radius 0.25 mm, downstream Hole and full suites. Circle radius Crossing remains outside the supported phase. |

#2457 remains open. Desktop QA is 19/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
