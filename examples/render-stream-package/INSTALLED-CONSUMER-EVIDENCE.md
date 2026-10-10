# #1424 outside-workspace installed consumer

Exact clean native parent: `15210cce85f757e72485ac33df3f04144748f08d`. This task changes only this file and `installed-consumer-flow.mjs`. The Stream source and public manifest are unchanged. Integration adopted the preceding #1420 code separately as local `ebae6a1409467638b3c2aeaac7049991c368180e`.

## Reproduce

From the repository root with the existing offline pnpm store:

```sh
PATH=/Users/user/Library/pnpm/nodejs/22.19.0/bin:$PATH \
  RESULT_ROOT=/tmp/render-stream-1424-final2 \
  /Users/user/Library/pnpm/nodejs/22.19.0/bin/node \
  examples/render-stream-package/installed-consumer-flow.mjs
```

Use a fresh result directory for another run. The script builds Stream with Node 22, packs it from its package directory, and removes only package-local workspace links that it created. It packs clean tracked Render/Server/Kit publish manifests with the already emitted public `dist` files in temporary staging directories. Only the temporary Server manifest resolves its Kit `workspace:*` dependency to matching `0.12.0`. The Stream tarball itself resolves its Render/Server `workspace:*` dependencies through matching package-local links. The packed Stream tarball contains its public JS and declaration entries, README, license and manifest with Render/Server `0.12.0` dependencies.

The consumer is `/private/tmp/render-stream-1424-final2/consumer`, outside the repository. Its manifest names all four local tarballs, pins React `19.2.3`, jsdom `26.1.0`, TypeScript `5.9.3` and React types `19.2.14`, and overrides transitive Render/Server/Kit to those same local tarballs. `pnpm install --offline --ignore-scripts` passed. Real paths for Stream and all three BaroCSS dependencies resolve in this consumer's `.pnpm` store with `@file+` package IDs; none resolve to the source checkout or a registry package. No registry download occurred.

## Observed result

`report.json` at `/private/tmp/render-stream-1424-final2/report.json` records `status: passed`. From the installed tarball, the root, protocol, server and Fetch entries imported. Five authored JSONL input records reached the direct compiler through the server subpath. The Fetch subpath emitted two validated snapshots with one committed final admission. A raw duplicate `streamId` member was rejected before callback/final admission through the root API. The one TypeScript NodeNext declaration consumer passed. Input SHA256 `c196193120629c93a843de18406d52c6ca4ba8f10946350c83960754fdca0602`; output SHA256 `f12d7ea833b6c467846b9261d80aaa6742e7c8930ef595130a0204c96615d84e`; model calls `0`.

| Local tarball | SHA256 |
| --- | --- |
| Kit 0.12.0 | `163365f79a9d1912f04d85a70488981315e9a0ee515c24a2d9cff6f24a7a436d` |
| Render 0.12.0 | `301d63cc3804c26681d5da25a4c6a2edf1bb1867fda2da2f97bfb7b689a45cf6` |
| Server 0.12.0 | `36ded1af2ce8c4094d2e443094016de65fe36343bccf5c5ee3888f4045e49900` |
| Render Stream 0.12.0 | `28d9084f6d2eea38878b5bb41e73a3ed9bda184b711964fc0cb51f255318dfe4` |

Emitted Stream `dist/index.js` SHA256 `43059d124bf47917674b91b516e9bc014b5359cbf133801a2fa2b33b21e2f0fd`; declaration `226ef5c90bd0103de7ae1d991ce4fb9923b1c276593b12f03a427226d19e8f58`. Existing dependency lease public JS hashes: Kit `7e94f5100289b412611074ae2da51c2223ea705bd6b1b75436216cdcfec67410`, Render `a62ec1b3926383fc03f519192bc8142444060253e6d9d73ebad3c140999d8c2f`, Server `99c05368fe1f22f557fed0a7a452729d092f4a08601eac6a133ae59fc5f97385`. These dependency outputs were not freshly built by this task.

## First failures and limits

- System Node `18.10.0` could not run the installed pnpm. Node `22.19.0` passed. The first package-directory pack then stopped because Stream lacked package-local Render/Server links; temporary links let pnpm resolve `workspace:*` and pack the actual Stream package.
- The first offline consumer install completed, but its nested Stream dependencies resolved cached same-version registry packages. That cached Render lacked `getRenderSpecDefinition`, so the import failed. Pinning transitive dependencies to the local tarballs in the temporary consumer manifest made the dependency lease explicit and the installed flow passed. This does not establish compatibility with any currently published registry version.
- Three harness assertions were corrected: macOS canonicalizes `/tmp` to `/private/tmp`; bundled root and subpath functions need not be reference-equal; the authored Layout fixture needs a valid `gap`. These did not require a product edit.

This check covers one local offline install and authored API/type flow. It does not rerun the browser interaction, verify current integrated #1254/#674 acceptance, invoke a provider, publish npm packages, or qualify a release.
