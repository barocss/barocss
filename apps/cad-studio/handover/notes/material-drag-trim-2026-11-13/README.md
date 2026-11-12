# D877 — Drag Trim a newly drawn material line

P1, rows 09, 12 and 16. SMALL repair to the private drag Trim planner. On the D876 parent, desktop Studio accepted the click preview for a newly drawn line. A drag across the same line previewed no cut and refused on release because the line had no saved side ID.

The planner assigns two original-end IDs to the crossed fresh line in the candidate. Model Trim then assigns the two cut-end IDs. Existing IDs and untouched shape objects retain their identity. Invalid, incomplete or repeated IDs and insufficient ID capacity still refuse the whole stroke. The stored document acquires no new fields.

| Result | Check |
| --- | --- |
| FAIL | At the parent, drag Trim refused the newly drawn material line. The click preview, current document and history stayed unchanged. |
| PASS | In the repair, one sparse stroke previewed and removed (10, 15) to (10, 25) mm on the line from (10, 5) to (10, 35) mm. The preview matched both ends within 0.02 CSS px. One Undo and one Redo restored and removed the same interval. |
| PASS | Finish refused the open material chain and named the first remaining endpoints. Studio retained the accepted 3,200 mm³ solid, selection, history and clean state. The draft cut remained editable after the refusal. |
| PASS | Two ordinary Line paths closed one eight-sided hole. Finish rebuilt the same Extrude and preserved the four outer side IDs and two construction bounds. Native geometry matched 24 independent corner positions, volume 2,100 mm³ and centroid (19.642857142857142, 20, 1) mm within 1e-7 in the respective units. Document Undo/Redo and the exact 2,721-byte OPFS Save and fresh File Open kept the accepted result. Studio reopened the sketch for editing. |
| PASS | D876's three-construction-line desktop regression, 55 focused Studio tests, both type checks, scoped lint, driver syntax and diff check. The baseline and repaired material runs held 832 source inputs through cleanup. |
| NOT_RUN | Production build, full suites, mobile, curved or dimensioned drag targets, tab switch, and a dedicated capture-loss flow. |

[#2328](https://github.com/barocss/barocss/issues/2328) remains open. Its proposal excludes hidden construction from cutting boundaries. The existing Studio policy retains that boundary role and protects hidden construction from cuts. D878 starts the P1 two-point radius circle input. Initial scenarios remain **8/10**. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
