# #458 Codex CLI agent boundary checkpoint

This checkpoint does not launch Codex `exec` or spend a model invocation. The accepted direct API preparation remains inactive. The old frozen CLI plan and its hard live block remain unchanged. The new module only defines a candidate supported CLI permission profile, argv, and observable event summary for the revised agent workflow.

## Candidate boundary

The CLI launch must use a unique empty `agent-scratch-458-*` directory directly under `/Users/user/.barocss-ai/v3/`. Its schema copy is the only initial file in that directory. The agent prompt contains the semantic request and bounded catalog, but no repository path, evaluator, rubric, expected response, or evidence path. The host process writes the final response and event ledger outside the agent workspace. The profile has `:root=deny`, `:minimal=read`, `:tmpdir=deny`, `:slash_tmp=deny`, `:workspace_roots/.=read`, and command network disabled. It uses Codex's native permission profile, not a sandbox bypass.

The installed CLI is `codex-cli 0.156.1`; `codex login status` reports ChatGPT. These are read-only preflight observations, not a live readiness verdict. `:minimal` still grants platform runtime paths. The host process may read the schema and ChatGPT login; model-generated commands are restricted by the profile. The exact launch uses a fresh mode-0700 `CODEX_HOME` outside scratch with only a symlink to the existing ChatGPT auth file. It does not copy or print the credential. The CLI can authenticate through that reference, while the native profile denies command reads of both the reference and original auth paths. No global AGENTS, user rules, user config, plugins, or user skills are copied into this home. A no-model `codex debug prompt-input` check binds the path-normalized inventory of the five CLI built-in `.system` skills and rejects unexpected project/global instructions. CLI-created cache, tmp, and built-in skill files are allowed only after the checked startup; new instruction sources are rejected before every attempt. The isolated home is removed after all CLI streams close; the claim and run evidence remain.

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
| Read isolated auth symlink or original auth file | Deny | 1 each |
| Create file in scratch | Deny | nonzero; file absent |
| Create file in host evidence directory | Deny | nonzero; file absent |

A prior probe using scratch under `/private/tmp` without explicit temp denials **failed isolation**: a sibling temp sentinel and its symlink were readable. That placement is rejected. Even after moving scratch under the private V3 root, the profile explicitly denies `:tmpdir` and `:slash_tmp` because old study artifacts may remain in system temp. No existing artifacts were moved or deleted.

## Next gate

The launch transport, one-run claim, route-specific provenance, and consumers are implemented in separate `agent-*` modules. The live route requires a matching Review approval file and durable claim; stub/browser smoke uses a distinct synthetic route that the viewer labels synthetic. A fragmented approval denial stops the run. The transport waits for a bounded stdout/stderr drain and kills its process group before return if a stop was latched, including when a descendant ignores SIGTERM. Their exact final commit and frozen agent plan still require independent pre-live Review ACCEPT. The old CLI hard block remains unchanged. See `AGENT-CLI-RUN-PACKET.md` for the reviewed execution sequence. No model call has occurred at this checkpoint.

## Later saved-run status

An independently accepted later commit made one CLI invocation. The collector stopped on an error classification and skipped the remaining 23 scheduled cells. The original collector did not save the raw error item or stderr, so the saved run does not identify the underlying cause. The no-model collector correction described in `AGENT-CLI-RUN-PACKET.md` retains bounded private diagnostics for any separately authorized future run. The original capture and its source commit remain unchanged. No further model invocation is authorized by this correction.
