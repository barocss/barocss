# #458 Codex CLI agent pilot run packet

This route tests an agent workflow using the installed Codex CLI and existing ChatGPT login. It does not use the OpenAI API route, an API key, a new download, or a provider fallback. The separate accepted API preparation is inactive history. The old frozen CLI hard block remains unchanged.

## Before any model call

1. Run `node --test scripts/json-render-458/*.test.mjs` with installed Node 22.19.0. Run `BARO_458_PROBE=1 node scripts/json-render-458/agent-boundary.test.mjs` in a host context that permits the no-model native sandbox probe. Record both results.
2. Run `node -e "import('./scripts/json-render-458/agent-freeze.mjs').then(m => console.log(m.verifyAgentFrozen()))"` and record the exact agent plan SHA-256.
3. Independent Review must post `ACCEPT` for the **exact clean task commit**, frozen agent plan, argv, startup context, evaluator isolation, evidence path, and this packet. A preparation-only acceptance or an acceptance for the old no-tool/API route is insufficient.
4. Use one fresh direct child path `/Users/user/.barocss-ai/v3/private-458/cli-run-<id>`. Create the private root with mode 0700 if absent. Write a mode-0600 local approval JSON in that root with `issue:458`, `decision:"ACCEPT"`, `agentPlanSha256`, `commit`, the Review Issue comment URL, and `outputDir` set to that exact fresh path. The local file records the independent verdict; it is not a substitute for Review's published verdict.
5. Invoke `node scripts/json-render-458/agent-run.mjs --output <fresh-output> --approval <approval-json>`. Do not call `agent-transport.mjs` directly or remove the reviewed gate.

The launch checks the exact clean commit and plan, ChatGPT login, CLI 0.156.1, scratch ancestry, and native permission profile before it creates a durable single-run claim. It then reserves each of at most 24 attempts before CLI dispatch. Each attempt uses a three-minute timeout; the whole run has a one-hour limit. Failed attempts count. There is no automatic retry or restart, including after a timeout or ambiguous result.

## Private failure diagnostics

For a new CLI attempt, the host saves the first CLI `item.*` error event (at most 32 KiB) and stderr (at most 64 KiB) in the private attempt directory. It writes these files before it removes the isolated CLI home. Both files and their hash summary are read-only for the owner; provenance checks their sizes, hashes, modes, and filtered error class. The filtered event ledger and public reports contain only the error class. The collector rejects an error event with explicit hidden-reasoning fields anywhere in the event. It omits stderr in full if it contains a structured reasoning marker. It stops on a stderr size limit. Once an error item stops the attempt, later events in the same stdout chunk are not recorded. Do not copy raw diagnostics into an Issue, PR, viewer, or inter-session message because they can contain private data.

The first saved live attempt predates this collector change. It stopped after one CLI invocation, but its raw error item and stderr were not retained. The underlying cause cannot be recovered from that capture. The accepted capture stays bound to its original source commit through a local evidence ref. This correction is a no-model preparation step; it does not authorize another live pilot.

## Proposed single-invocation diagnostic

The separate `agent-diagnostic.mjs` entry point is limited to one CLI invocation. It keeps the 24-cell schedule in the manifest, reserves only cell 0, and marks cells 1–23 `skipped-global` with `one-invocation-diagnostic-limit`. A successful cell 0 keeps its JSON and can be scored or replayed by the existing saved-artifact consumers. An error keeps the bounded private diagnostics. There is no loop that can start a second CLI invocation.

This entry point requires a fresh private run directory and a separate mode-0600 approval JSON bound to the exact clean commit, frozen agent plan, output path, independent pre-live Review verdict, and owner's concrete decision reference. Set `runKind` to `one-invocation-diagnostic` and `maxCliInvocations` to `1`; the full pilot approval kind cannot launch it. After separate owner authorization and Review acceptance for the exact diagnostic commit and plan, the only proposed model command is:

The approval JSON keys are `issue`, `decision`, `agentPlanSha256`, `commit`, `reviewUrl`, `outputDir`, `runKind`, `maxCliInvocations`, and `ownerDecisionRef`. The `reviewUrl` must point to a pre-live Review ACCEPT for the exact diagnostic commit; `ownerDecisionRef` must identify the separate owner's one-invocation decision. Keep the file under the private evidence root.

