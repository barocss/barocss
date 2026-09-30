# Native key-encoding correction and preparation (#465)

## Scope and observation

#464's sole actual run remains a failed initialization: one spent startup reservation, initialize-only,
zero model turns, UI observations and baseline samples. Its decision, ledger and original private
bytes are preserved. [Final #464 evidence ACCEPT](https://github.com/barocss/barocss/issues/464#issuecomment-5903933286)
accepted that bounded failure, not a working live packet.

The pinned [CLI key parser](https://github.com/openai/codex/blob/rust-v0.156.1/codex-rs/utils/cli/src/config_override.rs)
preserves key text while parsing values as TOML. Its [configuration override layer](https://github.com/openai/codex/blob/rust-v0.156.1/codex-rs/config/src/overrides.rs)
splits keys at literal dots and retains segments verbatim. TOML quoting inside that key string is
not an escaping mechanism. The former `JSON.stringify(name)` construction therefore produces a new
quote-bearing name with an enabled flag but no transport. The [typed MCP parser](https://github.com/openai/codex/blob/rust-v0.156.1/codex-rs/config/src/mcp_types.rs)
validates command/URL transport before applying the enabled flag.

## Small correction

Only names matching `^[A-Za-z0-9_-]+$` are supported. Their exact literal segments are used in
`mcp_servers.NAME.enabled=false`. Hyphens and underscores are preserved. Dots, quotes, controls,
spaces and other delimiter forms are rejected during inspection before a launch claim, reservation
or native process. This intentionally narrow grammar does not claim support for every valid TOML key.

The pinned [merge contract](https://github.com/openai/codex/blob/rust-v0.156.1/codex-rs/config/src/merge.rs)
recursively merges same-name tables. The enabled overlay therefore preserves an existing command,
URL and other transport fields; no new registration should be introduced for supported names.
An empty MCP table still does not clear inherited registrations.

No-model regressions model that pinned native key/merge contract independently of the builder.
They compare actual generated override paths against existing registrations, retain transport fields,
check false enabled flags, reproduce the old phantom entry and reject unsupported names. These are
source-contract checks; fake argv string equality and authored process success are not native proof.

## Frozen corrected proposal

`current-host-run-profile.json` now declares preparation issue 465, literal-safe-segment-v1,
the exact name grammar and rejection before claim. `current-host-plan.json` binds that profile and
records that the prior #464 launch is consumed. Existing prompts, schemas, four-slot accounting,
final-item integrity, browser contracts and default #462 guard/gate/frozen plan are retained.

The current-host decision format is still the launcher family's explicit local trust input. The
corrected candidate, plan and profile hashes differ from the spent #464 record, so that record cannot
authorize this candidate. This Issue creates no GO. A future launch proposal must have independent
exact Review, fresh concrete owner/Planner authority, a private current-host fingerprint and one new
canonical claim. Unused old slots do not permit relaunch. No real launch occurs in #465.

The proposed command remains the pinned installed Node running `launcher.mjs --current-host` with
an operator-supplied exact decision and a fresh private result directory. It is a proposal, not an
instruction to run under #465. Existing managed-policy, tool, startup-effect and no-retry limits remain.

## Verification and native gap

```sh
node scripts/barocss-render-progressive/freeze.mjs --verify
node --input-type=module -e "import {verifyCurrentHostPlan} from './scripts/barocss-render-progressive/current-host-gate.mjs'; console.log(verifyCurrentHostPlan())"
node --test scripts/barocss-render-progressive/*.test.mjs
git diff --check
```

No configuration-only native command was run. A read-only inspection of pinned
[`mcp list --json`](https://github.com/openai/codex/blob/rust-v0.156.1/codex-rs/cli/src/mcp_cmd.rs)
found configuration and auth-status paths; [auth-status computation](https://github.com/openai/codex/blob/rust-v0.156.1/codex-rs/codex-mcp/src/mcp/auth.rs)
can use an HTTP client for enabled HTTP servers. This bounded inspection did not establish the
required no-connection boundary for that candidate. No substitute native probe was attempted.

Installed native configuration compatibility remains unmeasured. Real generation, early UI and
latency remain unmeasured in #464. No app-server/model call, global/auth change, dependency download,
release or deployment occurs in this preparation. The renderer remains `packages/barocss-render`.

## Candidate verification record

- Original frozen plan: `ff9df0ba9c16c08e13a087978009ab4d3dbb6ed031620a6461d9d27493684141` (unchanged).
- Corrected current-host plan: `31dafc46de475fe7de3160e51bc5a6426e8bdadfdfbe0760b03e1d369a3ccb34`.
- Corrected run profile: `11e4608299ac6c7ff85b2ddb1af1f842e65abad9c729d09250a4cfc7db1d0656`.
- The full affected experiment harness has 80 no-model tests. All pass, including old-plan/profile
  decision rejection, default-mode rejection, reservation accounting and source-contract parsing.
- Changed JavaScript files pass scoped lint with no errors or warnings. `git diff --check` passes.
- Private host inventory, #464 decision/ledger, raw failure and `RESULT-464.md` are unchanged.

These plan/profile digests identify public experiment contracts, not private host settings or raw
failure bytes. The Issue closure records the exact independently accepted candidate and local merge.
