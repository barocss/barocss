# Renderer point conversion native observation

Native child parent: verified #921 local develop merge `46287542ff8842d3e0278960824de03271979021`.

- Node 22 library build: pass, bundled `dist/index.js` 174.9 KiB.
- Strict compiled public consumer type check: pass.
- Focused renderer conversion/refusal probe: pass, including empty Scene, copied points, seven invalid point cases, rejected view rollback, supported extreme views and disposal.
- Actual Chromium 155, WebGL2, DPR 2: world `(20,15)` mapped to viewport `(50,35)` and back. Rect-local point was `(0,0)`. The pixel at `(51,36)` was `[255,0,0,255]`; `hitTest({x:50,y:35})` returned `Red`. A real browser pointer at that point routed `Red:Red`, then `stage:Red`.
- Before render, changing view to `{panX:20,panY:10,zoom:4}` changed the mapped point to `(100,70)`. Rejected zoom 0 returned `INVALID_VIEW` and kept `(100,70)`. Restoring the prior view returned `(50,35)`. Offscreen conversion and negative-zero refusal passed.
- Browser Save downloaded the 381-byte [v1 document](document.json), SHA-256 `3d3b0f3ba7c798820c12705703dd7cecec4b561bd1398fc40ed2eba2d7ecf4a9`. File chooser Open staged it on a new canvas and renderer. Generation 2 repeated the same conversion, pixel, hit and real pointer route. Console errors/warnings: 0/0.

One compiled Chromium/WebGL2 consumer was checked. Cross-browser input and a published npm artifact were not checked.
