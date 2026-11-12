# D797 — Verify arc midpoint ownership in desktop Studio

P1, rows 09 and 15. SMALL. Verify ordinary closing arcs and temporary midpoint candidates through arc confirmation, source edits, plane changes, and document replacement. Product source is unchanged.

| Result | Check |
| --- | --- |
| PASS | The final arc of an ordinary closed semicircle snaps a construction line to (15,22) mm. The original profile and side tags are preserved. The regenerated centre differs by 1.78e-15 mm in Y and is within the 1e-8 mm check. |
| PASS | The toolbar File Open replaces the first document while its sketch is active. The new sketch has no candidate at the previous location. The construction arc from (4,−8) to (20,−8) mm offers no Middle on its pending curve or on its initial chord. Confirming the arc makes Middle available and places a rectangle at (12,−14) mm. |
| PASS | With an isolated arc, switching XY to XZ clears the cue and returning to XY restores it on hover. Setting the radius to 17 mm moves the midpoint to (53,−10) mm on the next pointer input. Moving both ends by +3 mm in Y moves it to (53,−7) mm. Trim deletes the arc and the next pointer input has no candidate. Escape preserves the accepted document. |
| PASS | Exact Undo and Redo restore the replacement document and the new rectangle. The 2 mm extrusion yields a valid native output of 110 mm³. Actual project Save, Close project and fresh Open retain the exact 1,747-byte document and volume. The passing run has zero page errors, console errors and downloads. |
| PASS | Both type checks, driver syntax, diff check and visual review of the closing arc, edited arc and reopened extrusion. D795's five Model snap tests and production build cover the unchanged product sources. |
| FAIL | The first driver confused the initial demo node ID with the fixture, expected bitwise equality for the regenerated arc centre, used an overly tight pointer-authored sagitta bound, and targeted the visible Close text instead of its accessible name. The final driver corrects all four assertions and locators. |
| NOT_RUN | One gate attempt expired before launch. The final attempt ran under the gate. Immediate marker retirement while a live radius or position changes with a stationary pointer, full suites, mobile and other browsers remain untested. |

[Commands and receipt digests](qualification.json). Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. The issue remains open for the stationary cue check. [#2387](https://github.com/barocss/barocss/issues/2387).
