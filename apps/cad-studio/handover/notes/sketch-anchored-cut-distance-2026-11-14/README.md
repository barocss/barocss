# D1151 — Keep the Cut opening fixed while editing Distance

2026-11-14 · SMALL · P0 desktop QA, rows 07 and 21 · [#2464](https://github.com/barocss/barocss/issues/2464)

Recognize the saved zero-draft Cut graph when the positive cutter ends on its attached sketch and the immediately following Difference consumes it against that same body. History Distance now sets both the positive height and its negative Start Z. Reject nonpositive cut distances before apply. Manual Start Z can still detach this relation. An explicitly shifted, unattached or parameter-bound tool keeps its prior behavior. A single named parameter cannot directly bind this coupled pair. The evaluator, saved shape and Boolean tolerance are unchanged. Older files encode Distance and Through all identically, so this edit rule does not infer the old depth mode.

| Result | Check |
| --- | --- |
| FAIL | In the original desktop Studio flow, edit Distance 2→4 mm on a circular cut across two prior through bores. The cutter stored height 4 and Start Z −2. The upward-facing native pocket floor stayed at Z=8 mm and the solid stayed at 11614.583717802914 mm³. |
| PASS | History rejects −4 before Apply and Enter. At positive 4 it displays Start Z −4 and lowers the native floor to Z=6 mm. The valid single solid is 11480.494847893038 mm³. Difference references stay exact. Undo restores Z=8 and the original document. Redo, Save and fresh Open retain Z=6 and Start Z −4. |
| PASS | 15 Model tests and 1 Studio end-face pick test, both type checks, production build, scoped lint, syntax and diff. Studio also passes the D847 ordinary modes and D1021 independent shifted rectangular cutter controls. |
| NOT_RUN | Full suites, mobile, persistent Through all mode, other planes and tapered Cut. |

The independent volume oracle subtracts the two 2 mm-radius through bores and the pocket depth times the radius-5 disk area minus its two bore lenses. The resulting pocket cross-section is 67.04443495494066 mm². Native and Worker volumes agree within 1e-7 mm³. The regression starts from an exact saved tool and edits it through the real History panel. [Commands and hashes](qualification.json).

Keep #2464 open. Next D1152 verifies whether a Cut authored as Through all retains that intent when the stock grows. Desktop QA is **25/54 (46%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**.
