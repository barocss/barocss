# #1452 encoded RGB color-key native receipt

Status: **PASS for this bounded native flow**. Integration adoption and the broader #1254/#674 acceptance are not claimed. Parent: `c8a914debde531fcb78c225e4f1e637bf5d78894`. Branch: `codex/canvas2d-1452`.

The required public `applyImageColorKey(asset, key, tolerance)` preserves all RGB bytes and all nonmatched alpha bytes. It clears alpha only when each encoded RGB channel is within the inclusive tolerance. It does not estimate physical color distance or photo cutout quality. The existing `sprite-blend.html?key=1` host uses a 3×2 source and a separate keyed asset. The original Follower remains unchanged. The no-query default and controls remain in source; their full producer flow was not repeated.

## Executed source gates

Node 22.22.0 was used with the existing primary runtime through an ignored local symlink. No install or Git config change was made.

- Affected `pnpm --filter @barocss/canvas2d build:library`: exit0, 317.2KiB bundle; `/tmp/c2d1452-build.txt`.
- Current common TypeScript check: exit0; `/tmp/c2d1452-common-types.txt`.
- Scoped strict check of actual modified host and explicit source/emitted public types: exit0; `/tmp/c2d1452-scoped-types.txt`. Final scoped check after narrow candidate diagnostic cleanup: exit0; `/tmp/c2d1452-scoped-types-final.txt`.
- One successful paired source-bundle/emitted numerical probe: 1496 assertions. Each entry independently matches the same prebuilt interval-oracle corpus: 63 whole-byte cases and 81 refusals. Getter reads and indexed pixel-key scans are0. Every refusal has typed-allocation0. The exact4096×64 case measures two1MiB arrays, total2097152 bytes.

The interval oracle tests each channel against lower and upper bounds. The provider uses maximum absolute component distance. Cases include all eight inclusive ±5 corners, each ±6 channel miss, all256 matched and nonmatched alpha values, tolerance0/255, thin/nonsquare/random cases, hidden RGB, mutation isolation and full malformed-option precedence. The payload count excludes caller, renderer, host and process/GC storage.

## First records and review repairs

The first numerical probe exited1. A test default replaced an explicit missing required key with the valid test key. The test now uses argument count; the provider did not change. `/tmp/c2d1452-probe-first.txt` is retained. The repaired successful probe was not repeated.

Before browser navigation, source review required candidate routes and pointer callbacks to be prepared before active-scene transfer, with partial cleanup and explicit diagnostic removal even if construction/staging throws before assignment. Driver review required the repeated Dispose comparison to exclude only intentional hash diagnostics: canonical serialization uses real SHA digests. All hash records are still retained and settled. These were static repairs before acceptance, not runtime failures. The root index `.js` specifier was repaired before this lane built; this lane did not encounter the other lane's TS2835 error.

## One actual page and native files

Actual UA reports **HeadlessChrome148.0.0.0**. The CLI launch configured ANGLE SwiftShader and each observed context was obtained as `webgl2`. Installed browser versions are not substituted for the actual UA. Logical100×80, DPR2, backing200×160.

The approved driver `cf9115dfeb6a2a00dc4479d59f66b3a7cab90d17092dbc5e9700e00b526150d0` ran once in five returned phases. All12 recorded stages passed. No accepted action was replayed. One physical Key button returned the actual prepared asset. Its caller-owned pixels were mutated to222 without changing renderer snapshots, saved assets or the original Follower. Keyed alpha was exactly `[0,0,255,64,1,0]`; all24 RGB/alpha bytes and the separate original24 bytes were checked.

Four actual preparation refusals—asset getter, key getter, invalid tolerance and valid oversized input—retained the complete stable scene, tree, CPU assets, canonical document, identities, full frame and hits. Getter0, typed-allocation0, candidate-canvas0 and draw/read0 were measured before observation reads. Diagnostic observation reads remain visible in the ledger.

