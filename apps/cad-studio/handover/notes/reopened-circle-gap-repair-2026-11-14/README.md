# D1137 — Preserve reopened circle-gap endpoints when closing the profile

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2489](https://github.com/barocss/barocss/issues/2489)

The Line tool retains the coordinates of a winning End snap from a visible ordinary two-point open arc. This preserves both ends when the chord precedes the arc in a reopened sketch. Other snap paths keep their existing behavior.

| Result | Check |
| --- | --- |
| FAIL | The parent reopened-circle repair wrote four-decimal endpoints. Its valid native volume was 627.264590697 mm³, with a 0.004225748 mm³ error against the independent circular-segment calculation and a 0.002 mm³ limit. |
| PASS | Studio reopened the tagged R10 Circle, cut a 4 mm gap, and replayed the open arc. The chord used the two retained endpoints. Finish replaced only the original sketch and retained the Extrude ID and reference. The native result was valid at 627.260170458 mm³, with a 0.000194491 mm³ error. |
| PASS | Document Undo returned the full circle. Redo, native project Save and fresh Open retained the repaired arc and line, and independent native evaluation matched. The reopened no-op and new-sketch gap/repair controls passed. D1136 records the current chord-candidate draft Undo/Redo. |
| PASS | Sol High independently derived the endpoint-rounding error. Studio 21/21 focused tests, Studio type check, build, lint, driver syntax and diff passed. |
| NOT_RUN | Reverse Line click order, bound or attached ordinary circles, general authored-side rematching across the closed repair, full suites and mobile. |

The declared ordinary Circle and chord-candidate flows of #2489 pass. Desktop QA becomes **23/54** on closeout. Initial scenarios are **8/10**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
