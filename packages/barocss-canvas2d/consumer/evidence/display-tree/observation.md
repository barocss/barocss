# Public display tree compiled-consumer observation

Issue: https://github.com/barocss/barocss/issues/747. Native parent: locally integrated #741 `cd04d448df034170474ec59d24ad7094532ea94b`. This is Execute evidence before Integration.

Node 22.22.0 `pnpm --filter @barocss/canvas2d build:library` passed with public compiled JS (96.8 KiB) and declarations. `tsc -p packages/barocss-canvas2d/consumer/tsconfig.json` passed for both package-local consumers. `node examples/canvas2d-scene/display-tree-probe.mjs` passed: fresh snapshots are independent, nine bad or over-limit mutations refuse without changing the tree, and group move/anchor/opacity/layer/reorder emit Scene v6. The first type check failed at a JS array-inferred `addEventListener` tuple (`TS2769`); an explicit `Record<string, () => void>` action map fixed it. The first depth probe tried to accept 16 nested groups, but the existing validator checks each group's empty child array at the next level; 15 groups are accepted and the next refuses with `SCENE_LIMIT`. The probe now uses that accepted boundary. A first browser CLI `run-code` invocation had a syntax error; the observed flow used explicit Playwright clicks and reads.

Opened `http://127.0.0.1:57017/packages/barocss-canvas2d/consumer/display-tree.html` in Headless Chrome 155. The page import map resolved only compiled `@barocss/canvas2d` and `/document` entries; it did not import `src` or the repository scene example. WebGL2 backing size was 640×400 for a 320×200 logical canvas at DPR 2. One copied 2×2 RGBA8 asset contained opaque red, transparent, blue and green texels (16 bytes). The stage contained Team; Team contained Red and Blue sprite handles.

| Step | Exact browser sample and hit |
| --- | --- |
| Initial Team at (40,50), Blue layer 1 | (50,60) `[255,0,0,255]` / Red; (70,80) `[0,0,255,255]` / Blue; (90,80) `[0,255,0,255]` / Blue; (50,40) `[0,0,0,0]` / null |
| Move Team to x=60 | (50,60) transparent/null; (70,80) blue/Red; (90,80) blue/Blue; (110,80) green/Blue |
| Center Red anchor (0.5,0.5) | (50,40) red/Red; (70,80) transparent/null; (90,80) blue/Blue |
| Reset anchor and raise Red to layer 2 | (90,80) green/Red |
| Equal layer 1, original order Red then Blue | (90,80) blue/Blue |
| Remove and re-add Red, order Blue then Red | (90,80) green/Red |

The browser tried negative-zero anchor, detached self-cycle, duplicate attached ID and foreign-tree handle. All four returned `INVALID_SCENE`; the exact accepted Scene, tree snapshot, five pixel/hit samples, handle order and asset bytes stayed equal (`retained true`). The page downloaded an actual 940-byte [v1 document](display-tree-document.json) after the reorder. It then changed Red's anchor, causing (90,80) to become blue/Blue. The file chooser cold-opened the downloaded document on a new canvas: generation 2, Team/Blue/Red hierarchy and Red anchor 0 restored, (90,80) green/Red returned, all 16 asset bytes matched, and the old renderer returned `DISPOSED`. Final disposal also returned `DISPOSED`. The [accepted screenshot](accepted.png) shows the reopened scene.

The current facade does not rebuild handles from a document. After Open, the accepted renderer Scene differs from the original authoring tree; the example disables tree editing controls and asks the user to reload before authoring a new tree. This is a declared API limit, not a restored editable object graph. The first static-server console error was a missing `/favicon.ico`; there was no module-load failure. This one browser/GPU run does not establish a frame-rate target or broad browser support.
