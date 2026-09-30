# Owner-approved current-host experiment (#464)

The owner approved one bounded experiment on the current Mac on 2026-09-30. This explicit mode
uses the existing ChatGPT CLI login. It does not use an API key, alter global configuration or auth,
change HOME/CODEX_HOME, install dependencies, provision infrastructure, or publish anything.
The renderer remains `packages/barocss-render`; these files are a local research host.

## Exact packet and decision

`current-host-plan.json` retains the #461 prompts, output schema, render contract and protocol
schema. It binds the separate `current-host-run-profile.json`. Model: `gpt-6.1-sol`; effort: `high`;
two independent profile sessions; at most four new turns, including failed or uncertain starts;
180 seconds per turn and 720 seconds overall. No retry, fallback or further model calls.

Independent Review must accept the exact candidate before Planner records the scoped GO. The
private operator-supplied record has kind `barocss-464-current-host-decision-v1`, issue `464`,
mode `owner-approved-current-host`, decision `GO`, exact `candidateCommit`, `planSha256`,
`runProfileSha256`, `hostFingerprintSha256`, `maxNewTurns: 4`, `ownerApprovalReference`, and
`reviewAcceptReference`. These reference strings are trust inputs, not automatic authentication.
Only the authorized operator supplies this record. Its canonical path is directly under the private
V3 root, with prefix `private-464-current-host-decision-`. Keep it mode 0600.

The canonical ledger binds owner reference, candidate and plan. An exclusive launch claim prevents
relaunch with a copied decision. The first turn is reserved **before native process initialization**;
startup uncertainty consumes that reservation. Each later session reserves its initial slot before
`thread/start` and reuses it for the initial turn. Later-turn reservations precede turn dispatch. The
report states consumed reservations separately from completed turns. A failure stops the run.

## Inspected configuration and limits

The default #462 guard, argv builder, decision gate and frozen plan remain intact. The opt-in permits
only the reviewed local registration categories: hooks, marketplaces, MCP, notify and plugins.
It hashes inspected local inputs and pinned binary identity privately, without printing configuration
values or credentials. It rejects unapproved config categories, routing or credential environment
variables, system config, and ancestor project config. It recomputes the fingerprint before spawn,
thread creation and each turn. Drift stops the run. The original #464 encoding gave each inspected MCP name a TOML-quoted
`enabled=false` override because an empty table does not clear a recursively merged table. The
[actual result](./RESULT-464.md) found this quoted-key encoding incompatible with the pinned CLI
parser. The [#465 corrected proposal](./CORRECTED-PACKET-465.md) uses only literal safe name segments
and rejects unsupported names before claim. It has not been tested by another native launch.

Fixed per-process settings disable known model tools, hooks, notification commands, plugins,
connectors and browser capabilities. Managed/cloud policy remains authoritative and is not fully
inspected. Remote catalogs are not fetched or proven complete. These controls **do not prove a
completely tool-free startup or zero startup effects**. Runtime server requests, unexpected tool
items, effective setting mismatch, identity drift or uncertain completion stop. An actual automatic
approval denial must never be bypassed.

## No-model checks

From the repository root, with the installed dependency roots used by the existing browser tests:

```sh
node scripts/barocss-render-progressive/freeze.mjs --verify
node --input-type=module -e "import {verifyCurrentHostPlan} from './scripts/barocss-render-progressive/current-host-gate.mjs'; console.log(verifyCurrentHostPlan())"
node --test scripts/barocss-render-progressive/*.test.mjs
git diff --check
```

Authored fake stdio tests do not start Codex or consume the live allowance. They cover exact binding,
copied decisions, order and accounting, pre-spawn and between-turn drift, uncertain startup, metadata
mismatch and retained final-item/browser guarantees.

## Sole reviewed live dispatch

After exact Review ACCEPT and Planner GO, from the clean accepted task worktree:

```sh
/Users/user/Library/pnpm/nodejs/22.19.0/bin/node scripts/barocss-render-progressive/launcher.mjs \
  --current-host --decision PRIVATE_464_DECISION --result FRESH_PRIVATE_464_DIRECTORY
```

The CLI derives its own clean Git HEAD and pinned Codex version. It has no runtime factory, alternate
model, configurable candidate, profile or plan option. Only exported test APIs accept authored factories.

Private evidence contains original stdout/stderr bytes, receipt offsets/times, correlated requests,
scoped events, reservations, actions, final authoritative items, 1200px/390px browser measurements and
screenshots. The static baseline uses the same accepted final response in the same session, with no
extra model turn. Report N, median and min–max separately for receipt and paint observations. No early
useful UI and an execution failure are valid bounded results. The broader realtime objective stays open.
