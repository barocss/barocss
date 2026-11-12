# D801 — Reacquire circular extension after Trim

P1, rows 09 and 15. SMALL. Verify the extension guide after a real source edit, a plane change, and competition from ordinary snaps. Product source is unchanged.

| Result | Check |
| --- | --- |
| PASS | Trim at (22.8,29.6) mm moves the terminal from (20,30) to (26,28) mm. The crossing line and the retained start ID e5 are preserved. The remaining sweep agrees with atan2(4,3) within 1e-8 radians. |
| PASS | The previous guide retires before the edit. The old terminal cannot acquire a guide. The new terminal opens a guide whose 90° limit excludes the old 160° target. The point at (20,30) mm now works as an extension point and stores the first rectangle corner there. |
| PASS | Exact Undo and Redo restore the two accepted sketches. A 2 mm extrusion gives a valid native output of 100 mm³. Studio agrees within 1e-8 mm³. Changing a separate armed guide from XY to XZ retires it. Escape preserves the accepted solid. |
| PASS | With a valid circular candidate under the pointer, Origin, End and Quadrant take priority at 3.8973, 3.9233 and 5.2018 CSS px respectively. The quadrant click stores (3,8) mm and consumes the guide. |
| PASS | Both type checks, driver syntax, diff check and visual review of the new guide and priority cue. The final desktop run has zero page errors, console errors and downloads. D799 and D800 retain the build, focused tests, project file and desktop scale evidence. |
| NOT_RUN | Full suites, mobile and other browsers. |

[Commands and receipt digests](qualification.json). Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. This completes the first bounded circular-extension profile. [#2317](https://github.com/barocss/barocss/issues/2317).
