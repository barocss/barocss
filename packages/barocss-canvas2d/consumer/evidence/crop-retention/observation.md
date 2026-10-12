# #1284 current-source crop refusal status

## Exact source and unchanged contracts

[Current-source amendment](https://github.com/barocss/barocss/issues/1284#issuecomment-6132082998) was read back in full before code.
Frozen parent: `a05c412254de2a4a23acd4ccc07b0d293116c4c3`.
Tested source: `fc870063060003fb1526357cd89966bc187dabee`, tree `db2754ed3c238bea8ae68361ef36e3d2fcc5d4c7`. Final edits change only this observation and `focused.json`; host and probe keep their exact tested blobs.

Only the private synchronous retention comparison and its two existing handler call sites change. It excludes the contexts diagnostic field and preserves every other actual observation field. Full instrumentation remains visible; there is no async handler conversion or invented document field. Actual canonical document authority is independently checked with the public document provider in the CPU probe, outside both synchronous handlers.

Historical correction `0b12e83a8f36b1a8616ea295d128fc62304bdae0` is unavailable locally and public GitHub lookup returned 422. Its narrative is provenance only. The eight original image-crop and three sprite-crop evidence blobs remain byte-identical and pinned in `focused.json`.

## Actual bounded checks, 2026-10-12

Independent source review preceded execution. Existing strict `consumer/tsconfig.image-crop.json` checks the changed host and unchanged source/compiled-root type fixture. It passed with Node 22.23.3/TypeScript 5.9.3 and a 1536 MiB heap. The one actual extracted-host probe passed 19/19 assertion groups with exactly 24 evaluated calls: 22 comparator evaluations, including four inside the handlers, plus two synchronous handler invocations. Both subprocesses and the outer runner returned exit 0 on first functional execution. Workspace free space remained 536 MiB.

The probe AST-extracts eight actual function declarations: retentionKey, observe, active, pixel, show, invalid, outOfBounds and documentText. It records their source hashes and executes those bodies with real public tree/scene/document providers and explicitly controlled renderer/frame/status dependencies. Counter wrappers count actual comparator/control evaluations, rather than disguising extra work as a named group.

- Repeated actual observation changes only contexts diagnostics by five controlled sample reads; all other actual fields and canonical document text remain identical
- The comparator retains every actual key except contexts. Changed scene/tree, registry/asset/original bytes, sprite/crop, sample pixels/hits, pointer and lifetime/operation fields remain significant
- Actual public SpriteHandle validation makes Invalid return INVALID_SCENE synchronously and display `retained true`
- A controlled renderer refusal makes Out-of-bounds return INVALID_ASSET synchronously and display `retained true`; this is not actual WebGL admission evidence
- Both controls retain all observed non-context fields and the real canonical document, SHA256 `a18bed31b5bcdd1fe0f1b508d09d2025f9d83f6e2402084bd739be0077c79fbd`
- Real public tree position and owned asset-byte changes independently alter the key and actual canonical document. No document-only field is invented in observe()
- Each control causes three observations, 15 observation reads, 0 non-observation reads and 0 draws in the software fixture. Full contexts diagnostics remain visible; observation sampling is not attributed to the refused mutation

The probe restores no globals because it changes none. Its owned software fixture is closed and its registry cleared; public DisplayTree is pure retained data with no dispose API. It does not create native rendering resources.

## Reused public provider and reproduction

No package source/API changed and no new package build ran. Current package source tree and emitted public index/declaration hashes match the accepted #1285 build at `0710509430b7675b7661aa5e32cbc4515dfb518e`, adopted as `a05c412254de2a4a23acd4ccc07b0d293116c4c3`. The actual document module, all emitted files and unchanged scoped type inputs are hash-pinned before this run. The source reviewer independently checked provider/source parity. Full bindings and raw stdout/stderr/command hashes are in `focused.json`.

From this checkout with those already-built matching providers and Node 22:

```sh
export NODE_OPTIONS=--max-old-space-size=1536 RAYON_NUM_THREADS=1
node node_modules/typescript/bin/tsc -p packages/barocss-canvas2d/consumer/tsconfig.image-crop.json
node packages/barocss-canvas2d/consumer/evidence/crop-retention/probe.mjs
```

Do not point this probe at an unqualified stale package build. A clean environment needs the existing package build once before these commands; that is a reproduction prerequisite, not a build claimed by this run. No image-helper campaign, network, Extract/Save/Open/PNG workflow or new browser driver is involved.

## First records and remaining gate

Initial sparse preparation failed: switching branches removed the out-of-cone consumer directory, so the first materialization redirections and attempted edit failed. The shell continued to evidence preparation; its final exit 0 was not a materialization success. The preserved preparation receipt records the cause and recovery: create the owned directory, materialize exact HEAD files and apply the bounded patch with `set -e`, before any functional/type check. No functional failure or rerun occurred.

#1284 stays OPEN for physical refusal clicks, actual full-frame/hit/document behavior and GL-resource acceptance. This controlled software status proof is not a browser/file/PNG/device pass. Original evidence and composed #1254/#674 remain separate; no manual deployment or broad performance claim follows.