`node scripts/json-render-458/agent-diagnostic.mjs --output /Users/user/.barocss-ai/v3/private-458/cli-run-<fresh-id> --approval /Users/user/.barocss-ai/v3/private-458/<approved-file>.json`

The approval file must not be created from a collector-only Review verdict. Do not execute this command until the owner decision and matching pre-live Review are recorded. No automatic retry, provider switch, API fallback, or expansion to 24 cells is permitted.

## Saved diagnostic and no-model flag correction

The separately authorized one-invocation diagnostic stopped on a CLI `item.completed` notice that the `web_search_request` feature is deprecated. The saved evidence has no final response, usage, or observable tool call; the other 23 cells were not attempted. The notice alone does not prove a fatal CLI rejection or a model/backend failure. Its raw text remains in the private capture.

The follow-up launch setting removes `--disable web_search_request` and explicitly sets `web_search="disabled"`. The installed CLI accepts `disabled` and rejects an invalid web-search mode in a fresh isolated home. Feature-flag states alone do not establish the web-search mode: the CLI reports the same false feature flags for its default, cached, and disabled modes. The route also omits the `--search` opt-in switch, continues to disable `standalone_web_search`, and denies command network access through the native profile. The event collector still stops on any error item; it does not suppress notices. This correction is no-model preparation and grants no new invocation.

## Agent workspace and evidence

The agent cwd is a unique `agent-scratch-458-*` direct child under `/Users/user/.barocss-ai/v3/`. Initially it contains only an empty HOME directory and a copy of the output envelope schema. The prompt contains the semantic request and bounded catalog, with no evaluator, expected answer fixture, rubric path, repository path, or evidence path. A fresh private `CODEX_HOME` holds only a reference to the existing ChatGPT login at startup. No global AGENTS, user rules, user config, plugins, or user skills enter that home. A no-model CLI diagnostic checks the built-in skill inventory and absence of project/global instructions. The native named permission profile has `:root=deny`, `:minimal=read`, `:tmpdir=deny`, `:slash_tmp=deny`, scratch workspace root=read, and command network disabled. It denies reads of the auth reference and original file. The launch explicitly selects the standard `on-request` approval policy. The profile leaves supported shell command tools available but disables apps, plugins, browser, web search, hooks, multi-agent, and code-mode host features. The agent can observe tool results but cannot edit scratch, evaluator, or host evidence through those commands. The host writes raw final text and a filtered JSONL event ledger outside scratch. The ledger retains command strings, exit status and output hashes/lengths; it discards command output text and reasoning content.

The no-model probe previously found that a scratch under `/private/tmp` without explicit temp denials could read sibling temp artifacts. That placement is rejected. The current profile's positive/negative boundary table is in `AGENT-CLI-BOUNDARY.md`.

## After the capture

- `node scripts/json-render-458/agent-consumers.mjs score --capture <output>` verifies the CLI route and reports observable command count.
- `node scripts/json-render-458/agent-consumers.mjs replay --capture <output> --output <fresh-replay>` uses the installed renderer/browser only. It does not call a model. Set the documented `JR_ROOT`, `PW_DIR`, `CHROME` and `REPO_DEPS_ROOT` paths as needed.
- `node scripts/json-render-458/agent-consumers.mjs view --capture <output> --replay <replay>` serves a tokenized read-only loopback viewer. It has no generation endpoint.

Saved live evidence includes the immutable one-run claim, accepted Review file hash, exact reviewed commit, startup inventory hash, agent plan, and every attempted command event. Synthetic browser smoke uses a separate synthetic route and cannot verify as live without a matching claim. Save all failures and unattempted cells. Do not regenerate responses to repair scoring or browser defects; replay saved artifacts. Report this as a Codex CLI agent pilot, not standalone base-model quality. Independent final Review, serial local develop integration, Issue closure and Planner's Wiki update follow actual evidence. If login, quota, model, sandbox, approval, or provenance fails, stop and report the exact cause; do not switch to API or bypass the denial.
