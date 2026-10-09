# C2D-55 sprite hit area: native consumer observation

Issue: [#918](https://github.com/barocss/barocss/issues/918). Base: verified local `develop` merge `6ed9850a7d90e3eed4a6837e2c27e1c0a419a621` (#917). This is a fixed Chromium 155, WebGL2, DPR 2 run against the built public package entries on 2026-10-09. It is not a cross-browser claim.

Node 22 built `dist/index.js` (173.1 KiB). The strict compiled consumer type check and 15 focused/version-sensitive scene probes passed. The consumer used a copied 2 × 2 RGBA8 image (16 bytes) and host-fed real browser pointer input.

- Before an area, transparent sample `(22,18)` and outside-paint sample `(25,20)` both showed magenta `[255,0,255,255]` and hit the underlying `Under` rectangle. After `setHitArea({x:-6,y:-6,width:12,height:12})`, both retained the same magenta pixel but hit `Sprite`. Their hit stacks began `Sprite,Under,Back`.
- After `setPivot(2,0)` and `setScale(-1,1)`, `(20,18)` and `(27,20)` remained magenta and hit `Sprite`. Painted `getWorldBounds()` changed from `{x:16,y:16,width:8,height:8}` to `{x:18,y:16,width:8,height:8}`; the interaction rectangle did not enlarge these bounds.
- A clipped sprite hit at `(47,20)` and fell through at `(51,20)`. A tiled sprite at `(66,21)` appeared once in `hitTestAll`. `setAlpha(0)` and `setHitMode('none')` each made the transparent point fall through. Restoring them returned the sprite hit.
- A negative-zero area edit returned `INVALID_SCENE` and retained handle data, pixels and hits. A separate renderer without the image returned `INVALID_ASSET`. An isolated nested-scale area whose composed corner exceeded ±1,000,000,000 returned `SCENE_LIMIT`. These refusals did not replace the accepted consumer frame.
- A real pointer at canvas CSS `(28,48)` mapped to logical `(20,18)` and delivered `Sprite:Sprite`, then `stage:Sprite`.
- Browser Save downloaded the actual 2,346-byte [v1 document](sprite-hit-area-document.json), SHA-256 `f0ef2c635ed460828cac3dd9f4da1fded5bccbe13aefc8f0e5fb1195dd9f92a9`. Reload and file chooser Open created generation 2 with a fresh canvas, renderer and display tree. The restored area, negative scale, pivot, 16 asset bytes, pixels, hits, clipping and tiled one-ID route matched. `setHitArea(null)` on the restored handle returned transparent and outside-paint points to sampled-alpha fallthrough while pixels and bounds stayed fixed.

The browser console had no errors or warnings. [Scene screenshot](scene.png) records the fixed consumer canvas after the fresh Open flow.
