# Current-host experiment result (#464)

## Observed outcome

The owner-approved real dispatch used accepted candidate
`e5038a0b7232294f3e194ef0edb624ff0883e57b`, pinned Codex 0.156.1 and the existing ChatGPT CLI login.
Planner supplied the exact scoped GO after independent Review
[ACCEPT](https://github.com/barocss/barocss/issues/464#issuecomment-5903750393).
The inspected local fingerprint matched before dispatch.

The actual native app-server exited during initialization. Its stderr reported an invalid transport
in an MCP registration during effective configuration loading. The local RPC client observed EOF before an initialize response.
The private original stderr contains 58 bytes; stdout contains 0 bytes. The one-use ledger retained
one launch claim and the first reserved slot. No retry, relaunch, fallback, configuration repair or
further model call followed.

| Observation | Count |
| --- | ---: |
| Owned real app-server launch | 1 |
| Consumed reservations, including uncertain startup | 1 |
| Initialize requests | 1 |
| Model `turn/start` requests | 0 |
| Established profile sessions | 0 |
| Accepted UI responses | 0 |
| Preview, action-ready and completion samples | 0 each |
| Same-session static baseline samples | 0 |

The two viewport browser observers started, but there was no accepted response to replay or measure.
N is zero for every UI timing series, so median/min/max and latency comparisons are unavailable.
There is no finding about early UI, model latency or user value. Whole-run elapsed time is harness
startup/cleanup time and must not be reported as model latency.

## Provenance and bounds

Raw bytes, request records, browser startup reports, scoped decision and canonical ledger remain
private under the V3 evidence root. Registration names and host settings are not public evidence.
The retained report has source `live-app-server`, status `failed`, and error `RPC stdout ended`.
It binds the exact candidate, plan, run profile and inspected host fingerprint.

Independent Review checked the original artifact hashes and their decision/ledger bindings.
Host-specific raw bytes and their digests remain private.

This is the bounded execution-failure outcome permitted by #464. It is not a preparation-only
completion or a claim that every startup capability was inert. The scoped launch claim remains
consumed. The unused numerical slots do not authorize another launch.

## Verification and remaining decision

The implementation's no-model suite passed 75 tests; independent affected verification passed 44.
Those tests establish authored accounting, configuration drift and terminal/browser behavior. They
do not establish compatibility of every inherited registration with native configuration parsing.
The default #462 guard/gate/frozen plan are unchanged.

Read-only inspection found command fields in the actual inherited registrations. The failure must
not be attributed to a malformed inherited transport. The pinned [CLI config override code](https://github.com/openai/codex/blob/rust-v0.156.1/codex-rs/config/src/overrides.rs)
splits keys on literal dots and keeps each segment verbatim at the configuration layer. If the
CLI passes our `JSON.stringify(name)` path unchanged, this creates a separate quote-bearing
registration with only an enabled flag. The pinned
[native MCP parser](https://github.com/openai/codex/blob/rust-v0.156.1/codex-rs/config/src/mcp_types.rs)
rejects an entry without a command or URL before assigning that flag. This construction is consistent with the
observed configuration-load failure. Upstream CLI path normalization and installed override
compatibility need a focused check; no further native launch tested this diagnosis.

The smallest follow-up is a dedicated no-model check of native CLI key semantics and a compatible
per-process encoding. The current quoted-key encoding is not ready for another live run. Whole-table
replacement and a successful compatibility fix remain unproved. No runtime repair is part of this
bounded result, and unused numerical slots do not authorize another launch.

The broader realtime question remains open. Any native transport-compatibility work or new real run
requires a separately scoped Planner decision and a fresh reviewed packet/allowance. #464 performs no
authentication or global configuration changes, API-key use, downloads, infrastructure, release or
publication. The renderer remains `packages/barocss-render`.
