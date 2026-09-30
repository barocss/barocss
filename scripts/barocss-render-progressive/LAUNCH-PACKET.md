# #461 bounded live packet — preparation only

**Status:** No live dispatch is authorized by this packet. #458's 20-call allowance is exhausted.
The exact candidate commit needs independent Review ACCEPT. The owner must then record a fresh,
scoped launch decision. A later launcher must reject a missing or mismatched decision and reserve
each turn durably before starting it. `gate.mjs` implements that local precondition; it does not
create an approval or launch a model.

## Frozen inputs and limits

- Plan: `frozen-plan.json`, SHA-256
  `ff9df0ba9c16c08e13a087978009ab4d3dbb6ed031620a6461d9d27493684141`;
  verify with `node scripts/barocss-render-progressive/freeze.mjs --verify`.
- Installed local Codex: 0.156.1 app-server, stdio v2. Generated protocol bundle SHA-256:
  `995fc3b8f8c469f6787e8fc5be4038c4f31359025edd8480b862e83355f3bf3b`.
- Output schema SHA-256: `7909df65cc3b6025fe9de2ec1b204d3bd4cfcde0e8e7d74ab14905f8797f499c`.
  It requires exactly one `specJson` string. The shared screen contract SHA-256 is
  `1eb435bd1c80aa5ef591c38c986f189d4ee235c12ec61866ca06cee155543a8e`.
- Fixed model `gpt-6.1-sol`, reasoning effort `high`; `readOnly` tool sandbox,
  `approvalPolicy: never`, private scratch cwd. Prompt contract is the unchanged
  `profile-form-v2` builder in `scripts/barocss-render-loop/cli-profile.mjs`, SHA-256
  `e397a7a0becc33b49e0bbeea92544b4348fe9d1d711b38a865b30e9d4a59f235`.
- Two independent sessions, rows 01 and 03 of the frozen #458 plan. Each has one initial and one
  save/next turn with the exact name in `frozen-plan.json`: **four new turns maximum**, including
  failures or uncertain starts. Per-turn timeout 180,000 ms; total 720,000 ms. No retry, fallback,
  API call, tool call, package download, or public deployment.
- The existing #458 corpus is a read-only comparison baseline. Never charge a #461 turn to its
  exhausted allowance or modify its saved raw files.

## Proposed later procedure

1. Review the exact candidate commit, this plan hash, no-model browser evidence, and failure tests.
   Do not start app-server until Review returns ACCEPT and the owner records a fresh GO that names
   the commit, plan hash, four-turn ceiling, and Review record.
2. Create a new private decision file under `~/.barocss-ai/v3/`. `reserveApprovedTurn` derives one
   canonical private reservation ledger from the owner approval reference, candidate commit, and plan
   hash; the caller cannot select or reset its directory. The later launcher calls it before every
   `turn/start`. A failed start uses its
   reservation. Stop on a missing/mismatched approval, tool item, session or turn drift, event limit,
   timeout, malformed UTF-8/JSON-RPC, or uncertain completion. Never auto-retry.
3. Start each session through `thread/start`, then `turn/start` with the frozen prompt and output
   schema. For the second turn, use only the same returned thread ID and the host-owned save action.
   Capture process, thread, turn, and item IDs with monotonic timestamps. `turn/interrupt` is only
   for cancellation of an owned active turn.
4. Save raw stdout and final items privately. Hash the raw bytes, compare the authoritative
   `turn.items` final message with the accepted item, confirm turn integrity,
   parse the `specJson` envelope, and apply the shared validator. Replay the accepted screen in the
   browser at 1200 px and 390 px. Keep generation, parse/validation, render, first preview,
   first action-ready, and final completion times separate. Reject missing screenshots or content.
5. Report paired timing only against a same-session complete-response baseline with N and median
   (min–max). A zero or negative lead is a valid result. Do not infer latency gain from synthetic
   chunk pacing.

## Current reproducible checks

```sh
NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node
$NODE scripts/barocss-render-progressive/freeze.mjs --verify
JR_ROOT=/Users/user/.barocss-ai/v3/wt/issue-446/scripts/json-render-446/scratch/jr \
PW_DIR=/Users/user/github/ai-based/abs/node_modules/.pnpm/playwright-core@1.60.0/node_modules/playwright-core \
REPO_DEPS_ROOT=/Users/user/.barocss-ai/v3/integration \
$NODE --test scripts/barocss-render-progressive/*.test.mjs
```

Generate the installed schema independently into a fresh private directory with
`codex app-server generate-json-schema --out ABSOLUTE_PRIVATE_DIR`, then compare the v2 bundle
digest with the frozen value. This command does not call a model. The private saved-replay command
is:

```sh
JR_ROOT=/Users/user/.barocss-ai/v3/wt/issue-446/scripts/json-render-446/scratch/jr \
PW_DIR=/Users/user/github/ai-based/abs/node_modules/.pnpm/playwright-core@1.60.0/node_modules/playwright-core \
REPO_DEPS_ROOT=/Users/user/.barocss-ai/v3/integration \
$NODE scripts/barocss-render-progressive/browser-replay.mjs \
  --corpus /Users/user/.barocss-ai/v3/private-458-corpus-run-lLKv57 \
  --output /Users/user/.barocss-ai/v3/private-461-browser-replay-FRESH
```

Choose a new output directory for each run. The CLI rejects non-private paths and never dispatches
Codex. The report labels every notification as synthetic delivery and hashes the saved inputs and
screenshots.
