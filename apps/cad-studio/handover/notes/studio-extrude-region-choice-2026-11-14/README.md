# D1133 — Choose an individual sketch region in the Extrude HUD

2026-11-14 · FEATURE · P0 desktop QA, rows 09 and 21 · [#2459](https://github.com/barocss/barocss/issues/2459)

Extrude offers the full profile or one of its authored regions. The selected region controls the preview, distance handle and saved boundary. Changing regions retires the earlier preview and queued Apply. A source already used by a region extrusion requires an explicit choice on restart. Deleting the last region extrusion preserves its source sketch.

| Result | Check |
| --- | --- |
| PASS | Desktop Studio previewed three regions together, then previewed the isolated and shared-edge rectangles separately. Root reviewed both native-looking previews and handle positions. Apply at 2 mm made the shared-edge rectangle only. The strict native check found 240 mm³ and centroid (19, 12, 1) mm. Undo and Redo retained the document. |
| PASS | A fresh Extrude invocation on the same source started with Apply disabled until a region was chosen. Applying Region 3 yielded a second valid body. Both volumes were 240 mm³, with distinct native centers X19 and X33. |
| PASS | An unsupported imported profile produced a refusal before Apply and preserved the document. Full-sketch Extrude with holes and the explicit two-sketch refusal and recovery both passed on the final source. |
| PASS | Sol High reviewed source ownership and the queued Apply boundary. Studio 22/22 and Model 53/53 focused tests, both type checks, build, scoped Model lint, driver syntax and diff check passed. |
| FAIL | One command named focused Studio test filters that matched no file. The corrected command passed 22 tests. |
| NOT_RUN | Direct canvas region picks, a held Worker reply during a region change, multiple subregions selected together, holes or face attachment in an individual region, full suites and mobile. D1132 retains the earlier exact Save/Open proof. |

#2459 remains open for direct region selection. Desktop QA is **21/54**. Initial scenarios are **8/10**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
