# Progressive UI delivery preparation (#461)

This directory is a local research host under `scripts`. The private renderer remains in
`packages/barocss-render`. No package or BaroCSS runtime API changes are proposed.

**Measurement stage ended at [#469](./RESULT-469.md).** Its sole fresh approved native launch
returned a session profile that the unchanged contract rejected, with zero model/UI samples.
Use the existing complete-JSON [loopback demo](../barocss-render-loop/README.md) and verified
[#458 corpus replay](../barocss-render-corpus/README.md). No further paid experiment or protocol-fix
cycle is authorized here. The [data-lineage manifest](./DATA-LINEAGE-469.json) lists actual retained
artifacts and missing stages. The historical packets below do not grant new launch authority.

The [#462 executable packet](./EXECUTABLE-PACKET.md) documents the bounded launcher, one-use decision
claim, private evidence and authored fake-stdio verification. It remains preparation only until fresh
owner GO on the independently accepted exact launcher commit. No actual app-server was started by
the implementation tests.

The [#463 configuration inspection result](./CONFIG-INSPECTION-463.md) records the bounded
negative finding for an installed standalone resolver diagnostic. It leaves the #462 guards intact.

The [#464 current-host packet](./CURRENT-HOST-PACKET.md) defines the separately selected mode for
the owner-approved current-Mac experiment. It preserves the default #462 guard and records startup
limits explicitly. The [actual #464 result](./RESULT-464.md) records one failed native
initialization, one consumed reservation and zero model/UI timing samples. No retry occurred.

The [#465 corrected proposal](./CORRECTED-PACKET-465.md) addresses native CLI key semantics with
source-contract checks only. It supplies no live GO and cannot reuse the spent #464 decision.

The [actual #466 corrected-run result](./RESULT-466.md) records successful native initialization,
one consumed startup, rejection of documented pre-turn metadata, and zero model/UI samples.
The new one-launch decision is consumed; no retry occurred.

The [#467 startup correction](./PACKET-467.md) validates narrowly scoped passive metadata and
replays the saved native startup bytes without a new process. It is preparation only; neither
spent decision authorizes a new launch. Native session/model/UI outcomes remain unmeasured.

The [#468 rate metadata correction](./PACKET-468.md) handles the source-established global
rate-limit notification before the owned-turn guard. Its sparse snapshot remains informational.
It is a separate frozen preparation packet with no native/model call or new GO.

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

The reducer expects notifications already scoped to one turn. `launcher.mjs` initializes the
protocol, matches request responses, checks session settings and routes only the owned turn's
notifications to this reducer. Its exact current-host contract did not accept the #469 native
session. It is not a general app-server client.

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

## Stage exit

Genuine app-server early-screen timing remains unmeasured. #469 has N=0, not a zero-latency result.
This measurement stage ends with the existing complete-validated-JSON delivery path. Passing saved
replay does not establish a realtime latency win, and the remaining startup gap does not authorize
a new paid experiment. See [RESULT-469.md](./RESULT-469.md) for counts and transformation boundaries.
