# Corrected current-host experiment result (#466)

## Actual bounded outcome

The fresh owner-approved experiment used exact corrected runtime
`937593ca8780e08204105785db9062df76010d05`, pinned Codex 0.156.1 and the existing CLI login.
The [independent exact runtime/packet ACCEPT](https://github.com/barocss/barocss/issues/466#issuecomment-5904304807)
preceded Planner's new immutable scoped GO. The fresh private host fingerprint matched before the
sole actual dispatch. This decision was separate from the consumed #464 decision.

Native initialization returned a response with the expected installed-version identity. The client
then recorded one `thread/start` request. It received `remoteControl/status/changed` and
`account/updated` notifications while no owned turn was active. The launcher stopped with
`Notification outside owned turn`. No validated session or model turn followed. Native session
creation remains uncertain because no `thread/start` response was accepted before cleanup.

| Actual observation | Count |
| --- | ---: |
| Owned native app-server launches | 1 |
| Consumed startup reservations, including uncertain starts | 1 |
| Recorded `initialize` requests / responses | 1 / 1 |
| Recorded `thread/start` requests / accepted responses | 1 / 0 |
| Model `turn/start` requests | 0 |
| Validated profile sessions / completed model turns | 0 / 0 |
| Accepted UI responses | 0 |
| Preview, action-ready and completion samples | 0 each |
| Same-session static baseline samples | 0 |

The original stdout contains 499 bytes in three complete JSON frames; stderr contains zero bytes.
The private ledger has one launch claim and one initial reservation. Browser observers started at
1200px and 390px but recorded zero observations, actions and baselines; their network-error list
was empty. There was no accepted response to replay. N=0 has no median, range, early-paint or latency
comparison. Whole-run elapsed time (approximately 7.640 seconds) is startup/cleanup time, not model
latency. No retry, fallback, output repair or extra call occurred.

## Diagnosis and limits

The saved pinned v2 protocol schema explicitly classifies both observed methods as
`ServerNotification` variants: `RemoteControlStatusChangedNotification` and
`AccountUpdatedNotification`. They carry global account/control metadata rather than thread/turn/item
identities. The retained notification frames have no JSON-RPC request id; they are not tool requests
or approval denial responses. Private installation/account values are excluded from public evidence.

`launcher.mjs` handles `thread/started` before requiring an active turn. All other notifications hit
that active-turn guard before metadata classification. That assumption explains this observed failure:
the host generated documented global notifications during startup, but our guard rejected them.
The schema establishes their category and shape; it does not establish their exact emission schedule
or prove every startup capability inert. No runtime correction belongs to this experiment.

This run progressed beyond the prior MCP configuration-load failure and received an initialize
response. It is not evidence of a second native transport failure, a model refusal or an automatic
approval denial. It also does not prove that every inherited registration or future host is compatible.
Actual generation, progressive UI behavior and performance remain unmeasured.

## Private provenance and remaining work

Original decision, host inventory, raw stdout, chunk/event/request records, browser report and
canonical claim/reservation remain private under the V3 evidence root. A private provenance record
retains artifact hashes for independent Review; raw-byte digests and host identities are not published.
The report binds accepted runtime, corrected plan/profile and private fingerprint. Source is
`live-app-server`, status is `failed`, and one reserved startup is consumed. The original #464 bytes,
decision and ledger are unchanged.

- Original frozen plan: `ff9df0ba9c16c08e13a087978009ab4d3dbb6ed031620a6461d9d27493684141`.
- Corrected current-host plan: `31dafc46de475fe7de3160e51bc5a6426e8bdadfdfbe0760b03e1d369a3ccb34`.
- Corrected profile: `11e4608299ac6c7ff85b2ddb1af1f842e65abad9c729d09250a4cfc7db1d0656`.

The bounded negative result is valid under #466. Unused numerical slots do not authorize another
launch. The broader realtime UI objective remains open. A separate no-model follow-up can audit
source/schema-defined notification phases with retained native bytes and realistic fixtures while
preserving unknown-message, tool-request and owned-turn identity rejection. Any further real launch
needs a separate concrete scoped decision and exact runtime review.

## Verification

The exact runtime already passed 80/80 no-model checks before and after #465 integration. This task
changes only result documentation. Its original/corrected plan checks and diff check pass:

```sh
node scripts/barocss-render-progressive/freeze.mjs --verify
node --input-type=module -e "import {verifyCurrentHostPlan} from './scripts/barocss-render-progressive/current-host-gate.mjs'; console.log(verifyCurrentHostPlan())"
git diff --check
```

Independent final evidence Review and the Issue closure record the exact evidence commit and local
merge. #466 makes no authentication/global configuration change, API-key use, dependency download,
release or deployment. The renderer remains `packages/barocss-render`.
