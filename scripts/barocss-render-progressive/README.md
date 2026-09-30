# Progressive UI delivery preparation (#461)

This directory is a local research host under `scripts`. The private renderer remains in
`packages/barocss-render`. No package or BaroCSS runtime API changes are proposed.

The [#462 executable packet](./EXECUTABLE-PACKET.md) documents the bounded launcher, one-use decision
claim, private evidence and authored fake-stdio verification. It remains preparation only until fresh
owner GO on the independently accepted exact launcher commit. No actual app-server was started by
the implementation tests.

The [#463 configuration inspection result](./CONFIG-INSPECTION-463.md) records the bounded
negative finding for an installed standalone resolver diagnostic. It leaves the #462 guards intact.

The [#464 current-host packet](./CURRENT-HOST-PACKET.md) defines the separately selected mode for
the owner-approved current-Mac experiment. It preserves the default #462 guard and records startup
limits explicitly.

## Capability and ownership

The installed Codex 0.156.1 app-server protocol has `item/agentMessage/delta`,
`item/completed`, `turn/completed`, `turn/start.outputSchema`, and `turn/interrupt`.
The [official app-server lifecycle](https://learn.chatgpt.com/docs/app-server) describes these
notifications and the final turn status. The locally generated v2 protocol schema is bound by
`frozen-plan.json`; it is generated without a model call.

`@json-render/core` 0.21.0 has `parseSpecStreamLine` and `createSpecStreamCompiler` for
newline-delimited `{op,path,value}` patches. The current response is one JSON object with a
`specJson` string containing a second complete JSON object. Passing its byte prefixes to the
SpecStream compiler produces no valid patches. The parser can skip malformed lines and deduplicates
identical patch lines, so it is not an integrity boundary for this response format.

The smallest host-owned change is a bounded UTF-8 and JSON-RPC buffer. It can display a **preview**
only after the accumulated outer response parses and the inner screen passes the existing
`validateSpec` contract. This is a complete candidate screen, not incremental element rendering.
The current prompt explicitly asks for a complete response and rejects patches. There is no evidence
yet that a real turn emits a usable candidate early enough to help the user.

## State and evidence contract

`delivery.mjs` accepts only one scoped process/thread/turn and one final `agentMessage` item.
It gives three distinct timestamps measured from the local turn start:

1. **Preview:** a complete candidate in accumulated text passes the screen schema. The host can
   display it. No action is dispatched.
2. **Action-ready:** the authoritative `item/completed` text exactly equals the accumulated text
   and passes the schema. Input and clicks may be collected, but an action is queued.
3. **Committed screen:** `turn/completed` reports `completed`, contains exactly the accepted final
   agent message in its authoritative `turn.items`, and the accepted item still matches.
   The host commits the screen and may release one queued action.

Cancellation, changed IDs, malformed bytes/events, duplicate terminal events, incomplete turns, and
failure keep the previous committed screen. User input stays in the host state. A duplicate action
is rejected. The action is not released if final completion fails. These are implementation safety properties, not evidence
that a model streams a screen early.

`stdio.mjs` consumes a caller-owned stdout stream and never starts a process. The browser replay
uses saved #458 complete responses and **synthetic** event chunking. Its event pacing does not
measure model latency. A passing replay needs complete layout measurements, correct state/action
behavior, no page error, no external request, no overflow, and final spec equality with the saved
output. Raw model output and screenshots stay in private V3 directories.

The reducer expects notifications already scoped to one turn. A later live app-server client must
initialize the protocol, match request responses, and route only the owned turn's notifications to
this reducer. This preparation is not a general app-server client.

## Saved-output replay result

The no-model replay of the verified #458 corpus completed 9 eligible two-turn rows; the tenth row
remains ineligible under the frozen ceiling. All 144 recorded viewport/stage screens passed the
phase, content, style, exact-spec, action, and overflow checks. Browser errors: 0. The private
report is `~/.barocss-ai/v3/private-461-browser-replay-20260930-codex-v4/report.json`, SHA-256
`f54c11d5812fbcdf1b6370968e745af399f8250f200658a638a96440a2b6efd9`. This proves
deterministic replay of saved responses, not a latency gain or genuine streaming behavior.

## No-model verification

From the repository root:

```sh
NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node
$NODE scripts/barocss-render-progressive/freeze.mjs --verify
$NODE --test scripts/barocss-render-progressive/*.test.mjs
```

The browser test also needs the installed `JR_ROOT`, `PW_DIR`, and `REPO_DEPS_ROOT` paths named
in `browser-replay.test.mjs`. The private saved-corpus replay command is documented in
`LAUNCH-PACKET.md`. It does not start Codex.

## Remaining question

Only a fresh, reviewed, bounded live run can observe genuine app-server delta timing. This
preparation must not be described as a realtime latency win. The original interaction goal remains
open even when the no-model replay passes.
