# #1285 current-source cache callback admission

## Exact source and ownership

Frozen parent: `bb0177bc7d99897f4ea6a4e0e67a76ce642ee951`.
The [current-source amendment](https://github.com/barocss/barocss/issues/1285#issuecomment-6131760578) was read back in full before source edits.
Tested source: `0710509430b7675b7661aa5e32cbc4515dfb518e`, tree `92a1bd72d17bc103348f1671fd29cdb8cb902861`. Final edits change only this observation and `focused.json`; product/probe/types/config remain the exact tested blobs pinned there.

The product schedules the actual URL loader in one Promise microtask so the complete Pending/controller/cancellation/promise record exists before caller fetcher reentry. Public async Promise wrappers stay distinct; coalescing means one underlying fetch/decode and independent copied assets. Existing canonical keys, limits, LRU, errors and cleanup remain authoritative. A fetcher's nested same-key load must not become the return value it awaits to deliver its own response; that would create an application dependency cycle.

Historical native `e0c2181db41224972034e758ab2621481741bc0e` is unavailable in the current object store and public GitHub Git-commit lookup returned 404. Its narrative is provenance only, not source or executed proof. All three original cache evidence blobs and the old example probe remain unchanged, with hashes in `focused.json`.

## Actual finite checks, 2026-10-12

Independent source review preceded the one affected package build. Node 22.23.3, TypeScript 5.9.3 and esbuild 0.25.12 used a 1536 MiB Node heap and one Rayon thread. Package declarations/browser bundle, new scoped unchanged actual-host/source+emitted types, source-index bundle and both actual-public-root probes all passed on their first functional execution. All six subprocesses and the outer runner returned exit 0. Workspace free space stayed at least 546 MiB. Exact commands, source/probe/host hashes, bundle provenance and raw receipt hashes are recorded in `focused.json`.

Each public root passed exactly 40 `cache.load` calls across 11 scenarios, below the 48-call cap. Fixtures use literal 2×2/16-byte assets. The source bundle contains 41 actual package source files with `src/index.ts` as its entry; the emitted probe imports the just-built public `dist/index.js`. Strict types import the actual source and compiled entries, and check the unchanged cache host with source aliases.

The actual cache → URL loader → decoder chain used controlled caller fetch/Response and bitmap/canvas boundaries. The results establish CPU control flow and copy ownership, not network access, actual PNG decoding, rendering or GL behavior.

### Observed behavior per root

- Canonical same-key fetcher reentry shares one fetch/decode; different public Promise wrappers resolve independent copied assets. A distinct URL refuses with ASSET_LIMIT before a second fetch while that Pending fills maxEntries 1
- Callback delete/clear/dispose cancels both waiters with the same AbortError object, aborts the dispatched signal and cancels the late Response before reader/decode. Same-turn cancellation before the scheduled microtask makes zero fetch calls
- Failed fetch maps to the existing INVALID_ASSET; header and reader-release errors preserve their exposed identity. Cancellation cleanup rejection does not replace the intended failure. Refused candidates retain accepted resident pixels and accounting; same-key failure retry succeeds
- Immediate same-key replacement survives the old cancelled finally. Old late fetch and pending decode completion cannot remove the replacement Pending or overwrite its accepted resident
- 40 loads, 17 controlled fetches, 16 Responses, 11 reader acquisitions/releases, 9 decoder calls, 8 created/closed bitmaps and 8 scratch canvases ending at 0×0
- All 11 caches are disposed and verified through DISPOSED size/get access; unhandled rejections 0; both replaced global descriptors and the exact unhandled-rejection listener are restored

The deliberately thrown header getter precedes loader reader ownership. The probe explicitly drains that one unconsumed Response itself and labels it `headerResponseDrainedByHarness`; this is not claimed as URL-loader cleanup. One reader-release exception is injected only after the real lock release. Decoder rejection creates no bitmap, and pixel-read failure still closes the bitmap and zeros scratch dimensions through the real finally path.

## First records and reproduction

A pre-runtime static probe correction replaced intentional bitmap-close/scratch-reset exceptions with decoder rejection and pixel-read failures, so all-created-resources cleanup assertions remain literal. Initial probe blob `df0082089b05372083d97303912ea90a1003de8c` was preserved separately; neither version had runtime execution before this correction. No functional test/build/type failure or rerun occurred. Standard environment Node warnings are retained on separate stderr receipts, keeping probe stdout valid JSON.

From the repository root with existing Node 22 tools, run serially:

```sh
export NODE_OPTIONS=--max-old-space-size=1536 RAYON_NUM_THREADS=1
node node_modules/typescript/bin/tsc -p packages/barocss-canvas2d/tsconfig.json
node node_modules/esbuild/bin/esbuild packages/barocss-canvas2d/src/index.ts --bundle --format=esm --platform=browser --target=es2022 --outfile=packages/barocss-canvas2d/dist/index.js
node node_modules/typescript/bin/tsc -p packages/barocss-canvas2d/consumer/tsconfig.image-cache-reentry.json
node node_modules/esbuild/bin/esbuild packages/barocss-canvas2d/src/index.ts --bundle --format=esm --platform=node --target=node22 --outfile=/tmp/barocss-1285-source/index.mjs --metafile=/tmp/barocss-1285-source/metafile.json
BAROCSS_CACHE_MODULE=file:///tmp/barocss-1285-source/index.mjs node packages/barocss-canvas2d/consumer/evidence/image-cache-reentry/probe.mjs
node packages/barocss-canvas2d/consumer/evidence/image-cache-reentry/probe.mjs
```

The first two commands are the existing package build steps, invoked with explicit paths; there is no second package build. Keep stdout and stderr separate for machine-readable probe reports.

## Remaining issue gate

#1285 remains OPEN after software adoption for its original focused browser/GL pixels, hits and lifetime acceptance. No new physical file, browser, actual PNG decode or GL result is claimed; original file/PNG evidence and composed #1254/#674 remain separate. No remote-server-stop, broad performance or release claim follows.
