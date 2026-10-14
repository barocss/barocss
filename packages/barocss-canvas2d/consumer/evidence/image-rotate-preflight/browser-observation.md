# #1283 corrected-source browser and WebGL2 acceptance

## Source and run

The tested checkout was `develop` commit `44633efff7658a308c0b7da96690665b7a3547cb`. The corrected helper blob was `b4aa09838065f1dcdaf1afb5e347a75aec7ff98f`. Its SHA-256 was `abb99164fd898c5608577ee1d6b74487023fe57d81ca8a8edbf548d3422d62f3`. Node 22.22.0 built `@barocss/canvas2d` from this checkout. The emitted public `dist/index.js` SHA-256 was `c524f535e5fb15f6021f290c09d1de60c7ea32298da4d3a78d2670c20b853c7a`.

One Playwright CLI session opened the existing `capture-image.html` host over a local HTTP server. The browser was Headless Chromium 155 with WebGL2 on ANGLE Metal, Apple M3 Max. The host SHA-256 was `3f28e10802f1efc0f45fa82517dc4850a0deadcc3004fac78840e843fee6b06f`. The session ran `browser-flow.js` once. The only later script edit changed its screenshot destination from the temporary checkout's absolute path to the equivalent repository-relative path; the browser assertions and product source did not change.

## Observed result

The emitted public helper rotated one literal 3×2 RGBA image through all four turns. All 24 bytes per turn matched independently listed source-pixel orders. Unrelated own string, symbol, hidden and accessor fields on the pixel array were accepted. The accessor was not read, and instrumented `Reflect.ownKeys` never received the pixel array.

The corrected 2×3 image was registered through the public renderer and displayed as one 60×48 Sprite. A full 128×64 WebGL2 readback matched the six independent premultiplied color cells and transparent remainder: 32,768 RGBA bytes, tolerance 2, maximum difference 0. Seven actual mouse clicks gave five Sprite hits and two misses. The checked points included opaque, partial-alpha, alpha-one and transparent pixels. The [screenshot](screenshot.png) was inspected.

An over-budget input returned `ASSET_LIMIT`. Asset and typed-array metadata accessors returned `INVALID_ASSET`. No accessor was read and no indexed pixel keys were enumerated. Each refusal preserved the accepted Scene, registered bytes, GL draw/read call counts, pixels and hits.

The host's Dispose control released both created WebGL2 contexts' resources. Both contexts reported native error 0, no context loss, zero live resources and matching created/deleted counts for every tracked resource kind. Listener bind/unbind counts were 1/1. A late real pointer event was ignored. The public CPU helper still returned the same bytes after Dispose without changing GL call counts. Browser console errors and warnings were both zero. Exact counts and hashes are in [browser-observations.json](browser-observations.json).

## Reproduce and limit

From this repository root, build `@barocss/canvas2d` with Node 22, serve the checkout over HTTP, and run the Playwright CLI against `packages/barocss-canvas2d/consumer/capture-image.html`. Then run `browser-flow.js` with `playwright-cli run-code --filename`. The script records one screenshot before Dispose.

This is the focused corrected-source browser gate for #1283. It does not rerun the original Save/Open/PNG flow or composed #1254/#674 acceptance. It checks normal GL resource disposal; it does not inject a context-loss event.
