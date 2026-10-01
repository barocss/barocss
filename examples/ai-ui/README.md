# Local request UI application

## Start the application

Prepare the workspace dependencies and library build. This private application manifest declares
React and React DOM 19.2.3, plus Playwright Core for tests; it is not a published library package.
Install its dependencies separately with `npm install --prefix examples/ai-ui --ignore-scripts`,
or reuse an already installed compatible host. Resolution checks example and repository dependencies.
The workspace supplies esbuild. If the host peers are already installed in another application, the optional
`REACT_ROOT` environment variable can point at that application's dependency root. No machine path,
private corpus or research source is embedded in this example. No dependency download occurs at startup.

```sh
pnpm build:library
node examples/ai-ui/serve.mjs
```

Open the printed loopback address (`http://127.0.0.1:5174`). The command prints the address and
`authored-fixtures` mode. It binds only to 127.0.0.1. Stop it with Ctrl+C. Enter a screen request,
then Generate, edit the two fields, Review, Edit, Review again and Confirm. Cancel and Restart are
explicit controls. Restart clears the old request lineage, screen and draft before another start.

**Authored fixtures are the default.** Request text is carried to the server transport as data, but
the default transport always returns the fixed request-form scenario. Typing a request does not
prove that an AI understood it or generated that screen. `injected-test` is a distinct no-model test
mode, not an actual CLI mode. There is no browser command execution or API-key fallback.

## Application architecture and lifecycle

The server bundles the browser entry against the renderer manifest's built root export, plus
installed React peers. It serves only four fixed assets and bounded session routes; no arbitrary
filesystem route exists. Browser -> JSON POST -> host session -> injected generation transport ->
correlated response envelope -> JSON parsing -> renderer schema validation -> host stage/summary
validation -> retained screen snapshot -> browser Renderer -> five host React components.

`POST /api/start` requires `screenRequest` (1–300 UTF-16 code units) and bounded `input`. The accepted
request string is retained unchanged for every initial/resumed generation. It cannot alter the host
contract, transition table, executable, flags or files. The legacy session's `start({ input })` remains
valid with an authored default request, but the HTTP application requires explicit request text.
`POST /api/input` writes bounded host draft values without generation; actions use that authoritative
draft. State reads and every mutation require a session token. Mutation routes additionally require
the exact same origin and JSON content type. Host/cross-site checks precede dispatch. Bodies are capped
at 4,096 bytes and assembled before strict UTF-8 decoding; malformed or oversized data is rejected.
The server supports one local application session, not multiple users.

The browser labels mode and phase, keeps the last valid screen while pending/failed/cancelled,
and uses stable registered component functions/node keys so ordinary polls do not remount inputs.
It rejects stale poll tickets/revisions after a local mutation or restart. The browser owns one
dedicated `new BaroCSS.BrowserRuntime`, with nonce and constructable=false set on the first creation.
It observes the document and generates initial and later screen utilities. It never uses or destroys
the shared `getRuntime()` singleton or another host's runtime. Disposal unmounts React, stops polling,
aborts owned fetches, removes the pagehide listener and destroys only its own runtime. Remount creates
a fresh runtime with the same supported nonce configuration. Server close aborts owned session work.

The actual CSP is `default-src 'none'`, same-origin scripts/connections/assets, and same-origin styles
plus a per-server nonce. There is no `unsafe-inline`, executable generated code, external asset or
arbitrary HTML/style field. The existing runtime's nonce-capable style-element path is tested;
no CSS core change is needed.

### Prepared Codex boundary and remaining evidence gate

`createAppServer({ generate, mode })` is the server-side injection point. Its request/envelope contract
is described below. Current modes are only authored-fixtures and injected-test; `codex-cli` is rejected.
An approved future packet must supply the Codex adapter, fixed executable/argv, budget/call bounds,
abort behavior and explicit actual-CLI mode before any live dispatch. Browser request text remains data
in that adapter. No flags or credentials come from HTTP fields. **#491 and its separately approved live
evidence packet remain the actual Codex generation gate.** This task starts zero model processes.

## Browser and server evidence

With an already installed Playwright Core and Chromium (no browser download), run:

```sh
node --test examples/ai-ui/session.test.mjs examples/ai-ui/server.test.mjs examples/ai-ui/browser.test.mjs
```

`PW_DIR` may identify an existing Playwright dependency root; otherwise the test resolves it normally.
`UI_RESULT_ROOT` optionally retains browser JSON and screenshots. Results separate server generation
completion duration (`generationMs`), schema plus host validation duration (`validationMs`), and
the first visible styled screen timestamp (`firstVisibleStyledMs`, relative to browser navigation).
The browser timestamp is not a model duration, and its clock is not compared to the server's clock.
All these measurements are authored/test data, with no production or live-model timing claim.

Real-browser tests cover 1200px and 390px, Korean/English fields, request lineage, five screens,
exact revisions/current snapshots, keyboard activation and focus across unrelated polls, computed
initial/later styles (including a later dark-card class), the actual CSP with zero violations/errors/
external requests, last-valid retention, malformed generation, cancellation, restart, stale results,
runtime disposal and styled remount. Server tests cover rejected host/origin/token/body/process-option
inputs with zero generator calls, split UTF-8 assembly and unchanged request/contract/correlation.

## Authored request session

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

- `start({ input: { draft: { name, topic } }, screenRequest? })` starts one initial generation (202).
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

`generate` receives `{ kind, sessionId, revision, requestId, action, target, input, screenRequest, signal, contract }`.
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
claim. The browser/server evidence above is also no-model. No CSS core change, package export or Changeset is needed.