Save fully returned (`complete:true`, `running:false`, `completed:true`) before root file review and the separate physical chooser. The genuine1524-byte JSON is `saved-document.json`, SHA256 `81b50c0c7d8c38d0bdfccee323ca376b8ddb3177a9db589a7a972287c4351691`, native mtimeNS1791684818597944452, downloading/downloaded1/1. File.text and input-change were both0 at that boundary. Root then allowed one separate chooser and one upload. Fresh generation3 restored every Scene29 field, IDs/context/full crop and Atlas24+Keyed24 exactly. Open did not call the key helper. The document stores pixels, not an inferred key profile.

A public restored edit moved Main to8,0 while Follower stayed55,20. One public PNG download produced the genuine1508-byte `exported.png`, SHA256 `8b4a6a3339f4b84e2e2dfdcaeb848583a032e88824ac628c3ffecb79ffdf5aad`, mtimeNS1791684877175995232, events1/1. Root checked it before one public `decodeImageBlob` call. Initial, restored, moved and decoded-PNG comparisons each covered all128000 premultiplied bytes, including transparent outside the gray Back. Maximum difference was0 in each comparison. The oracle uses fixed literal tuples, logical pixel centres, nearest columns/rows and independent source-over arithmetic. CPU/file proof covers hidden RGB; PNG alpha0 hidden RGB parity is not claimed.

Eight accepted physical canvas clicks checked keyed holes, nonmatched pixels and the original Follower. One late physical click was inert after Dispose. Bubble-route log entries are counted separately from physical clicks. `screenshot.png` was returned and inspected by root before Dispose; it shows generation3, Key/Open/Save/PNG1 and binds3/unbinds2 before terminal cleanup.

## Terminal cleanup before page closure

All four contexts remain in the receipt: initial, keyed candidate, fresh Open and PNG export. Texture counts are1/2/2/2. Each created4 shaders,2 programs,3 buffers,2 VAOs and0 FBOs. All delete counts match; all native is* queries report live0, getError0 and no context loss before page closure.

All25 exact native callback identities were added once and removed once:3 canvas pointer callbacks,8 renderer context callbacks,4 host diagnostic context-lost callbacks and10 controls (9 buttons plus JSON change). The inherited facilities names `pointerAdded/Removed/Active` count all25 here; `callbackPopulation` gives the exact types. Private tree routes are separate source subscriptions, not DOM counts. Public pointer bind/unbind is3/3. Controls are disabled, late entry refuses before allocation and repeated Dispose is inert. CPU Atlas24/Keyed24 and the moved canonical document remain exact after Dispose.

The PNG decoder closed its one native ImageBitmap once and reset the one private2D scratch to0×0. Both download Blob URLs were revoked once and their timers settled before closure. Canonical CPU checks perform SHA digests; all hash records settled and no zero-crypto claim is made.

Runtime assertions, app errors, unhandled rejections and native GL errors are0. Four GPU ReadPixels stall warnings are retained in full. Browser `c2d1452` closed with exit0. The owned server PID59198 closed by SIGTERM, exit143; port31452 is absent. No source, driver or build-output edit followed the first accepted Key.

## Frozen source and retained proof

The before/after guard matches326 source/host/config SHA values and the approved driver exactly. All930 unowned baseline working blobs and538 prior evidence blobs match their original Git blobs. Common Git config SHA remains `3a063086a1bb05dec4a79002664d015604a80d6ce7e4628ac7873fb6cf500246`.

Private raw logs are `/tmp/c2d1452-phase0.log` through `phase4.log`; parsed final raw receipt is `/tmp/c2d1452-phase4-parsed.json`. Native file receipts are `/tmp/c2d1452-save-artifact.json` and `/tmp/c2d1452-png-artifact.json`. Source guards are `/tmp/c2d1452-source-before-browser.json` and `source-after-browser.json`. No worker commit, product push, release, integration acceptance, performance/GC or context-loss campaign was run.
