# C2D-64 bounded miter joins: native observation

This branch starts from the separately verified #948 local `develop` merge `8942e5d815c3d2506d465c95697bbf49575f40d1`.

- Node 22 `pnpm --filter @barocss/canvas2d build:library` passed (189.7 KiB ESM). Strict compiled consumer type check passed. The focused `probe.mjs` covered Scene v20 compatibility, exact Scene v21 fields, public defaults, copied/restored values, shallow and sharp turns, reversal, closed seam, dash cut versus continuous join, bevel fallback, invalid input and `SCENE_LIMIT`.
- Actual Chromium 155/WebGL2 at DPR 2: the miter tip `(53,37)` was blue `[0,0,255,255]` and hit `Miter`. The same point with limit 1 was gray `[64,64,64,255]` and hit `Back`; the core `(45,40)` stayed blue. A real pointer down on the tip routed `Miter:Miter`, `stage:Miter`; after limit 1 it routed `Back:Back`, `stage:Back`.
- The nonuniform transformed dashed path's tip `(107,31)` changed from blue/`Turned` to gray/`Back` with the limit edit. Its observed world bounds were `{x:82.90766906738281,y:8.907670780786756,width:23.862335205078125,height:30.226289943090197}`. Invalid limit 17 returned `INVALID_SCENE`; a valid but resource-rejected zoom 64 returned `SCENE_LIMIT`; both retained the observed frame. Browser warnings/errors: zero.
- Browser Save produced the committed 1,674-byte `document.json` (SHA-256 `14d27d7493d8ed7722a0c357c5500f9fd452783b660a03c87e32ebe5bc8a8bab`). File-input Open of that exact v1 Scene v21 file staged a fresh canvas/renderer/tree (generation 2), restored both tip pixels/hits and bounds, and a restored handle limit edit changed both tips to gray/`Back`.

Separate local `develop` merged-head acceptance remains pending. A fixed turn and transform do not prove broad vector accuracy or SVG compatibility.
