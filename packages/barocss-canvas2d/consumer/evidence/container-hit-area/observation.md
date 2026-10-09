# C2D-56 container hit area: native consumer observation

Issue: [#921](https://github.com/barocss/barocss/issues/921). Base: verified local `develop` merge `d3b9498c5b8ea21ec3769a6a81f94c5ad1f51ed2` (#918). This is one fixed Chromium 155, WebGL2, DPR 2 run against the built public entries on 2026-10-09. It is not cross-browser certification.

Node 22 built `dist/index.js` (174.3 KiB). Strict compiled-consumer types and 16 focused/version-sensitive probes passed.

- Before the group area, empty-gap `(34,24)` was magenta `[255,0,255,255]` and hit `Lower,Back`. After `setHitArea({x:0,y:0,width:30,height:15})`, that same pixel was still magenta and hit `Group,Lower,Back`.
- Blue child `(22,22)` was blue `[0,0,255,255]` and hit `Blue,Group,Lower,Back`. Nested group's empty point `(32,32)` hit `Nested,Group,Lower,Back`. Painted child `Far` at `(62,22)` lay outside its parent's area and still hit `Far,Lower,Back`. The group's hit area added no painted bounds: before mirroring `getWorldBounds()` was `{x:20,y:20,width:45,height:8}` and the empty nested group's bounds were `null`.
- The group inside a frame hit at `(77,15)` and fell through to `Lower` at `(82,15)` outside the clip. A real browser pointer at canvas CSS `(34,24)` routed `Group:Group`, then `stage:Group`.
- With pivot `(5,0)` and X scale `-1`, the group-local gap mapped to `(11,24)`. It remained magenta and hit `Group,Lower,Back`. Alpha zero and `hitMode:'none'` each returned that point to `Lower,Back`; reset restored the group hit. At the blue child, alpha zero removed its blue paint and hit, while hitMode none kept blue paint but routed the hit to `Lower,Back`. A negative-zero area edit returned `INVALID_SCENE`. An isolated nested-scale area beyond the composed world limit returned `SCENE_LIMIT`; the accepted consumer frame remained intact.
- Browser Save downloaded the actual 2,282-byte [v1 document](container-hit-area-document.json), SHA-256 `8175924f3c0ae3db9b7e586591bec109e5d41acefde4405eea2593338db01740`. Reload and file chooser Open created generation 2 with a fresh canvas, renderer and display tree. The area, negative scale, pivot, gap pixel and hit, clipped group and bounds matched. `setHitArea(null)` on the restored handle returned the mirrored gap to `Lower,Back` while its magenta pixel and painted bounds stayed fixed.

The browser console had zero errors and zero warnings. [Scene screenshot](scene.png) records the fixed consumer after the fresh Open flow.
