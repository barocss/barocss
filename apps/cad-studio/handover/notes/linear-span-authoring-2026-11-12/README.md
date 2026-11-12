# D835 — Create a linear pattern with a fixed total span

P1, rows 08 and 16. FULL for the added option on the existing Model command and local agent command. One body offers Spacing and Total span. Switching converts the current distance at the current Count. In Total span, Count changes the derived spacing while the authored span remains fixed. The creation command accepts whole Counts 2–24. The saved feature reader retains its native range of 2–64. Choosing Separate bodies converts the draft to Spacing mode.

| Result | Check |
| --- | --- |
| PASS | Actual Studio starts in Spacing mode. Count 4 and pitch 30 mm convert to span 90 mm. Switching back shows 30 mm. Count 6 in Total span shows 18 mm. Separate bodies takes 18 mm, and One body can return to 90 mm. The Model compiles equivalent spacing and span inputs to the exact same native feature. |
| PASS | The Studio preview refuses Counts 1 and 25 and Total span 0. Apply is disabled, Enter cannot commit and the old preview color clears. The accepted document, geometry, selection, dirty state and history stay exact. |
| PASS | Apply creates one output with six closed native solids, 48 corners and 2880 mm³. X offsets are 0, 18, 36, 54, 72 and 90 mm. The resulting B-rep exactly matches an equivalent spacing-mode control. First Undo restores the exact seed and Redo restores the same row. |
| PASS | D834's history and project flow and D831's separate-body flow pass in current Studio. A local agent command authors the same stored feature. Model and Studio focused checks, types, lint, build, driver syntax and diff check pass. The mutation control passes and five changed behaviors fail at their designated assertions. |
| NOT_RUN | Pointer operation of the two creation handles, switching distance mode on an existing feature, wider axis and limit cases in Studio, full suites, mobile and other browsers. |

The Model verifies the Total span and Count handle positions and Count scale. Next D836 adds the existing-feature conversion and protects parameter-bound legacy Spacing. [Issue #2386](https://github.com/barocss/barocss/issues/2386) remains open. Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
