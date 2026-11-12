# D794 — Verify signed sketch snapping on an offset XZ plane

P1, rows 09 and 15. SMALL. Qualify the existing signed distance on the XZ plane at Y = −7 mm with the grid off, and remove the contradictory fixed grid label in the Sketch panel. The toolbar reports the actual grid state.

| Result | Check |
| --- | --- |
| PASS | Moving the sketch plane while one endpoint is selected retires the snap. Hiding the construction retires a second attempt and disables entry until the construction is visible again. These transitions leave the accepted document intact. |
| PASS | The actual desktop tool accepts −6.5 mm from A=(2,4) toward B=(14,9) in plane coordinates. Independent 5–12–13 arithmetic gives (−4,1.5) mm. The preview projects to that point. The second corner uses the ordinary midpoint at (8,6.5) mm. |
| FAIL | Before the display correction, the toolbar reported Snap off and the Sketch panel still showed Snap 1 mm. The fixed label is removed and the final Studio run verifies the actual Snap off state. |
| PASS | The 3 mm extrusion is valid and keeps all eight independent world corners, centroid (2,−8.5,4) mm and volume 180 mm³ within 1e-8. Project Open restores the exact 1,280-byte document. Trim then removes the original endpoint (14,9) mm. The stored rectangle, plane, side tags, Extrude and exact solid remain fixed. Undo, Redo and a second project Open verify the 1,281-byte edited document. |
| PASS | Both type checks, three focused Model snap tests, driver syntax and diff check. Visual review covers grid off and the post-Trim solid. Zero errors and downloads in the passing run. |
| FAIL | Early driver attempts projected the Trim click outside the view or tried to activate the already-open project again. The driver now uses public wheel input to frame the click and keeps the active project for the second save. |
| NOT_RUN | YZ and tilted planes, document replacement while the snap is pending, full suites, mobile and other browsers. |

[Commands and receipt digests](qualification.json). Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. The wider temporary snap issue stays open. [#2321](https://github.com/barocss/barocss/issues/2321).
