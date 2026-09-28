# #460 reviewed continuation launch packet

**Status:** two reviewed live attempts each made one initial CLI dispatch. The first stopped on a collector startup diagnostic; its private evidence is `~/.barocss-ai/v3/private-460-run-Y9ch1k`. The second completed real model output, but the unchanged validator rejected `elements.save.props.on`; its private evidence is `~/.barocss-ai/v3/private-460-run-eS95yj`. Their durable claims remain untouched. Review recorded the second diagnosis at https://github.com/barocss/barocss/issues/460#issuecomment-5862580774. The explicit prompt revision below needs an exact new pre-live Review ACCEPT and a recorded Planner continuation decision before running `live.mjs`. No prompt-v2 run has occurred. The renewed corpus work in #458 is separate. Prior usage is **2 of 20**. This continuation permits at most two further dispatches, so the aggregate would be at most **4 of 20**; failed or timed-out dispatches count.

## Exact local flow

1. The browser submits the fixed request `Create a profile form`. The server starts one Codex CLI `exec` turn. The CLI returns an envelope with a complete `specJson` string. The server checks the envelope and the private renderer schema before revision 1 appears.
2. The browser enters `Bea` in the `/name` field and presses the registered `save` node, regardless of the model's allowed button label. The server accepts only action `save`, the current revision and that exact name. It resumes the same explicit CLI session ID for one next turn. The next complete screen must contain a Text node whose text is exactly `Bea` or `Name: Bea` before revision 2 appears.
3. The browser records one first-visible time and one action-to-next-visible time, screenshots, both accepted specs, errors and external request attempts. These are observations with sample count one, not production latency or a comparative speed claim.

There are no per-node or patch updates. A partial or invalid response is never rendered. A failed next turn leaves revision 1 and the entered name visible. Cancel aborts the started CLI process group; restart cannot add a third dispatch. Browser input cannot choose a CLI argument, path, model, action name or network destination.

## Fixed process boundary

- Installed CLI: `codex-cli 0.156.1`; model `gpt-6-sol`; reasoning `high`.
- Initial command starts `codex exec`. The second uses `codex exec resume <recorded-session-id>`. Both carry `--ignore-user-config`, `--strict-config`, `--json`, the same output schema, an isolated permission profile, disabled web search, empty MCP servers and disabled browser/plugin/agent features. `--ephemeral` is absent so the isolated session can resume. The installed CLI parses both exact argument lists with `--help`; this check invokes no model. The profile explicitly suppresses the unstable-feature warning while leaving `code_mode_host` disabled. The collector records the exact known pre-turn Code Mode notice as a diagnostic and still stops unknown diagnostics or any tool event. The prompt cohort is frozen as `profile-form-v2` with the SHA-256 of its full contract in every dispatch record. This version states that `Button.on` is a node field beside `props` and `children`, supplies a schema-valid Button example, and keeps the renderer schema unchanged. The previous model JSON remains an invalid v1 sample.
- `CODEX_HOME` is a new private directory with a symlink to the existing local CLI login. The scratch workspace contains only `home/` and `schema.json`; the CLI inherits only `HOME`, `CODEX_HOME`, a fixed `PATH`, `TERM`, `NO_COLOR` and `LANG`. No API key environment path is used.
- Ceiling: **2 total dispatches**, including failed starts. Per call: **180,000 ms**. Combined CLI time from first dispatch: **360,000 ms**. No retry or fallback model. A tool event, model/session drift, malformed event, oversized event stream, timeout or cancellation stops the process group.
- The loopback server requires a random session token and exact Origin for POST, validates Host, and serves only fixed local assets. In live mode it also rejects any request or name other than the two values above before a CLI dispatch.

## Private lineage and failure evidence

`live.mjs` verifies both previous durable claims and their one-dispatch/no-next evidence. It then atomically creates a distinct `private-460-live-claim-continuation-2.json` before a new `~/.barocss-ai/v3/private-460-run-*` directory. The new claim blocks replay and concurrent launches, even after an early failure; removing any claim requires a new owner decision. For each attempted turn the run saves fixed argv and environment key names, exact prompt and version/hash, bounded raw JSONL stdout and stderr, CLI final response, exit code, timing, session ID, stop reason, diagnostic codes and a bounded validation failure code. It also saves the first and next screenshots and `live-result.json` with accepted specs, browser observations and failure classification. The output directory is private; do not paste raw prompts, responses, diagnostics, credentials or private security reproductions into a public Issue. Invalid samples stay in this private lineage and are not repaired or dropped. A short safe summary can be posted after Review.

## Launch command after the gates

The operator creates a **new** private `private-460-approval-<id>.json` file under `~/.barocss-ai/v3/` with the exact reviewed task commit, original owner decision, specific continuation decision and new pre-live Review comment links. The original approval file is not reused. `live.mjs` rejects a dirty worktree, changed commit, widened input or ceiling, missing CLI login, changed CLI version, absent prior accounting and an existing continuation claim. This file records the decision; creating it does not grant authority by itself.

```json
{
  "kind": "barocss-460-prompt-v2-continuation",
  "issue": 460,
  "taskCommit": "<exact reviewed 40-hex task commit>",
  "ownerDecisionRef": "https://github.com/barocss/barocss/issues/460#issuecomment-<owner decision>",
  "continuationRef": "https://github.com/barocss/barocss/issues/460#issuecomment-<specific continuation decision>",
  "reviewUrl": "https://github.com/barocss/barocss/issues/460#issuecomment-<pre-live Review ACCEPT>",
  "prompt": "Create a profile form",
  "name": "Bea",
  "promptVersion": "profile-form-v2",
  "promptContractSha256": "e397a7a0becc33b49e0bbeea92544b4348fe9d1d711b38a865b30e9d4a59f235",
  "priorDispatches": 2,
  "aggregateCeiling": 20,
  "maxDispatches": 2,
  "perCallTimeoutMs": 180000,
  "totalTimeoutMs": 360000
}
```

```sh
export JR_ROOT=/Users/user/.barocss-ai/v3/wt/issue-446/scripts/json-render-446/scratch/jr
export PW_DIR=/Users/user/github/ai-based/abs/node_modules/.pnpm/playwright-core@1.60.0/node_modules/playwright-core
export REPO_DEPS_ROOT=/Users/user/.barocss-ai/v3/integration
/Users/user/Library/pnpm/nodejs/22.19.0/bin/node scripts/barocss-render-loop/live.mjs \
  --approval /Users/user/.barocss-ai/v3/private-460-approval-<id>.json
```

No `live.mjs` invocation has been made in preparing this packet. The no-model browser tests use `generateMockScreen` or a fake child process. After a bounded live run, independent Review must inspect the exact private lineage and saved browser evidence before local integration or Issue closure.
