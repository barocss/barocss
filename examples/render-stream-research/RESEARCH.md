# Progressive UI: source comparison and package boundary

Source inspection date: 2026-10-11 (Asia/Seoul). This document records source
behavior and a proposed BaroCSS boundary. It does not establish OpenAI's private
Intelligent UI protocol or account access. No model or provider API was called
for this research. Experimental validation results belong in the
[experiment README](./README.md) and its report, separately from source findings.

## Result

Three public approaches solve different parts of progressive UI:

1. **json-render:** reduce streamed JSON patches into a declarative component
   specification, then use a registered renderer. Its compiler is a library
   operation, not a server-only React code compiler.
2. **ChatKit Python:** construct widget objects on the server, compare successive
   widget roots, and send typed JSON events over SSE. The public JavaScript
   repository supplies types and React bindings; it does not expose the core
   Web Component renderer/parser implementation.
3. **OpenIntelligentUI / CopilotKit:** convert streamed tool arguments containing
   HTML, CSS and JavaScript into activity updates. A browser sandbox renders and
   runs that content. This is a separate third-party implementation.

For BaroCSS, a server compiler that emits validated component data is a plausible
design. These sources do not require the server to send newly compiled component
JavaScript. Existing registered components and BaroCSS style processing can
remain the rendering targets.

## Pinned source set

