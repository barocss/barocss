# C2D-26 native browser observation

Base: locally integrated #780 merge `93da9f161e0b23cf6ee240607a09c97171b569f5`. Issue: #789. This consumer imports only compiled public package entries and is covered by the consumer declaration type check. Browser: Headless Chromium 155, actual WebGL 2.0 (OpenGL ES 3.0 Chromium), 180×140 logical canvas at DPR2. Scene: white Paper rectangle, red 60×60 Window frame at `(20,20)` with `clip:true`, and blue 40×40 Overhang child at frame-local `(40,20)`.

1. Initial clipped frame: `(30,30)` was red `[255,0,0,255]` with `Window/frame` hit. `(70,50)` was blue `[0,0,255,255]` with `Overhang/rect` hit. `(90,50)` outside the frame was white `[255,255,255,255]` with `Paper/rect` hit, though the child rectangle extended there. `(110,50)` was also white/Paper. A real pointerdown at `(30,30)` delivered `g1:frame:Window`, `g1:team`, `g1:stage`.
2. An invalid zero-width `setFrame` returned `INVALID_SCENE`; the page reported the exact observed state retained. The deterministic probe also checked rotated active clip rejection for frame and ancestor, bad boolean/extra field, duplicate attached ID and stale frame hit.
3. The browser downloaded a real 835-byte `frame-document.json` while clipping was on. Toggling `setFrame({clip:false})` made `(90,50)` blue with `Overhang/rect` hit; the other three samples kept their expected pixels/hits.
4. The file chooser Open staged a fresh canvas/renderer and new display tree. Generation changed 1→2, `clip:true` returned, and all four original pixels/hits returned. A real pointerdown delivered `g2:frame:Window`, `g2:team`, `g2:stage`. Editing the reconstructed frame with `setFrame({clip:false})` made `(90,50)` blue/Overhang again. The attached screenshot shows this reopened and edited state.

The initial console reported only a `/favicon.ico` 404. This is one rectangular clip in one Chromium/WebGL2 session. It does not establish nonrectangular masks, broad browser/device behavior or publication.
