# D1178 — Select and use a Hole preset with the keyboard

2026-11-14 · SMALL · P0 desktop QA, rows 07 and 21 · [#2465](https://github.com/barocss/barocss/issues/2465), checklist line 1293

The focused preset list uses the unmodified Up and Down keys to step through its existing options. The browser still owns its native select actions and modified shortcuts. Use preset updates the Hole inputs and preview. Apply commits the feature.

| Result | Check |
| --- | --- |
| FAIL | Parent desktop Chrome left the second preset selected after ArrowUp. A separate replay with Enter following ArrowUp also kept the second preset. |
| PASS | In actual desktop Studio, ArrowUp, ArrowDown and ArrowUp selected the expected saved options. Tab reached Use preset. Enter restored Ø6 and depth 5 while retaining the right face, centre Y25/Z6, accepted document, selection and Undo/Redo state. After explicitly focusing Apply, Enter created the blind hole. Undo and Redo restored each exact state. |
| PASS | The valid native result retained `n1.side1`, radius 3 mm, the expected axis and centre, and the blind floor at X85. Volume was 14258.628330588454 mm³. The independent cuboid-minus-cylinder result is 14400 − 45π mm³. |
| PASS | D826 desktop preset and persistence regression, three Studio preset tests, Studio type check, targeted lint, syntax and diff check. |
| NOT_RUN | Other browsers, mobile, full suite and new catalog-tapped creation. |

D1173–D1178 cover the reproduced Offset History failures, signed Draft and neutral position, legacy Hole placement and designation, angled Split and keyboard preset selection. [#2465](https://github.com/barocss/barocss/issues/2465) stays open because the existing thread designation was only reviewed and retained. Its editable catalog-backed scope still needs eligible person-loaded rows. Desktop QA is **29/54 (54%)** and initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. D1179 starts the independent Hole location reproduction in #2490. [Commands and hashes](qualification.json).
