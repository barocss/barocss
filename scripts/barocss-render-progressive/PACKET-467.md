# Startup protocol correction and preparation (#467)

## Boundary

This is a host-tool correction in `scripts/barocss-render-progressive`. The renderer remains
`packages/barocss-render`. It creates no live GO, native process, model call, product API, release,
or deployment. #464 and #466 are spent; their original evidence stays intact.

## Pinned protocol and host rules

The audit uses the locally retained Codex **0.156.1** generated
[v1 initialization schema](https://github.com/openai/codex/blob/rust-v0.156.1/codex-rs/app-server-protocol/schema/json/v1/InitializeResponse.json)
and [v2 schema family](https://github.com/openai/codex/tree/rust-v0.156.1/codex-rs/app-server-protocol/schema/json/v2).
The v2 aggregate digest remains in the original frozen plan.

- Initialization requires `codexHome`, `platformFamily`, `platformOs`, and `userAgent` strings.
  The host checks the installed version and binds current-host `codexHome` to the inspected path.
  `initialized` follows the response; the old capture does not independently log that notification.
- `account/updated` and `remoteControl/status/changed` are global notifications, with no turn ID.
  Only explicit `chatgpt` auth and `disabled` remote status are allowed. Missing/null auth stops,
  although schema-valid. Remote identity must stay fixed and environment must be absent/null.
  Required remote identity strings stay private. Repeated valid notices are idempotent; at most
  64 global notices are accepted. They never reach UI delivery or grant a session/turn.
- Thread status has `threadId` and `status`, without `turnId`. During an owned pending thread/start,
  at most 16 idle/notLoaded notices are buffered and later bound to that validated response ID.
  Afterwards only the owned thread is accepted. Active status requires an owned active turn and
  empty activeFlags. System errors, approval/input flags and unowned identities stop.
- Thread/start validates required Thread fields and approved model/provider/cwd/approval/reviewer
  settings. Read-only `networkAccess` omitted means false; omitted `instructionSources` means [].
  Explicit null or unsafe values stop. Native schema makes reasoningEffort optional/nullable;
  this experiment still requires explicit `high`. Missing effort therefore remains a possible
  native stop, not a proven session setting. Optional nested snapshots are not execution telemetry.
- Thread/start requests use the sandbox-mode string; turn/start uses structured sandboxPolicy.
  Turn responses require valid ID, inProgress, full/default itemsView and allowed initial items.
  Text user input and reasoning fields are checked. Tools and unsupported input types stop.

RPC server requests, unknown/malformed notifications, duplicate starts, identity/setting drift and
final-item mismatches retain failure behavior. Source schema does not promise emission order or
prove that every extension is inert. The saved startup observation is narrower than that claim.

## Evidence

Saved-only replay reads the unchanged #466 stdout using the same initialization/global validators:
**3 frames, 1 initialize response, 2 passive notifications** pass. Native launches/model calls = 0
for this replay. Accepted sessions/completed turns/UI samples = 0. No timing or generation claim.
Private original artifact and ledger digests match their retained provenance; the consumed decision
binding is unchanged. Output is private mode 0600. Private bytes and low-entropy digests are omitted
from public records.

Authored tests cover response defaults/required fields, metadata before/after responses, duplicates,
owned status binding, malformed/unknown/active/request/unowned cases, metadata ceilings and remote
identity drift. They are source-contract L2, not new native/model evidence. Existing delivery,
action continuity, four-slot/two-session accounting and default-mode guards are retained.

## Frozen prospective packet

- Original plan: `ff9df0ba9c16c08e13a087978009ab4d3dbb6ed031620a6461d9d27493684141` (unchanged).
- Corrected current-host plan: `6a6047695f6ebb90aad9b07809af6703a00495ae148774ff2974964d2fe4d392`.
- Corrected profile: `5a8becc005729526498a0440b34f578880511fbcc75b4a9d222d1a030ad56c41`.

The profile binds the protocol module and metadata bounds; the plan records both consumed launches.
Old decisions fail candidate/plan/profile matching. Proposed limits remain two sessions, four total
reserved turns including uncertain startup, 180 seconds per turn, 720 seconds total, one launch,
no retry/fallback. Prompts, output schema, final validation and actual-vs-synthetic timing contract
are unchanged. Any future live launch needs separate exact runtime Review and new scoped authority,
private fingerprint, immutable decision and fresh canonical claim. #467 permits preparation only.
Native session creation, effective high-effort response, model generation and UI timings remain
unmeasured after this correction.

## Rerun

```sh
node scripts/barocss-render-progressive/freeze.mjs --verify
node --input-type=module -e "import {verifyCurrentHostPlan} from './scripts/barocss-render-progressive/current-host-gate.mjs'; console.log(verifyCurrentHostPlan())"
node --test scripts/barocss-render-progressive/*.test.mjs
git diff --check
```

For the private saved input, supply a fresh output filename; this command only reads saved bytes:

```sh
node scripts/barocss-render-progressive/saved-startup-replay.mjs \
  /Users/user/.barocss-ai/v3/private-464-live-466-20260930-v1/stdout.bin \
  /Users/user/.barocss-ai/v3/private-467-startup-replay-NEW.json
```

The final saved replay is private `private-467-startup-replay-20260930-v2.json`; the original
replay and preservation audit remain retained as v1 files.
Final affected harness: 107/107 no-model tests pass. Scoped lint has zero errors/warnings;
both plan checks and diff check pass. The Issue records exact independent ACCEPT and local
integration SHAs.

## Independent review correction

[The first exact Review](https://github.com/barocss/barocss/issues/467#issuecomment-5904966313)
reproduced two saved-replay gaps: replacement decoding of invalid UTF-8 and acceptance of a
success response with an `error` property carrying a falsy value. The replay now uses fatal UTF-8,
requires a complete final newline, and rejects server requests, unexpected/duplicate response IDs,
and any error property in a success response. Focused regressions cover falsy error values,
invalid bytes, partial lines, non-object messages and invalid envelopes. Live runtime, private
original bytes, plan/profile and all launch boundaries are unchanged by this follow-up fix.
