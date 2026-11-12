# D867 — Measure associative inset replacement and failed Open

P1, rows 07, 09 and 16. SMALL, measurement for [#2324](https://github.com/barocss/barocss/issues/2324). The existing link uses a v1 recipe with an earlier source body, stable source feature, exact face name and inward inset. An explicit `on` target can point to a different earlier body.

| Result | Check |
| --- | --- |
| PASS | Actual Studio picked the native A top, applied the existing 2 mm linked inset and made a separate 4 mm Extrude. The 40 by 24 mm source gave ring area 240 mm² and native volume 960.0000000000016 mm³. All three output IDs and the sixteen ring corners matched the independent expectation. |
| PASS | A prepared file changed only the recipe source to B top at X = 100 to 160 mm and kept `on` at A. Actual Open resolved the new ring, with area 320 mm² and volume 1280.0000000000011 mm³. The source solids stayed separate. The ordinary B Width edit to 64 mm gave 1343.9999999999977 mm³ without changing the authored recipe or downstream node. Undo and Redo passed. |
| FAIL | The current linked Sketch editor provides no explicit source replacement control. General References does not list this recipe. The prepared file verifies the existing evaluator and Open path. |
| FAIL | Loose Open and Project Open both adopted the file with the wrong stable source ID. Native evaluation returned `BAD_REFERENCE` after adoption. The new filename appeared while the previous bodies stayed on screen with freshness false. Loose Open also cleared the dirty indicator of the previous document. Undo recovered the prior accepted geometry in both trials. |
| FAIL | A separate Model probe found that after replacing the source, deleting the explicit independent `on` target can remap it to the source through index reuse. The browser replacement and Width tests kept both source bodies. |
| PASS | Model 20/20, Studio 34/34, driver syntax and diff check. The desktop run recorded nine snapshots and 826 frozen files through cleanup, with zero page errors, console errors, source changes or downloads. |
| FAIL | The first browser driver used the wrong package alias. The next driver expected Open to retain the accepted document and reproduced the adoption defect. The final driver records it on both Open routes. |
| NOT_RUN | Explicit replacement UI, delayed replacement, damaged-file repair, actual target-deletion flow, type checks, production build, mobile and full suites. |

The independent Model probe also verified cold read of the prepared v1 graph, a 70 mm B edit at 1,440 mm³ and `BAD_REFERENCE` on a missing face or a collapsed inset. An omitted `on` defaults to the source during resolve. Keep that case outside the first explicit replacement until its target meaning is preserved. D868 takes the reproduced Open defect first. [#2324](https://github.com/barocss/barocss/issues/2324) remains open. Initial scenarios remain **8/10**. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
