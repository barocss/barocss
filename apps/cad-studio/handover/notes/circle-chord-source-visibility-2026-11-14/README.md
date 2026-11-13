# D1114 — preserve a chord circle draft through source visibility changes

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2457](https://github.com/barocss/barocss/issues/2457)

When a Browser body visibility change commits, the current chord circle draft follows the new document snapshot. The sketch generation and owner still have to match. A hidden source stops supplying new snap candidates. An already confirmed point stays in the draft.

| Result | Check |
| --- | --- |
| FAIL | The parent discarded the active Circle from two points draft when Hide body changed the document after the first Centre pick. The ordinary Circle draft passed on the parent. The first driver trial used an invalid Browser row locator. |
| PASS | Desktop Studio kept the first pick (14.84, 12.3457) mm during Hide and Show. While hidden, that source supplied no Centre cue. The second pick and radius 5 mm finished the circle without repeating the first pick. The saved geometry's distance from centre to the first pick agreed with 5 mm within 1e-6 mm. Root reviewed the hidden source and retained pick. |
| PASS | The ordinary Circle retained its centre and finished at radius 7 mm. Undo and Redo worked for both workflows. The existing Circle from two points regression, including its document replacement case, and the stationary Crossing regression passed. |
| PASS | Studio 9/9 and Model 22/22 focused tests, both type checks, production build, scoped lint, browser-driver syntax and diff check. |
| NOT_RUN | Other visibility actions, other snap sources, toggling after the second pick and full suites. |

#2457 remains open. Desktop QA is 19/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
