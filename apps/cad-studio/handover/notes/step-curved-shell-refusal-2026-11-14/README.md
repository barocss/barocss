# D1190 — Show the unsupported boundary in a Shell refusal

2026-11-14 · FEATURE · P0 desktop QA, rows 07, 13 and 21 · [#2467](https://github.com/barocss/barocss/issues/2467), checklist line 881

A sharp junction between smooth regions has its own Shell message. When the native refusal provides a location, Studio shows it in millimetres with Kernel detail collapsed. A separate closed-wall failure uses Shell guidance even if its detail includes an internal Boolean. The native errors, numerical behavior and original request remain intact.

| Result | Check |
| --- | --- |
| FAIL | Parent desktop Studio returned a generic kernel error on the historical STEP lid at Wall 1 and 3 mm. The actual junction was only in the collapsed detail. |
| PASS | Current desktop Studio picked the flat bottom at (45, 5, 0) and refused both sizes. The main panel identified the sharp junction near (45, 0, 11.5) mm. Apply stayed disabled. Cancel retained the exact document and native geometry. Root inspected the 3 mm refusal screenshot. |
| PASS | The original exact fixture retained one strict-valid solid and volume 1199.9999999999995 mm³. D1189 desktop box regression preserved the 4.999 mm opening and refused 5 mm. |
| PASS | 13 focused Model tests, including typed Shell message priority against the nested Boolean, absent-location handling and unchanged real Boolean wording. Model and Studio types, scoped lint, syntax, diff, frozen-source checks and production build passed. |
| NOT_RUN | A product flow for a separate historical wall-union failure, curved Shell support expansion, viewport boundary highlighting, Sew, full suites, CI and mobile. |

Keep #2467 open for Sew tolerance and STEP exchange. Desktop QA is **29/54 (54%)** and initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
