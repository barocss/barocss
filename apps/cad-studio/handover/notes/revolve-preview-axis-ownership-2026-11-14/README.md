# D1162 — Keep Revolve axis picks on their original edges

2026-11-14 · FEATURE · P0 desktop QA, rows 07 and 21 · [#2480](https://github.com/barocss/barocss/issues/2480)

Use the actual displayed mesh for a Revolve edge hit. Match a retained original body by stable key and reference. When a current Join preview consumes the original stock, use its Union's left operand and match one unchanged straight edge by the edge name, both adjacent faces and the full endpoints. Preserve the last axis and retire queued Apply if a generated or ambiguous edge cannot map.

| Result | Check |
| --- | --- |
| FAIL | In the original desktop Join, the Y20 original edge was shown at preview body ordinal 1. Revolve interpreted that ordinal as the separate stock and selected `n3.side1\|n3.top`. An early corrected-flow run let the camera reframe after reopening Revolve and could not pick the generated edge. |
| PASS | Desktop New body and Join accepted the same original Y0 edge. The generated Join edge at Y9 was refused with the original-axis instruction and the existing axis stayed selected. A new click on the original Y20 edge selected `n1.side2\|n1.top` and joined to the correct stock. |
| PASS | Native New volume was 1413.716694115 mm³. The Join had a single valid solid at 17767.145867644 mm³, matching 16000 + 562.5π within 1e−6 mm³. Its two cylinder radii were 11 and 14 mm about the axis at Y20, Z20. The separate stock retained 16000 mm³. Undo, Redo, Save and fresh Open retained axis coordinates. |
| PASS | Sol High source review, 60 Model and 4 Studio focused tests, Model and Studio type checks, final production build, scoped lint, driver syntax and diff check. Reverse To face desktop regression passed. |
| NOT_RUN | Full suites, mobile, remapping of trimmed or split original edges, linked-source motion and axis replacement through History. |

Keep #2480 open. D1163 adds current resolution for a picked native axis in a bounded same-document case while retaining fixed legacy axes. Desktop QA is **26/54 (48%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
