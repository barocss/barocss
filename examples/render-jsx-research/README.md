# Server-compiled JSX, component library and local state

## Result

**An actual JSX module was compiled on the server and executed in the browser.**
The server sent a compiled JavaScript bundle and separate initial-state JSON.
The module composed known UI components and used React hooks/event functions.
A real browser incremented a counter, recalculated a price and edited an input
while the authored source's terminal record was still held.

This extends the earlier [component-data stream experiment](../render-stream-research/README.md).
It does not establish OpenAI's private source language, compiler placement or
wire format. The owner quoted its native component library/compiler description;
this experiment tests one feasible implementation of that general direction.
The fixtures are authored. Actual model/provider calls: **zero**.

```text
authored JSX + known Layout/Card/Text/Input/Button library
  → server esbuild, current BaroCSS server CSS
  → complete JavaScript bundle + resource/digest manifest
  → separate initial-state JSON
  → opaque iframe, pinned React runtime
  → local useState/events/calculation
  → selected plain state → host bridge → final-authorized Save
```

## What crosses the network

| Payload | Actual path | Meaning |
| --- | --- | --- |
| Module descriptor | NDJSON module record | Identity, source/bundle digests, frame URL, initial `{count:2,name:'민지'}` |
| Executable module | `/bundle/<sha256>.js` | Server-produced JS bundle with React runtime, known UI library, hooks and event code |
| Frame document/CSS | `/frame/<sha256>.html?instanceId=...` | Nonce CSS, resource/config metadata and script link; initial state is not injected into this HTML |
| Initial state/hints | Parent → frame structured message | Plain count/name plus Save permission; current hooks remain frame-owned |
| Selected state | Frame → parent structured message | Plain count/name; closures and setters are not serialized |
| Final record | NDJSON commit + normal EOF | Allows parent admission after frame mount; preview local interaction is separate from Save |

