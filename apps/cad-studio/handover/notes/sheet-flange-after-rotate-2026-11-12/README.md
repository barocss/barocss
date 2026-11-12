# D815 — Flange the rotated sheet on its persistent edge

P1, rows 07, 08 and 16. SMALL verification of the existing Flange consumer on D814's 30° X-axis Rotate. One true viewport pick from Bottom right at (40, 12.9903810568, 7.5) mm selects the unique n0.end|n0.leg1.a edge. The 20 mm, 90°, full-width material-inside flange keeps the original fixed skin.

| Result | Check |
| --- | --- |
| PASS | The viewport pick, Flange HUD and accepted n8 all use the persistent edge of rotated output n7. The valid folded body measures 3756.8113728476 mm³ and centroid (17.8293649462, 11.2543226707, 10.5069413296) mm. The new axis direction is (0, 0.8660254038, 0.5). |
| PASS | One rigid alignment of the complete flat confirms width 30 mm, length 84.7858401318 mm, area 2496.0586150671 mm², both radius-2.75 mm holes at their independent positions, and the original DOWN and new UP bends. The Flat dialog shows both bends and both holes. |
| PASS | The first Undo and Redo restore the exact rotated and flanged documents. Actual project Save, Close and fresh Open restore the exact 2,837-byte flanged document and its native folded and flat quantities. |
| PASS | After Open, changing only source thickness from 1.5 to 2 mm preserves the original Rotate and named Flange. Volume is 4936.2057202674 mm³, aligned length is 83.4769905155 mm and area is 2456.7931265808 mm². Both hole radii and native bend directions persist. |
| PASS | The actual translated-flange regression passes with the shared flat alignment check. Both runs have zero page errors, console errors and downloads. Syntax, diff check and root visual review pass. D814's focused package checks apply to the unchanged product sources. |
| NOT_RUN | Invalid-flange case, DXF output, Mirror qualification, full suites, mobile and other browsers. |

[Commands and receipt digests](qualification.json). [#2230](https://github.com/barocss/barocss/issues/2230) remains open for single-body reflection and copy cases. Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**.