| Project | Inspected commit | License at that commit | Scope |
| --- | --- | --- | --- |
| json-render | `fc2a696a50a30cb30c878ab1eb65e102487eea0f` | [Apache-2.0](https://github.com/vercel-labs/json-render/blob/fc2a696a50a30cb30c878ab1eb65e102487eea0f/LICENSE) | Core compiler, React streaming/renderer/schema, package boundary |
| ChatKit Python | `dacc133c280b39b9334d06ea73f0f1c199e59927` | [Apache-2.0](https://github.com/openai/chatkit-python/blob/dacc133c280b39b9334d06ea73f0f1c199e59927/LICENSE) | Server diff/streaming, widget and action models, templates |
| ChatKit JavaScript | `22613848a656077a408788f028c7727e38d10449` | [Apache-2.0](https://github.com/openai/chatkit-js/blob/22613848a656077a408788f028c7727e38d10449/LICENSE) | React binding, types, documented external Web Component script |
| OpenIntelligentUI | `f6e4388b26a64b9a0714943b08a1ce622b924eec` | [MIT](https://github.com/CopilotKit/OpenIntelligentUI/blob/f6e4388b26a64b9a0714943b08a1ce622b924eec/LICENSE) | Runtime integration, browser sandbox renderer, MCP document assembly |
| CopilotKit | `04bc56aeff506d8d529fe3ebd4b1b442c49fdee5` | [MIT](https://github.com/CopilotKit/CopilotKit/blob/04bc56aeff506d8d529fe3ebd4b1b442c49fdee5/LICENSE) | Public incremental argument parser and activity middleware |

The inspected CopilotKit shared package declares version `1.78.0`.
OpenIntelligentUI's inspected application instead pins CopilotKit packages to
`1.55.2-next.1`. These are independent source snapshots. Their compatibility,
identical behavior and resolved installed implementation were not verified.
See the [CopilotKit manifest](https://github.com/CopilotKit/CopilotKit/blob/04bc56aeff506d8d529fe3ebd4b1b442c49fdee5/packages/shared/package.json#L1)
and [OpenIntelligentUI manifest](https://github.com/CopilotKit/OpenIntelligentUI/blob/f6e4388b26a64b9a0714943b08a1ce622b924eec/apps/app/package.json#L12).

## OpenAI: confirmed and undisclosed boundaries

The [official Intelligent UI announcement](https://openai.com/index/gpt-6-for-everyone/)
confirms a native streamable component library, a compiler that processes the
interface during model generation, and progressive display before the entire
response is complete. It also describes training for content, layout and
interaction decisions.

The announcement does not specify the compiler's execution location, the model's
source language, the network representation, component identity rules, partial
validation policy, state/action authority, or a distributable compiler/API.
Official documentation searches and the reviewed GPT-6/streaming guides did not
establish those details. This is a limit of the reviewed evidence, not proof that
no internal or future interface exists.

The [public Responses streaming guide](https://developers.openai.com/api/docs/guides/streaming-responses)
documents SSE and typed response events. It does not establish an Intelligent UI
component protocol. The [public ChatKit guide](https://developers.openai.com/api/docs/guides/custom-chatkit)
documents server-produced widgets, streaming and actions. No reviewed source
connects its protocol to Intelligent UI's private compiler.

The [public MCP Apps implementation guide](https://developers.openai.com/plugins/build/chatgpt-ui)
also documents bundling developer-authored React into JavaScript, serving it in
an HTML resource, and running it in a client iframe. This is an explicit public
server/resource path. It is not evidence that Intelligent UI uses that path.

## Source-backed behavior

### json-render

**Input and processing location.** The React schema uses a root key and a flat
elements map, with component types, props and child references. Components and
actions come from a catalog. The core exports `parseSpecStreamLine`,
`applySpecStreamPatch`, `compileSpecStream` and `createSpecStreamCompiler`.
The compiler can be called wherever that library runs. The reviewed React hook
applies the incoming patches in the browser.
Sources: [schema](https://github.com/vercel-labs/json-render/blob/fc2a696a50a30cb30c878ab1eb65e102487eea0f/packages/react/src/schema.ts#L10),
[core exports](https://github.com/vercel-labs/json-render/blob/fc2a696a50a30cb30c878ab1eb65e102487eea0f/packages/core/src/index.ts#L48),
[React stream hook](https://github.com/vercel-labs/json-render/blob/fc2a696a50a30cb30c878ab1eb65e102487eea0f/packages/react/src/hooks.ts#L265).

**Framing and completion.** SpecStream is newline-delimited JSON patch data.
The streaming compiler buffers incomplete lines, applies complete patches in
arrival order, and suppresses identical trimmed lines. `getResult()` tries the
remaining buffer and clears it. The reviewed compiler has no separate committed
terminal event. The React hook treats successful response-body EOF as completion.
The mixed parser also supports spec fences beside text.
Sources: [compiler](https://github.com/vercel-labs/json-render/blob/fc2a696a50a30cb30c878ab1eb65e102487eea0f/packages/core/src/types.ts#L866),
[mixed parser](https://github.com/vercel-labs/json-render/blob/fc2a696a50a30cb30c878ab1eb65e102487eea0f/packages/core/src/types.ts#L978),
[hook completion](https://github.com/vercel-labs/json-render/blob/fc2a696a50a30cb30c878ab1eb65e102487eea0f/packages/react/src/hooks.ts#L317).

**Partial validation.** The line parser only requires a truthy operation and a
defined path after JSON parsing. The reducer supports six patch operations;
`replace` deliberately tolerates a missing target. This processing does not call
catalog validation. A separate `catalog.validate()` uses Zod. Structural
`validateSpec()` checks tree references and placement problems. The React renderer
can skip missing children and use a fallback for unknown components; loading
suppresses missing-child warnings. Partial rendering is therefore not proof that
the completed tree satisfies the application's contract.
Sources: [parser/reducer](https://github.com/vercel-labs/json-render/blob/fc2a696a50a30cb30c878ab1eb65e102487eea0f/packages/core/src/types.ts#L587),
[catalog validation](https://github.com/vercel-labs/json-render/blob/fc2a696a50a30cb30c878ab1eb65e102487eea0f/packages/core/src/schema.ts#L460),
[structural validation](https://github.com/vercel-labs/json-render/blob/fc2a696a50a30cb30c878ab1eb65e102487eea0f/packages/core/src/spec-validator.ts#L66),
[renderer](https://github.com/vercel-labs/json-render/blob/fc2a696a50a30cb30c878ab1eb65e102487eea0f/packages/react/src/renderer.tsx#L650).

**Styles, state and actions.** Actual component rendering and styles are supplied
through the host registry. Props can resolve state expressions. The React schema
declares built-in state and form actions, and its action context resolves state
references. This permits a broader model/state relationship than the current
BaroCSS example's host-owned input contract. An adapter must preserve BaroCSS's
permissions rather than importing the other project's defaults.
Sources: [registry](https://github.com/vercel-labs/json-render/blob/fc2a696a50a30cb30c878ab1eb65e102487eea0f/packages/react/src/renderer.tsx#L1070),
[state/action schema](https://github.com/vercel-labs/json-render/blob/fc2a696a50a30cb30c878ab1eb65e102487eea0f/packages/react/src/schema.ts#L57),
[action context](https://github.com/vercel-labs/json-render/blob/fc2a696a50a30cb30c878ab1eb65e102487eea0f/packages/react/src/contexts/actions.tsx#L36).

**Package boundary.** Core `0.21.0` depends on Zod 4 and does not require React.
Renderers and TanStack Start helpers are separate packages. The TanStack server
entry explicitly avoids React/router imports. The codegen package exports tree
traversal and serialization utilities; that entry does not provide a complete
live server-to-component compiler.
Sources: [core manifest](https://github.com/vercel-labs/json-render/blob/fc2a696a50a30cb30c878ab1eb65e102487eea0f/packages/core/package.json),
[TanStack server entry](https://github.com/vercel-labs/json-render/blob/fc2a696a50a30cb30c878ab1eb65e102487eea0f/packages/tanstack-start/src/server.ts),
[codegen entry](https://github.com/vercel-labs/json-render/blob/fc2a696a50a30cb30c878ab1eb65e102487eea0f/packages/codegen/src/index.ts).

### ChatKit Python and JavaScript

**Server-produced component data.** `stream_widget()` takes a widget root or an
async generator of roots. A single root becomes an item-done event. A generator
produces an initial item-added event, typed updates from `diff_widget()`, then an
item-done event with the last root. This server emits JSON component descriptions,
not a new JavaScript component bundle.
Source: [server widget diff and stream](https://github.com/openai/chatkit-python/blob/dacc133c280b39b9334d06ea73f0f1c199e59927/chatkit/server.py#L101).

**Framing, ordering and terminal conditions.** The server encodes events as SSE
data frames containing serialized JSON. Update kinds include cumulative text
deltas, root replacement and component replacement. Text delta calculation
requires matching existing IDs and a cumulative text prefix when that diff path
is used. A structural/property change can instead produce root replacement.
`thread.item.done` completes an item; it is not a universal successful-run marker.
The enclosing stream can emit errors or handle cancellation separately, and it
persists done items through the host store.
Sources: [SSE encoding](https://github.com/openai/chatkit-python/blob/dacc133c280b39b9334d06ea73f0f1c199e59927/chatkit/server.py#L532),
[event types](https://github.com/openai/chatkit-python/blob/dacc133c280b39b9334d06ea73f0f1c199e59927/chatkit/types.py#L368),
[widget update types](https://github.com/openai/chatkit-python/blob/dacc133c280b39b9334d06ea73f0f1c199e59927/chatkit/types.py#L520),
[store/error/cancellation path](https://github.com/openai/chatkit-python/blob/dacc133c280b39b9334d06ea73f0f1c199e59927/chatkit/server.py#L838).

**Validation boundary.** Typed widget classes expose Pydantic validation, but
the public union also accepts `DynamicWidgetComponent` with extra fields and
dynamic types. `DynamicWidgetRoot` restricts root types while keeping dynamic
children. `WidgetTemplate.build()` renders Jinja into JSON and validates that
dynamic root shape. Its constructor stores `jsonSchema`; the reviewed build and
normalization methods do not enforce that stored schema. This is not a strict
catalog/props gate. The closed client runtime may impose additional checks that
these public sources do not reveal.
Source: [dynamic models and template building](https://github.com/openai/chatkit-python/blob/dacc133c280b39b9334d06ea73f0f1c199e59927/chatkit/widgets.py#L1062).

**Styles, state and actions.** Widget classes include theme tokens and some CSS
string/spacing values. Forms and buttons carry declarative actions. `ActionConfig`
selects a client or server handler, defaults to server, and carries payload and
loading behavior. ChatKit JavaScript exposes widget action callbacks and a custom
API URL/fetch interface. It does not expose BaroCSS's binding or style contract.
Sources: [Card/Form properties](https://github.com/openai/chatkit-python/blob/dacc133c280b39b9334d06ea73f0f1c199e59927/chatkit/widgets.py#L264),
[action model](https://github.com/openai/chatkit-python/blob/dacc133c280b39b9334d06ea73f0f1c199e59927/chatkit/actions.py#L14),
[JavaScript action options](https://github.com/openai/chatkit-js/blob/22613848a656077a408788f028c7727e38d10449/packages/chatkit/types/index.d.ts#L202).

**Package visibility.** Python `openai-chatkit` `1.6.5` requires Python 3.10+ and
Pydantic, Uvicorn, OpenAI, Agents SDK and Jinja2. The JavaScript repository's
`@openai/chatkit` is described as type declarations. Its React binding configures
an already-defined `openai-chatkit` element. The setup loads its implementation
from an OpenAI CDN. Public type/wrapper source does not provide a source-complete
independent widget renderer.
Sources: [Python manifest](https://github.com/openai/chatkit-python/blob/dacc133c280b39b9334d06ea73f0f1c199e59927/pyproject.toml#L1),
[types package README](https://github.com/openai/chatkit-js/blob/22613848a656077a408788f028c7727e38d10449/packages/chatkit/README.md),
[React binding](https://github.com/openai/chatkit-js/blob/22613848a656077a408788f028c7727e38d10449/packages/chatkit-react/src/ChatKit.tsx#L40),
[CDN setup](https://github.com/openai/chatkit-js/blob/22613848a656077a408788f028c7727e38d10449/README.md#L48).

### OpenIntelligentUI / CopilotKit: separate reference implementation

**Processing path.** OpenIntelligentUI's Next.js server enables CopilotKit's
`openGenerativeUI`. In the separately pinned CopilotKit source, a Clarinet-based
incremental parser reads `generateSandboxedUi` tool arguments and emits activity
snapshots and JSON patch deltas. It creates the snapshot before dependent deltas.
Complete CSS, HTML and JavaScript fields carry completion flags. Tool-call end
sets the activity's generating flag to false. Parser errors are resumed, so that
flag does not establish application-specific semantic validation.
Sources: [runtime options](https://github.com/CopilotKit/OpenIntelligentUI/blob/f6e4388b26a64b9a0714943b08a1ce622b924eec/apps/app/src/lib/copilotkit-runtime-options.ts#L24),
[argument parser and activity framing](https://github.com/CopilotKit/CopilotKit/blob/04bc56aeff506d8d529fe3ebd4b1b442c49fdee5/packages/shared/src/event-transforms/open-generative-ui-middleware.ts#L38),
[tool/run terminal handling](https://github.com/CopilotKit/CopilotKit/blob/04bc56aeff506d8d529fe3ebd4b1b442c49fdee5/packages/shared/src/event-transforms/open-generative-ui-middleware.ts#L266).

**Browser execution and component model.** The OpenIntelligentUI renderer gates
its preview on CSS completion, handles partial HTML in the browser, then creates
a final Websandbox frame. JavaScript functions are injected and expressions run
in arrival order. Its activity schema permits optional fields during generation;
it is not a catalog of validated native component props. This is generated
HTML/CSS/JavaScript execution, with a different state/action and isolation model.
Sources: [activity schema](https://github.com/CopilotKit/OpenIntelligentUI/blob/f6e4388b26a64b9a0714943b08a1ce622b924eec/apps/app/src/components/generative-ui/open-generative-ui/schema.ts#L8),
[preview](https://github.com/CopilotKit/OpenIntelligentUI/blob/f6e4388b26a64b9a0714943b08a1ce622b924eec/apps/app/src/components/generative-ui/open-generative-ui/renderer.tsx#L148),
[sandbox and scripts](https://github.com/CopilotKit/OpenIntelligentUI/blob/f6e4388b26a64b9a0714943b08a1ce622b924eec/apps/app/src/components/generative-ui/open-generative-ui/renderer.tsx#L279).

**Optional server assembler.** The MCP `assembleDocument()` function interpolates
an HTML fragment into a document with shared CSS and bridge scripts. It is a
real server-side document assembly path, separate from the streaming web app.
It does not compile a component catalog, validate native props, or return a
new framework component bundle.
Source: [MCP assembler](https://github.com/CopilotKit/OpenIntelligentUI/blob/f6e4388b26a64b9a0714943b08a1ce622b924eec/apps/mcp/src/renderer.ts#L32).

## Options for BaroCSS

| Option | Useful contract | Cost or unresolved work | Choose when |
| --- | --- | --- | --- |
| Existing complete-spec path | Current validation and host state/action boundary | Useful UI waits for a complete valid candidate | Baseline and final commit target |
| json-render adapter | Public patch/compiler/catalog ecosystem and renderer separation | Need explicit final validity, patch ordering/identity, partial props, and BaroCSS permission/style mapping; Zod 4 dependency | Interchange with actual json-render producers is required |
| ChatKit adapter | Public server widgets, SSE events and action interface | Python backend dependencies, different schema/styles, external client runtime; dynamic server validation is not a strict catalog gate | Interoperability with a ChatKit client is required |
| CopilotKit/OpenIntelligentUI sandbox path | Rich arbitrary interactive HTML and agent activity protocol | Different execution/state/action model and sandbox/runtime dependencies; inspected versions differ | Arbitrary code-based generated tools are an explicit product requirement |
| Own component stream compiler | Server can lower bounded input into renderer data; reuse BaroCSS components, validation and styles | Need a small explicit stream protocol, progressive validity policy and terminal handling | Current BaroCSS host requires progressive component delivery and the focused experiment proves it useful |

## Conditional package recommendation

If the experiment demonstrates a reusable need across hosts, create a separate
internal package such as **`@barocss/render-stream`**. That name and the following
entry points are proposals, not delivered public APIs.

- A pure compiler/protocol entry takes bounded component data, tracks identity
  and ordering, and returns validated preview/terminal data.
- A server entry encodes those records for a selected transport. Model providers,
  credentials and framework routes stay outside the compiler package.
- The consumer reuses `@barocss/render` for registered components and the existing
  definition/validation/style authority. It does not duplicate the component
  catalog or create a second CSS engine.
- Partial props and unresolved child references remain explicit. A usable preview
  is a separate state from a fully validated accepted screen. Host state writes
  and actions require the existing host permission and lifecycle rules.
- Final success, failure and cancellation need explicit outcomes. Transport EOF,
  a tolerant parser result or a generation flag alone must not imply a valid
  committed screen.

An external dependency is justified by an interoperability requirement or a
measured missing capability, rather than by the word compiler. A json-render
adapter may justify its core/Zod dependency. A ChatKit host justifies its SDK and
runtime. An arbitrary-code sandbox justifies a separate execution boundary.
For a bounded BaroCSS component stream, existing renderer contracts plus a small
own compiler can be tested without adopting those full stacks.

The experiment must determine the needed boundary. This document makes no
latency, visual-quality, runtime compatibility, package delivery or release claim.
