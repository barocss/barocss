# D1119 — Reconcile desktop sketch snap acceptance

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2457](https://github.com/barocss/barocss/issues/2457)

| Result | Acceptance and evidence |
| --- | --- |
| PASS | The polynomial Loft no longer offers a false Centre. The separate native R3 circle still offers its centre and stores the exact point. D855 passed again on the audit parent. |
| PASS | The active construction line is dashed and remains an open reference after Finish and fresh Open. D1107 passed again on the audit parent. D1116 shows the unsupported tool state. D1115 shows the placed rotation limit. |
| PASS | Line and Arc used both native Crossing endpoints. Circle used the first crossing as its centre. All three passed fresh Open on the audit parent. D1109 covers the Centre arc centre. D1110, D1111 and D1117 cover the fractional Circle radius, the Slot width and the construction endpoint. |
| PASS | The stationary keyboard toggle refreshed the visible Crossing and the stored Rectangle corner. Hide and Show preserved the chord circle pick and removed the hidden source as a candidate. Both passed again on the audit parent. D1112 covers Escape focus and draft retention. |
| PASS | The earlier signed-distance and face outline readbacks retain their scoped historical result. D1060 covers the numeric Circle diameter Undo. D1118 verified Grid 5 mm and Grid off on current source. |
| FAIL | No new failure in the five current desktop runs. Earlier reproduced failures remain in their original decision records. |
| NOT_RUN | The issue also lists closely competing or overlapping projected crossings, a smaller snapped radius and the downstream Hole. The scoped source does not offer curved edge crossings. The full suites were not run. |

The issue remains open pending the remaining named desktop controls. Desktop QA is **19/54**, initial scenarios **8/10** and whole CAD **NOT_MEASURED**. [Commands and hashes](qualification.json).
