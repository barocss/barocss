# Canvas2D #664 bounded prototype receipt

Date: 2026-10-08 (Asia/Seoul). Base: `16dd7c635025f3e3c8c6ccd154fa13987417f5fc`. Source is the package and example in this task branch. The browser loaded the compiled public `dist/index.js` entry from `http://127.0.0.1:54075/examples/canvas2d-scene/` in a separate Playwright session, `canvas2d664`.

## Commands and first failures

- `pnpm --dir packages/barocss-canvas2d build:library`: first attempt exited 1 before compilation because the shell had Node 18.10.0; pnpm required at least 18.12. The exact error was `ERROR: This version of pnpm requires at least Node.js v18.12`.
- `PATH=/Users/user/.nvm/versions/node/v22.22.0/bin:/Users/user/.barocss-ai/v3/integration/node_modules/.bin:$PATH pnpm --dir packages/barocss-canvas2d build:library`: exit 0, TypeScript declarations and ESM bundle produced. The same command exited 0 after the browser-driven fixes.
- `PATH=/Users/user/.nvm/versions/node/v22.22.0/bin:$PATH node examples/canvas2d-scene/probe.mjs`: exit 0; JSON v0, two frame IDs, 1,524 bytes, round trip and invalid cases.
- First browser load returned HTTP 404 because the example server did not map a directory URL to `index.html`. [The first browser console log](first-browser-failure.log) is retained. The server was fixed and the same URL returned the app.
- First `playwright-cli run-code` call exited 1 with `SyntaxError: Unexpected token 'const'` because that CLI needs a function argument. Retried the same Save/Open flow with `async (page) => { ... }` and it completed.

## Browser observations

At DPR 2, the canvas backing size was 1600×960 for an 800×480 logical viewport. `gl.getError()` was 0. The initial pixel and hit samples were:

| Logical point | RGBA readPixels | hitTest |
| --- | --- | --- |
| (80, 80) | (240, 245, 255, 255) | frame background |
| (120, 120) | (26, 97, 242, 255) | `BlueCard` |
| (200, 175) | (209, 97, 73, 255) | `OrangeCard` over blue |
| (390, 180) | (0, 0, 0, 0) | `null`, outside clipped FrameA |

The actual pointer moved `BlueCard` from local (35,45) to (65,65). The old viewport point (120,120) then hit `FrameA` and showed its background pixel; the new point (150,140) hit `BlueCard` and showed blue. Zoom In set zoom to 1.25; dragging empty space then set view `{panX:-80,panY:-45,zoom:1.25}`. The browser showed `Zoom 125% · 2 frames`.

Candidate scenes with an unknown field, rotated clip, fractional layer, and duplicate ID each raised `INVALID_SCENE`. After all four rejections, the accepted scene, view and sampled pixel were unchanged. Save JSON downloaded `canvas2d-scene.json`. Reset changed the scene. Opening the downloaded file restored `BlueCard` at (65,65) with no error. The saved file is retained as [dragged-scene.json](dragged-scene.json).

After the final build, a four-level scale-100 group fixture first returned `INVALID_SCENE` because the fixture reused one transform object, which the strict reader forbids. With distinct transform objects, the composed geometry exceeded ±1,000,000,000 and returned `SCENE_LIMIT`. The accepted scene and blue pixel stayed unchanged; `gl.getError()` remained 0.

After reload, `dispose()` followed by recreation kept the sampled blue pixel `(26,97,242,255)` and `BlueCard` hit. A point outside the viewport returned `null`. The `WEBGL_lose_context` extension caused `render()` to report `CONTEXT_LOST`; restoration returned the same pixel and hit, with `gl.isContextLost() === false`. See the [actual viewport screenshot](scene.png). This is a prototype flow, not browser or hardware parity evidence.
