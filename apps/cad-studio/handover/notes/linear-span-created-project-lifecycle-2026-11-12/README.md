# D839 — Verify the project lifecycle of a newly created fixed-span pattern

P1, rows 08 and 16. SMALL. One actual Studio command creates a fixed-span feature on a moved rectangular seed. The same document goes through History, Undo and Redo, its own project Save, Close, reload, Open and a final Count edit.

| Result | Check |
| --- | --- |
| PASS | Actual creation and Apply produce Count 4, span 90 mm and spacing 30 mm. History Count 6 derives spacing 18 mm. First Undo and Redo restore the exact accepted documents. |
| PASS | Studio saves the exact 674-byte project document and opens it after reload. The editor still shows Total span 90 mm. Count 5 derives spacing 22.5 mm. All six checkpoints keep the 90 mm first-to-last translation and 100 mm outer width. |
| PASS | Every checkpoint matches the corresponding spacing-mode B-rep exactly. The 4-, 6- and 5-copy results contain 32, 48 and 40 native corners and 1920, 2880 and 2400 mm³. Each centroid is (80, 13, 4) mm. |
| PASS | D834's moved-source editor and project regression, Model 6/6, Studio 36/36, Model types, browser syntax, diff check and root visual review pass. |
| NOT_RUN | Production build, full suites, mobile and other browsers. D835–D837 retain the affected production builds. |

This joins the lifecycle with the compatibility, geometry, input and pointer evidence from D833–D838 for [#2386](https://github.com/barocss/barocss/issues/2386). Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. Next D840 starts the bounded associative Extrude end-face workflow in [#2308](https://github.com/barocss/barocss/issues/2308). [Commands and receipt digests](qualification.json).
