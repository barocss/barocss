# C2D-23 native rectangle consumer observation

Date: 2026-10-08. Source branch: `codex/canvas2d-780`, exact parent `572b3eb2b45e139768537e75f4f2585b0838e4a3`. This is a native check. Integration has not yet recorded a merged-head result.

The package-local `rect.html` consumer imported compiled `@barocss/canvas2d` and `@barocss/canvas2d/document`. Node 22.22.0 package build, independent `checkJs`/declaration type check, `rect-handle-probe.mjs` and the older `path-handle-probe.mjs` passed. The new probe checked eleven refusal/compatibility cases and rect→Team→stage delivery. The older path probe now expects valid rectangle reconstruction, while its path behavior passed.

Headless Chromium 155 on macOS supplied WebGL2. The page used 240×160 logical pixels at DPR2, giving a 480×320 backing canvas. Before editing, `(40,40)` was opaque red and hit `Rect`; `(80,60)` was opaque blue and hit the higher-layer `Overlay` path; `(125,40)` and `(150,40)` were transparent and had no hit. A real pointer click at `(40,40)` delivered `g1:rect:Rect` → `g1:group:Team` → `g1:stage`. The accepted renderer Scene and tree snapshot were identical.

The browser downloaded the actual [807-byte v1 document](rect-document.json) before editing. An invalid zero-width edit returned `INVALID_SCENE`, with exact observation unchanged. A valid `setRect` changed width 80→110 and fill red→green: `(40,40)` and `(125,40)` were opaque green and hit `Rect`; the overlapping blue path stayed above it; `(150,40)` remained transparent. The accepted Scene again matched the tree snapshot.

The browser selected the saved file through the file chooser and staged a fresh canvas, renderer and display tree. Generation 2 restored width 80, red `(40,40)`, blue `(80,60)` and transparent `(125,40)`. A new real click delivered only `g2:rect:Rect` → `g2:group:Team` → `g2:stage`. A later edit again made `(125,40)` green and hit `Rect`. The [screenshot](after-reopen-edit.png) is from that final state. The only browser console error was the static server's missing `/favicon.ico` (404).

This proves the bounded compiled-consumer flow on one Chromium/WebGL2 configuration. It is not a merged-head, broad-browser, publication or release result.
