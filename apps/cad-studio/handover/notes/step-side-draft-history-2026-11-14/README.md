# D1175 — Edit Draft pull and neutral position on an imported STEP side

2026-11-14 · FEATURE · P0 desktop QA, rows 07 and 21 · [#2465](https://github.com/barocss/barocss/issues/2465)

Draft creation and History share the signed pull and neutral plane inputs. Body end follows the original stock at each rebuild. Fixed coordinate uses the specified world coordinate. On straight-edged stock the neutral row reports the actual native body-end coordinate. On other stock it identifies the body end without estimating a coordinate from the display mesh. History retains the saved parent, face names, feature and output IDs.

| Result | Check |
| --- | --- |
| FAIL | At the parent, desktop Studio applied +X Draft but its History editor only showed Angle. The first repair still placed the fixed-coordinate recovery in the collapsed kernel detail. |
| PASS | On the real Y− side pick of an imported 20 × 10 × 5 mm STEP box, +X at 5° turned about X4 and −X at 5° turned about X24. Each gave 912.5113364740758 mm³. The two drafted Y coordinates at X4 and X24 reversed between −3 and −1.25022672948152. |
| PASS | A pull perpendicular to the face was refused with an actionable message. Fixed X23 was refused for −X and Apply stayed disabled. Fixed X26 previewed and applied, moving the Y values to −1.075249402429672 and −2.825022672948152 with volume 895.013603768891 mm³. All eight native corners and volumes matched the independent planar slope and cross-section formula within 1e−6 mm and 1e−6 mm³. Every accepted result was one strict-valid native solid. |
| PASS | Undo and Redo traversed both changes. Save and fresh Open retained −X, fixed X26, the accepted document and native solid. Cancel retained it. The focused Model test also covers creating a fixed coordinate, preserving an unchanged parameter binding during an angle edit, and switching back to Body end. |
| PASS | D1174 desktop regression, 20 focused Model tests, four focused Studio tests, both type checks, scoped lint, driver syntax, diff check and production build. |
| NOT_RUN | Other stock families, non-cardinal pull, the complete multi-face Draft family, full suites and mobile. |

Desktop QA is **29/54 (54%)** and initial scenarios **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [#2465](https://github.com/barocss/barocss/issues/2465) stays open. D1176 checks Hole placement and the saved cosmetic thread designation in History using the existing legacy file. New catalog-tapped creation remains held pending eligible person-loaded shop rows. [Commands and hashes](qualification.json).
