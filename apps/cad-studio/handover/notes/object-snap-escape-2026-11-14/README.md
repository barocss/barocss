# D1112 — close Object snaps without discarding the sketch

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2457](https://github.com/barocss/barocss/issues/2457)

Escape with focus inside Object snaps closes the disclosure and focuses its summary. Escape stays local while focus remains in the control, including key repeat. The ordinary Sketch cancel command remains available from outside the disclosure.

| Result | Check |
| --- | --- |
| FAIL | Parent desktop Studio closed Sketch and discarded an in-progress Circle when Escape came from the focused Centre toggle. The first regression run used Escape from the settings focus to cancel the sketch. The test now leaves that control first. |
| PASS | Desktop Studio preserved the draft centre (8, 8) mm and preview diameter 6 mm after Escape from the toggle. Enter reopened the disclosure. Escape from the summary and its repeat closed the disclosure and preserved the draft. The next canvas click set radius 4 mm, and Finish and Undo/Redo preserved the expected documents. Root reviewed the focus and retained draft screenshot. |
| PASS | Desktop Object snaps regression, Studio 9/9 and Model 22/22 focused tests, both type checks, production build, scoped lint, browser-driver syntax and diff check. |
| NOT_RUN | Stationary snap re-enable, Hide body during a Circle draft, other window sizes and full suites. |

#2457 remains open. Desktop QA is 19/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
