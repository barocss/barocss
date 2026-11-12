# D799 — Snap once to the circular extension of a construction arc

P1, rows 09 and 15. FEATURE. In an empty Rectangle gesture, select Arc extension snap and pick the unique terminal endpoint of one visible authored open two-point construction arc. The guide follows the existing circle beyond the terminal for up to 90°. It stops before the original arc. The first rectangle click consumes the guide. Ordinary object snaps have priority. The guide uses the existing 8 CSS px reach and 0.0001 mm input rounding.

| Result | Check |
| --- | --- |
| PASS | Baseline actual desktop shows End at (20,30) mm. Beyond the terminal, the same pointer gives the grid corner (12,28) mm. |
| PASS | The final desktop accepts the terminal and refuses the opposite endpoint. Enter activates the control. Escape, Hide construction and starting Two-point snap retire the guide without editing the document. End and Middle still take priority on the source arc. |
| PASS | A radius-10 mm CCW quarter arc about (20,20) mm gives the independent continuation at (20−5√2, 20+5√2) mm. The guide wins at 5.0248 CSS px and is excluded at 13.9578 CSS px. The first corner stores (12.9289, 27.0711) mm. The second corner uses the ordinary input path. The source arc and IDs are preserved. |
| PASS | Undo and Redo restore the exact sketch. A 2 mm extrusion gives a valid native output of 106.41648958 mm³. Studio agrees within 1e-8 mm³. Project Save, Close project and fresh Open retain the 1,762-byte document. The temporary guide is absent on Open. |
| PASS | Independent Sol High source review, four focused Studio geometry and acquisition tests, five Model snap tests, both type checks, production build and driver syntax. The separate actual D793 two-point flow still passes. Visual review covers the guide and reopened extrusion. |
| NOT_RUN | Desktop clockwise and major arc placement, a second zoom and desktop device scale, active guide across File Open, and full suites. |

The first profile uses one completed construction segment with a supporting circle inside the modeling coordinate bounds. The focused Studio tests include signed direction, the angular seam, the major-arc complement, invalid sources and ties between visible snap candidates. The desktop checks use XY at device scale 1. [Commands and receipt digests](qualification.json). Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. The wider issue remains open. [#2317](https://github.com/barocss/barocss/issues/2317).
