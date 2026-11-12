# D836 — Switch distance mode in linear pattern history

P1, rows 08 and 16. FEATURE. The history editor converts the current literal spacing or total span at the current Count. Apply commits the converted feature with the same ID, source, direction and native placement. A bound spacing reports the existing connection and requires explicit unbinding before conversion.

| Result | Check |
| --- | --- |
| PASS | Actual Studio converts Count 4 at 30 mm spacing to a 90 mm total span. The draft stays local until Apply. First Undo and Redo restore the two exact representations and identical placement. |
| PASS | Count 6 keeps the 90 mm span and derives 18 mm spacing. Converting back retains that placement. Count 5 in Spacing mode keeps 18 mm and changes the first-to-last distance to 72 mm. The outer width is 82 mm, volume is 2400 mm³ and centroid is (71, 13, 4) mm. Native B-rep comparisons, named closed components and corner checks pass at each state. |
| PASS | The bound 30 mm fixture retains its `pitch` parameter, accepted feature, selection, geometry, dirty state and history after the refused mode change and Enter. First Undo restores the prior 72 mm row. Redo restores the exact bound document. |
| FAIL | The first driver read mass before the loaded document settled. The second run found that the mode selector needed an explicit accessible label. The third driver tried to close an editor during its automatic Apply dismissal. The final driver waits for the accepted state and the editor's dismissal. |
| PASS | D834's current Studio project regression, Model 50/50, Studio 48/48, types, lint, build, driver syntax, diff check and root visual review pass. |
| NOT_RUN | Pointer editing of the span handles, full suites, mobile and other browsers. |

Next D837 qualifies the Count and Total span handles in actual Studio. [Issue #2386](https://github.com/barocss/barocss/issues/2386) remains open. Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
