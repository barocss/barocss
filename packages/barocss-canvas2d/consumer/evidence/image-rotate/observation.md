# C2D98 exact quarter-turn image preparation (#1275)

Native parent: `6bd3376d6943a8d84b83ca62b0031a9ec8927bea`. Isolated branch: `codex/canvas2d-1275`. Contract Wiki `fb39cb6` preceded Issue1275; freeze Wiki `ee87e3c` and claim6097032598 preceded implementation. Native implementation is complete; local adoption and composed current-root validation remain separate.

## Result

The public synchronous `rotateImageAsset(asset, quarterTurns)` and `ImageQuarterTurns = 0 | 1 | 2 | 3` implement exact clockwise RGBA permutations. Identity copies independently; odd turns swap asset dimensions. Hidden RGB at alpha zero is retained. Descriptor and metadata guards run before copied typed payload. No DOM/GPU resources or automatic registration are used by this helper.

Node22 affected package build, common consumer checkJs, current capture host checkJs and explicit compiled/source public type checks passed. Independent matrix tuple transpose/reversed-row oracles checked all bytes in compiled-root and source-bundle tests: four turns, non-square/thin/1×1/4096×1 shapes, 64 random images, hidden alpha-zero color, identity/repeated/source copy isolation, malformed records/turns/metadata and getter-zero refusal. Every refusal made zero typed allocations. Exactly1MiB source and output were admitted; measured transient typed payload was two1MiB allocations, exactly2MiB. See `focused.json` and `probe.mjs`.

## One actual browser flow

Playwright CLI session `c2d1275`, server31275, Chromium148 WebGL2 ANGLE SwiftShader. The existing capture host was used once. Original64×32 logical source at DPR2 yielded128×64 and32768RGBA bytes, all equal to an independent source literal. ONE Rotate90 used the cached original and yielded64×128/all32768bytes, equal to the independent tuple permutation. The Sprite explicitly retained128×64 logical dimensions and full64×128 crop. A copied tree was admitted in a new renderer before the old canvas was swapped.

Full32768GL readback matched predefined independent display literals at tolerance2, maximum difference0. Frozen opaque blue/red, partial green and transparent points had the expected pixel hits. Five real pointer clicks produced three Sprite hits and two misses. Direct browser3×2/allfourturns matched every byte. Invalid turn, negative zero, asset accessor and valid oversized input refused with expected codes; getters0, draw/read deltas0, and accepted scene/tree/registeredbytes/file/pixels/hits stayed equal.

ONE Scene29 Save download, ONE physical file chooser and ONE upload restored fresh canvas/tree/renderer, retained contextID/assetID/SpriteID/fullcrop, all32768bytes, byte-for-byte serialized document and pixels/hits. Open did not run rotation, blur, shadow or resize again. Public `setPosition(8,0)` kept registered bytes and moved pixel/hit results. ONE PNG download was decoded through public `decodeImageBlob`; predefined opaque/partial/transparent samples matched independent premultiplied literals at tolerance2/max0. Screenshot was inspected and shows the moved rotated Sprite and all preserved controls.

Dispose plus a late real pointer produced no additional callback. All FIVE created GL contexts are included, including superseded renderers and PNG export. Every native resource kind has live0 and created=deleted; every context has native error0 and no context loss. Bind/unbind3/3. The pure CPU helper still produced all expected bytes after Dispose, with unchanged GL calls.

## First errors and limits

No build/type/probe/browser failure occurred and no pre-Rotate repair was needed. Four Chromium ReadPixels stall warnings were retained; JS errors/rejections0. Product source was unchanged after the first accepted Rotate. Prior capture/blur/shadow/resize controls and evidence are preserved.

A bounded root review arrived after the accepted Rotate. It requested removal of the extra typed-array own-key scan. The tested native retains that scan to preserve the frozen no-product-edits-after-acceptance constraint. It enumerates JS keys before ASSET_LIMIT and rejects extra typed-array properties beyond the frozen minimum. The2MiB claim covers typed payload only; JS descriptor/key storage and performance are unmeasured. This source concern is reported for explicit follow-up.

Existing public decoder backing cleanup remains pending under #1249. No decoder backing release, packed install, broad producer checks, performance/GC/context-loss campaign, integrated-root acceptance (#1254/#674), product push/PR/npm release is claimed. This native does not adopt the parallel crop native. Browser and server are closed after proof capture.
