# D1189 — Keep the selected opening on an imported box Shell

2026-11-14 · FULL · P0 desktop QA, rows 07, 13 and 21 · [#2467](https://github.com/barocss/barocss/issues/2467), checklist lines 877–884

An exact cardinal B-rep box with one named open face must keep a positive cavity. The thickness must be smaller than the distance to the opposite face and half of each transverse span. This limit uses the selected native body and face. The guard verifies both the six trimmed cardinal supports and their topology before reporting a thickness error. The minimum is exclusive. The general Shell algorithm stays in use for admitted values.

| Result | Check |
| --- | --- |
| FAIL | The first test used the hollow formula for the uncut stock. Its second run looked for a dedicated Shell History launcher. The corrected parent run committed Wall 5 mm in History, replaced the top's inner loop with a solid face, and restored stock volume from 468 to 500 mm³. |
| PASS | Current desktop Studio picked the original STEP top at (5, 5, 5). Creating at Wall 5 mm kept Apply disabled. The panel explained the thickness failure and identified `n0.a.top` with the exclusive 5 mm bound in Kernel detail. Creation at Wall 3 and History rejection at Wall 5 preserved the selected referent and the accepted open geometry. Root checked the creation screenshot. |
| PASS | The same History accepted Wall 4.999, kept the inner rim and the actual 0.002 × 0.002 mm aperture, and passed strict B-rep. Native volumes for Wall 3 and 4.999 were 468.00000000000006 and 499.999999996 mm³, matching the independent rectangular cavity calculation. Eight cavity corners and the inner loop detect collapse independently of mass. The sibling stayed at 144 mm³. Undo and Redo passed. |
| PASS | Sol High geometry audits, native positive side control at Wall 2.499, rejection at its 2.5 mm limit, and rejection of unsupported ownership in the helper when two native faces share a name. Parent reproduction detects removal of the guard. The near-boundary controls distinguish an overly conservative threshold. Kernel 10/10 and Model 12/12 focused tests, three type checks, scoped lint, syntax, diff, frozen-source checks and production build. |
| NOT_RUN | Fresh Open of a historically accepted closed-aperture file, further curved-face Shell diagnostics, multiple openings, rotated box profiles, Sew and external STEP verification, full suites, CI and mobile. |

Keep #2467 open for the curved Shell and Sew acceptance. Desktop QA is **29/54 (54%)** and initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
