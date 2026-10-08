# SceneV4 glyph run observation

2026-10-08, Chromium via Playwright CLI, compiled `dist/index.js`, local scene server. One browser session. The server and browser were stopped after capture. The repository does not publish this package.

## Build and schema

- Node 22 `pnpm --dir packages/barocss-canvas2d build:library`: exit 0, bundle 60.1 KiB.
- `node examples/canvas2d-scene/glyph-probe.mjs`: exit 0. v0–v4 canonical JSON round trips; unpaired surrogate, split scalar, fractional crop, empty range, 65 glyphs, and v3 glyph admission were refused.
- `git diff --check`: exit 0.

## Actual browser

- Initial status `v4 · Zoom 100% · DPR 1`; the `HI` atlas glyphs are visible in the second frame. [Screenshot](scene-v4.png).
- At viewport `(552,253)`, an opaque H pixel was `[20,32,56,255]` and hit `{id:"GlyphHI",kind:"glyphRun"}`. At transparent `(560,253)`, the underlying MintCard pixel was `[30,164,153,255]` and the hit was MintCard. I at `(598,253)` matched the glyph.
- Moving the run from local x=118 to x=138 moved the hit from `(552,253)` to `(572,253)`. With pan x=20 and zoom 0.8, hit at `(477.6,202.4)` remained GlyphHI. A 0.2 radian rotation produced an opaque glyph hit and matching dark pixel near `(520.53,250.65)`.
- Moving the run near the right edge gave a glyph hit and dark pixel at `(729,253)` and no hit or color at `(731,253)` outside the frame clip.
- A bad text value returned `INVALID_SCENE`; an out-of-atlas source rectangle returned `INVALID_ASSET`. Both left the accepted v4 scene and the opaque H pixel unchanged.
- UI buttons opened v3, v2, v1, v0. Save JSON wrote [saved-v4.json](saved-v4.json); the Open JSON input restored v4 and the H hit. A first immediate assertion after `setInputFiles` saw v0 because the asynchronous file reader had not finished. Waiting for v4 state repaired that test timing issue.
- A fresh renderer rejected v4 without registered assets as `INVALID_ASSET`. Registering the host asset bundle admitted it; removal of the in-use GlyphHI atlas returned `ASSET_IN_USE`.
- The only page console error was an unrelated missing `favicon.ico` (404).

The browser observation is limited to this authored atlas and one Chromium session. The renderer does not shape text, load fonts, or implement editing semantics.
