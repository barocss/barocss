# Issue 458: direct API preparation packet

**Status:** preparation only. No API request has been sent. The direct API entry point is gated by an exact reviewed commit, private owner-approval file, fresh private output path, and project-scoped API environment. It cannot dispatch without all gates. The existing Codex CLI `liveTransport()` still throws before dispatch. The new adapter is a request builder, response inspector, durable charge reservation, and an injected local stub. Independent Review of this exact commit is required before local integration. Integration is not permission to spend.

## Frozen scope and request

- Existing pilot plan: three scenarios × two arms × four stages = **24 maximum first-response attempts**, in six independent sessions. Each later request contains every earlier user request and complete saved assistant response from its own session in `promptFor`. No `previous_response_id`, conversation ID, automatic compaction, or server-held history is used. Existing validator, capture, scorer, replay, and viewer remain unchanged.
- Candidate API model: `gpt-6-sol`, `reasoning.effort: high`, `max_output_tokens: 8192` including hidden reasoning. The documented context window is 1,050,000 tokens. The model name is an alias in the currently published catalog; no immutable snapshot is identified here. Reconfirm identity, supported settings, context and pricing immediately before any owner-approved live run. Account availability and project tier are unverified.
- Endpoint is exactly `POST https://api.openai.com/v1/responses`, direct OpenAI Standard processing. The frozen request sets `tools: []`, `tool_choice: "none"`, `service_tier: "default"`, `background: false`, `store: false`, `stream: false`, `truncation: "disabled"`, a single `input_text` message containing the frozen complete prompt, and `text.format` with the frozen strict JSON schema. It contains no URL supplied by a scenario, tool executor, fallback, retry, or prior response handle. Do not set `OPENAI_BASE_URL` or use a regional, proxy, Batch, Flex, Fast, or CLI route.
- Before any future dispatch, save the exact request and a full-cost, `fsync`-durable charge reservation. Save each returned API response, then require `object: response`, completed status, exact model and `default` tier, optional empty reasoning item, exactly one completed assistant message containing one `output_text` with no annotations, no tool item, no refusal, and complete consistent usage. The existing strict envelope/schema validator then handles `specJson`. Incomplete, refusal, tool output, wrong model/tier, missing usage, timeout, or ambiguous completion stops all later attempts. An attempted cell's full reservation is never released after a timeout or other failure. Measured elapsed time is saved for completed, failed, timed-out, and budget-denied local slots. All 24 scheduled rows remain recorded, including skips.

## Charge ceiling proposal (USD)

