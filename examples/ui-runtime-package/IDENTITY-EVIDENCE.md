# #1459 module identity with equal bundle bytes

Parent: local Integration `c93ede744525753b32a608e63ed20b25aedef394`.
Branch: `codex/ui-runtime-module-identity-1459`. Only the Runtime package and
example are edited. #1457 is a separate native iterator-cleanup delta.

## Emitted Compiler premise

Node 22.19.0 rebuilt the adopted #1422 Compiler and Runtime and staged the
emitted Compiler package with the existing Integration dependency lease. The
staged Compiler JS SHA256 was
`2bc106c5fa390a3a9874b0bb9d31b58a9a578b62953df3bf59c26b52edd3e5b4`.
`identity-artifacts.mjs` compiled the same authored JSX source with module IDs
`counter` and `other`. The two actual artifact bundles were byte-identical:
source digest `2ec9ee05fdf2d1c478808001e83ee9c8ca1a1590e4d6ca3ad234be90f7c85f3f`,
bundle digest `1b26d5a263ae439a61074f48aa2d60754ab3a964aa4500dcb5599e001e17e874`,
214234 bytes. CSS bytes matched. The ignored
`output/identity/artifacts.json` SHA256 is
`f30ea5fa4b6314f3ee03a662be3678527b09769d5f09c65e8ea3de099e6509e7`.

## First failure and correction

The first actual Chrome flow on the parent reused the same iframe instance
for `other` and retained edited `Sujin/count3` state from `counter`. Its
ignored `output/identity/failure-first.json` SHA256 is
`1aa235866b7bb6554da60ffcec0693d5ca6fafd8858df6880cae4808b9aa327e`.
Two test-oracle attempts also failed before the input state or newly mounted
frame state had arrived. They are retained as `failure-oracle.json` SHA256
`b95aa7f3505cf63bb183aa677a0af85b70fe5a50b69759e1f2f07763563a764c`
and `failure-state-wait.json` SHA256
`37c9ce2d92d67a2a209729f7d2e1afdfda8b9d75d45ddf72bb47c87a2257893a`.
The flow now waits for the bridge state before asserting either screen.

The one-line Runtime correction requires both `moduleId` and `bundleDigest`
to match for frame reuse. A different module ID uses the existing artifact
validation and fresh-frame path. The v0 artifact/record/bridge types remain
unchanged.

```sh
PATH=/Users/user/Library/pnpm/nodejs/22.19.0/bin:$PATH \
  NODE_PATH=/Users/user/.barocss-ai/v3/integration/node_modules \
  node packages/barocss-ui-compiler/build.mjs
PATH=/Users/user/Library/pnpm/nodejs/22.19.0/bin:$PATH \
  /Users/user/.barocss-ai/v3/integration/node_modules/.bin/tsc \
  -p packages/barocss-ui-runtime/tsconfig.json
PATH=/Users/user/Library/pnpm/nodejs/22.19.0/bin:$PATH \
  PUBLIC_DEPS_ROOT=/Users/user/.barocss-ai/v3/integration \
  PACKAGE_DEPS_ROOT=/Users/user/.barocss-ai/v3/integration \
  node examples/ui-compiler-package/stage.mjs
PATH=/Users/user/Library/pnpm/nodejs/22.19.0/bin:$PATH \
  UI_COMPILER_ENTRY=/Users/user/.codex/worktrees/ui-runtime-module-identity-1459/barocss/examples/ui-compiler-package/.build/consumer.mjs \
  UI_COMPILER_SOURCE=/Users/user/.codex/worktrees/ui-runtime-module-identity-1459/barocss/examples/ui-compiler-package/app.jsx \
  COMPOSED_ARTIFACTS=/Users/user/.codex/worktrees/ui-runtime-module-identity-1459/barocss/examples/ui-runtime-package/output/identity/artifacts.json \
  node examples/ui-runtime-package/identity-artifacts.mjs
PATH=/Users/user/Library/pnpm/nodejs/22.19.0/bin:$PATH \
  PLAYWRIGHT_CORE_DIR=/Users/user/.codex/visualizations/2026/10/06/495-note-native2-codec-tests-v1/dependency-before/playwright-core@1.58.0/node_modules/playwright-core \
  COMPOSED_ARTIFACTS=/Users/user/.codex/worktrees/ui-runtime-module-identity-1459/barocss/examples/ui-runtime-package/output/identity/artifacts.json \
  RESULT_ROOT=examples/ui-runtime-package/output/identity \
  node examples/ui-runtime-package/identity-flow.mjs
```

After the correction, the affected build and one Chrome 155.0.8059.39 flow
passed. Same-module/same-bundle preview retained the first edited state.
Different-module/same-bundle preview mounted a new iframe with `Mina/count2`
and Save disabled. Cancelling it restored the exact old `Sujin/count3` frame.
A later matching commit installed the new module and removed the old iframe.
Save callbacks carried `counter/Sujin3` and `other/Mina2`, respectively.
Three resource requests, two Save callbacks, zero source and page errors.

Corrected source SHA256:
`ac0979aef0ca870bed10ce3725d2c97aa62d2b17da104c1765cf89cae4446f85`.
Emitted Runtime JS SHA256:
`2964408e9dc33fcc1220984bf7134f39220a38ca550ae7df99e9695f91b065cb`.
Tracked `identity-artifacts.mjs` SHA256:
`a1621be977c31555d2c9f4d4e52572540df1ec0f3efcc49b205016b420b68b3a`.
Tracked `identity-flow.mjs` SHA256:
`d8478a99aecd7165e8ade1f8d444ec507f0e7faad7a95ff1f1d6f4472bab2c3d`.
Ignored `output/identity/report.json` SHA256:
`9849e0d6206ffd966e3ff4999ab79a61a7088b326c34e9be88d4e4ca89c69522`.

This is a bounded authored bridge host driven by actual emitted Compiler
artifacts. It does not qualify future CSS-only artifact changes, moving Root
#1254/#674, hostile-code/CPU, provider or publication behavior. No new
dependency download or model call occurred.
