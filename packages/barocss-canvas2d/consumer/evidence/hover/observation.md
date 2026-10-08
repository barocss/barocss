# C2D-47 native consumer observation

- Source: `consumer/hover.html` using the compiled public ESM entry and `@barocss/canvas2d/document`.
- Browser: headed Chromium 155, WebGL2, DPR 2, 80×80 logical canvas.
- Initial real mouse route at `(20,20)`: `Parent → Frame → Sprite`. Pixel `[0,0,255,255]`; hit `Sprite`.
- After setting the sprite hit mode to `none` and moving the real pointer: `Sprite → Frame → Parent` leave, then `Back` enter. Pixel remained `[0,0,255,255]`; hit `Back`.
- Canvas exit: `Back` leave.
- Browser Save downloaded `document.json` (1,297 bytes), a v1 envelope with Scene v11 and the 1×1 blue RGBA8 asset.
- After page reload, file chooser Open created generation 2 with new canvas, renderer and display tree. Pixel remained blue; the saved sprite mode `none` returned hit `Back` and a fresh `Back` enter. The old listener log stayed empty.
- Editing the restored sprite mode to `auto` and moving the real pointer produced `Back` leave, then `Parent → Frame → Sprite` enter; hit `Sprite`. `reopened-edited.png` records the consumer screen.
- Browser console: zero errors and zero warnings.

The host converts DOM pointer coordinates to logical pixels, calls the current renderer hit test, then dispatches hover. This observation establishes this bounded Chromium/WebGL2 flow. It does not establish general DOM event parity or device coverage.
