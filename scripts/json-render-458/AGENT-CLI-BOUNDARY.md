# #458 Codex CLI agent boundary checkpoint

This checkpoint does not launch Codex `exec` or spend a model invocation. The accepted direct API preparation remains inactive. The old frozen CLI plan and its hard live block remain unchanged. The new module only defines a candidate supported CLI permission profile, argv, and observable event summary for the revised agent workflow.

## Candidate boundary

The CLI launch must use a unique empty `agent-scratch-458-*` directory directly under `/Users/user/.barocss-ai/v3/`. Its schema copy is the only initial file in that directory. The agent prompt contains the semantic request and bounded catalog, but no repository path, evaluator, rubric, expected response, or evidence path. The host process writes the final response and event ledger outside the agent workspace. The profile has `:root=deny`, `:minimal=read`, `:tmpdir=deny`, `:slash_tmp=deny`, `:workspace_roots/.=read`, and command network disabled. It uses Codex's native permission profile, not a sandbox bypass.

The installed CLI is `codex-cli 0.156.1`; `codex login status` reports ChatGPT. These are read-only preflight observations, not a live readiness verdict. `:minimal` still grants platform runtime paths. The host process may read the schema and ChatGPT login; model-generated commands are restricted by the profile. The later exact launch must verify its effective profile and startup context before Review can accept it.

## No-model probes

Run `BARO_458_PROBE=1 node scripts/json-render-458/agent-boundary.test.mjs` with the installed Node 22.19.0 and Codex CLI 0.156.1. The test creates disposable harmless sentinels and invokes only `codex sandbox`; it never invokes `codex exec` or a model. The final profile produced:

| Operation | Expected | Observed exit |
| --- | --- | ---: |
| Read scratch sentinel | Allow | 0 |
| Read sibling outside scratch | Deny | 1 |
| Read repository evaluator `plan.mjs` | Deny | 1 |
| Read host evidence sentinel | Deny | 1 |
| Read system temp sentinel | Deny | 1 |
| Read outside sentinel through scratch symlink | Deny | 1 |
| Create file in scratch | Deny | nonzero; file absent |
| Create file in host evidence directory | Deny | nonzero; file absent |

A prior probe using scratch under `/private/tmp` without explicit temp denials **failed isolation**: a sibling temp sentinel and its symlink were readable. That placement is rejected. Even after moving scratch under the private V3 root, the profile explicitly denies `:tmpdir` and `:slash_tmp` because old study artifacts may remain in system temp. No existing artifacts were moved or deleted.

## Next gate

The launch transport, single-run reservation, route-specific provenance, and exact final argv are still pending. There is no live dispatch path from this checkpoint. Independent Review must accept the final exact pre-live commit and immutable plan before any of the owner's 24 authorized CLI attempts can start.
