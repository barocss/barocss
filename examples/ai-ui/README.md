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

Unsubmitted name/topic edits survive disposal and remount within the same page when the host
session, revision, form stage, request and authoritative input still match. The browser keeps one
bounded in-memory draft and records edits synchronously. Different host lineage or server input
invalidates it; accepted Restart clears it. An explicit action submits the recovered values through
the existing input route. Remount itself performs no input write or generation. This does not persist
across page reload/navigation/crash and does not preserve focus or selection.

Accepted host input changes also reach the editable form at the same revision. When the
authoritative values are unchanged, ordinary polls retain a matching unsent local draft.
Changed host values invalidate that draft and replace the displayed values before the next
explicit submission. Synchronization itself performs no input write or generation.
After the affected renderer build, `node examples/ai-ui/host-input-flow.mjs` checks this
host-update/submission flow in the actual browser with authored responses and zero models.

After the affected renderer build, `node examples/ai-ui/remount-draft-flow.mjs` runs one authored
real-browser flow for same-task edits/remount, held old polls, host input invalidation, explicit
review/edit/confirmation, Restart/new session and owned/foreign runtime cleanup. It calls zero models.

The actual CSP is `default-src 'none'`, same-origin scripts/connections/assets, and same-origin styles
plus a per-server nonce. There is no `unsafe-inline`, executable generated code, external asset or
arbitrary HTML/style field. The existing runtime's nonce-capable style-element path is tested;
no CSS core change is needed.

### Prepared Codex boundary and remaining evidence gate

`createAppServer({ generate, mode })` is the server-side injection point. Ordinary startup remains
`authored-fixtures`; `injected-test` remains a no-model mode. Only `createPacketApp` can provide the
branded `codex-cli` or `codex-cli-fake` transport. An arbitrary injected function cannot select these
modes. The browser distinguishes actual CLI from fake-process data. Restart and server close stop
owned packet work. Browser requests cannot provide credentials, process flags or approval.

[The prepared packet contract](./CODEX-PACKET.md) specifies fixed argv, finite reservations, private
artifacts, identity mapping, timing boundaries and the exact future owner request. The committed
runner provides these commands:

```sh
node examples/ai-ui/run-packet.mjs --prepare ABS_PRIVATE_ROOT --catalog ABS_EXISTING_MODEL_SOURCE_JSON
node examples/ai-ui/run-packet.mjs --run ABS_PRIVATE_ROOT/experiment.json --approval ABS_PRIVATE_APPROVAL_FILE
```

Preparation freezes `packet.json`, `experiment.json` and `request.txt` at the exact committed
candidate. It creates no authority or authentication files. It runs installed CLI help/version checks
only. Preparation and tests start zero model processes. The execution command requires the direct
owner's new decision and a private record binding candidate, packet/declaration/experiment digests
and run UUID.
The CLI has no fake-process override; tests inject a process programmatically.

Catalog-bound preparation snapshots one existing selected model entry, verifies local decoding with
the installed CLI under an OS network deny, and binds its private bytes into initial/resume argv.
The current offline verifier supports macOS. Missing or changed metadata stops before another process;
this prepares no model authority and does not retry the spent #495 packet. See `CODEX-PACKET.md`.

The runner drives five displays and two topic edits through spec-derived field/action selectors. It
keeps private host/browser snapshots, screenshots, spec differences and terminal success or partial
failure counts. It reports state/action continuity separately from structural/style/label variation,
including absent variation. It stops at the first failure and closes only owned resources.
The browser action latency uses matching `userActionSent` and `firstUsefulPresentation` points in one
navigation. Missing observations stay null; server and browser timestamps are never subtracted.

## Browser and server evidence

With an already installed Playwright Core and Chromium (no browser download), run:

```sh
node --test examples/ai-ui/run-packet.test.mjs
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

## Shared renderer declarations and one focused offline flow

`scenario.mjs` now imports `getRenderSpecDefinition(REQUEST_CONTRACT)` through the renderer
manifest's compiled public root. Build the renderer before importing the scenario. Component
props, finite style choices, node-level Button events, limits, patterns and graph rules come from
the renderer's shared definition. The scenario still owns permissions, transitions, forbidden
instructions and exact summary checks. Metadata format `definitionVersion: 1` is separate from
host prompt version `request-ui-v1`. New declaration digests invalidate old prepared packets;
historical records are preserved, and no model run follows from this change.

With Node22, installed React19.2.3 peers, Playwright Core and Chromium:

```sh
pnpm --filter @barocss/render build:library
node examples/ai-ui/contract-catalog-flow.mjs
```

`REPO_DEPS_ROOT`, `REACT_ROOT` and `PW_DIR` can identify already installed dependency roots.
The host also needs the adopted `packages/barocss-browser/dist/cdn/barocss.umd.cjs` artifact.
No downloads are performed. The driver checks the public compiled import, shared source graph,
new declaration types, detached metadata and representative validator error paths. It uses the
existing ProfileForm for default name/save confirmation, then the current request server/session
and browser for configured name/topic review/edit/confirm. All responses are authored offline.

The second form display changes labels/layout while preserving stable IDs and host values.
Review removes inputs; edit recreates them with the retained values. This does not prove focus
or DOM identity survives remounting. The same flow checks props.on, unknown component/action,
truncated JSON, cancellation with a late response and stale revision; rejected updates preserve
the accepted screen/input. Browser observations are separate from source/API checks. The driver
closes its own servers/browser and removes its temporary consumer. It is one bounded prototype,
not a live-model, streaming, general continuity, performance or release acceptance suite.
