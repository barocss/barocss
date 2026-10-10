# C2D-79 native execution: two copied polygon masks

Exact parent: `343941b6f85efa08024dc79f9d0d1f2b3c93d13a` (#1025 local Integration merge). Branch: `codex/canvas2d-1054`. Native author execution; this is not an integrated-head acceptance, installation or release receipt.

## Executed

- Node22 affected library build: 223.9 KiB ESM. Strict source declarations, consumer checkJs and explicit compiled-root `types.mts` pass. Scene26 types are public, while source-default maps still require a TS transform tool.
- `focused-probe.mjs`: 37 expected refusals. Preserved Scene25 nested `UNSUPPORTED_FEATURE`, Scene26 third-depth `SCENE_LIMIT`, including hidden alpha0; old profiles, copied commands, CPU conjunction and child-first stack; conservative bounds, disjoint empty overlap, add/reparent/setMask/transform/view rollback, document reconstruction/restored edits, eight masks/256 points and SVG refusal. Uniform upload/capacity calls in this probe are isolated doubles, not GPU proof.
- Actual HeadlessChrome155/WebGL2, DPR2, 320×240 logical / 640×480 backing. `browser-observation.json` contains 17 stages. Initial 19 interior samples cover both/outer-only/inner-only/neither, transformed signed nonuniform pivot frame, green-blue nonzero path/hole, opaque/transparent glyph, sprite, stroke, group hit area and zero/one/two-mask following siblings. Six real pointerdown events include glyph-to-group bubbling.
- UI Remove/Restore each mask reveals the corresponding formerly rejected region. Disjoint overlap is legal. A hidden third mask on the fixed two-mask sibling chain reports `SCENE_LIMIT` and retains the accepted scene/pixels/hits.
- Actual Save downloads a 6346-byte v1 document. File chooser Open reads those bytes, creates a new canvas/renderer, preserves both mask command lists, all 14 IDs and all 448 atlas bytes. Sample pixels/hits match. The old canvas listener is removed. Restored Inner handle removal/reapplication returns the initial frame.
- Actual PNG download: 11162 bytes, 640×480. Browser `createImageBitmap` decode and 2D readback match all 19 initial samples. `exported.png` and `saved-document.json` are the actual downloaded files.
- Native WEBGL_lose_context loss and restore: accepted samples match after restoration. Dispose: rendererCreated3 / rendererDisposed3 / live0, binds11 / unbinds11; a later real pointer adds no event. The CLI upload resumed the physical-file flow and also delivered a second Open of the same file before the context controls. Both old renderers were disposed. PNG uses one separate document export canvas.
- `capability-observation.json`: actual reported fragment capacity1024, both programs link, conservative fragment layout common126 / image119 vectors. Each has 64 vec2 mask points + two counts and existing 16-entry clip arrays. Created/deleted shader4/program2/buffer3/VAO2 match, GL error0. A test-only reported127 injection on a real native context refuses `UNSUPPORTED_FEATURE` with shader0/program0. This injection is not a physical 127-vector GPU claim.
- Initial-through-PNG page warning/error capture is empty. The final CLI context/Dispose run reported no page errors. Restored screenshot was inspected.

## First failures and repairs

1. The first focused test sampled `(35,110)` on an inclusive contour boundary while expecting Back. It was moved to interior outside `(35,115)`. A second test expected SCENE_LIMIT for scale1e6, while existing schema correctly reports INVALID_SCENE. Corrected that expectation and added an independent Float32-collapse guard. No core change for either test repair.
2. A consumer type check while the helper was drafting the fixture found duplicate version26 comparison (TS2367) and unfinished getInner reference (TS2304 twice). The completed fixture fixes both. Final consumer check passes.
3. First compiled-root type fixture omitted required visible/alpha/hitMode on direct serialized group/frame values. The fixture now supplies them. Final compiled-root type check passes; library types did not change for this repair.
4. A browser driver attempted a Node fs dynamic import in the CLI VM, which lacks its callback. That driver did not run page assertions. Replaced it with browser-returned observations and physical download saveAs. CLI file chooser suspension was resolved with `upload` of the saved file. The resumed driver completed its assertions.
5. One read/document command used a wrong cwd or repo-relative path from package cwd. It failed before writing and was rerun with explicit repo cwd and login:false.

## Replay

Build the affected package under Node22. Serve this package directory and open `consumer/nested-mask.html`. `browser.playwright.js` runs the first phase; upload its actual saved document when the CLI exposes the chooser. Serve the downloaded PNG at the evidence path, then run `finish.playwright.js`. Capability uses a separate real canvas. Focused probe runs directly with Node22; `types.mts` is a strict NodeNext noEmit check.

## Limits

No claim of exact CPU/GPU raster boundary parity, minimum polygon intersection bounds, performance, Unicode, reference masks, Boolean geometry, filter/render-texture framework, packed/installed use or deployment. Scene25 retains its original nested refusal. Scene26 permits at most two inherited masks; total8/256 and existing depth16 remain. There is no new GPU resource category. Integrated-head screen/file/recovery checks remain separately tracked.
