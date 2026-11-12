# D870 — Replace the source face of a healthy linked inset

P1, rows 07, 09 and 16. FEATURE for an existing v1 recipe. In the linked extrusion's History editor, pick one current original native planar face of an earlier visible solid. **Replace inset source** checks the candidate in the worker and shows the resolved ring, plane, separate target and dependent Extrude volume. **Apply source** changes only the recipe's three source fields in one history edit. The sketch's explicit `on` target, authored snapshot and IDs stay intact. No file format changes.

The first scope requires a healthy linked sketch, an explicit earlier solid target and one final separate straight Extrude with a positive literal height. It excludes assemblies, drawings, affected saved face references and other downstream consumers.

| Result | Check |
| --- | --- |
| PASS | Actual Studio created the original linked ring from `n1.top`. The second face pick was `n3.top`. Preview showed a two-loop ring with an empty centre, plane Z=8 mm and normal +Z, `Target · n1` and `Extrude · 1280 mm³`. Before Apply, the document, current bodies, selection, dirty state and history were equal. |
| PASS | Escape and a repeat pick of the existing source preserved the accepted state. A cleared Distance field blocked replacement until Reset. A held valid worker reply did not revive a review after a new face pick or File Open that reused feature IDs. |
| PASS | Apply changed only the v1 source fields. Two unchanged source bodies and the dependent output retained `b1`, `b3`, `b5`. Independent rectangular ring arithmetic and 16 native corners agreed within 1e−8 of the expected quantities. The output moved from 960 to 1,280 mm³, while `on` still targeted `n1`. First Undo and Redo restored the exact old and new documents. |
| PASS | Studio Save wrote 2,581 exact bytes to the owned browser project. A fresh context opened those bytes through File Open. Editing the new source width from 60 to 64 mm then gave 1,344 mm³ with the same `n3.top` recipe and `n1` target. The D868 invalid Open regression also passed. |
| PASS | Sol High reviewed native face identity and candidate scope. An independent source review identified typed-only drafts and unintended signature capture on commit. Both were corrected before the passing Studio run. |
| PASS | Model 28/28, Studio 46/46, both type checks, production build, scoped lint, driver syntax and diff check. The two passing desktop runs held 829 and 828 source pins through cleanup, with zero page errors, console errors, downloads or source changes. |
| FAIL | The first desktop run threw in the unrelated end-face editor button when opening the replacement body's Width editor. The condition now stays on its original path. The first Studio type check also caught a nullable volume; the final check requires a finite positive number. |
| NOT_RUN | Damaged-file repair, broader profiles or consumers, a valid resolve followed by a failed downstream rebuild in Studio, non-axial Studio picks, mobile, full App lint and full suites. |

[#2324](https://github.com/barocss/barocss/issues/2324) remains open for the remaining cases. Initial scenarios remain **8/10**. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
