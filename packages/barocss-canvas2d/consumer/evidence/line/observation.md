# C2D-27 native browser observation

Base: locally integrated #780 merge `93da9f161e0b23cf6ee240607a09c97171b569f5`. Issue: #794. This consumer imports only compiled public package entries and is covered by the consumer declaration type check. Browser: Headless Chromium 155, actual WebGL 2.0 (OpenGL ES 3.0 Chromium), 180×140 logical canvas at DPR2. Scene: white Paper rectangle and a 12-logical-pixel blue Edge line from `(20,40)` to `(100,40)` inside Team.

1. Initial line: `(40,40)` was blue `[0,0,255,255]` with `Edge/line` hit; adjacent `(40,50)` was white `[255,255,255,255]` with `Paper/rect` hit. `(120,60)` and `(120,80)` were white/Paper. A real pointerdown at `(40,40)` delivered `g1:line:Edge`, `g1:team`, `g1:stage`.
2. An invalid zero-length `setLine` returned `INVALID_SCENE`; the page reported the exact observed state retained. The deterministic probe also checked zero width, extra field, duplicate attached ID and stale line hit.
3. The browser downloaded a real 656-byte `line-document.json` while the blue line was accepted. `setLine` then changed endpoints and stroke to a vertical green line from `(120,20)` to `(120,100)`: `(40,40)` became white/Paper, and `(120,60)` and `(120,80)` became green `[0,255,0,255]` with Edge/line hits.
4. The file chooser Open staged a fresh canvas/renderer and new display tree. Generation changed 1→2; the blue line and all four initial pixels/hits returned. A real pointerdown delivered `g2:line:Edge`, `g2:team`, `g2:stage`. Editing the reconstructed line changed it to vertical green and updated pixels/hits again. The attached screenshot shows this reopened and edited state.

The initial console reported only a `/favicon.ico` 404. This is one finite line in one Chromium/WebGL2 session. It does not establish dashes, joins, arrowheads, broad browser/device behavior or publication.
