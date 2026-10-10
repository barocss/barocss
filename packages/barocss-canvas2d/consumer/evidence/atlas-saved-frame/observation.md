# C2D102 saved named atlas frame — Issue #1296

## Recorded result

The original generation2 saved-frame flow passed its assertions. The aggregate browser run did not satisfy the intended one-upload limit: a Playwright fixture mistake caused a second accepted upload after the original flow disposed its renderer. Both uploads and all four actual GL contexts are preserved. No additional Pack/Save/Open flow or source repair was run. Root chose to retain the original acceptance with the unexpected upload addendum and to track the separate late-Open-after-Dispose gap.

Exact parent `934d7f03f7195b0523bb8d965081583c17d70e3a`, branch `codex/canvas2d-1296`, managed checkout `/Users/user/.codex/worktrees/canvas2d-atlas-reopen/barocss`. Contract Wiki7643114, freeze27ceb10 and claim6097302085 preceded code. Root reviewed host+README and source/compiled probes; affected build264.2KiB/commoncheckJs/scoped source-host plus explicit compiled-root types passed before browser GO. Host blob `68cfe02baa1136bd087629899a0560f9eb8d3860`; README blob232e13ba. This browser worker did not modify host/README/probe/types/dist, commit, Wiki or GitHub.

Three SHA256 product guards (host, consumer README and public index) were captured before the sole accepted host navigation and verified unchanged after all observed actions. Full hashes are in browser-observations.json. The product source did not change after the first accepted correction action.

## Original generation2 flow

Playwright CLI used Node22, sessionc2d1296 from `/tmp`, own Python HTTP server31296 and the frozen `/tmp/c2d1109-browser.json`. Chromium148/ANGLE SwiftShader/WebGL2; logical100x80/DPR2/backing200x160. Native GL context capture was installed before the only host navigation, and every observed native context matched the host's own resource instrumentation. No context was excluded.

Ten stages were recorded: manualDefaultRed, packedRed, goldBeforeSave, savedGoldScene29, physicalOneOpenGold, unknownCropRefusedRetainedGold, startFirstDeltaZeroGold, tick80WrapRed, realSpriteThenBackPointers, disposeLatePointer.

Pack called the actual public packer once. All100 host and renderer RGBA bytes matched an independent literal5x5 grid: RRRBB / RRRBB / 000BB / CMMMM / C0000, with R=[255,0,0,255], B=[0,0,255,255], C=[0,255,0,0], M=[255,0,255,128], 0=[0,0,0,0]. Red/Blue/Clear/Gold catalog crops matched independent literal rectangles. Gold(1,3,4,1) rendered [255,127,128,255] over the yellow background. Independent pixel-center geometry/color oracles compared the complete128000-byte framebuffer with tolerance2 frozen before execution; Gold and later Red both had maximumDifference0.

Save was clicked once. One physical chooser was opened. The original async snippet uploaded the1054-byte saved file and opened a fresh canvas/tree/renderer at generation2. Its complete canonical Scene29, SpriteAtlasConsumer context, Back/Sprite IDs, Gold crop, all100 bytes and full framebuffer matched the saved state. Canonical document serialization was exact. Controller state was paused frame3, and packCalls remained1. This reconstructs known catalog state from the current session; it does not persist elapsed animation time or encode catalog policy into documentv1.

A valid in-image crop(0,0,1,1), which is not a packed catalog frame, was submitted through openText. Its document passed staging and allocated the third context. The host rejected it with Error: Document does not contain the saved animation frame. The accepted canvas/tree/renderer identities, complete Scene/tree serialization, asset100bytes, full framebuffer, pixels/hits, canonical file, pausedframe3 and accepted catalog state remained identical. The rejected candidate's resources were all deleted.

Start followed by the existing controlled scheduler timestamp0 retained Gold/frame3; status was Tick0ms. Tick80 advanced to Red/frame0. This is controlled scheduler evidence, not actual RAF timing. Two real pointer clicks targeted Sprite and Back, yielding Sprite,stage,stage. The original Dispose stopped playing/ticker, removed both host pointer bindings (binds2/unbinds2), disposed every resource in all three original contexts, and a later canvas pointer did not raise pointerEvents beyond2.

## Fixture failure and additional actual state

The first run-code command returned at the file chooser modal while its asynchronous snippet remained alive. The snippet then performed its own chooser.setFiles and completed the original generation2 flow. I failed to inspect that async state before issuing a separate CLI upload on the same chooser. That upload caused a second accepted Open after original Dispose, producing generation3 and the fourth actual GL context. There was one physical chooser and one Save download, but TWO accepted uploads overall. The aggregate run must not be reported as one-upload PASS.

The host openText has no disposed guard and rebinds after a late accepted Open. Its dispose returns early when the global disposed flag is already true. This left a fresh late renderer/controller/binding. Root kept #1296's saved-crop source immutable and chose to track that concrete lifecycle gap in a separate correction.

Evidence-only cleanup used public pause followed by the current renderer.dispose. All four actual GL contexts then had created=deleted/live0/error0: shaders4/programs2/buffers3/VAOs2 per context, textures2/1/1/1, FBO0. Aggregate shader16/program8/buffer12/VAO8/texture5/FBO0. Original generation2 bind2/unbind2 is retained, while aggregate final binding counters are3/2. The extra private unbind closure and controller disposal were not public; no external callback-reference tracker was installed. Public pause stopped the extra controller/ticker, but full API binding/controller cleanup was not proved. Browser/page closure terminated the remaining runtime binding. This is page closure, not observed API unbind.

The original screenshot remains from the generation2 flow before Dispose. No second screenshot or corrected flow was taken. Final driver evidence now splits Save in phase1, the physical chooser/CLI upload between phases, and remaining assertions in phase2. That corrected fixture was NOT replayed. The initial executed script and final captured state remain under `/tmp/c2d1296-phase1.log`, `/tmp/c2d1296-initial-state.log` and browser-observations.json.

## Exact artifacts, failures and limits

saved-document.json:1054bytes, SHA256c00e318d8ee4d56d6082d5bc037197d3032184d4cc774939f2d0d5928316bb09. It contains v1/Scene29/Gold and asset digest8afaec87d39665abbd8df496780b535e99a143b9a6862ecace1e695750c231d3. Artifact hashes and every recorded stage/counter/resource population are in browser-observations.json.

Host first build lacked dependencies (ENOENT); Root repaired only an ignored dependency link before the successful build. The focused probe initially could not resolve esbuild before assertions; dependency setup was repaired before source/compiled probes passed. These sibling first records remain in their focused.json and build logs. The browser fixture duplicate upload described above is separate from source/selector assertion results. Runtime error events and unhandled rejections were[]; wholeCLI errors0, warnings4 native ReadPixels GPU-stall messages. Both browser and HTTP server are closed.

No PNG export replay, package campaign, source/provider redo, performance/GC/context-loss or publication evidence follows. Original1230/843 native proof stays separately attributed. Current composedRoot acceptance is UNRUN in1254 under674. The original one-upload intention remains in the frozen contract, and the different actual fixture boundary remains explicit here. Root owns the final native commit and sole serial handoff.
