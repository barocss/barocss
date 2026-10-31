# Re-check of the nested-BOM fixes

Verdict: **ACCEPT**

I rebuilt the same probes, unchanged, against the current working tree and ran them through the gate. All five pass (log: `run3.log`).

| Item | Result | Evidence |
|---|---|---|
| P7: balloons | PASS | Block's balloon is on `s1/p2/n1.side0\|n1.side1`. The nested key's balloon is on `s1/p1/n1.side0\|n1.top`. Every line has a balloon (no line is left without one). |
| Drawing BOM table | PASS | Nested rows read `Sub › Shaft` and `Sub › Block`. The note says a sub-assembly's mass includes the parts under it, and that the rows marked › are not added again. |
| P1b: fastener rows in a sub-assembly | PASS | Nested screws now match the sub-assembly opened alone: row F1, not an estimate, source "a test row". The purchase list carries F1. |
| P3a: merging | PASS | Two identical sub-assemblies that list their parts in a different order are one line, S ×2. |
| P3b: purchase list | PASS | The top-level M6×20 screw and the four in the sub-assembly are one purchase row with qty 5. The BOM lines themselves stay by level. |
| P6: byte-identity | PASS | View, BOM, panel data and purchase.csv (with made parts) are identical to the pre-change code on 10 flat documents. |

## Follow-up (low; not a wrong result)

The balloons for the Sub line (1) and the Shaft line (2) both sit on the same edge, `s1/p1/n0.seat2#2~sil0`, so the two leaders meet at the same tip. Sub has no bodies of its own, so it borrows a part's edge. It would read better if it picked an edge no other balloon uses.
