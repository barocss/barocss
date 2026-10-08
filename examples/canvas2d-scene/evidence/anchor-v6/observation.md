# Canvas2D image anchor v6 observation

Issue: https://github.com/barocss/barocss/issues/741

Built with Node 22.22.0 using `pnpm --filter @barocss/canvas2d build:library` (TypeScript declarations and browser bundle, 90.5 KiB). `node examples/canvas2d-scene/anchor-probe.mjs` passed 12 missing/invalid anchor refusals, v5 anchor refusal, v6 nonzero path preservation, and a 789-byte v1 document parse with the exact 16-byte RGBA asset.

Opened `/examples/canvas2d-scene/anchor-v6.html` in Headless Chrome 155 with WebGL2. The logical canvas was 240×200 at DPR 2, so backing size was 480×400. The fixture used a 2×2 RGBA asset, an 80×40 destination, rotation +π/2, and anchor (0.5,0.5). Coordinates below are logical pixels. Values came from `gl.readPixels` and `hitTest` after real button clicks.

| Point | Center v6 RGBA / hit | Zero v6 RGBA / hit | Legacy v5 RGBA / hit |
| --- | --- | --- | --- |
| (110,50) | red / Sprite | white / Paper | white / Paper |
| (90,50) | blue / Sprite | white / Paper | white / Paper |
| (110,110) | white / Paper (transparent texel) | white / Paper | white / Paper |
| (90,110) | green / Sprite | red / Sprite | red / Sprite |
| (90,90) | green / Sprite | red / Sprite | red / Sprite |
| (70,90) | white / Paper | blue / Sprite | blue / Sprite |
| (90,150) | white / Paper | white / Paper (transparent texel) | white / Paper |
| (70,150) | white / Paper | green / Sprite | green / Sprite |

Red, blue, green, and white were exact `[255,0,0,255]`, `[0,0,255,255]`, `[0,255,0,255]`, and `[255,255,255,255]`. The zero-anchor v6 and legacy v5 observations matched at all eight points.

With v5 still accepted, the **Invalid anchor** button returned `INVALID_SCENE` for `anchorX:-0.1`; scene version and eight pixels/hits stayed v5. **Anchor in v5** also returned `INVALID_SCENE`; the accepted Sprite hit stayed present. After a reload at centered v6, invalid-anchor refusal kept the exact same canvas object, canonical scene, eight pixels/hits and 16 asset bytes. The browser downloaded the actual 789-byte [v1 document](anchor-v6-document.json) from the centered v6 scene. After switching to zero anchor, the file chooser opened that document on a fresh canvas. Generation changed from 1 to 2, one asset restored, and all centered pixels/hits matched the original. `dispose()` then made `render()` return `DISPOSED`. The [accepted screenshot](accepted.png) shows the reopened document.

One browser console 404 was the example server's missing `favicon.ico`; the module loaded and rendered. This is one fixed browser/GPU observation. It does not establish broad browser support, animation throughput, or exact behavior at shape boundaries.

`document-probe.mjs` and `nonzero-probe.mjs` passed against this build. `image-probe.mjs` fails at its first fixed asset-list assertion because shared `image-assets.mjs` now contains a third `GlyphHI` asset. The same failure reproduces in the #739 parent worktree; no v6 code runs before that assertion. This existing fixture mismatch is outside #741.