JSX source is an input to the server compiler. The browser receives its compiled
JavaScript, not raw JSX requiring a client compiler. React Server Components are
another architecture: rendered values and client-module references are serialized.
They do not transfer server event closures as JSON. See
[React's client reference serializer](https://github.com/facebook/react/blob/612e371fb215498edde4c853bd1e0c8e9203808f/packages/react-server/src/ReactFlightServer.js#L2752),
[event-function handling](https://github.com/facebook/react/blob/612e371fb215498edde4c853bd1e0c8e9203808f/packages/react-server/src/ReactFlightServer.js#L3817)
and [esbuild's JSX transform](https://esbuild.github.io/content-types/#jsx).

The [official Intelligent UI announcement](https://openai.com/index/gpt-6-for-everyone/)
confirms native streamable components and compilation during generation. It does
not identify JSX source, executable bundles or a state wire protocol. Public
ChatKit, json-render and third-party OpenIntelligentUI are separately compared in
the predecessor [source report](../render-stream-research/RESEARCH.md).

## Run

Use Node22.19 and existing workspace dependencies. This example reuses the
predecessor's staged actual compiled public BaroCSS exports:

```sh
pnpm --filter @barocss/kit build:library
pnpm --filter @barocss/server build:library
node packages/barocss-render/build.mjs
node examples/render-stream-research/build.mjs
PLAYWRIGHT_CORE_DIR=/absolute/path/to/installed/playwright-core \
  node examples/render-jsx-research/flow.mjs
```

The isolated dependency lease/build details are in the predecessor README.
No new install/manifest/lock change is required. React/ReactDOM19.2.3,
esbuild0.25.12 and TypeScript5.9.3 were actually installed in this run.
TypeScript parses source imports; esbuild emits the bundle. Current compiled
classesFor and ServerRuntime generate the fixed library's full CSS.

```sh
node examples/render-jsx-research/serve.mjs
```

The optional authored example listens at `http://127.0.0.1:5177`. Its source is
ungated. The driver holds source termination until the browser observes and
interacts with the compiled unit; it is not a real AI latency demo.
`RESULT_ROOT` selects output; `BROWSER_CHANNEL` defaults to installed Chrome.

## Actual qualification — #1354

Parent `fc45aaeb9158523549c631a59c8cf69839acd6e1`.
Same isolated `codex/render-stream-research` checkout.
Actual Chrome155.0.8059.39, viewport1100×850, playwright-core1.60.0.

Final scoped flow **passed**: five authored source runs, six compile control
groups, eight browser milestones. Page errors0, observed CSP violations0,
external requests0. Actual model/provider calls0.

| Observation | Result |
| --- | --- |
| Before source terminal | One complete compiled unit visible; grid/gap10px/padding22px; counter2→3, price3600→5400, name→수진 |
| Isolation | Opaque frame could not read parent DOM; its messages had origin `null`, checked by contentWindow/instance/digest |
| State lifecycle | Host rerender hint count90/name `host hint` did not reset mounted hooks; count3/name수진 remained |
| Action authority | Preview Save disabled and server probe409; final+EOF+mount enabled named Save exactly once with selected count3/name수진; duplicate409 |
| Bridge boundary | Forged same-shape message from the wrong window did not alter selected state |
| Cancellation | Different-bundle preview was removed; exact previously mounted frame and hook state restored |
| Invalid JSX | Compile syntax failure produced no executable replacement; previous frame/state restored |
| New module | Changed unit price2200 produced a different bundle; new frame initialized count2/name민지 and displayed4400 |
| Pending mount cancellation | Source EOF before blocked frame script; Cancel settled start as false and restored prior frame |
| Owned disposal | Frames removed, pending mount settled, parent message listener and button entry points removed |

The counter source digest:
`c7265183c638c0e5e0faa4dd35a7cc64bb0a0837509f71085badd7cfb18b2d96`.
Bundle digest:
`29be82bb165e1f23bcab6681c8538bb7550f160030aab4689ca8751936d5be90`.
Bundle617126bytes, generated library CSS494bytes; valid stream620bytes
(module437 + final183), excluding HTTP/frame documents/compression. The bundle
is unminified and includes React. No size optimization/performance target is
claimed. Report retains versions, source/bundle hashes, actual resource request
headers, state events and original module/Save observations.

Final original artifacts: `/tmp/render-1354-jsx-final/report.json`,
`jsx-preview.png`, `jsx-new-module.png`; log
`/tmp/render-1354-jsx-final.log`. Output is ignored; committed driver and this
result make the bounded flow reproducible. Same-browser clocks describe event
ordering, not physical paint or actual inference latency.

### First failures and concrete corrections

1. Compilation/control checks passed but frame initialization timed out. The
   opaque iframe's script fetch is actually classified `Sec-Fetch-Site:
   cross-site`; the generic resource guard rejected it. Only existing
   hash-addressed public GET bundles now permit that classification. Private
   session/mutation routes retain their origin/token guards. The next actual
   request trace confirmed cross-site script requests and initialized the UI.
2. The next flow found a real recovery failure: reparenting the old iframe
   reloaded its browsing context and reset the input to민지. Keeping the iframe
   in its original DOM parent and toggling `hidden` preserved the actual hooks.
   The subsequent four-run recovery flow passed.
3. Read-only review found that disposing a frame during mount wait could leave
   the Promise pending after timeout removal. Dispose now rejects that Promise.
   The final five-run flow added a real blocked-script/EOF/Cancel case and passed.
   It also verifies owned frame/listener/button teardown.

Original failure logs/reports remain in `/tmp/render-1354-jsx-first/` and
`/tmp/render-1354-jsx-corrected/`; original successful recovery evidence is in
`/tmp/render-1354-jsx-restored/`. Failures were not replaced by final claims.

## Compiler and host boundaries

- Source≤32KiB. TypeScript JSX AST rejects foreign imports, forwarded imports,
  require and dynamic import. The esbuild virtual module boundary restricts
  imports again. A complete bundle≤2MiB is required. Six compile controls
  verified source/syntax/import/dynamic/export/digest/CSS boundaries.
- This is an authored executable-code experiment. Import restrictions are not a
  semantic/capability validator for arbitrary JavaScript. Infinite loops, CPU
  budgets, arbitrary DOM code and hostile generated programs are not qualified.
- The fixed library supplies BaroCSS classes and receives no arbitrary class/CSS
  prop. Only selected bounded count/name state crosses the bridge. The parent
  owns origin/session/action checks. Hooks/functions live inside the frame.
- A syntactically complete module is the execution unit. JSX token fragments
  are not compiled/displayed incrementally. First module availability before
  source terminal proves that boundary, not a model's generation speed.
- Same mounted module preserves hooks. New compiled module resets from declared
  initial state; arbitrary state migration is not delivered. Previous mounted
  frame stays hidden during preview. Error/cancel restores it with Save disabled
  until a new valid commit.
- A terminal source can be admitted before a cancelled client frame mounts.
  Client admission and Save enablement still require normal EOF and successful
  mount. The local server's action is once-only, in-memory, and not a durable
  transaction or multi-session API. No reconnect/retry/remount persistence.
- No training/design-quality/model cost/mobile-native/OpenAI parity, broad
  device or production release result is established.

## Package recommendation

The studies now distinguish two useful boundaries:

| Candidate | Owns | Excludes |
| --- | --- | --- |
| `@barocss/render-stream` | Component-data protocol, validated snapshot/CSS association, Fetch transport | Newly generated component code |
| `@barocss/ui-compiler` or a compiler entry | JSX/library binding, pinned runtime, bundle/style descriptor | Model/provider, credentials, application persistence/actions |
| Separate execution host | Module loading, local state lifecycle, bridge/host permissions and isolation | CSS engine/catalog duplication |

These names/APIs are proposals. **No new public package is delivered by this
example-only commit.** The JSX path can express local algorithms and events;
the declarative path retains explicit finite contract validation. Stable package
extraction must preserve that difference. The next need is a measured user case
and explicit execution contract for generated behavior, followed by an actual
provider experiment under its separately approved packet. Model training and
design evaluation remain separate from compiler feasibility.
