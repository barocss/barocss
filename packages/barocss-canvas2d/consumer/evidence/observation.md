# C2D-14 compiled consumer observation

## Scope and commands

Native parent: local integrated `develop` at `ddd14f93285e96c1068a0089967a3fc0368ad4d1` (#710). Owned paths: `packages/barocss-canvas2d/**`. Node 22.22.0 used the workspace's existing compiler dependencies. From the repository root, `pnpm --filter @barocss/canvas2d build:library` passed and emitted the 90.0 KiB main bundle. `tsc -p packages/barocss-canvas2d/consumer/tsconfig.json` passed. TypeScript's resolver selected `dist/index.d.ts` and `dist/document.d.ts` for the two public package specifiers. The first local type-check run found an implicit-`any` `lastOldDisposeCode`; a `string | null` annotation fixed it, and the same check then passed. No dependency was downloaded.

`python3 -m http.server 57013 --bind 127.0.0.1` served `http://127.0.0.1:57013/packages/barocss-canvas2d/consumer/index.html`. Actual Playwright Chromium loaded `dist/index.js` and `dist/document.js` plus the latter's relative compiled modules. Browser: Headless Chrome 155.0.0.0 on macOS, ANGLE Metal Apple M3 Max. The console recorded only an unrelated `/favicon.ico` 404, zero warnings and no observed application error. The browser and server were closed.

## Actual file and canvas flow

The initial Scene v3 canvas backed 320×200 logical pixels at DPR2 (640×400). One `Paper` frame clipped a `Blue` rectangle and nearest-sampled `Stamp` image. `Stamp2` held exactly 16 top-to-bottom RGBA8 bytes: `[255,0,0,255, 0,0,0,0, 0,0,255,255, 0,255,0,255]`. The browser produced the following values before Save and after cold Open:

| Logical point | RGBA | Hit |
| --- | --- | --- |
| (30,30) | `[51,102,204,255]` | `Blue` / `rect` |
| (90,70) | `[255,0,0,255]` | `Stamp` / `image` |
| (130,70) | `[255,255,255,255]` | `Paper` / `frame` (transparent image texel) |
| (100,110) | `[0,0,255,255]` | `Stamp` / `image` |
| (300,180) | `[255,255,255,255]` | `Paper` / `frame` |

The Save button downloaded the actual 919-byte [v1 document](saved-document.json), with one `Stamp2` asset of 16 bytes. The Change button made (30,30) yellow `[255,255,0,255]` while keeping `Blue` as the hit. Uploading the downloaded file with the browser's file chooser produced a new canvas (generation 2) and restored the blue sample, all other pixels/hits, the original scene IDs, and the exact asset bytes. The old renderer returned `DISPOSED` after the swap.

The [corrupt fixture](corrupt-digest.json) changes only the saved asset's SHA-256 first character. Uploading that actual file returned `INVALID_ASSET`. The page retained the **same canvas DOM object**, generation 2, blue and image pixels/hits, Scene IDs and the 16 asset bytes. Final **Dispose** made a later `render()` return `DISPOSED`. The [screenshot](consumer.png) shows the accepted page after corrupt-file refusal. The consumer source imports only the two public package specifiers; it has no `src/` or `examples/canvas2d-scene/` import.

This proves one local compiled browser route and declaration check. It is not an npm, other-browser, color-managed output or general application-integration claim.
