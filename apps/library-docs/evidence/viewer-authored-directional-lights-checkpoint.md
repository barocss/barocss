# Viewer authored directional lights Manual checkpoint

- Scope: seven app-only paths under #1247; guide, Viewer API/examples/guides, sidebar, exact Markdown TypeScript checker and this checkpoint
- Frozen contract: https://github.com/barocss/barocss/issues/1247#issuecomment-6118283148
- API availability/source base: `78ff80606497875cf148c860e58a213b27dd0cf3`; base tree `403733ff1a658627ccef5939d223bed8aa8bf42f`
- Historical generated API, example and manifest catalog pins unchanged; the new guide pins its availability independently
- Existing software evidence reused: https://github.com/barocss/barocss/issues/1580#issuecomment-6117896054. Existing two-Surface example linked, not duplicated. No native/GPU/provider/browser test or rebuild was run for this increment
- Public-root recipe covers complete canonical CAD source and all TEN bindings, display aliases/full-pair material and selection joins, poses, raw materials/light signed originals, independent composition/CAD revisions, required WebGPU, async factory/replace/pick, UpdateResult refusal, late factory cleanup and explicit loss/remount boundary
- PASS: `node --max-old-space-size=2048 apps/library-docs/scripts/check-viewer-authored-directional-lights.mjs` extracts the exact single maintained Markdown block and strictly compiles against current public package source entries with noEmit. Public import allowlist enforced; no native runtime execution. Free disk before final check: 987205632 bytes
- Initial build FAILED: `NODE_OPTIONS=--max-old-space-size=2048 pnpm --filter @barocss/library-docs build` exited 137 (`Killed`) during VitePress client/server bundle construction after its existing large-chunk warning. Free disk admission: 1059479552 bytes. Failure preserved; no GPU/device claim follows
- PASS retry: `NODE_OPTIONS=--max-old-space-size=1536 pnpm --filter @barocss/library-docs build`, serial, completed in 21.43 seconds. Free disk admission 987201536 bytes; same existing large-chunk warning, successful client/server bundles and page rendering
- PASS: `node --max-old-space-size=1536 apps/library-docs/scripts/check-docs.mjs`: 115 pages, 731 internal links, 57 image assets, 4 downloads and 45 preset anchors. Manifest hashes matched. Free disk admission 977915904 bytes
- PASS: rendered guide route, API/example/guide links and sidebar label inspected in built HTML; `git diff --check`. Every admission exceeded the 500000000-byte floor
- Preserved external receipts: `/workspace/shared/viewer-lights-manual-compile-final.log`, `/workspace/shared/viewer-lights-manual-build.log` (initial failure), `/workspace/shared/viewer-lights-manual-build-retry.log`, `/workspace/shared/viewer-lights-manual-docs.log`
- Toolchain: pinned `/workspace/shared/barocss-toolchain/node_modules/node/bin/node` (Node 22.23.3) and matching pnpm; no dependency install or provider rebuild. Local ignored vitepress links supplied from existing installed dependencies
- Physical WGSL device compilation, colored-light pixels, physical picking, browser Save/Open and device-loss/remount UI remain externally owned **UNRUN**. Compile/build/link checks do not qualify those flows
- No package code, native fixtures, lockfile, publication, deployment or #660 body changes
