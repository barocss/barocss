# C2D106 / #1335 native padding receipt

Status: corrected same-page functional flow passed. The original frozen phase 1 driver assertion failed after the single accepted Pad and before Save. It assumed a flat Scene29 node list. The actual document stores Back and Sprite in Team.children. Preserve that failed assertion; this is not an all-first-pass browser claim. The root authorized an evidence-only continuation on the same page. It checked the three IDs recursively and ran only the remaining single Save. No Pad, pointer or refusal action was replayed. Source and approved driver remained unchanged.

## Source and gates

Parent `c07e56a2c8aba59f167aecc062eb6eefd4b3e2f9`, branch `codex/canvas2d-1335`. Contract Wiki `16c320e` and freeze `b765a11` / claim `6098635313` preceded implementation. No worker commit, publication or adoption.

`padImageAsset(asset, padding)` validates both complete ordinary records before budget checks or copies. Four own typed-array metadata names are checked; indexed pixel keys and irrelevant getters are not scanned. Integer margins 0..4096 add zero RGBA working space. Source bytes, including RGB under zero alpha, are exact. Valid dimensions above4096 or either payload above1MiB throw ASSET_LIMIT; malformed data throws INVALID_ASSET. Independent input/output typed pixel payload is at most2MiB.

Node22.22.0 affected library build passed, 272.3KiB bundle. Common actual-host checkJs and scoped source plus explicit compiled-root types passed. One paired source-bundle/emitted probe passed1180 assertions: each36 full-byte cases and85 refusals, getter0/indexedscan0/refusal typedallocation0, exact1MiB inputs/output and2MiB measured typed payload. No successful build/probe rerun. The first build attempt was a setup failure before the ignored runtime link was ready; it exited127 with esbuild unavailable. Initial host types had four TS2322 nullable-map/resolver errors. Both first failures and retry logs remain in the JSON and private logs. Probe static syntax failure was repaired before its first provider run and remains in focused.json.

## One actual flow

Chromium148, ANGLE SwiftShader WebGL2. Existing CropConsumer logical160×120, DPR2, backing320×240. Initial originalAtlas red control remains. One Pad original2×2 with `{top:1,right:2,bottom:0,left:1}` admitted a copied tree and fresh renderer before swap. Result `Padded`5×3/all60 literal RGBA bytes; Sprite80×80/full5×3crop, Back80×80 unchanged. Host getter copies and registration copies remained separate. Direct24-byte CPU check preserved hidden RGB.

The independent full-frame oracle uses logical pixel centres and named red/blue/green source regions over the yellow Back. Initial and moved framebuffer comparisons each cover307200 bytes; maximum difference0, fixed tolerance2. Four refusal attempts cover padding getter, asset getter, negative margin and valid oversized input. Each refused with getter0/typedallocation0/candidate0/drawread0. Accepted canvas/tree/renderer identities, full stable observations, assets, all framebuffer bytes and canonical document stayed exact.

Four accepted physical canvas clicks route Sprite/Back through Team and stage. The bubble log is10 callbacks; it is not10 clicks. After fresh Open, three more physical canvas clicks produce8 bubble callbacks. One physical late click after Dispose produces no additional callback. Total physical canvas clicks8: seven live and one late.

The single Save completely returned before the separate physical chooser click and CLI upload. Raw pre-upload boundary confirms phase1complete=true/running=false, generation2, Save1, native inputchange0/File.text0. The actual completed native download,1179 bytes, was copied to saved-document.json and compared exactly to canonical text. File SHA256 `2af922f0b868365b8968d8d8c9a4101bf0a1b0e435a5d3a0b6cc92797ae4a650`. One physical chooser/upload/inputchange/File.text restored fresh canvas/tree/renderer/context at generation3. Full60bytes/crop/IDs/context/file/frame were exact; paddingPreparations remained1. Open registered only the missing host Atlas default without replacing the loaded Padded file asset. Padded literal asset SHA256 `2f57712de4ff01ac4f1915a59aa980ca0f5899dad650503f0439dd08a4daf9be`.

The restored public position edit set Sprite to8,0. One actual PNG download2604 bytes was copied to exported.png; SHA256 `3f04d9fb1d08ae2b5bd3821ef63cb9e4a6407b9547aa102685bbd74618cb7d24`. Public decodeImageBlob returned320×240/all307200 bytes. Its independent premultiplied whole-frame comparison had maximum difference0. The private2D backing dimensions became0×0 and the one ImageBitmap closed once. Screenshot was inspected: red above blue/green over yellow Back, Exported PNG status and generation3, before Dispose.

## Lifetime and immutable proof

All four actual GL contexts are included: initial host, Pad candidate, fresh Open and PNG exporter. Per context native created/deleted shader4/program2/buffer3/vao2/fbo0; textures1/2/2/1. Every resource's deleted count equals created count and native is*live count is0 after public Dispose, before page closure. All GL errors0; no context loss. Exact target/callback/capture pointer identities add3/remove3/active0. Repeated Dispose, real late pointer and CPU padding after Dispose passed. CPU document serialization remains available. Controls/file input disabled. Diagnostic webglcontextlost listeners are separate from pointer cleanup; no generic competing-Open policy is claimed.

Frozen201 source/host/type/config hashes and approved driver SHA256 `88b887f1caaaa8a4be5ba359f1fee38bc4afbab56fffe288621e0518464c2857` are unchanged. All624 unowned baseline blobs, including427 prior evidence files, match the parent. The continuation exact code and SHA are embedded in browser-observations.json, with raw path `/tmp/c2d1335-phase1-continuation.js` and log. Reproduce the recorded flow with browser-flow.js phases0/1, retain its documented hierarchy assertion, execute only the embedded continuation, then perform the separate chooser/upload before unchanged phases2/3. Native Save and PNG download artifacts must be copied between phases as documented in the frozen driver. No accepted operation was repeated.

Window application errors0/unhandled rejections0/nativeGL errors0. The console retains one favicon404 and four readPixels stall warnings. They are distinct from the preserved fixture assertion. Browser sessionc2d1335 and server31335 closed after API resource cleanup. All private logs use `/tmp/c2d1335-*`.

## Limits

This is scoped native evidence. Sole Integration adoption and broad current-root1254/674 acceptance remain UNRUN. Existing crop diagnostic retention status is unchanged; prior1284 correction remains separately pending. No schema/tree/renderer/document changes, producer/pack campaign, performance/GC/process peak/context-loss/device parity, product push or release claim. Original native1324/1317/1283/1284/1285/985 evidence and deferred1032 were not replayed.
