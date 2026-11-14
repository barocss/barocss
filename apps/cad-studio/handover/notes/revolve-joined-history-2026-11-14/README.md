# D1166 — Replace a joined Revolve axis through History

2026-11-14 · FEATURE · P0 desktop QA, rows 07 and 21 · [#2480](https://github.com/barocss/barocss/issues/2480)

A direct current Join preserves the identity of both operands. During Replace axis, read the original stock at the Revolve History step. Accept a click on the current joined solid or its completed preview only when the name, adjacent faces and entire segment match one original edge. Preview and commit the entire part with its existing Revolve and Union IDs.

| Result | Check |
| --- | --- |
| FAIL | The parent had no Replace axis action for this joined feature. The first driver attempt also used half the original annulus for added material. The corrected oracle uses three quarters because one quadrant lies in the stock. |
| PASS | Desktop Studio refused one generated edge before a valid pick, and another on the completed preview. Clicking the original Y20 edge set `n1.side2\|n1.top`. Re-picking Y0 on that preview produced a new preview. Cancel kept the accepted document. Apply replaced the axis and kept the Union, profile, angle, other nodes and decoy. |
| PASS | The decoy stayed at 16000 mm³. The joined result stayed one valid native solid. Radii changed from 6 and 9 mm to 11 and 14 mm. Native joined volume changed from 17060.287520587 to 17767.145867644 mm³ within 1e−6 mm³ of 16000 + 337.5π and 16000 + 562.5π. Undo, Redo, Save and fresh Open reproduced the corresponding state. |
| PASS | D1162, D1164 and D1165 desktop regressions, Sol High geometry review, 66 focused Model tests, 4 focused Studio tests, both type checks, scoped lint, driver syntax, diff check and production build. |
| NOT_RUN | History replacement through a further Boolean or transform, trimmed original edges, partial-turn display, full suites and mobile. |

Desktop evidence meets the [#2480](https://github.com/barocss/barocss/issues/2480) criteria across D1162–D1166. Desktop QA is **27/54 (50%)** and initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. D1167 starts #2462 with Sweep selection order and input identity. [Commands and hashes](qualification.json).
