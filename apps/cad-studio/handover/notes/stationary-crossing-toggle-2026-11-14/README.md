# D1113 — refresh the Crossing cue under a stationary pointer

2026-11-14 · FEATURE · P0 desktop QA, rows 09 and 21 · [#2457](https://github.com/barocss/barocss/issues/2457)

A keyboard change to Edge crossing refreshes the current sketch cue at the last eligible pointer position on the canvas. The active Rectangle preview follows the same coordinate. Pointer leave, an active drag, dedicated snap modes and stale sources retain their existing boundaries.

| Result | Check |
| --- | --- |
| FAIL | The parent cleared the Crossing cue when the keyboard disabled it and did not restore the cue when the same key re-enabled it. Earlier driver iterations used a degenerate preview, a point beyond the source edge or a non-rounded expected display number. |
| PASS | Desktop Studio restored Crossing before the next pointer event on an offset tilted plane. The accepted document, feature history, selection and dirty state were unchanged by the toggle. During placement, the displayed width changed from 8 to 8.46 mm with the pointer fixed. Finish used corner (14.54, 8.3071) mm. Undo and Redo restored the exact documents. Root reviewed the stationary cue screenshot. |
| PASS | The existing Object snaps workflow and Escape control, Studio 9/9 and Model 22/22 focused tests, both type checks, production build, scoped lint, browser-driver syntax and diff check. |
| NOT_RUN | Stationary refresh for toggles of other snap kinds, other DPI values, placed sources, Circle draft preservation during Hide body and full suites. |

#2457 remains open. Desktop QA is 19/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
