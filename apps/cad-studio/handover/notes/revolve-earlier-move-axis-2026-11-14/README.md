# D1165 — Follow an earlier stock Move from Revolve

2026-11-14 · FEATURE · P0 desktop QA, rows 07 and 21 · [#2480](https://github.com/barocss/barocss/issues/2480)

A linked axis can use one earlier Move of a plain rectangular extrusion. The reference names the Move output and the extrusion's original edge. Native evaluation finds the translated edge in the earlier History state. A Move added after Revolve changes the selected stock at that later step.

| Result | Check |
| --- | --- |
| FAIL | On the parent, the selected edge was fixed at Y22. Editing the earlier Move from ΔY2 to ΔY6 placed the source at Y26 while Revolve stayed at Y22. Three intermediate runs stopped on test-driver issues with the Browser body label, the selection read and focus before opening the palette. |
| PASS | In desktop Studio, the picked edge was linked to Move n2 and native edge n1.side2\|n1.top. Editing Move kept the same Revolve node and shifted its axis Y22 to Y26. The stock kept 16000 mm³. The native rotor stayed one valid solid, with radii 13 and 16 mm then 17 and 20 mm. Volumes 2733.185608623 and 3487.167845485 mm³ match 870π and 1110π within 1e−7 mm³. |
| PASS | ΔZ4 was refused and kept the accepted document. Undo and Redo recovered the expected axes. History Replace could preview another edge on the moved stock and cancel. A new Move after the Revolve changed the stock minimum Y6 to Y13 and the axis remained Y26. Save and fresh Open reproduced that state. |
| PASS | D1164 desktop regression, 65 focused Model tests, 4 focused Studio tests, both type checks, scoped lint, driver syntax, diff check and production build. Model checks cover active and dormant suppression, standalone copy, joined copy and flatten. |
| NOT_RUN | History replacement of a joined Revolve using its consumed source, multi-Move or other transform chains as the bound source, full suites and mobile. |

Keep #2480 open pending joined History replacement. Desktop QA is **26/54 (48%)** and initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
