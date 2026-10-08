# Public sprite sampling edit: native consumer observation

Run the Node 22 package build, then serve `packages/barocss-canvas2d` with Vite and open `/consumer/sprite-sampling.html`. This record uses Headless Chromium 155, WebGL2, logical canvas 100×80 and DPR 2. The host registered one 2×1 opaque RGBA8 image: red `[255,0,0,255]`, blue `[0,0,255,255]`. The public Sprite used it at 40×30 logical pixels over a yellow Back rectangle. Samples are logical positions read through `gl.readPixels` from the actual canvas.

| State | (30,30) | Boundary (39,30) | (50,30) | (65,30) | Hit at boundary |
| --- | --- | --- | --- | --- | --- |
| Initial nearest | `[255,0,0,255]` | `[255,0,0,255]` | `[0,0,255,255]` | `[255,255,0,255]` | Sprite |
| Edited linear | `[252,0,3,255]` | `[137,0,118,255]` | `[0,0,255,255]` | `[255,255,0,255]` | Sprite |
| Reopened linear | `[252,0,3,255]` | `[137,0,118,255]` | `[0,0,255,255]` | `[255,255,0,255]` | Sprite |
| Reopened handle changed to nearest | `[255,0,0,255]` | `[255,0,0,255]` | `[0,0,255,255]` | `[255,255,0,255]` | Sprite |

A real pointerdown at the Sprite boundary routed `Sprite` then `stage` before Save and again after Open. An invalid `cubic` edit returned `INVALID_SCENE` and retained the accepted linear Scene and frame. The browser Save downloaded the attached 740-byte v1 document at linear sampling, SHA-256 `da009565d38c96ac554d8f377c0ad39af7bbbd67df6a883dbda247e651796d86`. After page reload, file chooser Open created generation 2 canvas/renderer/tree with all eight original asset bytes, linear sampling and matching pixels/hits. Editing the restored handle to nearest returned the original boundary pixel. `reopened-nearest.png` shows that final state. Browser console reported zero errors and zero warnings. Browser and Vite server were closed.

These are fixed image and browser observations. They do not certify all scale ratios, devices or color spaces.

The same native checkout passed the Node 22 library build (142.8-KiB browser entry), strict package consumer declaration check and all 35 Canvas2D example probes. `npm pack` produced a 90,518-byte archive. An independent `/tmp` project installed that archive offline with scripts disabled; public core/document ESM imports and a strict `checkJs` consumer exercised `setSampling`, Scene v7 reconstruction and v1 document serialization. This verifies archive consumption, not npm publication.
