# #1457 iterator cleanup recovery

Parent: local Integration `c93ede744525753b32a608e63ed20b25aedef394`.
Branch: `codex/ui-runtime-iterator-cleanup-1457`. Only the Runtime package
and its example are in scope. The committed v0 record and bridge contract did
not change.

## First Chrome failure

The original source SHA256 was
`15094fadb6159b52e08f9b8a79995a09d6f1cee0aeb43e8b2f2c487a7d995f19`.
The ignored `output/cleanup-repro.mjs` driver SHA256 is
`5815ba8111696447eebda051f4ada19527ed8ba36c59cb55a2bcb6de75dbdf1a`;
its preserved `output/cleanup-first.json` SHA256 is
`d54aa8c17228d6a84b36b2ecd5fca5f92cd7fc422eb527117cda396622920ca6`.
Chrome 155.0.8059.39 first committed `Mina/count2`, then began a pending
source whose iterator `return()` threw synchronously. `cancel()` threw,
`start()` rejected with the cleanup error, and the old committed iframe was
hidden with `phase: receiving` and `active: null`.

## Correction and bounded flow

Iterator cleanup is attempted once per ticket. A synchronous throw, rejected
promise or non-promise return cannot change the frame transition or admission
result. The earlier behavior of ignoring cleanup errors is preserved.

```sh
PATH=/Users/user/Library/pnpm/nodejs/22.19.0/bin:$PATH \
  /Users/user/.barocss-ai/v3/integration/node_modules/.bin/tsc \
  -p packages/barocss-ui-runtime/tsconfig.json
PATH=/Users/user/Library/pnpm/nodejs/22.19.0/bin:$PATH \
  PLAYWRIGHT_CORE_DIR=/Users/user/.codex/visualizations/2026/10/06/495-note-native2-codec-tests-v1/dependency-before/playwright-core@1.58.0/node_modules/playwright-core \
  RESULT_ROOT=examples/ui-runtime-package/output/cleanup-corrected \
  node examples/ui-runtime-package/cleanup-flow.mjs
```

Both commands passed. The actual Chrome flow committed and saved an edited
`Sujin/count3` frame. For throwing, rejected and non-promise iterator cleanup,
`cancel()` returned, each pending `start()` resolved false, cleanup ran once,
and the same iframe URL, instance ID, visible input and state were restored.
Replacing a pending source also settled false and cleaned it once. A later
valid changed module committed `Mina/count2` despite its own throwing cleanup,
then saved. Disposing a pending source settled false, cleaned it once and
removed owned frames. Save callbacks: 2. Page errors: 0.

Corrected source SHA256:
`b7b2c08b97c2521aee7e9b5519446d2705e47c361d3d0277124a38d7c938f462`.
Emitted Runtime JS SHA256:
`9e7566b08220753df0e7b4a2baf9c7bd5c131e87ad3eedb971aec858ea7b8ecf`.
Declaration SHA256:
`98e6e60b853785c6097896652e5b645478365da2c99b0b6862ec79eac2a6432f`.
Tracked flow SHA256:
`2e9de35c7ea9c5fb8f8a92bfbe9be6d471b35740119c9702101e8120b8807fac`.
Preserved ignored `output/cleanup-corrected/report.json` SHA256:
`cca41b04022df20d6cf7879a183122cf7a6eccdbaf0f210b18ce593339ff409e`.

This uses an authored bridge fixture to exercise source lifecycle before an
artifact is admitted. It does not prove whole currentRoot #1254/#674,
hostile-code/CPU isolation, provider behavior or publication. No new
dependency download or model call occurred.
