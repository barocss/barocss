# D781 — Keep Box editable after a width or depth task

P1 and AI automation, rows 04, 09, 16 and 29. FULL interface qualification. New scalar width and depth tasks for a standard upright Box carry an explicit retained-command flag through planning, the worker and checkpoint validation. The existing Box command rebuilds from the updated dimension. The other command fields, extrusion height, origin and native feature IDs remain fixed. The stored endpoint must satisfy the Box limit. The paired footprint path uses the same Box rebuild.

Historical scalar plans, candidates, handoffs and approved checkpoints keep their original semantics and bytes. The marked and unmarked runs have separate identities for the same source and occurrence. A historical Box with stale command fields still qualifies for the ordinary scalar repair path.

| Result | Check |
| --- | --- |
| PASS | Studio and CLI agree on the new width and depth plans. Studio previews, approves and opens each result. The Base grows from 20 × 10 × 5 mm to 24 × 10 × 5 mm or 20 × 14 × 5 mm. A separate Lid task changes its height from 3 to 4 mm in each run. |
| PASS | A fresh Studio project Open shows the updated Box label. The native handle opens Edit Box. A second edit changes only the same axis to 25 mm or 15 mm. Studio Save and fresh Open read the same saved bytes. The original project file and the approved durable run retain their bytes. |
| PASS | Native evaluation returns one shell, six planes and eight vertices. Independent Python expectations confirm the approved and re-edited volumes of 1,200 and 1,250 mm³ for width and 1,400 and 1,500 mm³ for depth. The centroids are (15, 2, 2.5), (15.5, 2, 2.5), (13, 4, 2.5) and (13, 4.5, 2.5) mm. Absolute tolerance is 1e-8. |
| PASS | Historical files produced at the parent revision verify with the current reader. The CLI replays both old plans with the same spec revisions and candidate digests, then resumes both old durable runs. The Studio local service starts a distinct run from each old handoff. Studio opens each old checkpoint with the original accepted bytes and reports the approved width or depth. |
| PASS | Both final type checks, Model 54/54 and Studio 44/44 focused tests, and two mutation overlays. Focused tests cover an exact 1 mm Box input at a decimal origin, a subminimum refusal and preservation of the untouched command field. |
| PASS | The D780 paired desktop regression still approves, re-edits, saves and reopens the Box. Visual review confirms the re-edited viewport and the historical checkpoint display. All three desktop receipts record zero unexpected errors and downloads. |
| FAIL, first Model type check | Conditional spreading and test result inference caused TS2698 and TS7022. Both were corrected before the final type checks and desktop runs. |
| NOT_RUN | Full suites, live LLM providers, mobile and retention for rotated, elevated or nonstandard Box profiles. |

[Commands and receipt digests](qualification.json). Initial scenarios remain 8/10 and B09 v1 remains 9/9. Whole CAD and core readiness are **NOT_MEASURED**. [#2402](https://github.com/barocss/barocss/issues/2402) remains open.
