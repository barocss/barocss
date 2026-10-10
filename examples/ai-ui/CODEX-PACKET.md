# Prepared Codex request UI packet

Status: **catalog readiness correction; no new live approval**. #495's once-only authorized packet stopped at a missing-model-metadata diagnostic before an observed turn start: attempted1/completed0/accepted0/useful0. Its original bytes remain preserved and spent. #1202 prepares an explicit catalog for a future packet. The spent #458/#460/#495 decisions cannot be reused. Ordinary `serve.mjs` startup remains `authored-fixtures`.

## Prepare and approve

After committing and locally integrating the candidate, use its clean checkout and a fresh absolute private directory:

```sh
node examples/ai-ui/run-packet.mjs --prepare ABS_PRIVATE_ROOT --catalog ABS_EXISTING_MODEL_SOURCE_JSON
```

The same committed runner freezes candidate, packet/declaration/model-catalog/experiment digests,
run UUID, installed environment, bounded request/input edits and future command. Supply an existing
local model cache/catalog explicitly. Preparation extracts one selected model entry, excluding cache
identity/etag/auth and other models, and creates private `model-catalog.json`. It invents no metadata.
Source cache version is provenance, not compatibility or entitlement. Repeat preparation when a bound
value changes; an already attempted packet remains spent.

The installed CLI decodes the snapshot with `debug models` under a macOS OS network deny, isolated
empty homes and no auth. It checks the model/high effort and absence of a refreshed cache/auth file.
Unsupported verifier hosts and decoder failures stop preparation. Private `catalog-check` output/result
and `catalog-provenance.json` accompany packet/experiment/request. These commands invoke no inference.
`--bundled` inspects built-ins and cannot prove a custom catalog is honored.

After the owner directly approves that exact request, the future command is:

```sh
node examples/ai-ui/run-packet.mjs --run ABS_PRIVATE_ROOT/experiment.json --approval ABS_PRIVATE_APPROVAL_FILE
```

The approval is trusted private host input. It binds `kind: owner-approved`, `candidateSha`, `packetDigest`, `declarationsDigest`, `experimentDigest`, `runId` and `ownerDecisionId`. A file alone does not substitute for the owner's decision. Missing or mismatched authority fails before process dispatch. Browser requests and model output cannot grant approval. Preparation creates neither approval nor authentication files.

The runner reuses `preparePacket`, `validatePacket` and `createPacketApp`. The real adapter checks
candidate HEAD, clean worktree and CLI version. Native dispatch now requires a catalog-bound v2
packet: initial/resume argv use its private `model_catalog_json` path. Missing, altered, symlinked or
nonprivate catalog bytes stop before another process. Digest drift halts the packet. Historical v1
construction remains usable for authored fixtures only. Existing ChatGPT auth in the isolated Codex
home remains a separately authorized prerequisite; preparation does not copy it or use an API key.

The generated owner request includes the catalog digest, already bound inside the packet digest.
An offline catalog match proves local decoding only; actual account/model access remains unverified.

Tests inject a fake child process through a programmatic test boundary. The CLI has no fake-process override. `fake-test` is test data and cannot launch the native Codex process. The browser labels real mode `codex-cli` as “actual Codex CLI” and injected mode `codex-cli-fake` as “fake process; no model”. Neither label alone proves approval or a completed model run.

### Prospective direct owner approval request

Fill every placeholder from the committed candidate and fresh preparation output. Do not treat this template as approval:

> Approve one request UI experiment for candidate `<40-character SHA>` and packet SHA-256 `<packet digest>`, with declaration digest `<declaration digest>`, experiment digest `<experiment digest>`, private root `<absolute path>` and run UUID `<UUID>`. Use Codex CLI 0.156.1, model gpt-6.1-sol and high reasoning effort. Allow at most five turn reservations, including failed or uncertain starts, with 180 seconds per turn, 900 seconds total and zero retries. Use the committed runner and frozen request/input edits in experiment.json, one host session and one explicitly mapped Codex UUID for the five displays described below. Use existing ChatGPT CLI authentication in an isolated Codex home, without API-key fallback. Disable agent network access and tools; abort on a tool item or any stop condition. Keep raw output private and export only approved derived/browser evidence. This approval is for this exact packet and candidate only. It authorizes no downloads, release, publication or other experiment.

Until the owner directly approves that binding, execute only preparation and injected-process tests. A host record alone does not substitute for the owner's decision.

## Fixed execution boundary

