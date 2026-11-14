# D1225 — Verify mixed edge selection through rounded inset regeneration

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2481](https://github.com/barocss/barocss/issues/2481)

Actual Studio picks one straight and one curved inner top edge on the rounded 1 mm inset and changes its distance to 2.5 mm. The driver reads selected edge indices against the evaluated native names. No product change was needed.

| Result | Check |
| --- | --- |
| PASS | At 1 mm, both n2.side[e9] and n2.side[e10] top edges were picked. At 2.5 mm, only straight n2.side[e9] stayed selected. No other edge replaced the retired arc. Undo and Redo kept the surviving selection. |
| PASS | The 2.5 mm ring passed strict B-rep inspection and measured 1215.663706143591 mm³ within 1e-7 mm³ of the analytical value. |
| PASS | Chamfer on the surviving edge displayed that the linked inset supports only its Extrude and offered Detach inset. Apply stayed disabled. Cancel retained the accepted document and the straight pick. Driver syntax, diff and frozen-source checks passed. |
| NOT_RUN | Tangent expansion from a detached straight source edge, another mixed pair, full suites, CI and mobile. |

Keep #2481 open for the separately recorded tangent case. Desktop QA is **30/81 (37%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
