# D1115 — show the placed box snap rotation limit

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2457](https://github.com/barocss/barocss/issues/2457)

The existing Object snaps disclosure shows the placed box rotation limit when a current visible placed source uses an unsupported rotation. The note and the snap provider use the same exact Z quarter-turn check.

| Result | Check |
| --- | --- |
| FAIL | The parent offered no placed End or Middle at 89.999 degrees and gave no reason in Object snaps. |
| PASS | Desktop Studio showed the rotation limit at 89.999 degrees. The near-turn box remained valid at 1440 mm³ and its independent transformed endpoint was present. At 90 degrees, End and Middle returned and the note disappeared. The unrotated sibling supplied Middle in both cases. Cancel retained both source documents. Root reviewed the disclosure screenshot. |
| PASS | The existing quarter-turn desktop flow retained exact rectangle points, a 1923.75 mm³ extrusion, Undo/Redo and Save/fresh Open. Studio 11/11 and Model 22/22 focused tests, both type checks, production build, scoped lint, driver syntax and diff check passed. |
| NOT_RUN | General rotation snap support, multi-body and nested sources, wider tool support and full suites. |

#2457 remains open. Desktop QA is 19/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
