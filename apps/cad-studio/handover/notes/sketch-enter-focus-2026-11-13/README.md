# D865 — Keep Enter on the focused Browser control

P0, rows 16 and 21. SMALL repair of the D864 observation. The global Studio handler now lets an unmodified Enter reach a focused native button or summary. The existing workspace Enter and modified shortcuts keep their dispatch path.

| Result | Check |
| --- | --- |
| FAIL | At the parent, trusted Enter on **Hide body** was prevented and produced zero native button clicks. It finished a 6 by 4 mm rectangle at Z = 3 mm, added one sketch node and left the source body visible. This was an unintended document edit. |
| PASS | After the repair, trusted Enter activated **Hide body** and **Show body**. The rectangle stayed active with the same fields and the same geometry history. Hide changed only visibility. Show restored the exact original document. |
| PASS | Enter on the explicit **Finish sketch** button generated one trusted native click and one sketch node. Workspace Enter finished a second sketch at Z = 5 mm once. Enter on the explicit Extrude **Apply** button generated one native click and one 2 mm extrusion of 48.00000000000001 mm³. Undo and Redo restored the exact documents. |
| PASS | Current desktop D667 and D684 regressions retained Browser keyboard selection, workspace palette, focused toolbar Space and native filename Undo. Studio focused tests 37/37, Studio type check, driver syntax and diff check pass. The fixed desktop run recorded 352 frozen files through cleanup, six snapshots and zero page errors, console errors, source changes or downloads. |
| FAIL | The first fixed driver expected a false visibility field. The existing document normalizer removes the default look. The final driver checks the exact original document after Show. App.tsx lint reports the existing unused `_k` on the parent and current source. |
| NOT_RUN | Other browsers, mobile, production build and full suites. |

Initial scenarios remain **8/10**. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
