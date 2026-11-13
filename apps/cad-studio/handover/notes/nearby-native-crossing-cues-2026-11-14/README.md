# D1121 — verify nearby native crossing cues and placement

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2457](https://github.com/barocss/barocss/issues/2457)

The desktop fixture has a 0.5 mm gap between two native straight-edge crossings of an oblique plane. This decision checks the displayed candidate and the actual Rectangle coordinate.

| Result | Check |
| --- | --- |
| PASS | At DPR 1 and 2 the two crossings were 6.9444 CSS px apart. Both were inside the 8 CSS px aperture for each of the two clicks. The closer point was 2.2917 CSS px away and the farther point was 4.6528 CSS px away. The marker was within 0.02 CSS px of the expected point. Finish stored (4.2346, 3.4321) or (4.7346, 3.4321) mm as shown. |
| PASS | The pointer at the projected midpoint selected one candidate. Finish used the candidate shown before click. Original features and outputs stayed exact in the two nearest-point cases. Undo and Redo retained the expected documents. Root reviewed the cue. |
| PASS | Studio 9/9 and Model 22/22 focused tests, both type checks, production build, scoped lint, driver syntax and diff check. |
| FAIL | No failure in the tested cases. |
| NOT_RUN | An exactly equal browser pointer distance after event quantization, coincident projection, a downstream Hole and full suites. The focused nearest-snap test covers an exact mathematical tie. |

#2457 remains open. Desktop QA is 19/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
