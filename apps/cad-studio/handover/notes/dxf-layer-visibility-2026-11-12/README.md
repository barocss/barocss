# D730 — Refuse hidden DXF geometry before adoption

P0, rows 13 and 16. FEATURE qualification. Parent `3af2328a5fadc24f72afd47e0e6dc6d2a294e8a6`. [#2404](https://github.com/barocss/barocss/issues/2404).

The ASCII DXF profile and underlay readers audit the supported entities they consume. A negative layer color, globally frozen layer, or explicit invisible entity produces `DXF_UNSUPPORTED` with the affected layer, reason and counts. A malformed or ambiguous relevant definition produces `DXF_MALFORMED`. The existing draft admission returns before document commit. An unused hidden layer, a locked layer, a new-viewport freeze default and a nonplot layer preserve their existing import behavior. Legacy files without a layer table still read. POLYLINE keeps its VERTEX and SEQEND context. [Autodesk LAYER groups](https://help.autodesk.com/cloudhelp/2018/ENU/AutoCAD-DXF/files/GUID-D94802B0-8BE8-4AC9-8054-17197688AFDB.htm), [Autodesk common entity groups](https://help.autodesk.com/cloudhelp/2020/ENU/AutoCAD-DXF/files/GUID-3610039E-27D1-4E23-B6D3-7E60B22BB5BD.htm).

The underlay audit resolves layer 0 through the reached INSERT chain. An affected INSERT or supported child refuses the entire import. Reachable external blocks refuse before expansion. The reader never opens the external path. [Autodesk BLOCK definition](https://help.autodesk.com/cloudhelp/2020/ENU/AutoCAD-DXF/files/GUID-66D32572-005A-4E23-8B8B-8726E8C14302.htm), [Autodesk layer 0 behavior](https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-Core/files/GUID-25E9F20C-D146-426C-8815-37DF48D2D33F.htm).

## Qualification

- **FAIL (parent)** — Desktop Add drawing admitted all six hidden fixtures. Off, frozen and entity-invisible circles became sketch holes. A bundled Model evaluation of each resulting 3 mm extrude measured 562.3008881569228 mm³. The other three fixtures admitted hidden TEXT, ELLIPSE and an INSERT's LINE into the underlay. The baseline driver passed its six reproduction assertions over 793 frozen inputs.
- **PASS** — Current desktop Add drawing refused all six inputs with the expected layer and reason. The accepted draft, bodies, history and pending Redo stayed identical through all six. An unused off layer was accepted. A visible locked, new-viewport-default and nonplot control produced one region and one hole. Independent input arithmetic gives 200 mm² for the rectangle, 4π mm² for the hole and 600−12π mm³ for the 3 mm solid. The actual Studio solid measured 562.3008881569228 mm³. Undo, Redo, browser-project Save and fresh Open retained the exact document and body. Saved SHA-256 `76fcdf2f8abe6b19c6ec01cb221d739ffe8353c8d563355efff46d6874247e2b`. Ten desktop states over 794 frozen inputs.
- **PASS** — Model 32/32. The focused cases additionally verify both hidden layer flags together, two-circle counts, negative entity color, case-insensitive matching, malformed visibility, duplicate definitions, entity application metadata, legacy closed POLYLINE, nested layer-0 inheritance and an explicitly hidden child. Reached external definitions refuse and unused definitions remain compatible. D725 and D721 desktop replays passed nine and eight states. Studio 38/38, both type-checks, affected lint, driver syntax, production build and diff check passed. The four desktop runs had zero console errors, recorded page errors or downloads.
- **NOT_RUN** — Per-viewport or paper-space visibility, DWG, third-party reader execution, full suites and mobile. The shared admission has no new schema, layer UI or runtime dependency.

The literal fixture groups are in the browser driver. SHA-256 for the identical baseline and current cases:

| Fixture | SHA-256 |
| --- | --- |
| Off circle | `c401462cc07d963bdee54ac619c4659bbaf764657d911f0ff9678f28d3a4eeff` |
| Frozen circle | `ba7ff0b28a8bd49d7fc84d9d71b05f414edeef53371f971ea5460a157dec632e` |
| Invisible circle | `69ba498186e5fd1e3184d7ba3a03714664578e70aabe60b615aa0d6783d5b0b2` |
| Off TEXT | `c1c49a91b1dcb0666640eba4d4f8e9350d6f4b4804414b4db1f41c091617bab9` |
| Frozen ELLIPSE | `3ecff49a9ce33a409d94ae092178acee01bbcdd608fb3eefad2528b834044bbc` |
| Off INSERT | `8a8781e9253741333fc74c0ac502457b9de5b96252ec5d5504d05c0e5d9a618f` |

Node 22.19.0, existing desktop Chrome and Playwright. Run serially under the heavy gate and use an external evidence directory.

```sh
D730_SOURCE_FROZEN=1 node apps/cad-studio/test/dxf-visibility-browser.mjs "$EVIDENCE/baseline" --baseline
D730_SOURCE_FROZEN=1 node apps/cad-studio/test/dxf-visibility-browser.mjs "$EVIDENCE/studio"
D725_SOURCE_FROZEN=1 node apps/cad-studio/test/dxf-local-gap-browser.mjs "$EVIDENCE/d725-replay"
D721_SOURCE_FROZEN=1 node apps/cad-studio/test/reflected-dxf-text-browser.mjs "$EVIDENCE/d721-replay"
TEST_CONCURRENCY=2 pnpm --dir packages/barocss-cad-model test dxf drafts
TEST_CONCURRENCY=2 pnpm --dir apps/cad-studio test draft project-open-ownership
pnpm --dir packages/barocss-cad-model type-check
pnpm --dir apps/cad-studio type-check
pnpm exec eslint packages/barocss-cad-model/src/sketch/dxf{Read,Underlay,Visibility}.ts packages/barocss-cad-model/test/dxf-visibility.test.ts
node --check apps/cad-studio/test/dxf-visibility-browser.mjs
pnpm --dir apps/cad-studio exec vite build --outDir "$EVIDENCE/studio-dist"
git diff --check
```

Next D731 tests zero-chord DXF bulges because a nonfinite profile or underlay can corrupt the same admission boundary. [#2434](https://github.com/barocss/barocss/issues/2434). Initial scenarios remain 5/10. Whole CAD and core readiness remain **NOT_MEASURED**.
