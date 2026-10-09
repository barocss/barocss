# C2D-51 native tiled sprite observation

Issue: [#900](https://github.com/barocss/barocss/issues/900). Contract: Wiki C2D-51, published before the Issue at `249f672`. Native base: separately verified #897 local `develop` merge `7ef1e68067750731e7af7223844099e1c0baa7e9`.

## Node and external package

- Node 22.22.0 `pnpm --filter @barocss/canvas2d build:library` passed with the root checkout's `tsc`/`esbuild` bins on `PATH`; final `dist/index.js` was 168.6 KiB.
- Strict `tsc -p packages/barocss-canvas2d/consumer/tsconfig.json --noEmit` passed. All 49 `examples/canvas2d-scene/*probe.mjs` probes passed, including `tiled-sprite-probe.mjs` with ten atomic refusals.
- Final `npm pack --offline --ignore-scripts` made a 105,650-byte archive. An external `/tmp/canvas2d-pack-900/external-final` project installed it offline with scripts disabled. Both public ESM exports ran; strict `check.mts` consumed `SceneV13`, `TilePattern`, `createDisplayTree` and the document adapter. The external document had Scene v13 and 779 bytes.

## Actual Chromium/WebGL2 consumer

- Headed Chrome 155.0.0.0, WebGL2, logical 32 × 24 canvas at DPR 2. The page was `consumer/tiled-sprite.html`, loaded from a local HTTP server. A 2 × 2 copied RGBA8 crop held opaque red, green and blue texels plus one transparent texel.
- At sprite size 5 × 4 and tile size 2 × 2 with zero offset, exact readback at logical `(4,4)`, `(5,4)`, `(6,4)` and partial right `(8,4)` was red, green, red, red. `(4,5)` showed the gray underlay `[64,64,64,255]`; `(5,5)` showed blue. The opaque stack was `[Floor,Back]`; the transparent stack was `[Back]`.
- Actual pointerdowns at the opaque and transparent points delivered `Floor → stage` and `Back → stage`. After resizing to 7 × 5, bottom partial `(4,8)` was red and hit identity stayed one `Floor` object.
- First seam check found an exact-boundary hit error: at world `(6,5.5)`, the new tile was transparent but the previous tile's inclusive right edge reported `Floor`; `(6.01,5.5)` correctly reported `Back`. Tiled hit admission now uses half-open cell edges. After rebuild and reload, both points report `Back`, while opaque boundary `(6,4.5)` reports `Floor`.
- A tile offset of `1` changed the first three cells to green, red, green. Offset `-1` produced the same first/next/partial readback. A `[0.5,1,1]` tint produced `[128,0,0,255]` at the first red cell in normal blend. Additive blend over the gray underlay produced `[191,64,64,255]`. A host frame clipped the sprite beyond world x=6: inside stayed red, outside became gray and hit `Back`; removing the frame restored red. An out-of-bounds crop returned `INVALID_ASSET` while the prior accepted red pixel remained.
- Browser Save downloaded the actual [1,005-byte v1 Scene v13 document](tiled-sprite-document.json). After page reload, the chooser Open created generation 2 with saved 7 × 5 size, tile offsets, all 16 RGBA8 asset bytes, exact sampled colors, and hit stacks. The restored handle changed offsetX from 0 to 1; first/next/repeated pixels changed to green/red/green. The [reopened and edited screenshot](reopened-edited.png) records the visible state. Browser console: zero errors and warnings.

This is native evidence. Integration must independently verify its own merged head before closing #900. Fractional-transform seam freedom, broad performance and cross-device parity were not measured.
