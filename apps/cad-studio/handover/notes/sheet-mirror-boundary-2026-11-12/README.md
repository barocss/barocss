# D816 — Measure legacy Studio Mirror and single-body reflection

P1, rows 07, 08 and 16. SMALL proof of current scope. The test derives an asymmetric sheet from the canonical D546 bracket by shifting the horizontal bore from y = 15 to 18 mm. All other source intent stays exact. The comparison uses the YZ plane at X = 0.

| Result | Check |
| --- | --- |
| PASS | The asymmetric source is one valid native sheet. Its original flat keeps the horizontal bore at (18, 52.3929200659) mm and the vertical bore at (15, 10) mm. |
| PASS | Actual Studio Mirror produces the existing combined original and reflection. Its one valid solid measures 5935.5364895193 mm³, with X bounds −40 to 40 mm. The accepted native request has keep = true. Native flat returns CAPABILITY and the Flat button is absent. |
| PASS | First Undo restores the exact source and its Flat dialog. First Redo restores the combined body. Actual Save, Close project and fresh Open restore the exact 2,280-byte legacy Mirror document and its Flat boundary. |
| PASS | The separately controlled native keep = false output is one valid solid, with volume 2967.7682447597 mm³ and centroid (−12.1410980541, 14.9639755142, 7.0078425114) mm. The same fixed face n0.leg0.a has outward normal +X. Its report is absent and flatPatternOf returns CAPABILITY. The existing unfolder works with explicit rules and recovers the 30 × 67.3929200659 mm blank, one DOWN bend, positive exterior and two negative bore loops. The reflected horizontal bore is (18, 15) mm and the vertical bore is (15, 57.3929200659) mm in its normalized flat coordinates. |
| PASS | Desktop WebGPU, syntax, diff check, independent Sol High oracle and visual review. There were zero page errors, console errors and downloads. D814's focused checks apply to the unchanged product source. |
| NOT_RUN | Actual single-reflected-body Studio authoring, new sheet-report carry, other planes or offsets, DXF, copy/pattern, full suites, mobile and other browsers. |

D817 selects an explicit reflected-only outcome for a qualified sheet at the origin YZ plane. The existing combined default and older documents retain their interpretation. [Commands and receipt digest](qualification.json). [#2230](https://github.com/barocss/barocss/issues/2230) remains open. Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**.
