# Bounded URL image cache: native consumer observation

This observation belongs to #797's native branch. It is not a merged-head or release receipt.

Node 22.22.0 built the package's 129.5-KiB compiled entry. The independent `consumer/tsconfig.json` check passed against compiled declarations. `image-cache-probe.mjs` passed same-key concurrent/resident deduplication, copied bytes, fragment/query keys, LRU and byte/entry limits, a distinct in-flight request limit, failure retention, delete/clear/dispose cancellation, stale-result refusal, invalid input and disposal. The existing `image-url-probe.mjs` passed its 12 refusal paths and cancellation checks.

Headless Chromium 155 used the compiled package on `http://127.0.0.1:57014/packages/barocss-canvas2d/consumer/image-cache.html` with an actual WebGL2 context and same-origin HTTP PNG. The first `load` made one 98-byte PNG GET, stored 16 RGBA8 bytes, and drew a sprite. Repeating with a different URL fragment made no GET; changing the returned copy's first byte did not change cached or renderer bytes. Loading `?second=1` with a one-entry cache evicted the first URL. Loading the first URL again made the third GET. The browser's request list showed exactly these three PNG GETs. After refetch, `getCount=3`, `cacheSize=1`, `cacheBytes=16`.

At `(30,30)`, pixel/hit was red `[255,0,0,255]`/`Sprite`; `(70,30)` was transparent-image fallthrough yellow `[255,255,0,255]`/`Back`; `(30,70)` was blue `[0,0,255,255]`/`Sprite`; `(70,70)` was green `[0,255,0,255]`/`Sprite`. All 16 cached and renderer asset bytes matched the PNG decoder's expected values.

The browser downloaded the actual [746-byte v1 document](cache-document.json), then reloaded the page. A real file-chooser Open staged a fresh generation-2 canvas and renderer, disposed the cache, and restored the four pixels/hits and 16 renderer asset bytes with `getCount=0`. The [reopened screenshot](reopened.png) shows the visible 2×2 sprite and restored status. The final page console had zero messages. Browser and HTTP server were closed after capture.

This fixed same-origin PNG flow does not certify CDN behavior, broad browsers/devices, cache performance, or publication.
