# C2D-48 native consumer observation

- Source: `consumer/local-bounds.html` using compiled public ESM and document entries.
- Browser: headed Chromium 155, WebGL2, DPR 2, 80×80 logical canvas.
- Initial parent local bounds `{x:0,y:0,width:30,height:10}` and world bounds `{x:20,y:20,width:30,height:10}`. Blue sprite center pixel `[0,0,255,255]`, hit `Sprite`; red rectangle center pixel `[255,0,0,255]`, hit `Rect`.
- Moving the parent to `(30,20)` kept local bounds and moved the parent world bounds to `{x:30,y:20,width:30,height:10}`. Both object samples kept their pixels and hits.
- Rotating the parent 90 degrees kept local bounds and changed world bounds to `{x:20,y:20,width:10,height:30}`. The red sample moved to `(25,45)` and remained red with `Rect` hit; the blue sample stayed blue with `Sprite` hit.
- Browser Save downloaded `document.json` (1,069 bytes): v1 envelope with Scene v11 and the four blue RGBA8 bytes. After page reload, chooser Open created generation 2 on a fresh canvas, renderer and tree. Both local/world bounds, pixels, hits and asset bytes matched the saved scene.
- Editing the restored parent to `(40,20)` retained local bounds and moved world bounds to `{x:30,y:20,width:10,height:30}`. Blue at `(35,25)` and red at `(35,45)` kept exact pixels and hits. `reopened-edited.png` records the screen.
- Browser console: zero errors and zero warnings.

This is one bounded Chromium/WebGL2 consumer. It does not establish pixel-tight curve bounds, filter behavior or CSS layout.
