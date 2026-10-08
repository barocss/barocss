# C2D-44 native Chromium/WebGL2 observation

Actual headed Chromium 155, WebGL2, DPR 2, compiled public package import map in `consumer/round-rect.html`. Canvas logical size 120×90.

- Initial radius 20: center (60,45) `[255,0,0,255]` and hit `Shape`; corner (25,20) `[64,64,64,255]` and hit `Back`. Two real canvas pointer presses routed `Shape → stage` and `stage` respectively.
- After public `Shape.setPath` with `roundRect(...,5)`: corner (25,20) `[255,0,0,255]` and hit `Shape`; a real pointer press routed `Shape → stage`.
- Browser Save downloaded `document.json`, 1,215 bytes, document v1 and Scene v10 with ten shape commands and zero assets. Actual file chooser Open staged a fresh canvas, renderer and display tree. The restored corner was red/`Shape`. A restored-handle `setPath` to radius 20 made it gray/`Back`; center remained red/`Shape`, and a real pointer press again routed `Shape → stage` on the new tree.
- Browser console: zero errors and zero warnings. Images show the initial, changed and reopened-edited states. This is one fixed browser flow, not broad device certification.
