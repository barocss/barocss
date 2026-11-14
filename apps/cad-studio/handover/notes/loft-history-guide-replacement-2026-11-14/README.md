# D1171 — Replace a copied Loft guide in History

2026-11-14 · FEATURE · P0 desktop QA, rows 07 and 21 · [#2463](https://github.com/barocss/barocss/issues/2463)

A parallel-section Loft with a copied polynomial NURBS guide can replace that guide with a compatible current Direct curve. Applying the draft uses the full authored document and native Loft validation. The replacement keeps the section list and the Loft feature ID. The first visible refusal identifies an endpoint or section vertex that the guide misses and gives a recovery action.

| Result | Check |
| --- | --- |
| FAIL | The parent History had no copied guide replacement. An early test expected a select option to have a visible DOM box, and the older D783 driver still searched for the reason inside Kernel detail. Both drivers were corrected. |
| PASS | Desktop Studio refused the candidate ending at Z19 when the top section required Z20. The first notice gave both heights, the failed feature and the option to choose another guide or reset. The accepted guide, shape and document stayed unchanged. |
| PASS | Replacing straight Rail A with bowed Rail B changed only the copied guide. Three 10 × 10 mm sections stayed at Z0, Z10 and Z20 in their saved order. The native solid stayed valid at 2000 mm³. Its seam midpoints shifted from X0 to X2 at Z5 and Z15, and centre of mass moved from (5,5,10) to (6,5,10) mm. The independent equal-area slice and triangular-offset calculation matched within 1e−7. Undo, Redo, Save and fresh Open replayed the guide. |
| PASS | D1170 Desktop Studio mode regression, D783 width/corner/refusal and project reopen regression, Sol High geometry review, 74 focused Model tests, 4 focused Studio tests, both type checks, scoped lint, driver syntax, diff check and production build. |
| NOT_RUN | Replacing a copied section reference, framed and single-span legacy guide replacement, wider families, full suites and mobile. |

Keep #2463 open. D1172 checks replacing a single copied section through History without rewriting the other sections or guide. Desktop QA is **28/54 (52%)** and initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
