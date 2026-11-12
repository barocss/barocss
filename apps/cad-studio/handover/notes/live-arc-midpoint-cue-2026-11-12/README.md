# D798 — Clear the midpoint cue when a live arc changes

P1, rows 09 and 15. SMALL. Retire a live polygon midpoint cue when its point leaves the current shape. The layout check preserves an unchanged midpoint while the pointer updates another segment. The click path still computes the candidate from the current sketch.

| Result | Check |
| --- | --- |
| FAIL | In the baseline actual desktop, setting the isolated live arc radius to 17 mm moved the curve and left one Middle marker at the old location while the pointer stayed still. |
| PASS | In the final desktop run, stationary radius and coordinate edits clear the old marker. The next pointer input shows Middle at (53,−10) mm after the radius edit and (53,−7) mm after translation. The earlier closing, pending, plane, file replacement and deletion checks remain valid. |
| PASS | Undo/Redo, 110 mm³ native and Studio extrusion, project Save, Close and fresh Open pass again with the same 1,747 bytes. Type checks, five focused Model tests, driver syntax and diff check pass. |
| NOT_RUN | Full suites, mobile and other browsers. |

[Commands and receipt digests](qualification.json). Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. This completes the authored circular-arc midpoint scope. [#2387](https://github.com/barocss/barocss/issues/2387).
