# #1413 bundle reproducibility receipt

Base: local Integration `74333e3d79781183224389676836941c7ef96c3f`. Branch: `codex/ui-compiler-cwd-1413`. The checkout is isolated and sparse to the Compiler package and its example.

The original #1367 compiler at fixed `c5e009d6` emitted two valid but different bundles for the same source, module ID and dependencies. From its checkout cwd, SHA256 was `27765ede184ade6ad761098057b1b50421998c213991e589ccc716d2d94c5421` (614060 bytes). From `/tmp/ui-runtime-c5e.vo6DIf`, SHA256 was `354f18d065d36b501d7a06f0c42f2b421673a773e4d7590b6902653a780903ed` (614220 bytes). Exactly 20 of 12,905 lines differed, all esbuild dependency module labels. CSS SHA256 was the same: `308cea3b811e10ed6e9e047cfb237e092c56bf4edc3f0285d8e484c3f5c57187`. Both original digests correctly hashed their bytes. This first mismatch is retained, not replaced by the corrected output.

With existing Node 22.19.0 and installed dependencies:

1. `node packages/barocss-ui-compiler/build.mjs` passed. Emitted JS SHA256: `9a4bcb229c0ac6a34c4216950dbac0d737cc449fbc1d47618dd3b0bd004f0369`. Declarations are unchanged.
2. `PUBLIC_DEPS_ROOT=/Users/user/.barocss-ai/v3/integration PACKAGE_DEPS_ROOT=/Users/user/.barocss-ai/v3/integration node examples/ui-compiler-package/stage.mjs` passed. Staged compiled public Render/Server/Kit entries retained the hashes in the original `EVIDENCE.md`.
3. `node examples/ui-compiler-package/cwd-repro.mjs` passed. It imported the emitted package from the checkout cwd and `/tmp`, then imported a relocated emitted package copy. All three outputs had identical bundle bytes and SHA256 `698e9e8b8b80c3ad164ba14f5f45a9b2c786c06f6683f60bf268e0c8dfc43b53` (613020 bytes), identical source SHA256 `2ec9ee05fdf2d1c478808001e83ee9c8ca1a1590e4d6ca3ad234be90f7c85f3f`, CSS SHA256 `308cea3b811e10ed6e9e047cfb237e092c56bf4edc3f0285d8e484c3f5c57187`, and React/ReactDOM 19.2.3 plus esbuild 0.25.12.
4. `PLAYWRIGHT_CORE_DIR=<installed playwright-core> node examples/ui-compiler-package/flow.mjs` passed in installed Chrome. The authored opaque-frame UI changed count 2 to 3, total 3600 to 5400 and name Min to Lee. Selected state was `{ "name": "Lee", "count": 3 }`; page errors were zero. Malformed JSX, foreign import and dynamic import were refused as before.

The fix pins esbuild's module-label anchor to the resolved React dependency root. It does not change the v0 artifact fields, bridge, CSS, component set or source bounds. This proves reproducibility for the three tested locations with one installed dependency lease, plus one independent browser flow. It does not prove reproducibility across different dependency layouts or versions, integrated Runtime admission, global #1254 acceptance or publication.
