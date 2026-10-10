# Server-compiled component stream experiment

## Result

**The bounded server-to-browser path works.** A server assembles complete valid
component snapshots, compiles their CSS, and sends both to registered React
components. A real browser displayed a styled preview while the authored source
iterator was paused after record5 of10. Later records had not been constructed.
The browser released Save only after the final snapshot and valid response EOF.

This proves an implementation path with existing BaroCSS APIs. It does not prove
actual AI latency, generation quality, cost, OpenAI implementation equivalence,
or the need for a published package. [Source comparison](./RESEARCH.md) separately
pins five public repositories and distinguishes OpenAI's announcement from its
undisclosed implementation.

## Architecture

```text
lazy authored source (or a future provider adapter)
  → strict bounded input JSONL decoder
  → root/node assembly
  → whole RenderSpec validation at checkpoint
  → existing classesFor + ServerRuntime CSS compiler
  → complete {identity, sequence, phase, spec, css} JSONL snapshots
  → browser decoder + RenderSpec validation
  → registered React components + host-owned input
  → valid final + EOF → host Save handler
```

The server compiles component **data and CSS**. React component implementations
are installed in the host. No generated JSX, HTML, JavaScript or executable
component is downloaded. The browser does not run BrowserRuntime or a CSS
compiler. Its fixed host stylesheet covers typography and native controls.

| File | Responsibility |
| --- | --- |
| `build.mjs` | Stage actual emitted public package exports and record entry digests |
| `protocol.mjs` | UTF-8/LF framing, identities, exact fields, sequence and size limits |
| `compiler.mjs` | Assemble nodes, validate a complete graph, generate a full CSS sheet |
| `serve.mjs` | Authored source, loopback HTTP stream, host final admission and Save |
| `browser.jsx` | Registered components, preview/final lifecycle, host input and recovery |
| `flow.mjs` | One focused real-browser flow and narrow protocol/compiler controls |
| `RESEARCH.md` | Source comparisons and package choices |

## Run with existing workspace dependencies

Use Node22.19 and the repository's installed dependencies. No dependency manifest
or lockfile is added. An isolated checkout needs its own ignored dependency lease.
During this run root `node_modules` used the existing Integration installation;
`packages/barocss-server/node_modules/@barocss/kit` linked to this checkout's own
`packages/barocss`. It did not resolve to another checkout's source or dist.

```sh
pnpm --filter @barocss/kit build:library
pnpm --filter @barocss/server build:library
node packages/barocss-render/build.mjs
node examples/render-stream-research/build.mjs
```

`build.mjs` copies emitted dist files and applies each package's real
`publishConfig` export map in ignored `.build`. Native imports then resolve those
compiled exports. No source alias substitutes for a compiled API. The current
render root export also imports React; this experiment does not prove a
React-free server compiler package.

```sh
# Set this only if playwright-core is outside ordinary Node resolution.
PLAYWRIGHT_CORE_DIR=/absolute/path/to/installed/playwright-core \
  node examples/render-stream-research/flow.mjs

# Optional: a local authored example, with no model or provider.
node examples/render-stream-research/serve.mjs
```

The interactive example listens at `http://127.0.0.1:5176`. The source is ungated
there and can finish quickly. The focused driver pauses the actual lazy iterator
at the first checkpoint and pauses final admission independently. Those causal
checks demonstrate an early preview; the standalone example is not an AI timing
demo. `RESULT_ROOT` selects an absolute output directory. `BROWSER_CHANNEL`
defaults to installed Chrome. The driver closes only its own browser/server.

## Executed evidence — #1350

Parent: `0a416403b831cc3e00f2a89768919752e2653522`.
Branch: `codex/render-stream-research`.
Node22.19.0, React19.2.3, Vite8.3.1, playwright-core1.60.0,
actual Chrome **155.0.8059.39**, viewport1100×800.

The final focused driver passed: **six authored source runs, eight narrow
control groups and seven browser milestones**. Actual model/API calls: **zero**.
Page errors, observed CSP violations and external requests: **zero**.

| Observation | Actual result |
| --- | --- |
| Useful first preview | Only5/10 source records produced; source completion false; Korean title visible, grid display, gap10px, card padding22px, white background; screenshot captured |
| Preview action authority | Full form preview had disabled Save; server rejected its action with409 before final admission |
| Final edit/Save | Normal EOF enabled Save; edited `수진` reached the named host action once; duplicate Save returned409 |
| Same-source baseline | Stream emitted3 snapshots/3538 response bytes; complete mode emitted1/1259 bytes; final spec and CSS were equal |
| Cancellation | Dark replacement preview differed; current edit `혜진`, previous accepted spec and full CSS survived cancellation |
| Invalid checkpoint | Undeclared action stopped compilation; no final output; previous accepted view/CSS and current input recovered |
| Supersession | Older held source was aborted; newer commit remained visible; old identity could not Save |
| Fault injection | Coalesced valid-final + duplicate-final response was rejected; accepted view was unchanged and Save stayed disabled |

