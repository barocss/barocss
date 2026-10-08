# C2D-45 native Chromium/WebGL2 observation

Actual headed Chromium 155, WebGL2, DPR 2, compiled public package import map in `consumer/ellipse.html`. Canvas logical size 120×90.

- Initial `ellipse(60,45,40,20)`: center (60,45) `[255,0,0,255]` and hit `Shape`; edge (80,25) and bounding-box corner (22,26) `[64,64,64,255]` and hit `Back`. Real canvas pointer presses routed `Shape → stage` and `stage` respectively.
- After public `Shape.setPath` with `ellipse(60,45,40,30)`: edge (80,25) became `[255,0,0,255]` and hit `Shape`; corner stayed gray/`Back`. A real pointer press at the changed edge routed `Shape → stage`.
- Browser Save downloaded `document.json`, 1,077 bytes, document v1 and Scene v10 with six shape commands and zero assets. Actual file chooser Open staged a fresh canvas, renderer and display tree. The restored edge was red/`Shape`. A restored-handle `setPath` back to vertical radius 20 made it gray/`Back`; center remained red/`Shape`, and a real pointer press routed `Shape → stage` on the new tree.
- Browser console: zero errors and zero warnings. Images show initial, enlarged and reopened-edited states. This is one fixed browser flow, not broad device certification.
