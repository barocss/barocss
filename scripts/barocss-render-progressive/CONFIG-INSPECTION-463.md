# Configuration-only inspection result (#463)

## Decision

**No complete, supported configuration-only inspection route was established for the installed
Codex 0.156.1 under this task's constraints.** This is a bounded negative result, not proof that
every internal diagnostic path is absent. Help inspection and package inventory do not observe
effective runtime settings or prove that startup consumers are inert.

The first prerequisite is missing, so the investigation stops here. No replacement resolver,
configuration simulation, consumer harness, changed launch profile or infrastructure is added.
The exact #462 accepted launcher and frozen plan remain unchanged. The realtime UI objective
remains open.

## Installed evidence

The installed manifests identify `@openai/codex` 0.156.1 and its Darwin ARM64 package
0.156.1-darwin-arm64. The native executable SHA-256 is
`0196e89fe5a7598f816ee54232c3d7c26d75e502ab5cfe2c9240e81d90f7255a`.
The JavaScript shim forwards arguments to that native executable. The inspected package contains
no local Rust resolver source or separate resolver-only executable. A source tag supplies useful
implementation evidence; it does not establish all effects of this installed native build.

Eleven version/help commands completed with exit code zero. Original stdout/stderr bytes, argument
lists and hashes are retained privately. The inventory did not request or emit host configuration
or authentication values. No functional candidate below was executed. Help alone does not prove
all internal file-access or side-effect behavior.

| Candidate | Installed help observation | Why it does not establish the required route |
| --- | --- | --- |
| `features list` | Lists known flags and their effective state | Only a subset; no complete settings/layer/catalog report or established startup boundary |
| `mcp list --json` | Lists configured MCP servers | Only a subset; additional registrations and startup effects remain unproven |
| `doctor --json --summary` | Diagnoses installation, config, auth and runtime | Aggregate diagnostics; no config-only selector is advertised |
| `plugin list` | Includes configured and remote marketplaces | Catalog/refresh boundary is not established |
| `debug models --bundled` | Reads the bundled model catalog without refreshing it | A catalog is not effective configuration |
| `debug prompt-input` | Renders model-visible prompt input | Not a full configuration inspection route |
| `debug app-server` | Offers a message-sending test client | Requires server activity outside the task boundary |
| `app-server` | No configuration-inspection subcommand advertised | Starting the server is prohibited in this task |

Current [official command documentation](https://learn.chatgpt.com/docs/developer-commands)
also places `/debug-config` inside an interactive session. Its documented `doctor` scope is broader
than configuration, and feature listing covers flags. These current docs corroborate the surface
observations; installed help takes precedence for version-specific syntax.

The frozen local protocol schema includes `config/read` and `experimentalFeature/list`.
They are app-server requests, not standalone commands. The
[official app-server documentation](https://learn.chatgpt.com/docs/app-server) describes configuration
RPCs. A read method does not remove the server-start boundary or establish tool inactivity.

## Source evidence supplied by Review

These findings were already established before #463; they were not repeated as new experiments.
The source version is `rust-v0.156.1`.

| Established source fact | Unresolved proof requirement |
| --- | --- |
| [Tables merge recursively; non-table values replace](https://github.com/openai/codex/blob/rust-v0.156.1/codex-rs/config/src/merge.rs) | `mcp_servers={}` does not clear inherited entries |
| [Legacy managed configuration is applied above CLI settings](https://github.com/openai/codex/blob/rust-v0.156.1/codex-rs/config/src/loader/mod.rs) | Managed/cloud requirements must remain authoritative; all inputs must be known |
| [Resolved MCP servers are filtered by their enabled state before connection](https://github.com/openai/codex/blob/rust-v0.156.1/codex-rs/codex-mcp/src/connection_manager.rs) | Every registration source must be enumerated before per-entry disabling can establish coverage |
| [Global plugin feature checks gate inspected startup paths](https://github.com/openai/codex/blob/rust-v0.156.1/codex-rs/core-plugins/src/manager.rs) | Complete plugin/hook entry-point coverage and zero refresh/download remain unproven |

Review also notes that individual plugin disabling does not establish zero refresh activity;
see the [official plugin documentation](https://developers.openai.com/plugins/build/plugins).
Notification commands, ancillary hook files, additional catalogs and unknown policy inputs
remain uncovered. No claim of a safe merged profile follows from these individual gates.

## Concrete missing capability and next decision

The missing capability is an installed-resolver diagnostic that can report complete redacted
effective settings, origins, managed constraints and registration/catalog inputs without starting
app-server, initializing a session or invoking startup consumers. Its side-effect boundary must
be demonstrated before effective-profile or zero-consumer tests can run. Reading TOML ourselves
would not supply that evidence. No download or source build is permitted by #463.

Planner can now choose whether to authorize a separate bounded diagnostic-capability investigation
or select an already owner-prepared compatible macOS environment. A version change alone is not
an isolation proof. For the latter, the concrete #462 fallback requires natural matching paths,
a clean standalone checkout at the accepted launcher HEAD, complete installed runtime/dependency
closure, normal independent owner login, no shared host config/auth mounts, and configuration/freeze/
fake-test verification before any fresh GO. Unknown or rejected managed inputs still stop the run.
An approval-bearing environment must not be cloned or reset; launch claims and reservations need
approved durable private retention outside its disposable lifecycle. Availability, login and
dependency completeness have not been established. Provisioning and live execution are not
authorized by this result.

## Reproduction and verification

Select the already installed pinned CLI as `ISSUE_463_CODEX`; do not install or change settings.
The following commands inspect syntax only. They do not test effective configuration:

```sh
"$ISSUE_463_CODEX" --version
"$ISSUE_463_CODEX" --help
"$ISSUE_463_CODEX" doctor --help
"$ISSUE_463_CODEX" features list --help
"$ISSUE_463_CODEX" mcp list --help
"$ISSUE_463_CODEX" plugin list --help
"$ISSUE_463_CODEX" debug --help
"$ISSUE_463_CODEX" debug models --help
"$ISSUE_463_CODEX" debug prompt-input --help
"$ISSUE_463_CODEX" debug app-server --help
"$ISSUE_463_CODEX" app-server --help
node scripts/barocss-render-progressive/freeze.mjs --verify
git diff --check
```

No functional configuration-only command is added to the Issue's verification block: none passed
the prerequisite. This result requires independent exact-commit Review before local integration.
