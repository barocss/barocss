# Example source-pin compatibility

Task: #1270. Docs task parent: `83d3ceede9b97df1ec6bbd4da7feab9757f0f75d`.
Source remains `5f5ad866205a21510ac69552e704cc162fa253b5`.

## Result and scope

The example bundler now keeps the matching workspace path, or materializes the fixed local Git source when the eight package manifests/src paths differ from the pin. The task-specific `BAROCSS_DOCS_FORCE_SOURCE_PIN=1` flag exercises materialization even when the workspace still matches.

Only `scripts/example-runtime.mjs`, `scripts/build-examples.mjs` and this receipt are the owned tracked change for this compatibility fix. Generated snapshots, package links, copied consumers and the generated browser bundle stay under the docs application's existing ignored cache/generated directories. The existing shared `scripts/snippets/node_modules/@barocss` workspace links remain unchanged during fallback; declaration/snippet extractors retain their normal workspace targets.

Snapshot packages: GPU, CAD, CAD interop, Canvas2D, Viewer, Physics, CAD Editor and Render Editor. Render is excluded. Archive paths are exactly each selected `package.json` and `src` tree. The cache is `docs/.vitepress/cache/source-pin/5f5ad866205a21510ac69552e704cc162fa253b5` within the app.

`git archive` uses the local fixed commit. Eight ordinary package links in the snapshot's own `node_modules/@barocss` point to the materialized packages. The selected standalone consumer is copied into that snapshot; its bare public root/subpath imports use the exact manifests with ordinary esbuild resolution. No package aliases, custom source condition, product source changes, dependency installation, root/lock mutation or network archive is involved. Existing root dependencies supply esbuild, TypeScript and optional external peers.

All 452 materialized manifest/src files are compared against the local Git blob IDs before cache use, including reuse. Every consumed own input is also checked against its pinned blob. Dist input, own source outside that snapshot or an absent pinned source path is refused. A modified/incomplete cache is refused; it is not trusted because a prior build produced it.

Fallback requires a standalone consumer with literal bare imports. Consumer-relative, absolute and file-URL imports are refused with an explicit message because copying a lone file would change their resolution. Computed dynamic imports/requires are also refused in fallback. Matching-workspace mode retains the original entry and ordinary relative resolution. This does not add a universal consumer directory/asset copier.

## Actual execution

Node: `v22.22.0`.

1. First runtime syntax check exited 0.
2. First forced snapshot browser bundle exited 0:
   - `BAROCSS_DOCS_FORCE_SOURCE_PIN=1 node apps/library-docs/scripts/build-examples.mjs`
   - sourceMode `pinned-git-snapshot`, forcedSnapshot `true`
   - eight manifests, 452 pinned files
   - 222 own source inputs, zero own dist inputs
   - bundle 206891 bytes
   - all materialized/consumed Git blobs matched
3. One forced snapshot CPU fixture executed through `bundleExample(...material.mjs,'node')` followed by evaluation of its emitted in-memory ESM bundle. First execution exited 0:
   - original public `@barocss/gpu` import, version `0.0.0`
   - `compileMeshMaterial` → `validateMeshMaterialIR` → `lowerMeshMaterial`
   - shader ID `wave`
   - uniform `timeSeconds`, float, min 0, max 2, default 0, lowered name `mat_u_0`
   - unsupported `unknown()` returned actual `SYNTAX` diagnostics
   - 222 own source inputs, zero own dist inputs
   - sourceMode `pinned-git-snapshot`; all 452 cached Git blobs and actual consumed inputs matched
   - drawing not executed
4. Builder syntax check exited 0. A normal matching-workspace visual bundle then exited 0:
   - sourceMode `matching-workspace`, forcedSnapshot `false`, sourceRoot `.`
   - 222 own source inputs, zero own dist inputs
   - bundle 206895 bytes
   - matching manifest/src Git diff and consumed Git blobs matched
5. One temporary ignored-cache consumer containing `import './unavailable.mjs'` refused before bundling with the explicit consumer-relative-import message. The temporary file was removed. This was an expected admission refusal, not a failed runtime fixture.
6. `git diff --check` passed.

No first failure or repair occurred in these selected compatibility executions. The earlier source drift refusal is the static behavior being replaced, not an executed current Root failure.

## Limits

The forced route proves exact local archive/materialization, ordinary public import resolution, source provenance and one meaningful GPU CPU operation. The workspace used here still matches the source pin; an actual later Integration Root build was not executed by this helper. Automatic selection on drift follows the actual package manifest/src Git diff condition. No product package was changed to simulate drift.

No other saved package CPU examples, package builds, browser/GL/pixel flows, emitted declaration checks, packed consumer or dependency-peer matrix were replayed for this fix. Existing UI/image receipts stay separate. Publication, external peer compatibility on future Roots and Integration acceptance remain separate.
