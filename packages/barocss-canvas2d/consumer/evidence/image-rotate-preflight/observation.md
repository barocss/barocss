# #1283 current-source rotation preflight correction

## Provenance and limited claim

Frozen parent: `5d42e727510b398a8c20fde1c03a008b9dee5a4d`.
The dated amendment is [issue comment 6131379743](https://github.com/barocss/barocss/issues/1283#issuecomment-6131379743).
Tested source: `4f833a931ec8c538270fb5b352d3828a9e5cecad`, tree `5931d9f8375a49627d9963b1edf8dc846a880a9e`. Final edits change only this observation and `focused.json`; the product, READMEs and probe retain the tested blobs recorded there.

The reported historical native correction `71479903eab4370f20bd880b7d790069fb7d3b22` is unavailable in this repository and public GitHub lookup. Its narrative is retained provenance, not evidence that its source or checks ran here.

Product code removes only the four-line indexed pixel-key scan. Ordinary asset keys/descriptors, four own typed-array metadata descriptor guards, exact type/prototype/nonshared/extent rules, turns, budget and pixel mapping are retained. Unrelated own pixel fields no longer cause refusal. No general proxy-trap, timing, allocation-overhead or GC claim follows.

All eight original `../image-rotate/` evidence blobs remain unchanged and pinned to their original implementation. In particular, that historical probe's extra-field refusal expectation is not current corrected behavior and is not rerun as current acceptance.

## Actual finite verification, 2026-10-12

Independent source/probe review preceded the one package build. Node 22.23.3, TypeScript 5.9.3 and esbuild 0.25.12 used a 1536 MiB Node heap bound and one Rayon thread. The package build's declaration and browser-bundle stages, existing `consumer/tsconfig.image-rotate.json`, actual source-index bundle and both probe invocations all returned exit 0. Commands and exact receipt hashes are in `focused.json`. Workspace free space remained at least 571 MiB.

Each actual public root passed 84 rotation calls: 33 accepted and 51 refused, below the frozen maximum of 96. Each made 2,098,592 byte comparisons across literal non-square, thin, single-pixel, nonzero-offset, copy-isolation and one exact-budget fixture. Four clockwise turns and hidden RGB at zero alpha were covered without reusing the product coordinate formula in the oracle.

Both roots observed zero `Reflect.ownKeys` calls targeting original pixels, zero unrelated/asset/metadata getter reads, and zero typed constructions for all refusals. Metadata own values and accessors, malformed assets, wrong types/prototypes/extents, shared/detached buffers, invalid dimensions/turns and one correctly sized overbudget input were refused. The exactly 1 MiB nonidentity input produced exactly 1 MiB output through two typed constructions totaling 2 MiB. These are observed constructed-payload counters, not peak-heap or GC measurements.

Instrumentation wraps only the global constructor and `Reflect.ownKeys`, forwards native behavior and `newTarget`, and restores both complete global descriptors in nested `finally` blocks. Fixture/oracle allocations occur outside instrumentation. Both reports confirm restoration. The source bundle's 41 inputs are all actual `packages/barocss-canvas2d/src/` files; its public entry is `src/index.ts`. The emitted probe imports the package's actual `dist/index.js` from the just-completed build.

The outer runner's final summary failed after the six successful commands: an environment-injected Node warning preceded JSON in combined stdout/stderr, so parsing the entire log raised `SyntaxError`. That first failure is preserved. Receipt-only recovery read the sole JSON record from each original log and confirmed both passes; no product, probe, typecheck or build was rerun.

### Reproduction

From the repository root with the existing Node 22 toolchain, run these serially:

```sh
export NODE_OPTIONS=--max-old-space-size=1536 RAYON_NUM_THREADS=1
node node_modules/typescript/bin/tsc -p packages/barocss-canvas2d/tsconfig.json
node node_modules/esbuild/bin/esbuild packages/barocss-canvas2d/src/index.ts --bundle --format=esm --platform=browser --target=es2022 --outfile=packages/barocss-canvas2d/dist/index.js
node node_modules/typescript/bin/tsc -p packages/barocss-canvas2d/consumer/tsconfig.image-rotate.json
node node_modules/esbuild/bin/esbuild packages/barocss-canvas2d/src/index.ts --bundle --format=esm --platform=node --target=node22 --outfile=/tmp/barocss-1283-source/index.mjs --metafile=/tmp/barocss-1283-source/metafile.json
BAROCSS_ROTATE_MODULE=file:///tmp/barocss-1283-source/index.mjs node packages/barocss-canvas2d/consumer/evidence/image-rotate-preflight/probe.mjs
node packages/barocss-canvas2d/consumer/evidence/image-rotate-preflight/probe.mjs
```

The first two commands are the existing `build:library` steps, invoked with explicit paths; there is no additional package build. Each probe writes one JSON record to stdout; keep stderr separate when machine-parsing it.

## Deferred actual-device acceptance

The original focused browser/GL pixels, hits and resource lifetime gate is UNRUN for this corrected current source. Original Save/Open/PNG and historical correction reports are not a current GPU or browser pass. #1283 remains OPEN after this CPU software adoption; composed #1254/#674 acceptance remains separate.
