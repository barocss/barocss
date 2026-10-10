# @barocss/render-stream

This package turns bounded JSONL screen records into complete validated screen snapshots and full CSS sheets. It also offers a demand-driven WHATWG `Response` adapter. It does not run a model, render JSX, authenticate requests, save data, or execute business actions.

## Entrypoints

```js
import { createJsonlDecoder, encodeRecord } from '@barocss/render-stream/protocol';
import { createCompiler } from '@barocss/render-stream/server';
import { createCompiledResponse } from '@barocss/render-stream/fetch';
```

The root entrypoint re-exports these functions. `/server` uses the public `@barocss/render` validation, catalog and class mapping and the public `@barocss/server` CSS runtime. The current render package has a React peer, even when a server only calls its validation functions.

The v1 input envelope has exact fields `version`, `streamId`, `revision`, `seq`, and `type`. `root` and `node` records carry complete node data. `checkpoint` and `commit` carry no payload. Sequence numbers start at 1 and increase by 1. A checkpoint must already be a complete valid screen. Each emitted preview is a detached full screen and CSS sheet. `commit` proposes a final screen; it is not authority to save.

`createCompiledResponse({ identity, contract, source, signal, includePreview, acceptFinal })` calls `source(ownedSignal)` only when the response body is pulled. The source must honor that signal. It calls `acceptFinal` once only after normal source EOF and successful decoder and compiler finishes. The host must reject stale runs and perform any durable admission atomically. An asynchronous callback may finish side effects after cancellation; the adapter cannot roll those effects back. A callback that returns `false` refuses admission.

The response is newline-delimited JSON with `application/x-ndjson`, `x-stream-id`, and `x-revision` headers. A browser must decode and validate the entire response through normal EOF before it enables actions. It must validate each received `spec` with `@barocss/render` and apply CSS only from the trusted server compiler. Preview actions stay disabled. The host retains authentication, authorization, action dispatch, persistence and retry policy.

Limits are exported as `STREAM_LIMITS`: 256 KiB input, 32 KiB input line, 256 input records, 32 nodes, 8 snapshots, 128 KiB CSS, 256 KiB output line and 2 MiB total output. Invalid UTF-8, wrong identity or sequence, unknown fields, incomplete lines, missing terminal records, and any bytes after a terminal record stop decoding.
The JSONL decoder also refuses duplicate object member names at every depth, including names that match after JSON escape decoding. A duplicate stops that decoder before it delivers the affected record. Equal names in separate objects are valid.

Run the independent authored Fetch host in `examples/render-stream-package/` to see preview, final admission, cancellation and invalid-tail handling. This is a local package build and consumer proof, not npm publication or a model-performance claim.
