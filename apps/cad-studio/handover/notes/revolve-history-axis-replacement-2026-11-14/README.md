# D1164 — Replace a Revolve axis through History

2026-11-14 · FEATURE · P0 desktop QA, rows 07 and 21 · [#2480](https://github.com/barocss/barocss/issues/2480)

History offers Replace axis on a standalone Revolve with an earlier rectangular extrusion. Pick a current original top edge, check the rebuilt result, then apply. Replacement keeps the feature ID, profile, angle and body key. A successful new pick clears the refusal from that command.

| Result | Check |
| --- | --- |
| FAIL | The parent had linked-axis History information without a replacement action. Whole-file lint of App.tsx also reported its existing unused bend-table binding. This item did not edit the bend-table code. |
| PASS | In desktop Studio, Apply and Shift+Enter before a valid pick caused no edit. A top edge on the later solid was refused. After a correct pick, the preview completed, the refusal cleared and the saved document stayed unchanged until Apply. Cancel kept the original axis. |
| PASS | Changing Y24 to Y0 kept the same feature, profile and other nodes. The native rotor stayed one valid solid. Radii changed from 15 and 18 mm to 6 and 9 mm, with volume from 3110.176727054 to 1413.716694115 mm³ within 1e−7 mm³ of 990π and 450π. The original stock retained 19200 mm³. Undo, Redo, and Save followed by fresh Open replayed the expected state. A fixed legacy axis could be replaced by the same linked edge. |
| PASS | D1162 and D1163 desktop regressions, 82 focused Model tests, 4 focused Studio tests, both type checks, lint of the affected modules outside App.tsx, driver syntax, diff check and production build. |
| NOT_RUN | History replacement when the axis stock is consumed by Join, a prior Move as the axis source, wider source families, full suites and mobile. |

Keep #2480 open. D1165 checks a literal earlier Move as the axis source and follows its History edit. Desktop QA is **26/54 (48%)** and initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
