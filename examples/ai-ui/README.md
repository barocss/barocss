# Authored request session

This application example demonstrates repeated host-approved screen updates. It is not a public
orchestration package. All files stay in `examples/ai-ui/`; the renderer stays in
`packages/barocss-render/`. The session resolves that package's root ESM export from its manifest
and imports the built entry. Build the renderer before importing the example.

## Protocol and ownership

`createRequestSession({ generate, contract?, createId? })` injects a transport. It never starts a CLI,
invokes a model, executes a script or retries a failure. The default host contract is the frozen
`REQUEST_CONTRACT` exported by `scenario.mjs`: `/draft/name`, `/draft/topic`, review/edit/confirm.
Pass `session.contract` to the browser's `Renderer` and to any separate screen validation.
The session copies declarations at creation and checks each generated screen with
`validateSpec(candidate, contract)` from the built package root.

The host owns input, identity and transitions:

| Current stage | Exposed and permitted actions | Next stage |
| --- | --- | --- |
| form | review | review |
| review | edit | form |
| review | confirm | confirmed |
| confirmed | none | none |

Declaring an action does not permit it in every stage. A request must match the current session and
revision, and the action must appear on the last validated screen and in the host transition table.
The host checks generated field/action sets against the destination stage. Review and confirmation
must contain the exact name/topic summaries from the accepted host snapshot. Extra or altered Text
content is rejected. There are no generated prices, totals, action parameters or state expressions.

Methods:

- `start({ input: { draft: { name, topic } } })` starts one initial generation (202).
  Each field must contain 1–80 UTF-16 code units, with no extra input fields.
- `updateInput({ sessionId, revision, input })` replaces the bounded host draft (200) in a usable
  form stage. Input updates never dispatch generation. The host calls this method after an edit.
- `action({ sessionId, revision, action })` snapshots the current host draft and starts exactly
  one next generation (202). Pending state is set synchronously, so a second submission is 409.
- `snapshot()` returns a detached copy of phase, sessionId, revision, displays, stage, spec, input
  and sanitized error. Caller mutation cannot alter authority.
- `settled()` returns the current generation's completion promise. It does not dispatch or retry.
- `cancel()` aborts pending work, invalidates its epoch and advances revision. The last screen,
  stage and draft remain available. Cancel before an initial dispatch starts zero generations.
- `restart()` aborts and invalidates pending work, clears the old screen/draft and advances revision.
  A later explicit start receives a host-generated UUID. Old revisions/results remain obsolete.

`generate` receives `{ kind, sessionId, revision, requestId, action, target, input, signal, contract }`.
Initial action is null. Subsequent action is a validated name. `input` is a detached accepted snapshot;
the transport cannot mutate session state. It must return exactly:

```js
{ sessionId, revision, requestId, specJson: JSON.stringify(innerScreen) }
```

All three correlation fields must echo the request. `specJson` is bounded to 32,768 UTF-8 bytes.
The host parses it, validates it and checks stage content before committing a new screen. A success
advances revision and display count. A failure advances revision, keeps the previous screen/stage/draft
and exposes a sanitized error. Failure and cancellation allow an explicit new action against the
new revision. The session rejects old submissions. There is no silent retry.

Phases are idle, generating, ready, action-pending, failed and cancelled. During pending work the
previous screen/draft stay visible, but actions and input writes are rejected. In ready/failed/cancelled,
a retained form can be edited. No screen exists after an initial failure/cancellation; restart first.
This example delivers complete responses only. It does not implement progressive rendering.

## Reproducible authored evidence

```sh
pnpm --filter @barocss/render build:library
node --test examples/ai-ui/session.test.mjs
node --test scripts/barocss-render-loop/controller.test.mjs
```

The five-display test injects `requestScreen(target, input)` as an authored transport:

| Display | Accepted action | Stage | Authoritative topic |
| --- | --- | --- | --- |
| 1 | initial | form | 커피 |
| 2 | review | review | 커피 |
| 3 | edit | form | 커피 |
| 4 | review after host edit | review | 차 두 잔 |
| 5 | confirm | confirmed | 차 두 잔 |

The name remains 민지. Exactly five correlated requests occur in one session at revisions 0–4,
with unique request IDs. Final screen summaries contain `name: 민지` and `topic: 차 두 잔` exactly.
There is no hard two-response limit: review/edit can repeat before confirmation.

The deterministic suite also checks concurrent duplicate submissions, actions declared but not
exposed, unknown actions, wrong-session/stale requests, invalid contracts, oversized inputs/responses,
extra response fields, malformed JSON, obsolete result correlation, wrong destination action sets,
incorrect summaries, detached payloads/snapshots, sanitized transport failure, cancellation and
restart with delayed results. The frozen historical controller tests run unchanged for compatibility.

Evidence is authored and no-model. It proves this application protocol's correctness under the
tested transport responses. It makes no live-model quality, production latency or browser integration
claim. A browser consumer is a separate task. No CSS core change, package export or Changeset is needed.
