# D1181 — Edit signed Hole row spacing in History

2026-11-14 · FEATURE · P0 desktop QA, rows 07 and 21 · [#2490](https://github.com/barocss/barocss/issues/2490), checklist line 2436

History edits both stored row-step components with the same face axes as the creation command. Changed row spacing, bore diameter or copy count for a multi-hole row uses the same minimum separation rule as creation. The existing numeric storage is retained.

| Result | Check |
| --- | --- |
| FAIL | Parent desktop Studio created the row, but History had no Step X or Step Y inputs. The first fixed driver reused the locator from its closed browser context after fresh Open. The final driver locates the reopened fields in the new context. |
| PASS | A real top-face pick on a 40 × 40 × 12 mm box created three Ø4 through bores at (8,12), (16,13) and (24,14). History showed step (8,1). Changing to (3,0) was refused with the accepted part intact. Changing to (11,−2) kept the first bore and placed the others at (19,10) and (30,8). |
| PASS | Native B-rep comparison checked all bore centres and radii to 1e−7 mm. Both strict-valid outputs matched the independent 19200 − 144π mm³ formula with measured volume 18747.61065788305 mm³. Independent volume-weighted centroids matched within 1e−7 mm. Undo, Redo and fresh Open retained exact documents and the signed spacing fields. |
| PASS | D1180 desktop regression, 18 focused Model tests, both type checks, scoped lint, syntax, diff check and production build. |
| NOT_RUN | Circular hole layout, changing a thread designation, pattern parameter bindings, full suites and mobile. |

Desktop QA is **29/54 (54%)** and initial scenarios **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. D1182 checks the circular Hole pattern centre under the still-open [#2490](https://github.com/barocss/barocss/issues/2490). [Commands and hashes](qualification.json).