| Item | Packet rule |
| --- | --- |
| CLI | 0.156.1; gpt-6.1-sol; high effort |
| Budget | Five reservations, including failed/uncertain starts; no retry |
| Time | 180,000 ms per turn; 900,000 ms total |
| Output | At most 2,000,000 event bytes and 32,768 final bytes per turn |
| Identity | Host `sessionId`, revision and `requestId` remain host authority |
| Resume | Explicit Codex UUID from the first accepted `thread.started`; never `--last` |
| Authentication | Existing ChatGPT auth provisioned in isolated `codex-home`; no API-key route |
| Tools/network | Agent network disabled; tools forbidden; stop on any tool item |
| Failure | Stop the entire packet at first failure, uncertain start, drift, invalid screen, cancellation, timeout or ceiling |

`buildArgv()` constructs fixed initial `exec` and explicit `exec resume` argv. The host passes the bounded prompt through stdin and uses no shell interpolation. User text cannot change process arguments, environment, declarations or transitions. The child gets an allowlisted environment, isolated home/Codex home and owned scratch directory. The packet does not install dependencies or provision credentials automatically. Authentication needed by a future approved run must be supplied through the approved private host setup.

The prompt contains the accepted 1–300 character screen request, current bounded input, host declarations and required stage template. The same `REQUEST_CONTRACT` governs prompt permissions, `validateSpec(candidate, contract)` and host transition checks. Only Layout, Card, Text, Input and Button are allowed. Bindings are `/draft/name` and `/draft/topic`; declared actions are `review`, `edit` and `confirm`. Each screen must expose exactly the actions allowed by its current stage. Generated HTML, JavaScript, CSS, class strings, URLs, action parameters and tools are forbidden.

The CLI returns an exact outer object `{ "specJson": "..." }`. The inner complete screen must pass schema and scenario checks. Host IDs are added by the host envelope, not accepted from model output. No patches or partial screens are committed.

## Five-display scenario and rubric

Use one host session throughout. Record the accepted user request and initial name/topic before the first turn. Do not substitute an authored screen for any claimed model-generated display.

| Reservation | Trigger | Required model-generated display | Check |
| --- | --- | --- | --- |
| 1 | Generate | Initial form | Two bound fields and only `review` |
| 2 | `review` after the first topic edit | Review | Exact current name/topic summaries; `edit` and `confirm` |
| 3 | `edit` | Form | Current values preserved; only `review` |
| 4 | `review` after a second, different topic edit | Corrected review | Second topic replaces the first; name stays correct |
| 5 | `confirm` | Confirmed | Exact corrected summaries; no further actions |

For a successful run, all five candidates must be validated, committed and shown with useful content and BaroCSS styles. The browser driver finds bound fields and exposed actions from the accepted spec, not fixture labels or container IDs. It supports permitted renamed nodes, labels and a no-Card layout. Record input edits, action invocations and display observations. Confirm that each action runs once with the current host state. Reject stale/duplicate correlation or a changed host/Codex identity. Preserve the explicit mapping between the host session UUID and the different Codex thread UUID; do not imply that they are interchangeable.

Report reservations, attempted starts, completed turns, accepted candidates and useful displays separately. A failed or uncertain start consumes its reservation and stops the packet. Fewer than five accepted useful displays is incomplete evidence, even when a process exits successfully. Fake-process success proves wiring and checks only; it is not evidence of model output quality, latency or user value.

## Private evidence and clocks

The private root holds the prepared packet/experiment/request, run lock, fixed argv reservations, prompts, raw stdout JSONL, stderr, final files, validated specs, per-turn results and identity mapping. The browser host writes `display-N.json`, `display-N.png` and `report.json` with correlated host snapshots, browser observations, screenshots and the terminal result. Ctrl+C or SIGTERM cancels owned pending generation; the total deadline also closes the owned browser. Each display retains its accepted spec, current input, action, revision/request mapping, all six fields, separate `userActionSent`, useful content/styles and browser/CSP/external-request errors.

Keep original response bytes separate from derived validated specs, host state, browser observations and screenshots. The report follows root/child traversal to compare each accepted screen with its stage fixture for semantic structure, style and label differences. JSON object insertion order is ignored. ID-only changes are reported separately as identity differences. No variation is a valid result; the driver must not force it. State/action continuity and variation are separate findings.

The terminal report records reserved, attempted, completed, accepted and useful counts separately. Invalid output stops the packet, retains the last valid screen and produces partial failure evidence without retry. Cancellation and deadlines are terminal too. Cleanup closes only owned child processes, server and browser resources. Normal stdout reports safe status/counts/digests; it does not print input, identities, raw output or credentials.

