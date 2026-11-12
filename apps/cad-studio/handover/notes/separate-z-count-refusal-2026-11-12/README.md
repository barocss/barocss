# D823 — Refuse invalid counts for separate Z circular pattern bodies

P1, rows 08 and 16. FEATURE. The shared circular-pattern builder now requires a whole-number Count from 2 to 36 when it creates separate bodies about Z. This is the existing range shown by the command fields and includes the original. The guard runs before the copy loop. X/Y admission, the One body path and existing saved recipes keep their own rules.

| Result | Check |
| --- | --- |
| FAIL | Actual Studio on the parent enables Apply at Count 2.5, then commits b1, b4 and b7. The 120° request places the last copy at 160°. |
| PASS | Current Studio preserves the typed values 2.5, 0, 1 and 37, explains the allowed range and disables Apply. Enter cannot commit. Each refusal retains the accepted source and its 216 mm³ Worker volume. |
| PASS | Cancel followed by first Undo restores the prior 192 mm³ extrusion. First Redo restores the 216 mm³ source. A fresh Count 2 creates b1 and b4 with 216 mm³ each. The authored Rotate retains 120° and pivot (12, 4, 0) mm. |
| PASS | 47 focused Model tests and 87 focused Studio tests. Model checks both builder bounds and the invalid matrix. Both type checks, affected lint, driver syntax, production build, diff check and visual review pass. Desktop has zero page errors, console errors and downloads. |
| NOT_RUN | Actual Count 36 geometry, full suites, mobile and other browsers. |

[Commands and receipt digests](qualification.json). [#2354](https://github.com/barocss/barocss/issues/2354) remains closed for X/Y. [#551](https://github.com/barocss/barocss/issues/551) remains open for its broader graph acceptance. Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**.
