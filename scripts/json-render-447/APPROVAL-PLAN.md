# #447 proposed run packet — preparation only

No generation was authorized or executed. This packet requests a separate owner decision for **pilot-a only**, after account readiness is verified. The accepted #446 result is deterministic evidence; the synthetic checks here measure the harness, not model quality.

## Exact route and unresolved facts

Proposed route: direct Anthropic Messages API at `https://api.anthropic.com/v1/messages`, standard capacity, global inference, no cache, tools, external assets, extended/adaptive thinking, SDK, automatic retries or paid evaluator. Credentials enter only through `ANTHROPIC_API_KEY`; the runner never records that value. The existing Claude CLI is not the proposed provider.

Read-only local checks on 2026-09-27: Claude Code 2.1.283; filtered `claude auth status --json` reported `loggedIn=false`, `authMethod=none`, `apiProvider=firstParty`, subscription unknown. This process had no Anthropic API key, alternate endpoint or cloud-provider routing flags. These observations do not establish the owner's account state elsewhere. **Account model access, API workspace, credits, tax/contract terms and billing route remain unverified.** No credential file was read, no token was printed, and no API request was made. Public model availability is not account entitlement. Owner approval must confirm the direct account and token-billing scope; missing facts block `--live`.

## Official source record (accessed 2026-09-27)

