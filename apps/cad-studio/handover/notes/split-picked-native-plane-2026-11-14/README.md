# D1197 — Use a picked native plane for Split

2026-11-14 · FEATURE · P0 desktop QA, rows 07 and 21 · [#2469](https://github.com/barocss/barocss/issues/2469)

An original native planar face normal to X, Y or Z can supply the Split plane. The B-rep control points certify the exact constant coordinate of one unmerged support. Studio accepts a preselected face from the current model or a retained original reference face during the command. A pick keeps the Split target fixed, clears pending Apply and replaces the previous preview. The saved Split uses the picked coordinate as a numeric snapshot. The History editor can then change it.

| Result | Check |
| --- | --- |
| FAIL | On the parent, clicking the stock top Z=10 opened an X=30 Split with an enabled preview. |
| PASS | Studio opened a Z=10 plane named n1.top and refused the tangent cut. Apply stayed disabled and the accepted document was unchanged. |
| PASS | Clicking the separate n3.top face kept the original target and staged Z=4.000123456789 mm. Apply made strict-valid stock halves of 7,200.2222222202 and 10,799.7777777798 mm³. The reference remained 256.00790123449565 mm³. Both cap carriers and centroids matched the independent box calculation. |
| PASS | History retained the full coordinate. Editing it to Z=4.5 mm yielded 8,100 and 9,900 mm³. Undo reached the applied pick and then the two original bodies. Redo reproduced the applied pick. |
| PASS | Focused Model 19/19, both type checks, scoped lint, driver syntax, production build, diff and frozen-source checks. The reviewed final Studio run used the dedicated pick and Apply ownership paths. |
| NOT_RUN | Oblique, faceted and placed source faces, live reference after editing the source, single-side retention, a controlled worker-delay induced queued Apply, fresh Open, full suites, CI and mobile. |

Keep #2469 open. Desktop QA is **29/54 (54%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
