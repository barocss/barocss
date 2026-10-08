# C2D-24 native URL image consumer observation

Date: 2026-10-08. Source branch: `codex/canvas2d-785`, exact parent `bf2e93d6d2159e3a1592e4db545a284af4f7076a`. This is native evidence; Integration has not recorded a merged-head result.

The package-local `image-url.html` consumer imported compiled `@barocss/canvas2d` and `@barocss/canvas2d/document`. Node 22.22.0 package build and independent `checkJs`/declaration type check passed. The injected-fetch `image-url-probe.mjs` checked exact GET/CORS/omitted-credentials/no-store request policy, copied bytes, twelve refusal cases, pre-fetch/read/decode abort paths and three bitmap closures. It also checked a misleading short `Content-Length` against the real streamed byte count.

Headless Chromium 155 on macOS supplied WebGL2. The local HTTP server served an actual [98-byte PNG](../image-decode/rgba2.png) with `image/png`. `loadImageURL` returned a 2×2, 16-byte RGBA8 asset: red, transparent, blue, green. After the host registered it, `(30,30)` was red/Sprite, `(70,30)` showed yellow/Back through the transparent source pixel, `(30,70)` was blue/Sprite and `(70,70)` was green/Sprite. `getImageAsset` returned all 16 expected bytes.

The same browser requested real HTML and received `UNSUPPORTED_FEATURE`; it requested the local 9-MiB PNG stream without a length header and received `ASSET_LIMIT`. In both cases the accepted Scene, registered asset bytes, four pixels/hits and generation stayed identical. The server's special oversized response is an example-only refusal fixture.

The browser downloaded the actual [738-byte v1 document](url-image-document.json). The live view then moved by 40 logical pixels, changing visible pixels/hits while retaining asset bytes. File chooser Open staged a fresh renderer/canvas at generation 2. All four original pixels/hits and all 16 asset bytes returned. The [screenshot](reopened.png) shows that state. The only browser console error was the static server's missing `/favicon.ico` (404).

This checks one same-origin Chromium/WebGL2 configuration. It does not prove cross-origin/CDN behavior, color equivalence across browsers, cache behavior outside this helper, publication or release.
