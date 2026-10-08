# Scene v8 sprite additive blend: native consumer observation

Run the Node 22 package build, serve `packages/barocss-canvas2d` with Vite, and open `/consumer/sprite-blend.html`. This record uses Headless Chromium 155, WebGL2, logical canvas 100×80 and DPR 2. The host registered one 1×1 straight RGBA8 image `[255,0,0,128]`. Two sprites shared it over one opaque gray Back rectangle. The second, following sprite stayed normal. Samples are logical positions read from the actual WebGL2 canvas with `gl.readPixels`.

| State | Main at (30,30) | Following normal at (65,30) | Back at (87,30) | Main hit |
| --- | --- | --- | --- | --- |
| Initial normal | `[160,32,32,255]` | `[160,32,32,255]` | `[64,64,64,255]` | Sprite |
| Edited add | `[192,64,64,255]` | `[160,32,32,255]` | `[64,64,64,255]` | Sprite |
| Reopened add | `[192,64,64,255]` | `[160,32,32,255]` | `[64,64,64,255]` | Sprite |
| Reopened handle changed to normal | `[160,32,32,255]` | `[160,32,32,255]` | `[64,64,64,255]` | Sprite |

The unchanged following sprite proves normal blend state was restored after the additive image draw in the same frame. A real pointerdown at Main routed `Sprite` then `stage` before Save and again after Open. Invalid `multiply` returned `INVALID_SCENE` and retained the accepted add Scene and frame.

The browser Save downloaded the attached 1,051-byte v1 Scene v8 document at add mode, SHA-256 `cf36dae20e6eeea02fcfb147c2390ed0e43d3d79ac9c384a8b2594e9fcb445d9`. After page reload, file chooser Open created generation 2 canvas/renderer/tree with all four original asset bytes, add mode and matching pixels/hits. Editing the restored handle to normal returned the initial pixel. `reopened-normal.png` shows the final state. Browser console reported zero errors and zero warnings. Browser and Vite server were closed.

This fixed RGBA8/WebGL2 corpus does not certify broad devices, color spaces, blend families or publication.

The same native checkout passed the Node 22 library build (143.7-KiB browser entry), strict package consumer declaration check and all 36 Canvas2D example probes. `npm pack` produced a 91,232-byte archive. An independent `/tmp` project installed it offline with scripts disabled; public core/document ESM imports and a strict `checkJs` consumer exercised `SceneV8`, `SpriteHandle.setBlendMode`, reconstruction and v1 document serialization. The first installation attempt failed because the shared npm cache contained root-owned files (`EACCES`). Retrying with a separate temporary npm cache succeeded without changing the shared cache. This verifies archive consumption, not npm publication.
