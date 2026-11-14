# D1224 — Verify the detached inset through Chamfer and former-source editing

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2481](https://github.com/barocss/barocss/issues/2481)

The existing Studio flow draws and rounds the 20 × 10 mm source, creates and detaches its linked 2.5 mm inset, and chamfers one inner top edge. No product change was needed.

| Result | Check |
| --- | --- |
| FAIL | The first test assumed the inner side ID from a prepared fixture. The actual drawn part assigned e10 to this edge. Native coordinates and the actual saved tag identify the same edge. |
| PASS | Studio picked n2.side[e10]&#124;n2.top and applied Chamfer 0.5 mm. The solid passed strict B-rep inspection. A 15 mm wedge removed 1.875 mm³ within 1e-7 mm³. The resulting volume was 1213.7887061435897 mm³ and the four predicted trim vertices agreed within 1e-7 mm. |
| PASS | Changing the former source radius from 2 to 2.25 mm kept the independent sketch, extrusion, Chamfer reference, native readout and body readout equal. Undo and Redo traversed the edit, Chamfer and detachment. Actual project Save and fresh File Open retained the same solid. |
| PASS | Driver syntax, diff and frozen-source checks. Both browser processes and Vite closed. |
| NOT_RUN | Mixed straight/arc selection and the separately described tangent extension case, full suites, CI and mobile. |

Keep #2481 open for its remaining mixed-edge conditions. Desktop QA is **30/81 (37%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
