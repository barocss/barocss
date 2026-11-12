# D793 — Place one rectangle corner with a two-point sketch snap

P1, rows 09 and 15. FEATURE. In a live Rectangle sketch, select two visible construction endpoints in order, enter a decimal ratio or signed distance, and use the calculated point once. The point enters the existing rectangle gesture at full computed precision. The second corner uses the ordinary snap path.

| Result | Check |
| --- | --- |
| PASS | Real desktop input captures A=(0,0), B=(31,13) mm. Enter opens the snap tool and confirms one point. A repeated endpoint and a fraction string are refused. Negative distance updates the live preview. The invalid value clears the calculated marker, and the decimal ratio restores it at the independently projected point. |
| PASS | Escape, a tool change while picking, and a tool change after confirming an unfinished rectangle retire the temporary state. The construction line and accepted document stay intact. The same two endpoints work in a new attempt. |
| PASS | Ratio 0.25 supplies (7.75,3.25) mm under a 1 mm grid. The second click uses the existing midpoint at (15.5,6.5) mm. The saved sketch retains its authored construction line and rectangle side tags. The independent 2 mm extrusion yields a valid native solid of 50.375 mm³. |
| PASS | Undo/Redo, project Save of 1,054 bytes and fresh project Open keep the exact document and volume. Both type checks and 3/3 Model snap tests pass. Independent source review verified the revised input, marker and owner guards. The passing desktop run has zero errors and downloads. |
| FAIL | Early driver attempts hit a dimension control or used the wrong project entry locator. The first type check found a missing local type import. The final checks passed after those fixes. |
| NOT_RUN | Applied distance outside XY, grid-off placement, construction-source edits after reopen, full suites, mobile and other browsers. |

[Commands and receipt digests](qualification.json). Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. The wider issue stays open. [#2321](https://github.com/barocss/barocss/issues/2321).