Root directories require private permissions; evidence files use mode 0600. Raw output may contain input or auth diagnostics. Keep it private. Browser API responses expose validated host state and safe errors, not raw CLI output, process options or credentials. Derived reports and screenshots can still contain input: review them before sharing. Public recording or publication needs its own authorization.

Retain all six observation fields, including nulls:

| Field | Clock and meaning |
| --- | --- |
| `requestAccepted` | Server-process monotonic ms: host accepts a generation request |
| `firstByteReceived` | Server-process monotonic ms: first stdout chunk, which may be metadata/reasoning rather than a useful candidate |
| `firstValidCandidate` | Server-process monotonic ms: complete screen passes validation; the host records its own validation boundary |
| `firstUsefulPresentation` | Browser-navigation monotonic ms: requestAnimationFrame plus useful content and declared root/container grid, gap, padding and theme color checks |
| `committed` | Server-process monotonic ms: host commits validated state |
| `actionReleased` | Server-process monotonic ms: validated next action is dispatched once to generation; initial/rejected/pre-dispatch-cancelled actions have null |

Transport observations leave unobserved host/browser boundaries null. Session and browser observations supply their own boundaries; preserve provenance rather than filling gaps with guessed timestamps. The presentation check is a proxy, not physical paint. `actionReleased` is the server dispatch boundary. The separate `userActionSent` browser point records a click and does not replace it. Restart clears both lineages. Browser polling, rendering and input save can add delay.

Never subtract browser timestamps from server timestamps. The runner derives browser action-to-useful-screen duration only from matching `userActionSent` and `firstUsefulPresentation` points in the same navigation, with request/session/revision correlation. Missing points remain null. Compare other durations only inside the same clock domain and process/navigation. State generation/validation timing scope, sample count and spread. Preparation and fake-process timing cannot establish real model latency; there is no live result yet.

## No-model verification

For #1202, build the affected renderer dependency and run
`node examples/ai-ui/model-catalog-flow.mjs`: one authored browser packet, OS-network-denied
metadata decoding, source/snapshot rejection and catalog drift before resume. No inference or #495
retry occurs. The [official configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference)
documents `model_catalog_json` loaded at startup.

Zero useful timing samples must not be reported as live model evidence. #495's original
`latency.liveModelEvidence=true` reflected owner-approved mode with n=0 and is preserved as a
historical reporting defect. New reports set that field true only for matched useful timing samples
from native CLI mode; n=0 is false. Native mode remains a separate source label.

Use already installed dependencies and Chromium. Do not download a browser for this preparation:

```sh
pnpm build:library
node --test examples/ai-ui/run-packet.test.mjs
node --test examples/ai-ui/codex-transport.test.mjs examples/ai-ui/launch-packet.test.mjs
node --test examples/ai-ui/session.test.mjs examples/ai-ui/server.test.mjs examples/ai-ui/browser.test.mjs
```

The runner tests use the actual browser and an injected child process for all five displays and both edits. They check permitted structural variants, styles, correlation, action dispatch, authority rejection and terminal partial failure. This proves host wiring only. It does not prove account/model/profile acceptance, live generation quality, physical paint, real-time suitability or user value. Fresh direct live authority and live evidence remain separate work.
## Usage observations — #1171

Each private `turn-N-result.json` records the number of `turn.completed` events,
the known reported counters and host/request/revision/Codex-thread/run correlation.
Status is `reported`, `no-completion`, `missing`, `malformed` or `ambiguous`.
The raw stdout JSONL remains the original evidence, including unfamiliar fields.
Missing optional reasoning output is null; missing/invalid counters are never zero.

The private browser report includes these rows for accepted and failed attempts.
`source` distinguishes `injected-process` from `native-cli`; an injected row is
authored verification, not actual model usage. Usage does not change UI acceptance,
host authority or current stop conditions. Private telemetry is not returned to the
browser or printed in the command's public summary.

The [official exec JSONL example](https://learn.chatgpt.com/docs/non-interactive-mode)
documents the reported counter fields. Counter scope across resumed processes has
not been established for this packet. `counterScope` is `unverified`; `tokenTotals`
is null. Counters are not summed or differenced. Billed amount/currency remain null:
ChatGPT account billing cannot be inferred by applying API token prices.

Run `node examples/ai-ui/usage-flow.mjs` after the compiled renderer dependency
build for one authored five-display browser packet and a rejected-screen telemetry
check. It invokes zero models. A future live packet still requires the existing
fresh exact candidate/digests/run/budget/direct-owner record; old packets are unchanged.
