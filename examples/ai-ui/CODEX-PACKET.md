# Prepared Codex request UI packet

Status: **prepared-not-approved**. Issue #491 prepares an adapter and fake-process evidence. It does not authorize a real model call. The spent #458 and #460 approvals cannot be reused. Ordinary `serve.mjs` startup remains `authored-fixtures`.

## Prepare and approve

After committing the candidate, prepare a fresh private directory:

```sh
node examples/ai-ui/launch-packet.mjs --dry-run PRIVATE_ROOT
```

Use an absolute private path. This command records `packet.json`, checks the installed CLI version and initial/resume help, and prints the candidate SHA and packet digest. It makes zero model calls. Preparation must be repeated if the candidate, declarations, CLI or packet changes.

The implemented app entry is the imported `createPacketApp({ packet, approval, ... })` function in `codex-transport.mjs`. There is no live CLI launcher. A trusted host must supply the approval record; browser requests and model output cannot grant approval. `owner-approved` requires the fresh packet digest, exact candidate SHA, run UUID and owner decision ID. The real adapter checks the candidate HEAD, clean worktree and CLI version before dispatch.

`fake-test` requires an injected process. It is test data, not owner authority. The browser labels prepared real mode `codex-cli` as “actual Codex CLI” and injected mode `codex-cli-fake` as “fake process; no model”. Neither label proves that a model run was approved or completed.

### Prospective direct owner approval request

Fill every placeholder from the committed candidate and fresh preparation output. Do not treat this template as approval:

> Approve one request UI experiment for candidate `<40-character SHA>` and packet SHA-256 `<packet digest>`, with declaration digest `<declaration digest>`, private root `<absolute path>` and run UUID `<UUID>`. Use Codex CLI 0.156.1, model gpt-6.1-sol and high reasoning effort. Allow at most five turn reservations, including failed or uncertain starts, with 180 seconds per turn, 900 seconds total and zero retries. Use one host session and one explicitly mapped Codex UUID for the five displays described below. Use existing ChatGPT CLI authentication in an isolated Codex home, without API-key fallback. Disable agent network access and tools; abort on a tool item or any stop condition. Keep raw output private and export only approved derived/browser evidence. This approval is for this exact packet and candidate only. It authorizes no downloads, release, publication or other experiment.

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

For a successful run, all five candidates must be validated, committed and shown with useful content and BaroCSS styles. Record input edits, action invocations and display observations. Confirm that each action runs once with the current host state. Reject stale/duplicate correlation or a changed host/Codex identity. Preserve the explicit mapping between the host session UUID and the different Codex thread UUID; do not imply that they are interchangeable.

Report reservations, attempted starts, completed turns, accepted candidates and useful displays separately. A failed or uncertain start consumes its reservation and stops the packet. Fewer than five accepted useful displays is incomplete evidence, even when a process exits successfully. Fake-process success proves wiring and checks only; it is not evidence of model output quality, latency or user value.

## Private evidence and clocks

The private root holds the packet, run lock, fixed argv reservations, prompts, raw stdout JSONL, stderr, final files, validated specs, per-turn results and identity mapping. Root directories require private permissions; evidence files use mode 0600. Raw output may contain input or auth diagnostics. Keep it private. Browser API responses expose validated host state and safe errors, not raw CLI output, process options or credentials. Derived reports and screenshots can still contain input: review them before sharing. Public recording or publication needs its own authorization.

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

Never subtract browser timestamps from server timestamps. Compare durations only inside the same clock domain and process/navigation, with request/session/revision correlation. State generation/validation timing scope, sample count and spread. Preparation and fake-process timing cannot establish real model latency; there is no live result yet.
