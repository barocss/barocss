# D873 — Measure click Trim and its draft history boundary

P1, rows 09 and 16. SMALL baseline for [#2328](https://github.com/barocss/barocss/issues/2328). The existing click Trim operates on a 40 × 20 mm native rectangle with two vertical construction lines at X10 and X30. The fixture has a 2 mm Extrude. The driver reads the projected Trim intervals and the current accepted solid.

| Result | Check |
| --- | --- |
| PASS | Actual Studio previews the bottom interval from (10, 0) to (30, 0) mm. One click removes that interval. The remaining bottom intervals are X0–10 and X30–40. Both construction lines keep their lower and upper sections. Projected endpoints agree within 0.02 CSS px. |
| FAIL | The first sketch Undo leaves the gap. Redo has no local step to replay. The accepted document, selection, History controls and clean state stay exact. The accepted native body stays current at 1,600 mm³, as expected from 40 × 20 × 2. |
| PASS | Finish reports the open chain from (30, 0) to (10, 0) mm and keeps the draft and accepted source. Escape and Edit sketch restore the original profile and its exact Trim interval. |
| PASS | The final desktop runner recorded six states and 357 frozen inputs through cleanup. Studio focused checks pass 33/33, with Model type check, driver syntax and diff check. |
| FAIL | The first driver used a visibility test on an SVG line with zero bounding height. The second expected a toast for an inline Finish refusal. The final driver checks the SVG points and inline alert directly. |
| NOT_RUN | The history repair, a drag gesture, production build, mobile and full suites. |

`trimSketch` writes a new `done` array and clears the active shape. The current `SketchHistory` only records before/after pairs of settled active shapes. The sketch Undo path consumes the key without a cut step. D874 will record the whole click Trim draft edit before expanding to multi-cut. The current hidden-construction boundary policy remains the source contract for this repair.

Initial scenarios remain **8/10**. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
