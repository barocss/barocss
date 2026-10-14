# #1392 coverage-area downsampling receipt

PASS for the frozen native implementation and one actual consumer flow. Integration and release acceptance are separate.

## Public helper

`downsampleImageAsset(asset,width,height)` prepares owned straight RGBA8 resources using the full source footprint. Both required output dimensions must be positive integers within the source dimensions. Complete source shape, data descriptors, four typed metadata guards and both dimensions precede budget checks and copies. Refusals use INVALID_ASSET or ASSET_LIMIT with getter0/typedalloc0 and no indexed pixel key scan.

The scalar integer coverage calculation averages alpha and encoded RGB×alpha, then rounds alpha and unpremultiplied RGB once, half-up. Shrinking alpha0 normalizes allRGBA0. Identity returns ONE independent exact source copy, including hiddenRGB. Input/output each fit1MiB; their conservative combined ceiling is2MiB; no pixel scratch/DOM/GPU is used. Strict reduction cannot attain exactly2MiB. The largest admitted witness4096×64→4095×64 used1048576+1048320=2096896 typed bytes; identity used one1048576-byte copy. Largest sums are below2^35. Existing resize/schema/renderer/document/Scene behavior remains unchanged.

## Executed build, types and independent probe

Node22.22.0 affected build FIRSTPASS308.9KiB. Common check and strict scoped actual sprite-sampling host plus explicit source/emitted public declarations passed first runs.

ONE paired source-bundle/emitted-root probe passed4,208,466 channel/assertion checks, largely full cap byte comparisons. Each entry executed46 small whole-byte cases and59 refusals, getter0/indexedpixelkeys0/refusaltypedalloc0. The independent BigInt oracle integrates common-coordinate microcells into source/output bins; it does not copy provider destination-overlap loops. Fixed4×2→1×1 and3→2 literals, arbitrary ratios/thin/two-axis shapes, mixed alpha, half ties, hiddenRGB identity/zero normalization, output ownership and cap full-byte constant witnesses passed.

The random seed is initialized once outside the entry loop. Each entry consumed a different sequential32-case corpus; both independently matched the oracle. Fixed cases/cap witnesses are shared. Identical-random-case source/compiled parity is not claimed. No successful probe rerun occurred; inert import proof is not claimed.

## One actual browser flow

Actual Chromium148, ANGLE/SwiftShader WebGL2; logical100×80/DPR2/backing200×160. Existing `sprite-sampling.html?area=1` reused; default sampling/Extrude controls and prior proof remain separate and were not replayed. The inline Atlas4×2 has two Blue,Red,Red,Blue rows; original Sprite40×30 at20,20/full4×2/nearest; yellow Back10,10/70×60.

All five frozen phases passed first execution:

1. ONE physical Downsample click yielded exact `[128,0,128,255]`/full1×1/newimageID Downsampled while preserving logical40×30 at20,20. Public copied tree/new renderer/registered resources were admitted before swap. The actual helper source copy and actual returned output were captured during that physical action; mutating source copy and output independently retained output and renderer-owned host cache as declared. Original32bytes stayed exact. The full128000 derived frame matched the independent literal purple/yellow/transparent oracle with maximum0; default striped frame also matched maximum0. Three trusted canvas clicks routed Sprite/Sprite/Back.
2. Real asset getter, malformed extent, enlargement, oversized-source plus malformed height, and valid oversized source refused before typed allocations/candidates/newcanvas/draw/read. Complete stable scene, tree, assets, IDs, frame, hits, canonical document, counters and identities stayed exact. Getter0. This is new area preflight evidence, not a replay of the old Invalid control correction.
3. ONE genuine JSON Save fully RETURNED complete=true/running=false/completed=true before a SEPARATE physical chooser/ONEupload. File.text1/inputchange1. Fresh generation3 canvas/tree/renderer retained Scene29, SamplingConsumer, Back/Sprite, explicit full1×1 crop, logical geometry, all4pixels and canonical file. All128000 frame channels matched the saved independently checked frame exactly. Preparation counter stayed1 on Open; missing original Atlas32 restored without replacing referenced Downsampled.
4. Public restored position8,0 and three more trusted canvas clicks passed. Full moved128000 frame matched the literal oracle with maximum0. ONE genuine PNG200×160 was publicly decoded with decodeImageBlob; all128000 premultiplied channels matched maximum0, bitmap.close1/dimensions0 and private2D0×0. Screenshot returned before Dispose; author and root inspected moved purple Sprite/yellow Back and generation3/preparation1/Open1/Save1/PNG1/bind3-unbind2.
5. API Dispose completed before page closure. One late physical canvas click did not change routes. Repeat Dispose is idempotent; controls are disabled. CPU preparation after Dispose still produced all4 expected bytes without DOM/GPU changes; postDispose canonical document exactly matched preDispose moved document.

Six accepted plus one late physical canvas clicks are distinct from each live tree's five bubble callbacks. Exact cleanup ledger scope is canvas pointerdown target/function/capture identities; other DOM control callbacks are disabled, not claimed removed.

## Genuine artifacts and native lifetime

- JSON933bytes; SHA256 `a8e9db23f44cee4060bf6b22b20f11c4738b58c6376df64fd51d3c06f2dce710`; native mtimeNS1791658180287790094.
- PNG1380bytes; SHA256 `ff77f4ee22c1d235205d154d1056e83b8e0408352656df65af767f89d6fc52a8`; native mtimeNS1791658260532358616.
- Phase0 startNS1791658165222940000. Each artifact had one native downloading and one downloaded event. Dedicated files are exact fresh native copies, not reconstructed bytes.

ALL four actual GL contexts were instrumented before module startup: default/Downsample/Open/PNG. Each shader4/program2/buffer3/VAO2/FBO0, textures respectively1/2/2/1, created=deleted/native is*live0/getError0/no loss BEFORE page closure. Exact three canvas callbacks ADD3/REMOVE3/active0/capturefalse. PNG private2D0×0 and bitmap.close1/dimensions0. Two download Blob URLs revoked once each; timer revocations settled before closure. Application/rejection/nativeGL errors0. Four ReadPixels stall warnings remain distinct.

Browserc2d1392 closed; server31392/PID84075 terminated, tool terminal exit143. Frozen322 source/host/config/docs hashes and driverSHA `662c251a3ae32ddabda518a74772ac4c986415104d63a04d9a02c44cc0805b07` stayed unchanged. All910 unowned baseline blobs and591 prior evidence blobs matched. Raw phase logs, exact native metadata and preparation logs stay under `/tmp/c2d1392-*`; repeated stage canonical strings are summarized offline by length/SHA only, while raw logs/final scene/file remain exact.

## First records and limits

A guessed author-freeze filename was absent during read-only lookup. The actual `/tmp/c2d1392-1394-author-freeze.md` was read fully before product code. Build/types/paired probe/browser phases had no functional first failure. No accepted replay, source/driver edit after acceptance, duplicate upload or excluded context occurred.

This is encoded-byte coverage-area preparation, not gamma/perceptual-quality/general GPU minification/mipmap chain/seam/device/context-loss/performance qualification. The v1 file stores current scene/prepared pixels, not the area recipe. No package installation/packed/release campaign ran. Broader current1254/674 integrated acceptance remains UNRUN. Root owns immutable sole commit/handoff/adoption.
