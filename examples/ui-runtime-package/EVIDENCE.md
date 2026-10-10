# #1368 native evidence

- Parent: `be10f2ecca04800b0d344dc93a855e74d04fc305` (actual Integration HEAD at claim).
- Branch: `codex/ui-runtime-1368`; owned paths only `packages/barocss-ui-runtime/**` and `examples/ui-runtime-package/**`.
- Compiler dependency: exact local native commit `8c551eaf31e192bc82a5095dded957fa68fe5eb6`, parent `be10f2ec`. Its emitted package consumer was read from its isolated checkout. It was not merged into this branch.
- Toolchain: Node 22.19.0; TypeScript from existing Integration `node_modules`; Chrome 155.0.8059.39 with existing `playwright-core` 1.58.0. New downloads: zero. Model/provider calls: zero.

## Build

`PATH=/Users/user/Library/pnpm/nodejs/22.19.0/bin:$PATH /Users/user/.barocss-ai/v3/integration/node_modules/.bin/tsc -p packages/barocss-ui-runtime/tsconfig.json`

Result: passed; emitted `dist/index.js` and `dist/index.d.ts` (ignored build output). The package manifest points to those files.

## First failure and correction

The first authored-fixture browser run failed after three milestones. The driver waited for initial `Mina/2` when it started an error preview of the **same** module. The actual frame kept `Sujin/3`, as required. The original ignored report remains at `examples/ui-runtime-package/output/failure.json`. The driver now expects the retained state for that preview. The fixture server also closes its own keepalive connections at teardown. Corrected fixture flow passed.

## Authored fixture flow

`PLAYWRIGHT_CORE_DIR=/Users/user/.codex/visualizations/2026/10/06/495-note-native2-codec-tests-v1/dependency-before/playwright-core@1.58.0/node_modules/playwright-core RESULT_ROOT=examples/ui-runtime-package/output/final-fixture node examples/ui-runtime-package/flow.mjs`

Result: passed, six milestones, one Save callback, zero page errors. Counter/input/calculation, host hint preservation, final gating, wrong-window rejection, changed-module cancellation/recovery, source error, changed-module reset, blocked-script cancellation and disposal all ran. This stage uses **hand-authored** artifact/bridge bytes.

## Emitted compiler artifact composition

`UI_COMPILER_ENTRY=/Users/user/.codex/worktrees/ui-compiler-1367/barocss/examples/ui-compiler-package/.build/consumer.mjs UI_COMPILER_SOURCE=/Users/user/.codex/worktrees/ui-compiler-1367/barocss/examples/ui-compiler-package/app.jsx COMPOSED_ARTIFACTS=/Users/user/.codex/worktrees/ui-runtime-1368/barocss/examples/ui-runtime-package/output/composed/artifacts.json node examples/ui-runtime-package/compose-artifacts.mjs`

Base digest `27765ede184ade6ad761098057b1b50421998c213991e589ccc716d2d94c5421`, changed digest `4df208664bdb735a1c6ba3a8b89f8a81fe91f5191e9f99097fd109405aebaf4f`. Base bundle 614,060 bytes. Compiler versions: React 19.2.3, React DOM 19.2.3, esbuild 0.25.12.

`PLAYWRIGHT_CORE_DIR=/Users/user/.codex/visualizations/2026/10/06/495-note-native2-codec-tests-v1/dependency-before/playwright-core@1.58.0/node_modules/playwright-core COMPOSED_ARTIFACTS=/Users/user/.codex/worktrees/ui-runtime-1368/barocss/examples/ui-runtime-package/output/composed/artifacts.json RESULT_ROOT=examples/ui-runtime-package/output/final-composed node examples/ui-runtime-package/flow.mjs`

Result: passed, the same six milestones, one Save callback, zero page errors. This stage uses **actual emitted `@barocss/ui-compiler` artifact bytes** in the Runtime controller. The browser host supplied resource URLs and the frame document. No integrated Integration merge, production CSP, hostile JavaScript/CPU, model, mobile, persistence or release acceptance is claimed.
