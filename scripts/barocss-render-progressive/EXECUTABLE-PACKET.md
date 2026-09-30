# Executable four-turn preparation (#462)

This is an experiment host under `scripts`, not a new package. The private renderer stays in
`packages/barocss-render`. This implementation task starts no Codex app-server and consumes no model
turns. The original realtime UI goal remains open.

## Approval and exact candidate

After independent Review ACCEPT on the final launcher commit, the owner must give a **fresh explicit
GO** for that same commit and the unchanged #461 plan SHA-256:
`ff9df0ba9c16c08e13a087978009ab4d3dbb6ed031620a6461d9d27493684141`.
Neither Issue assignment, local integration nor a passing fake test is launch approval.

An authorized owner record must exist directly under `/Users/user/.barocss-ai/v3`, with a basename
starting `private-461-live-decision-`. The launcher reads it; it never creates a GO record. Example
shape (placeholders are not valid approval):

```json
{
  "kind": "barocss-461-live-decision-v1",
  "issue": 461,
  "launcherIssue": 462,
  "decision": "GO",
  "candidateCommit": "EXACT_REVIEW_ACCEPTED_40_HEX_COMMIT",
  "planSha256": "ff9df0ba9c16c08e13a087978009ab4d3dbb6ed031620a6461d9d27493684141",
  "maxNewTurns": 4,
  "ownerApprovalReference": "FRESH_OWNER_GO_REFERENCE",
  "reviewAcceptReference": "EXACT_COMMIT_REVIEW_ACCEPT_REFERENCE"
}
```

The record is an explicit local trust input. Its reference strings do not authenticate the owner or
fetch an approval from GitHub. Only the owner or an authorized operator may supply it. Keep it mode
0600. A canonical ledger is derived from the owner reference, exact commit and plan. An exclusive
`launch.json` claim is written before process initialization. Copied records cannot restart the same
decision. Each turn is reserved before `turn/start`; failure retains all reservations. There is no
retry, fallback or continuation command. #458's allowance remains exhausted.

## Runnable command (only after GO)

Run from the **clean reviewed task worktree at the accepted commit**, not the later merge commit.
The command derives HEAD itself and rejects dirty tracked or untracked files. It uses the pinned
absolute CLI, never a shell, and refuses a version other than Codex 0.156.1.

```sh
NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node
export REPO_DEPS_ROOT=/Users/user/.barocss-ai/v3/integration
export JR_ROOT=/Users/user/.barocss-ai/v3/wt/issue-446/scripts/json-render-446/scratch/jr
export PW_DIR=/Users/user/github/ai-based/abs/node_modules/.pnpm/playwright-core@1.60.0/node_modules/playwright-core
$NODE scripts/barocss-render-progressive/launcher.mjs \
  --decision /Users/user/.barocss-ai/v3/private-461-live-decision-OWNER_RECORD.json \
  --result /Users/user/.barocss-ai/v3/private-462-live-FRESH_RUN
```

Both referenced dependencies and Chromium must already be installed. No dependency is downloaded.
The result directory must be fresh. The launcher creates one owned stdio process, initializes it,
starts two distinct threads, and runs row 01 initial/save followed by row 03 initial/save. All four
requests use the frozen prompts and output schema, `gpt-6.1-sol`, high reasoning, read-only sandbox
and `never` approval. The save is accepted only after authoritative final completion.

## Settings and stop boundary

The installed app-server lacks `--ignore-user-config`. The launch profile therefore checks inherited
local configuration before spawning; unsafe inherited MCP, hooks, notification commands, custom
provider/instruction settings or uninspected configuration layers stop the command. It does not edit
user configuration, authentication, HOME or CODEX_HOME. Fixed CLI overrides disable known execution,
browser, connector, plugin and agent features. These are configuration controls, not proof of a
tool-free protocol. Any tool item or server request is rejected. Effective thread settings must match
the frozen model, reasoning and sandbox. Unknown events, rerouting, missing/full-item mismatch,
identity drift, malformed UTF-8/JSON, uncertain completion and timeouts stop the run.

Before the first turn reservation, the thread response must explicitly report `high` reasoning,
the `openai` provider (including nested thread provenance), `auto_review` approval reviewer,
matching working directories, and an empty `instructionSources` array. Missing, null or conflicting
metadata is not inferred from the request. Provider/reviewer are pinned in supported CLI and protocol
fields; accepted values are recorded in the private session evidence.

The TOML preflight uses the installed `/opt/homebrew/bin/python3.11` in isolated mode. Missing parser
support stops the launch; the launcher does not install a parser. Cloud-managed defaults cannot be
fully inspected through these local files. This remains an explicit limitation of the launch packet.

The preflight may prevent a live run on the current host. Do not remove a guard or copy credentials
to get past it. Record the blocker and obtain an approved launch environment separately.

Each turn is bounded by 180 seconds and 2,000,000 stdout bytes; the whole experiment by 720 seconds.
The transport also bounds lines, event count, total bytes and stderr. SIGINT/SIGTERM cancel the owned
turn. Cleanup sends an owned `turn/interrupt` when its identity is known, closes stdin and terminates
only the child it started. No completion is inferred from a process exit.

## Evidence and interpretation

Private mode-0600 files contain original stdout/stderr bytes, chunk offsets and monotonic receipt
times, request identities, scoped notifications, reservations, accepted actions, authoritative final
items and one record per completed turn. Browser reports and screenshot hashes cover 1200px and 390px.
Transport preview, action-ready and completion times are separate from actual host paint times.

The baseline renders the same authoritative final response through the same registered components
in a static root in the same session. It makes no extra model call. Reports require final equality,
content/styles, action gating and no overflow or external requests. A preview painted after final
receipt is **not early UI**. Missing early UI is a valid negative result. Summary timing statistics
state N, median and min–max. Fake/synthetic evidence is labelled and proves lifecycle correctness
only; no report automatically claims a latency advantage.

## No-model verification

```sh
NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node
$NODE scripts/barocss-render-progressive/freeze.mjs --verify
$NODE --test scripts/barocss-render-progressive/*.test.mjs
git diff --check
```

`launcher.test.mjs` starts only the authored `fake-app-server.mjs` with Node. `rpc.test.mjs` uses
caller-owned fake streams. `live-browser.test.mjs` replays authored notification lines in installed
Chromium. No test invokes Codex or consumes the live allowance.
