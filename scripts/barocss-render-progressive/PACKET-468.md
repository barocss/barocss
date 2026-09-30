# Passive rate-limit metadata correction (#468)

## Confirmed source gate

The [independent pinned-source diagnosis](https://github.com/barocss/barocss/issues/468#issuecomment-5905226635)
identifies a conditional normal emission in Codex **rust-v0.156.1**:
[TokenCount dispatch](https://github.com/openai/codex/blob/rust-v0.156.1/codex-rs/app-server/src/bespoke_event_handling.rs#L1026)
calls the [token-count handler](https://github.com/openai/codex/blob/rust-v0.156.1/codex-rs/app-server/src/bespoke_event_handling.rs#L1572).
When rate limits are present, it sends `AccountRateLimitsUpdated` after the thread usage update.
The [thread sender](https://github.com/openai/codex/blob/rust-v0.156.1/codex-rs/app-server/src/outgoing_message.rs#L199)
forwards that notification without adding thread identity. The
[connection sender](https://github.com/openai/codex/blob/rust-v0.156.1/codex-rs/app-server/src/outgoing_message.rs#L753)
adds routing/timestamp metadata; the
[wire assertion](https://github.com/openai/codex/blob/rust-v0.156.1/codex-rs/app-server/src/outgoing_message.rs#L997)
confirms method `account/rateLimits/updated` and `params.rateLimits`, without thread/turn IDs.
The retained pinned `ServerNotification`/`AccountRateLimitsUpdatedNotification` schemas agree.
This is source evidence, not a captured native rate update or proof that every turn emits one.

## Narrow host change

The notification now passes the passive validator before the owned-turn identity guard.
Only `rateLimits` is accepted in params. Sparse snapshot fields may be omitted or null; nested
windows, credits and spend-control records retain their required field/type checks. Known enums,
32-bit percentages and JavaScript-safe integer timestamps/durations are checked. Percentages above
100 are schema-valid and remain informational. Unknown fields, unsafe numbers, invalid enums,
thread/turn identity, RPC request IDs, malformed envelopes and unsupported phases fail.

The existing four bounded host phases accept this global metadata. The shared 64-notice ceiling
remains unchanged. The host keeps no quota state, does not clear data on sparse nulls, infer available
headroom, alter model settings, create sessions/turns, or send metadata to delivery/browser handling.
Quota labels/model aliases cannot authorize dispatch. Owned turn data, final items, browser actions,
first/session startup charging and default configuration guards retain their existing checks.

Authored source-shaped fixtures exercise sparse/null/full values, duplicates, invalid nested fields,
rate updates beside token usage and model completion, excessive notices, and tool/unknown/unowned
model events after valid metadata. They are L2 source-contract tests, not native model output.

## Frozen prospective packet

Original plan `ff9df0ba9c16c08e13a087978009ab4d3dbb6ed031620a6461d9d27493684141` is unchanged.
Corrected plan: `2a9f1db5a180a45c19bc9f9e58d2fad285fb6f048e0f67fb566ad41667dc89ea`.
Corrected profile: `7404fdd3cdc5ecb49185bad38487e675e84e367338aaac27003d3ac7aaef2ace`.
The profile binds the protocol validator and sparse-ignore policy. Prior plan/profile and both spent
live decisions cannot authorize this exact correction. #467 stays accepted and closed; its packet
is historical preparation evidence, superseded only for a prospective live candidate.

Proposed bounds stay two sessions, `gpt-6.1-sol/high`, four NEW reservations including uncertain
starts, 180 seconds per turn, 720 seconds total, one launch, no retry/fallback. This task creates
no GO, native/model/server call, connection probe, configuration change, download or release.
A future live launch needs new concrete scoped authority and separate exact runtime Review.
Native session/high-effort response, rate-update frequency, model/UI generation and timing remain
unmeasured. Source/fixture/saved success is not actual latency proof. The renderer remains
`packages/barocss-render`; all changes are research-host files under `scripts`.

## Verification

```sh
node scripts/barocss-render-progressive/freeze.mjs --verify
node --input-type=module -e "import {verifyCurrentHostPlan} from './scripts/barocss-render-progressive/current-host-gate.mjs'; console.log(verifyCurrentHostPlan())"
node --test scripts/barocss-render-progressive/protocol-contract.test.mjs scripts/barocss-render-progressive/saved-startup-replay.test.mjs scripts/barocss-render-progressive/current-host-launcher.test.mjs scripts/barocss-render-progressive/current-host-gate.test.mjs
git diff --check
```

The gate tests are included because its frozen profile binding changed. No unrelated broad suite is
needed. Targeted tests: 39/39 pass. Scoped lint: zero errors/warnings. Both plan checks and diff
check pass. The Issue records the exact independent verdict and local integration.
The unchanged #466 stdout replays three frames (initialize1/passive2), with zero new native/model
launches, accepted sessions/turns or UI samples. It contains no native rate-update observation.
Original private artifact/ledger digests and consumed decision binding match retained provenance.

Rerun saved bytes with the existing replay CLI's canonical private output namespace and a fresh path:

```sh
node scripts/barocss-render-progressive/saved-startup-replay.mjs \
  /Users/user/.barocss-ai/v3/private-464-live-466-20260930-v1/stdout.bin \
  /Users/user/.barocss-ai/v3/private-467-startup-replay-468-NEW.json
```

The retained replay is `private-467-startup-replay-468-20260930-v1.json` (mode0600).
The private preservation audit is `private-468-preservation-audit-20260930-v1.json`.
Private identities, actual quota values and raw/low-entropy digests are omitted from public records.
