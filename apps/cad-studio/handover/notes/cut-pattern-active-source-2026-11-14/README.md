# D1195 — Disclose the active Cut Pattern source

2026-11-14 · FEATURE · P0 desktop QA, rows 09 and 21 · [#2468](https://github.com/barocss/barocss/issues/2468)

Opening an earlier Subtract in the Browser also selects the current body. Studio now retains which Subtract the user inspected for that selection. A Cut Pattern refuses that request if it would repeat a different Subtract. Select the current body to repeat its active Subtract. The command HUD and History editor identify the source with its Subtract number and feature ID.

| Result | Check |
| --- | --- |
| FAIL | The parent accepted a Linear cut pattern after opening and closing Subtract 1 (n4). The stored reference was Subtract 2 (n7). Native volume was 23,680 mm³. An extra n4 cut in this fixture would give 23,720 mm³. |
| FAIL | The first fixed driver incorrectly assumed Undo began disabled after Open. The refusal and unchanged document passed. The final driver compares both prior history controls and steps through the accepted Undo/Redo chain. |
| PASS | Studio refused the earlier source after the editor closed. The document, bodies and prior Undo/Redo controls stayed unchanged. Explicitly selecting the body allowed preview and Apply and showed Subtract 2 (n7). |
| PASS | History showed the same source. Spacing 16 → 18 mm changed only the spacing field. Undo restored spacing 16 and then the original two cuts. Redo restored both accepted states. |
| PASS | Seed volume 23,800 mm³. Both pattern states were strict-valid at 23,680 mm³. At 16 mm spacing the four new native walls had X=24/30 and Y=26/28 mm. At 18 mm they had X=26/32 and Y=26/28 mm. Each wall carried the n6 tool provenance. Stock-minus-prism volume and centroid checks used a 1e-7 absolute tolerance. |
| PASS | Focused Model 4/4, Studio type check, scoped lint of the new helper and both display components, driver syntax, diff, production build and frozen-source checks. |
| NOT_RUN | Authoring a pattern with an earlier source, separate Rectangular/Fill/Path desktop qualification, fresh file restart, full suites, CI and mobile. |

The same guard and source readout apply to all four Cut Pattern commands. Actual Studio proof here is Linear only. The current document has one reference for both stock and cut producer. Adding an earlier source requires a separate authored reference across Studio, file admission, dependency edits and native evaluation. Keep #2468 open. Desktop QA is **29/54 (54%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
