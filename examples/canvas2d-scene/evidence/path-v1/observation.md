# Canvas2D #669 bounded path receipt

Date: 2026-10-08 (Asia/Seoul). Native parent: `59d87f79d8fe86e07c288f74a487161f73662535`. Browser session `canvas2d669` loaded the compiled public `dist/index.js` entry from `http://127.0.0.1:64593/examples/canvas2d-scene/`. The local server was stopped afterward. This is one prototype flow, not browser or hardware parity evidence.

## Build, file and first failures

- First affected build: `PATH=/Users/user/.nvm/versions/node/v22.22.0/bin:/Users/user/.barocss-ai/v3/integration/node_modules/.bin:$PATH pnpm --dir packages/barocss-canvas2d build:library` exited 2. TypeScript reported four `TS2339` errors at `src/path.ts:103-104`: `c1x/c1y/c2x/c2y` were not narrowed from a union that combined `M` and `L`. Separate `M` and `L` discriminants fixed that exact failure. The same build exited 0 after the fix and after the final public-type edit; `dist/index.js` was 34.1 KiB.
- `PATH=/Users/user/.nvm/versions/node/v22.22.0/bin:$PATH node examples/canvas2d-scene/probe.mjs` exited 0: v0 and v1 JSON round trips, exact v1 control value, unsupported version and v0 path refusal.
- The first browser console error was an optional `/favicon.ico` 404; the app and WebGL scene loaded. A stale Playwright element ref caused one `click e8` failure; a fresh snapshot gave `f1e8`, and Zoom In then passed. The first v1 file check compared raw `JSON.stringify` field order and reported false; a structural key-sorted comparison of the same Save/Open flow passed. No scene data was lost.

## Actual viewport and path observations

At DPR 2 and logical viewport 800×480, the v1 path `PathRibbon` used an asymmetric Q, C and Z. `getPathObservation` returned 52 accepted segments, 468 Float32 draw vertices, a closed subpath and maximum observed control-polygon deviation `0.967238066` device pixels at the default 1-pixel tolerance. The Q command's accepted `t=0.5` sample was world logical `(533.75,173.5)`. `hitTest` returned `PathRibbon`; `readPixels` returned RGBA `(240,20,89,255)`; `gl.getError()` was 0. The [screenshot](scene.png) shows the rendered stroke, bevel joins, clipping and visible Q/C handles.

An actual pointer drag moved Q control `(105,12)` to `(145,32)` without changing `PathRibbon` ID. Its `t=0.5` world sample moved to `(553.75,183.5)`. The old sample hit `VioletCard` and read `(131,82,225,255)`; the new sample hit `PathRibbon` and read `(240,20,89,255)`. The accepted path then had 48 segments. Zoom In changed view to `{panX:-100,panY:-60,zoom:1.25}` and retessellated to 54 segments with observed deviation `0.881099`.

After reload, `resize({width:800,height:480},dpr)` yielded segment counts 31, 52 and 62 at DPR 1, 2 and 4 respectively; each observed deviation remained below 1 device pixel. A nonuniform path transform `{scaleX:2,scaleY:0.5}` at DPR 4 returned 61 segments, sample `(637.5,134.25)` on the red stroke and `PathRibbon` hit. A generated sample at `(742.880859375,129.3408203125)` was outside FrameB's clip: hit `null`, transparent pixel `(0,0,0,0)`.

At DPR 4, an unknown `X` command returned `INVALID_SCENE`, 257 commands returned `SCENE_LIMIT`, and zoom 100 returned `INVALID_VIEW`. After each refusal, the accepted scene, view, segment count and sampled pixel were unchanged; `gl.getError()` stayed 0. Save/Reset/Open restored v1 path controls by structural comparison and no error. The v0 Save/Open flow restored version 0 with no path observation. The browser downloads are retained as [saved-v1.json](saved-v1.json) and [saved-v0.json](saved-v0.json); neither serializes DOM or renderer resources.
