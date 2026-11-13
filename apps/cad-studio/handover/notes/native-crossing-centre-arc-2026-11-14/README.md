# D1109 — snap the Centre arc centre to a native edge crossing

2026-11-14 · FEATURE · P0 desktop QA, rows 09 and 21 · [#2457](https://github.com/barocss/barocss/issues/2457)

Centre arc accepts a certified native straight-edge Crossing for its first centre click. The cue clears immediately after that click. The radius and sweep keep their existing inputs. Switching tools clears an incomplete Centre arc.

| Result | Check |
| --- | --- |
| FAIL | Parent source showed no Crossing two CSS pixels from the projected native intersection. |
| PASS | In desktop Studio at DPR 1 and 2, the first click used Crossing, and switching to Line and back restored the first-click cue. A second native crossing gave no cue while setting the radius or sweep. |
| PASS | The saved open construction arc had a signed sweep of 1.6877130379 rad. Its chord and bulge independently recovered centre (4.2346001399, 3.4320997284) mm, within 3.06e-7 mm of the authored coordinate. The original prism and outputs were unchanged. Undo, Redo, project Save and fresh Open preserved the expected documents. Root reviewed the anchor and sweep screenshots. |
| PASS | The D1108 Line, Arc and Circle desktop control passed. Studio 9/9 and Model 22/22 focused tests, both type checks, Vite production build, viewport lint, browser-driver syntax and diff check passed. Sol High reviewed the source and the numerical oracle. |
| NOT_RUN | Fractional Circle radius from End, native crossings for the Centre arc radius or sweep, further source families and full suites. |

#2457 remains open. Desktop QA is 19/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
