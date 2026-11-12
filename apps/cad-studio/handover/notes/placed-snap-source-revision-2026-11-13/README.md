# D884 — Verify placed snaps through a source revision

P1, rows 09, 10 and 16. SMALL qualification for [#2333](https://github.com/barocss/barocss/issues/2333). The existing product implementation passes the selected revision flow. This decision adds a desktop regression driver.

A left 20 × 12 × 6 mm native box and an independent right box each used body key `b1`. The left occurrence kept its ID, definition ID and placement while New revision changed its source to a 34 × 12 × 6 mm box.

| Result | Check |
| --- | --- |
| PASS | While Rev B was offered, the accepted Rev A endpoint remained at (30.25, 14.25) mm and the proposed endpoint at (44.25, 14.25) mm had no cue. Keep Rev A restored the exact original document. |
| PASS | Accept Rev B changed the source. The driver held the first successful placed Worker reply for that acceptance. The old left mesh remained visible. Neither left endpoint qualified, and the unchanged right midpoint stayed available. A click near the old left endpoint used the 1 mm grid at (30, 14) mm and left the document intact. |
| PASS | After release, the left endpoint (44.25, 14.25) and midpoint (27.25, 14.25) mm qualified. The old endpoint had no cue. The left endpoint and unchanged right midpoint (65.75, 34.25) mm made the finished Rectangle. The independent native read verified the 2,448 mm³ Rev B box and 860 mm³ root Extrude within 1e-8, with unchanged right and original root solids. |
| PASS | Undo/Redo and a 3,350-byte browser project Save and fresh Open retained the accepted sources and geometry. Independent driver review, 15 focused Model tests, 20 focused Studio tests, syntax and diff checks passed. |
| NOT_RUN | A failed placed Worker result, effective per-body hiding and removal, reused occurrence IDs across New/Open, duplicate Finish, build, full suites and mobile. |

The held reply is attributed by the Accept operation, the request ID, the unchanged sibling and the transition to Rev B bounds on release. [#2333](https://github.com/barocss/barocss/issues/2333) stays open for the remaining lifecycle checks. Initial scenarios remain **8/10**. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
