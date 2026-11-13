# D1123 — verify overlapping snap markers and curved-edge exclusion

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2457](https://github.com/barocss/barocss/issues/2457)

The original acceptance from [D1119](../desktop-snap-acceptance-audit-2026-11-14/README.md) is complete for the declared desktop scope. D1120 qualifies the smaller radius and D1122 qualifies the Hole consumer. This decision verifies overlapping markers and the unsupported curved-edge case.

| Result | Check |
| --- | --- |
| PASS | Desktop Studio at DPR 1 and 2 showed one Crossing when two native straight intersections were 0.27778 CSS px apart. The shown candidate agreed with the stored corner. D1121's independent nearby nearest-point control passed again. |
| PASS | The valid cylinder has a native degree-two cap edge that crosses the tilted plane. The source yielded zero straight-edge Crossing candidates. Studio showed no cue at the analytic intersection and used grid coordinates (9, −9) mm. Undo retained the original source. |
| PASS | The acceptance records cover cue and stored-coordinate agreement, the dashed construction state, explicit unsupported tool and placed rotation limits, and draft retention across Escape and Hide/Show. |
| PASS | Studio 9/9 and Model 22/22 focused tests, both type checks, production build, scoped lint, driver syntax and diff check. |
| FAIL | No failure on the tested current source. |
| NOT_RUN | Exact mathematical equality at the browser event point, curved-edge crossing support and full suites. The focused candidate control covers the exact tie rule. |

#2457 meets its desktop acceptance criteria. Desktop QA is 20/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
