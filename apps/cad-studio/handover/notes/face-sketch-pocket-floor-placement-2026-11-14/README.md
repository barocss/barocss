# D1157 — Follow the native pocket floor after a Cut placement edit

2026-11-14 · FEATURE · P0 desktop QA, rows 07 and 21 · [#2464](https://github.com/barocss/barocss/issues/2464)

A new unshifted rectangular sketch on the individual +Z floor of a rectangular zero-draft pocket records the Difference output and exact native floor name. Model resolves the current floor from its source prefix. Sketch coordinates and the authored frame remain in the saved document. The native extruded result, sketch overlay, reopening and command placement use the current Z. Refuse a lost, split, ambiguous or laterally changed floor. Legacy unmarked files keep fixed coordinates.

| Result | Check |
| --- | --- |
| FAIL | In the original Studio, Start Z −2 to −4 mm moved primary floor `n3.bottom` from Z8 to Z6 while the child Cut stayed in the void. Native volume stayed equal to the primary Cut alone, 11424 mm³. |
| PASS | Actual desktop Studio picked the native Z8 floor and drew a 4 × 4 mm rectangle. A 1 mm Cut produced floor `n6.bottom` at Z7 and 11696 mm³. The same edit moved the source floor to Z6 and child floor to Z5. Native volume was 11408 mm³. The child removed 16 mm³ both times. The native rectangular trim and all downstream nodes stayed exact. |
| PASS | History rejected a lateral width edit without changing the model. Undo, Redo, Save, fresh Open and Edit sketch all passed. Edit sketch displayed Z6 with the same four 4 mm sides. Through all and linked face inset regressions passed. |
| PASS | Sol High source review, 56 Model and 3 Studio focused tests, both type checks, production build, scoped lint, driver syntax and diff check. Two intermediate type checks failed on local TypeScript narrowing before browser launch. Both passed after correction. |
| NOT_RUN | Full suites, mobile, large-model interaction timing, arbitrary face following, child profiles other than rectangles, and consumer paths outside the stated desktop flow. Copy and assembly flattening were checked in Model tests. |

Keep #2464 open. D1158 verifies additional work planes and Draft Cut acceptance. Desktop QA remains **25/54 (46%)**. Initial scenarios remain **8/10 (80%)**. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and hashes](qualification.json).
