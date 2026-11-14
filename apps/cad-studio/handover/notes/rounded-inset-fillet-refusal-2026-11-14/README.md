# D1186 — Explain the linked inset Fillet restriction

2026-11-14 · FEATURE · P0 desktop QA, rows 07 and 21 · [#2466](https://github.com/barocss/barocss/issues/2466), checklist lines 3519–3524

The saved rounded inset supports one direct Extrude. For this exact reference refusal, the preview explains how to keep the link or use the existing **Detach inset** action in Extrude History. The message states that detaching removes the source link. The more specific retired-edge refusal and the file and geometry admission rules retain their existing behavior.

| Result | Check |
| --- | --- |
| FAIL | The first browser driver reversed the stock area calculation. With the corrected analytic expectation, parent Studio reproduced the generic undo/value message for both native picks, while the actual restriction was only in Kernel detail. |
| PASS | Current desktop Studio opened the QA file and directly picked the straight inner rim at (10, 1, 10) and its adjacent arc. The names matched e9 and e10. R0.1 Fillet showed the linked-inset limitation with collapsed Kernel detail. Apply stayed disabled, both Cancel actions preserved the accepted document, and the undirtied state stayed intact. Root inspected the arc refusal screenshot. |
| PASS | Explicit Detach inset in Extrude History kept the Extrude and side names. Strict B-rep confirmed one solid and 534.247779607693 mm³ before and after. The area difference gives the same volume within 1e−7 mm³. Undo restored the linked recipe and Redo restored the accepted detached sketch. |
| PASS | 21 focused Model tests, including preserved retired-edge reporting. Model and Studio type checks, scoped lint, browser-script syntax, production build and frozen-source verification passed. |
| NOT_RUN | Applying a further Fillet on the detached shape, expanded linked-recipe consumers, full suites, CI and mobile. |

Keep #2466 open. Desktop QA is **29/54 (54%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
