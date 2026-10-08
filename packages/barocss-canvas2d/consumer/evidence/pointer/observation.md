# Public pointer delivery compiled-consumer observation

Issue: https://github.com/barocss/barocss/issues/754. Native parent: locally integrated #753 `30b8a1bc3cf1c144cc8de46ffd11d6c2c28c4214`. This is Execute evidence before Integration.

Node 22.22.0 `pnpm --filter @barocss/canvas2d build:library` passed with public compiled JavaScript (101.6 KiB) and declarations. `tsc -p packages/barocss-canvas2d/consumer/tsconfig.json` passed for all three package-local consumers. `pointer-events-probe.mjs` passed target/Team/stage order, same-handle order, null-hit stage, idempotent unsubscribe, `stopPropagation`, route snapshot under detach, 32-listener limit, eight invalid/unsupported dispatch cases with zero callbacks, and new handles after reconstruction. The earlier `display-tree-reopen-probe.mjs` and `display-tree-probe.mjs` also passed. The first library build caught a misplaced duplicate `onPointer` property and missing sprite method; it was fixed. The first consumer type check caught string event-name inference (`TS2769`) and an untyped message (`TS7006`); fixed with a literal type list and JSDoc. The first browser `run-code` call used a snippet instead of the required function wrapper; the accepted flows used a function wrapper.

Opened `http://127.0.0.1:57020/packages/barocss-canvas2d/consumer/pointer.html` in Headless Chrome 155. The import map loaded only compiled `@barocss/canvas2d` and `/document` entries. WebGL2 backing size was 640×400 for a 320×200 logical canvas at DPR 2. One copied 2×2 RGBA8 asset had red, transparent, blue and green texels (16 bytes). Initial Team was at (40,50), Red at (0,0) and Blue at (-20,0) inside Team. Blue painted over Red. Actual readback/hit: (30,60) red/Blue; (50,60) red/Red because Blue's overlaid pixel was transparent; (70,60) transparent/null; (50,80) green/Blue.

Real browser pointer clicks at (30,60), (50,60) and (70,60) produced `pointerdown` delivery in these exact orders:

| Pixel | Delivery |
| --- | --- |
| Blue opaque (30,60) | Blue first listener, Blue second listener, Team, stage |
| Blue transparent over Red (50,60) | Red, Team, stage |
| Blank (70,60) | stage with null target |

Clicking **Stop after Blue** retained both Blue listeners and stopped Team/stage delivery. After turning it off and clicking **Unsubscribe Blue second listener**, another Blue click delivered Blue first, Team, stage. Moving Team to x=60 made (30,60) transparent/null and (50,60) red/Blue; a click at (50,60) delivered Blue, Team, stage. Putting Red at equal layer and re-adding it last changed the overlap click at (70,80) to Red, Team, stage. The page explicitly submitted each changed Scene before the next hit test.

The browser downloaded the actual 941-byte [v1 document](saved.json) from the initial tree. After Team move and Red reorder, the file chooser reopened that file. Open made a new canvas and new tree (generation 2), restored Team x=40 and Red/Blue child order, exact canonical Scene equality, original pixels/hits and all 16 asset bytes. A click at (30,60) then recorded only generation-2 Blue first, Blue second, Team and stage listeners; no generation-1 listener received that new-tree event. A direct stale `Detached` hit in the browser returned `INVALID_SCENE` and retained the exact observed tree, accepted Scene, pixels/hits, asset bytes and log. The [full-page screenshot](reopened-pointer.png) shows the reopened scene and event log.

The initial static server had a missing `/favicon.ico` request; after reload the browser console showed zero errors and warnings. This is one local browser/GPU/input run. It does not prove broad browser support, forged matching-ID provenance, automatic pointer capture, hover, event modes, ticker, frame rate or PixiJS parity.
