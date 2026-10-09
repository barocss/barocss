# C2D-70 atlas game native observation

Contract: Wiki `0495e61`, Issue #994. Exact separately verified parent: `f217cd7060a22f44fcfa6612d701e5bf3e432942` (#976). Source scope is consumer composition only; pending #983 native is preserved.

## Executed compiled checks

- Node 22.22.0 package build passed: 198.0 KiB ESM.
- `node packages/barocss-canvas2d/consumer/evidence/game/probe.mjs` passed. It uses only compiled public exports and a manual host scheduler. First tick delta0; 5000ms elapsed capped to100ms advanced one frame. Resume restarted delta0. Pause was stable; explicit100ms step and frame0/pose reset passed. Atlas/sequence data were copied. Invalid crop returned INVALID_SCENE and retained actor; invalid atlas crop returned INVALID_ASSET. Unsubscribe/dispose produced zero subsequent host snapshot callbacks, including an already saved stale scheduler callback. These counts do not represent GPU renders. Probe reports GPU/browser untested.

## Actual browser flow — 2026-10-09

Actual isolated HeadlessChrome155/WebGL2 at localhost52994 used the compiled entry, a 320×200 CSS/logical canvas and640×400 backing (DPR2). Strict consumer checkJs/declaration consumption passed. Actual GET game-atlas.png returned200. The committed32×8 RGBA8 PNG is116bytes.

- Initial Red interior `[255,64,64,255]` hit Actor; transparent corner and Back `[32,40,56,255]` hit Back. Yellow token `[255,208,32,255]` hit its Token ID. Parent transform is x36/y28, scale1.1/.9, rotation.14.
- Actual Step button twice produced Blue frame1 `[64,128,255,255]` then Green frame2 `[64,224,128,255]`, ticker stopped and pendingFrames0. Reset restored actor(20,32), frame0, three tokens and score0.
- Actual Play button changed frame/color through native rAF callbacks. Actual Pause stopped scheduling; frameIndex and tickCallbacks stayed equal across200ms, pendingFrames0. This is behavior evidence, not an FPS benchmark.
- Actual mouse pressed actor center and moved outside the canvas: display capture Actor and DOM capture true, pointermove target Actor→World→stage while spatial hover left Actor. Bounded pose clamped244/142. Moving back to Token1 center and releasing collected it once; both captures returnednull/false. Repeating release over it kept score1. Actual subsequent drags collected Token2/Token3: score3, pickups3, all tokens hidden. No synthetic DOM events were dispatched.
- After Reset, actual transparent-corner click routed Back→stage for down/up; pixels remained background.
- Actual Reject crop button returned INVALID_SCENE/retained:true. Actual Reject missing asset button returned INVALID_ASSET/retained:true. Candidate cloned accepted Scene; source tree, accepted Scene and pixels were unchanged.
- Actual Dispose button while playing cancelled scheduling and detached listeners. After another actual canvas click and200ms, callback1175/submit1206/render1208/pointer37 counts remained fixed, pendingFrames0. Repeated host disposal only incremented disposeCalls.
- Separate actual HTTP decode runs used the documented1000ms host gate after decoded bytes, before renderer creation. Browser host API Dispose at that gate yielded loadsDecoded1/loadsIgnored1/rendererCreations0/submits0. Cancel at the gate likewise kept rendererCreations0; a new bounded load then reached ready with one renderer, one submit and one render. The gate is a host race reproducer, not an artificial network success.
- The isolated accepted page had zero browser errors/warnings. Screenshot `/tmp/canvas2d-994-game.png` was visually inspected. Compact numeric data are committed in browser-observations.json; private full CLI observations are under `/tmp/canvas2d-994-browser-observations.json` and `/tmp/canvas2d-994-cancel-observations.json`.

A first headed session showed unrelated existing input/play state; no source actor or cause was identified. It was discarded as a baseline and replaced by the isolated headless session above with initial counters0/one load and paused state. The older CLI skill's network command was unavailable; current requests command confirmed the PNG GET. Neither tooling event is claimed as a product failure.

## Rerun and limits

Build with Node22 and workspace tool binaries on PATH, then run `tsc -p packages/barocss-canvas2d/consumer/tsconfig.json` and `node packages/barocss-canvas2d/consumer/evidence/game/probe.mjs`. Serve the worktree root over HTTP and open consumer/game.html. Use actual controls and pointer input; `window.game.observe()` gives read-only state/counters/coordinates and `probe(point)` samples real pixels/hits. `?delayMS=1000` holds decoded bytes for the late-result check.

This consumer adds no core/schema/API and no document/SVG export. Score, token rules and scheduler are host state. No Physics, performance target, broad browser support, fresh npm-pack campaign or publication is claimed. Visibility-loss pause/capture release is source-reviewed; this run does not claim an executed browser visibility transition. Separate Integration adoption and merged-head affected type/browser acceptance remain required.

Atlas PNG SHA-256: `19789d0d5d7b1c4a9df7395fc621d2331791c52cfd78d79d71d85856e83d6b96`.
