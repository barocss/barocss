# D846 — Export and reopen one bound-end extrusion as STEP

P1 with P2 exchange evidence, rows 08, 13 and 16. SMALL evidence-only item. Studio opens the qualified D844 YZ recipe, edits the target's local Start Z from 20 to 30 mm and exports the current two-body part. The existing independent Python Part 21 reader and the Studio reader inspect the same output bytes.

| Result | Check |
| --- | --- |
| PASS | Actual desktop Studio reports AP214, B-rep geometry and millimetres. The panel discloses native feature-history loss and agrees with the real export Worker. Export produces 10,586 bytes at the local Blob boundary. The bytes match the prepared Worker payload. Export leaves the authored document exact. |
| PASS | The independent reader finds one product, 261 resolved records, one mm declaration, two manifold solid records, two closed-shell records and 16 topological vertices. The end body bounds are (−100, 12, −7) to (−70, 22, 3) mm. The target bounds are (−70, 7, −12) to (−65, 27, 8) mm. Both positive controls and all five negative controls pass. |
| PASS | A fresh Studio context opens those exact bytes as one import with two solids. Studio reports 3000 and 2000 mm³ at centroids (−85, 17, −2) and (−67.5, 17, −2) mm. The import contains the STEP text and no authored end-face recipe. The mass measurements are Studio self-read evidence against the analytic prism oracle. |
| PASS | Current D691 standalone and D683 variant export and fresh Open regressions pass. Model 42/42, Studio 33/33, final Model types, driver syntax, diff check and root visual review pass. |
| FAIL | None in this item. |
| NOT_RUN | Third-party CAD geometry import or independent volume integration, full suites, fresh Studio type check and production build, mobile and other browsers. The OCP cache and old native reader remain removed. |

[Issue #2308](https://github.com/barocss/barocss/issues/2308) remains open. D847 verifies the selected existing Distance and face-start behaviors on the current Studio. Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