The stream response is larger because it sends full snapshots/full CSS. HTTP
headers, request bytes, compression and browser bundle bytes are excluded from
those response counts. The current production-defined host bundle is637975
bytes, unminified; no bundle/performance target was evaluated.

`report.json` stores compiled entry digests, per-run bytes/view counts, browser
events, source state and same-browser `performance.now()` observations. PNGs
capture the early preview, form preview, accepted screen and recovered screen.
The final original artifacts were written to
`/tmp/render-1350-lazy-source-final/`. Output artifacts are ignored; this README,
the driver and the Issue receipt retain the reproducible result.

Narrow controls cover split Korean UTF-8/LF, coalesced records, wrong identity and
sequence, invalid encoding, missing/incomplete/duplicate terminal, input limits,
missing child/unknown component/undeclared action, detached snapshots, compiler
finish, node/view/CSS limits and output source ordering. A same-length non-ASCII
session token is rejected with403 and the server remains usable.

### First failures and corrections

1. The first server build exited0 but reported TypeScript `TS2307` for the missing
   worktree `@barocss/kit` link. Adding that ignored local workspace link resolved
   the declaration diagnostic. The affected server rebuild passed; emitted
   public APIs were then imported successfully. Existing kit extractor/config
   warnings are not claimed fixed.
2. The first combined driver stopped before browser launch: its case-sensitive
   assertion expected `source sequence`, while the actual rejection was `Source
   sequence changed`. The assertion now matches case-insensitively.
3. The first browser attempt found22px padding; the driver incorrectly expected
   88px. Current catalog class `p-5.5` represents22px at this viewport. The
   correction is to the expectation. The next complete scoped flow passed.
4. Read-only helper review found a token byte-length exception risk. The server
   now compares encoded byte lengths before `timingSafeEqual`; the driver
   verifies403 for a non-ASCII token. The scoped corrected flow passed.
5. The initial fixture preconstructed an array. It now lazily creates records.
   The final flow explicitly asserts only5 records exist at the first useful
   preview. This strengthens the authored-source observation and still makes
   no real-model timing claim.

Original logs: `/tmp/render-1350-flow-first.log`,
`/tmp/render-1350-browser-first-failure.json`,
`/tmp/render-1350-server-build-corrected.log`,
`/tmp/render-1350-flow-reviewed.log`,
`/tmp/render-1350-flow-lazy-source-final.log`.

## Guarantees and limits

- Checkpoints contain whole valid graphs. Token fragments, partial props and
  unresolved children are not shown. The model/provider adapter must decide
  when to propose a checkpoint; it is not implemented here.
- Input supports root selection/node upserts, not general JSON Patch, node
  deletion, schema migration or arbitrary catalogs. Limits are fixed in the
  experimental protocol. Sequence/identity checks are not cryptographic proof.
- Compiler commit is a proposed final. Server input EOF/decoder/compiler success
  and current-run authority precede its committed output. Browser output EOF and
  decoder success precede action enablement. Neither EOF alone is sufficient.
- CSS is trusted output from the host compiler and finite allowed class choices.
  The browser does not sanitize arbitrary provider CSS. Applying a full sheet
  and React view in one task does not establish physical-paint atomicity.
- Draft input is host-owned. Failure/cancel restores accepted view/CSS, retaining
  current input. Generated Save stays disabled after error/cancel until a new
  valid commit. Focus, IME, arbitrary remount and reload recovery were not tested.
- The action endpoint is a once-only in-memory research handler. Durable
  transaction/idempotency, reconnect/retry, production authentication, concurrent
  sessions, provider timeout and deployment are not delivered.
- No real-model first-preview/final latency, token/billing cost, general device
  performance, physical paint, product-value or OpenAI parity result is claimed.

## Recommended next package boundary

This experiment supports a **candidate `@barocss/render-stream`** for stream
protocol and lifecycle. The current deliverable is the runnable example, not that
package. Validate a second independent host before declaring a stable public API.

| Proposed entry | Owns | Reuses / leaves to host |
| --- | --- | --- |
| `/protocol` | Bounded decoder/encoder, version, identity, ordering and terminal rules | No React, HTTP or provider SDK |
| `/server` | Incremental graph assembly, complete-valid checkpoints, CSS-associated snapshots | Existing render definition/validation and `@barocss/server`; host admission |
| Optional `/react` | Received-view lifecycle and full-sheet ownership | Existing Renderer; host draft/action/auth policy |

Provider adapters, credentials, framework routes, persistence and actual model
evaluation stay explicit host responsibilities. Do not duplicate the catalog or
CSS engine. A pure renderer validation entry would be a separate justified API
change; the current package root carries its React peer. A json-render adapter
is useful when actual json-render interoperability is required. ChatKit and
arbitrary-code sandbox adapters require their own demonstrated host need.

The next research gate is reuse in a second host with the same admission,
state/action and cancellation guarantees. Actual AI performance qualification
is separate from package extraction. Native completion, Integration adoption,
integrated verification and publication remain separate states.
