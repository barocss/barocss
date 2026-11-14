# D1167 — Keep Sweep inputs in either selection order

2026-11-14 · FEATURE · P0 desktop QA, rows 07 and 21 · [#2462](https://github.com/barocss/barocss/issues/2462)

Keep one finished sketch and one visible direct curve selected together. Sweep names both its profile and its copied path in the command panel. A missing, hidden or duplicate object ID cannot supply the path.

| Result | Check |
| --- | --- |
| FAIL | The parent cleared Sketch 1 when Rail A was picked second and cleared Rail A when Sketch 1 was picked second. An intermediate Studio type check rejected the region selection guard and passed after its field access was corrected. |
| PASS | In desktop Studio, both Browser orders retained Sketch 1 (Ø6) and Rail A while an unused Ø12 sketch and another rail were present. The panel showed both inputs. Apply produced the same document in both orders and copied the rail endpoints (0,0,0) and (0,0,32) mm. |
| PASS | The saved result has one valid faceted native body. Both end rings have 32 vertices and 3 mm radial distance within 1e−7 mm. Undo, Redo, Save and fresh Open replayed the same result. |
| PASS | D1166 desktop regression, 67 focused Model tests, 4 focused Studio tests, both type checks, scoped lint, driver syntax, diff check and production build. The Model test refuses duplicate path-object IDs. |
| NOT_RUN | Changing inputs during preview, replacement or inspection through Sweep History, recovery from duplicate IDs during Open, full suites and mobile. |

Keep #2462 open. D1168 checks replacing one active input during preview while preserving the other. Desktop QA is **27/54 (50%)** and initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