- [Model overview](https://platform.claude.com/docs/en/models/overview): candidate exact IDs `claude-haiku-4-5-20251001` and `claude-sonnet-5`; documented context limits 200K and 1M, output maxima 64K and 128K. The plan caps both outputs at 4,096. Verify account access and these limits again before approving the immutable plan hash.
- [Pricing](https://platform.claude.com/docs/en/about-claude/pricing): direct base input/output rates are $1/$5 and $2/$10 per million tokens. The page states full 1M context at standard rates for Claude 4.6 and later, so Sonnet 5 has no long-context premium under this proposed route. Haiku stays within its 200K limit. Regional/data-residency, fast/priority, cache and tool pricing can differ; this plan excludes those paths. Taxes and account contracts are not known. The enforced figures below cover API token charges only, not an unknown invoice total.
- [Messages API](https://platform.claude.com/docs/en/api/messages/create): explicit complete conversation messages, `max_tokens=4096`, `thinking.type=disabled`, `tools=[]`, `tool_choice.type=none`, `stream=false`, `service_tier=standard_only`; no cache-control fields. Output/reasoning tokens must fit the declared output limit. Sampling parameters are omitted at provider defaults; no unsupported seed is invented. Reject unexpected response model, service tier, cache/tool usage or missing token usage. If a model rejects these settings, record the failure and stop; do not adapt them mid-study.
- [Token counting](https://platform.claude.com/docs/en/build-with-claude/token-counting): counts are estimates, may differ from actual usage, and the endpoint is free. It is used only as an operational context check after approval. A 32,768-token estimate limit never substitutes for the conservative billing reservation.
- [Claude Code cost guidance](https://code.claude.com/docs/en/costs) distinguishes subscription allowances, usage credits and API account billing. CLI displayed dollars are estimates; they are not proof of billed cost. [CLI flags](https://code.claude.com/docs/en/cli-reference) do not provide this experiment's durable aggregate reservation. This study therefore proposes the direct API, not subscription CLI billing equivalence.

## Frozen phases and cost

All sessions have initial generation and three edits. Each model/arm/scenario/repetition has isolated complete history. Run sessions serially in the balanced model/arm order emitted by `schedule()`. Every scheduled cell remains in the denominator. Build-only control reuses utility outputs without model calls.

| Phase | Scope | Sessions / responses | Assumption-based expected token charge | Conservative token maximum |
| --- | --- | --- | --- | --- |
| pilot-a (request first) | Settings; 3 arms; 2 models; 1 repetition | 6 / 24 | $0.3168 | $27.137280 |
| pilot-b (separate approval) | All 3 scenarios; 3 arms; 2 models; 1 repetition | 18 / 72 | $0.9504 | $81.411840 |
| study (separate approval) | All 3 scenarios; 3 arms; 2 models; 5 repetitions | 90 / 360 | $4.7520 | $407.059200 |

Expected values are **unmeasured assumptions**: input totals of 2,000, 3,200, 4,400 and 5,600 tokens across each session's successive requests, plus 1,000 output tokens each. This explicitly accumulates history. Actual prompt counts and output lengths can differ, especially across catalogs/models. Stages are independent proposed runs, not automatic extensions; charges would add if more than one were approved. No larger phase follows automatically.

The conservative maximum reserves each model's entire documented input context ceiling on every response, including system/catalog, all user edits, complete raw prior outputs and provider overhead, plus 4,096 output tokens. Per-call reservations: Haiku $0.220480 and Sonnet $2.040960. `pilot-a` is 12 calls per model: 12 × ($0.220480 + $2.040960) = $27.137280. This deliberately over-reserves; count-token estimates have no guaranteed error bound. It relies on the provider's verified context/output limits and billing route. If those cannot be confirmed, do not run.

Reserve durably before dispatch under an exclusive lock. Known usage settles the charge at the approved rates. Missing usage, timeout, transport failure, ambiguous completion or over-bound usage retains the full reservation and stops the whole run. Never steal a crash lock or automatically resend an ambiguous request. Parse, schema-envelope and truncation failures stop that session; retain its remaining cells. No automatic retries or repairs. A failed API attempt is included in the call cap. A fresh manifest cannot overwrite a previous run, and approval binds one absolute output directory. Reconciliation needs an explicit decision and authoritative billing evidence.

Reject oversized input without truncation: 262,144 request bytes or an estimated 32,768 input tokens. Keep complete raw response/history on disk. Unknown categories, model drift, price drift or route drift block live readiness. Capture paths are synthetic research data only. The exact prepared requests and code hashes are emitted by `--freeze`; any code/prompt/plan change requires a new hash and approval.

## Proposed invocation after approval — not executed

First save `node scripts/json-render-447/capture.mjs --freeze` as the reviewed frozen plan. Owner approval must refer to that `planHash`, the exact commit and the following fields. This template is intentionally unapproved; changing flags is not a substitute for owner authorization.

```json
{
  "ownerApproved": false,
  "planHash": "FROM_REVIEWED_FREEZE",
  "phase": "pilot-a",
  "provider": "anthropic-direct-standard-global",
  "billingScope": "API-token-charges-only",
  "accountModelsVerified": false,
  "billingVerified": false,
  "contextAndPricesVerified": false,
  "budgetMicroUsd": 27137280,
  "callCap": 24,
  "outputDir": "/private/tmp/barocss-447-approved-pilot-a"
}
```

With the owner-approved direct API key supplied privately to the environment and a verified approval record:

```sh
node scripts/json-render-447/capture.mjs --live --phase pilot-a --approval /private/tmp/barocss-447-owner-approval.json --output /private/tmp/barocss-447-approved-pilot-a
```

Do not use `--live` while any readiness fact is unknown. An authenticated read-only model lookup and billing-route check must precede owner approval; neither was possible with credentials available to this task. Do not request keys in Issue comments. If the owner wants subscription CLI instead, prepare and review a different invocation and accounting plan.

## Evaluation and stopping decision

`fixtures.mjs` freezes 36 scenario/arm/stage cases and all prompts. `RUBRIC.md` defines semantic, state, action, style and host anchors before output exists. All requested edits are expressible in all three catalogs. Utility tokens use an explicit safe vocabulary, not unrestricted CSS; this is a limitation on inference. `replay.mjs` reuses #446's official renderer and runtime. It preserves failures and pairs build-only rendering with each utility session's initial captured token inventory. A skipped or failed earlier stage prevents a successful-session claim, even if a later isolated stage renders.

Review pilot-a first responses, token accounting and failure attribution before proposing pilot-b. Stop expansion for unresolved infrastructure/accounting faults, unclear scoring or prompt imbalance. Changes require a new frozen plan; do not pool revised prompt runs. A one-repetition pilot is descriptive. The five-repetition study would still be exploratory, and no superiority claim follows from synthetic responses or a small pilot.