The [GPT-6 Sol model page](https://developers.openai.com/api/docs/models/gpt-6-sol) lists Standard short-context per-million-token input/cached/cache-write/output prices of **$2.00/$0.20/$2.50/$10.00**. For prompts above 272,000 input tokens, the **entire request** uses long-context prices **$4.00/$0.40/$5.00/$15.00**. [Prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching) says cache-write is an alternative input-token rate, not an additive fee. [Responses API](https://developers.openai.com/api/reference/cli/resources/responses/methods/create) says `max_output_tokens` includes hidden reasoning and `service_tier: "default"` requests Standard pricing.

The reservation ignores token estimates and cache savings. It treats all 1,050,000 possible input tokens at the **highest Standard long-context cache-write rate**, $5/M, and all 8,192 allowed output/reasoning tokens at $15/M. This is **$5.372880 per attempt**. The hard aggregate ceiling is **$10.000000**, with up to 24 scheduled attempts. Before each dispatch the adapter durably reserves $5.372880. After a fully completed response with exact model/tier and consistent detailed usage, it durably settles the actual charge at the documented applicable rate and frees only the proven unused portion. If the remaining budget cannot cover the next full reservation, it stops before network dispatch and records the budget-denied slot plus all later scheduled skips. Timeout, missing usage, refusal, incomplete response, or any other ambiguous result retains the full reservation and stops. This cap does not guarantee 24 actual API responses. Under the documented model context, output cap, direct Standard tier, and published rates, aggregate token charges cannot exceed $10.000000. This is an authorization ceiling, not a predicted bill or an account spending limit. A change in model capability, pricing, processing route, non-token fees, or Standard-tier contract invalidates the packet and blocks dispatch until a new review and owner decision.

For planning only: if the live run uses **100,000 total uncached input tokens** and **48,000 total output tokens**, Standard short-context charge would be **$0.68**. If all 100,000 input tokens instead count as cache writes, it would be **$0.73**. These are assumptions, not a token bound. The 24 synthetic prompts total 107,607 UTF-8 bytes; bytes are not billable tokens, and synthetic output sizes do not predict live output. Reasoning tokens are part of the billed `output_tokens`, not a separate addition.

## Local no-network verification

From the repository root:

```sh
node --test scripts/json-render-458/*.test.mjs
```

The API tests assert exact request fields, denial before network without private owner approval and project key, one-run atomic claim, cache-write/long-context/reasoning accounting, strict rejection of tool/refusal/incomplete/model/tier/usage drift, durable reservation and settlement, full 24-cell saved-response provenance, API artifact mutation detection across scoring/replay/viewer, and retained reservation plus scheduled skips after timeout or missing usage. The stub responder makes no HTTP request and spends nothing. The CLI hard block has its own test.

## API saved-evidence commands

Use the route-aware commands below for any API capture. They verify the API source freeze and the saved API request, charge reservation, response, and settlement before scoring or browser replay. Replay writes an `api-report-binding.json` sidecar that binds the report to the API evidence digest; the API viewer requires it. The generic CLI/stub consumers remain for accepted legacy captures and must not be used for an API run.

```sh
node scripts/json-render-458/api-consumers.mjs score --capture /Users/user/.barocss-ai/v3/private-458/run-UNIQUE123
node scripts/json-render-458/api-consumers.mjs replay --capture /Users/user/.barocss-ai/v3/private-458/run-UNIQUE123 --output /Users/user/.barocss-ai/v3/private-458/replay-UNIQUE123
node scripts/json-render-458/api-consumers.mjs view --capture /Users/user/.barocss-ai/v3/private-458/run-UNIQUE123 --replay /Users/user/.barocss-ai/v3/private-458/replay-UNIQUE123
```

Browser replay still needs the already installed renderer/browser environment described in `README.md`. Do not download dependencies to run this packet.

## Exact gated command and unresolved owner decision

This command is implemented but **must not be run yet**. It fails before network without the owner-approved private file, matching exact reviewed commit/API-plan hash, a fresh path under the private evidence directory, and matching project-scoped environment values. The current environment has no known API key or project/account confirmation. This preparation made no credential-file lookup, account probe, or paid request.

```sh
node scripts/json-render-458/api-live.mjs \
  --approval /Users/user/.barocss-ai/v3/private-458/owner-approved-api-458.json \
  --output /Users/user/.barocss-ai/v3/private-458/run-UNIQUE123
```

The approval file is **not created by this preparation**. It must contain `issue: 458`, `ownerDecision: "APPROVED_LIVE_API_458"`, the exact clean Git `commit`, `apiPlanHash`, `capturePlanHash`, `endpoint: "https://api.openai.com/v1/responses"`, `model: "gpt-6-sol"`, `maxChargeMicroUsd: 10000000`, `organizationId`, `projectId`, and the independent final Review `reviewDecision: "ACCEPT"` and `reviewUrl`. The private approval file hash and reviewed commit are recorded in the API run manifest, without saving the API key. The approval also names the exact canonical `outputDir` and a unique `runId` that matches its `run-<id>` basename. Before dispatch, the command creates an exclusive, durable `.claim` next to that directory; the same approval cannot start a second run or a parallel restart. The run environment must supply `OPENAI_API_KEY`, `OPENAI_ORG_ID`, and `OPENAI_PROJECT_ID` through an approved secret channel; the organization/project must match the approval file. `OPENAI_BASE_URL` must be unset. The command does no retry. At completion it verifies and prints the API evidence digest and held charge. A timeout or HTTP failure retains the full reservation and stops. The old CLI `--live` command remains an unconditional hard block.

Before owner GO, confirm model ID and alias behavior, API access, Standard tier billing and price, available credit, organization/project identity, budget and rate limits, data-retention policy for `store: false`, and any tax or non-token charge. The owner must decide whether **$10.000000** token-charge authorization, up to 24 scheduled slots with possible early stop, is acceptable. Independent Review must ACCEPT the final dispatch implementation at its exact SHA. Local develop integration of preparation is not permission to spend. The run is allowed only after a separate owner GO and matching private approval file. A timeout must never trigger a replacement request.

References: [model and limits](https://developers.openai.com/api/docs/models/gpt-6-sol), [pricing](https://developers.openai.com/api/docs/pricing), [Responses create parameters](https://developers.openai.com/api/reference/cli/resources/responses/methods/create), [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching), [reasoning token accounting](https://developers.openai.com/api/docs/guides/reasoning).
